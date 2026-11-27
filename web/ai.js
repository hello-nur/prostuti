/* Prostuti — Gemini (free tier) client.
   In the Android app, requests go through the native bridge (window.AndroidBridge) so there are no CORS limits.
   In a normal browser it falls back to fetch(). */
window.AI = (function () {
  const BASE = "https://generativelanguage.googleapis.com/v1beta";
  const DEFAULT_MODEL = "gemini-flash-latest";
  let cbSeq = 0;
  const pending = {};

  // Called by the Android side: status code + base64(UTF-8 body)
  window.__bridgeCb = function (id, status, b64) {
    const p = pending[id]; if (!p) return; delete pending[id];
    let text = "";
    try {
      const bin = atob(b64 || "");
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      text = new TextDecoder("utf-8").decode(bytes);
    } catch (e) { text = ""; }
    p({ status: status, text: text });
  };

  function http(method, url, key, body) {
    if (window.AndroidBridge && window.AndroidBridge.request) {
      return new Promise(function (resolve) {
        const id = "r" + (++cbSeq);
        pending[id] = resolve;
        window.AndroidBridge.request(id, method, url, key, body || "");
        setTimeout(function () { if (pending[id]) { delete pending[id]; resolve({ status: 0, text: "timeout" }); } }, 90000);
      });
    }
    const ctl = new AbortController();
    const t = setTimeout(function () { ctl.abort(); }, 90000);
    return fetch(url, {
      method: method,
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: method === "POST" ? body : undefined,
      signal: ctl.signal
    }).then(function (r) { return r.text().then(function (t2) { clearTimeout(t); return { status: r.status, text: t2 }; }); })
      .catch(function (e) { clearTimeout(t); return { status: 0, text: String(e && e.message || e) }; });
  }

  function errMsg(res) {
    if (res.status === 0) return "NETWORK";
    try { const j = JSON.parse(res.text); return (j.error && j.error.message) || ("HTTP " + res.status); }
    catch (e) { return "HTTP " + res.status; }
  }

  // All usable Flash models for this key, best first (model names change often, so we ask Google).
  let modelCache = null;
  async function listModels(key) {
    if (modelCache) return modelCache;
    const res = await http("GET", BASE + "/models?pageSize=200", key);
    if (res.status !== 200) throw new Error(errMsg(res));
    const all = (JSON.parse(res.text).models || []).filter(function (m) {
      const n = m.name || "";
      return (m.supportedGenerationMethods || []).indexOf("generateContent") >= 0 &&
        /(flash|gemma)/.test(n) && !/(image|tts|live|audio|embed|vision|transcribe|translate|native)/.test(n);
    });
    const ver = function (n) { const m = n.match(/(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : 0; };
    const rank = function (n) { return (/gemma/.test(n) ? 4 : 0) + (/(preview|exp)/.test(n) ? 2 : 0) + (/lite/.test(n) ? 1 : 0); };
    all.sort(function (a, b) { return (rank(a.name) - rank(b.name)) || (ver(b.name) - ver(a.name)); });
    modelCache = all.map(function (m) { return m.name.replace(/^models\//, ""); });
    return modelCache;
  }
  async function discoverModel(key) { const l = await listModels(key); if (!l.length) throw new Error("No model available"); return l[0]; }
  const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  async function generate(opts) {
    // opts: {key, model, system, prompt, history:[{role,text}], json:bool, schema, temperature, onModel}
    if (!opts.key) throw new Error("NOKEY");
    const contents = (opts.history || []).map(function (h) { return { role: h.role === "user" ? "user" : "model", parts: [{ text: h.text }] }; });
    contents.push({ role: "user", parts: [{ text: opts.prompt }] });
    const body = { contents: contents, generationConfig: { temperature: opts.temperature == null ? 0.7 : opts.temperature } };
    if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };
    if (opts.json) {
      body.generationConfig.responseMimeType = "application/json";
      if (opts.schema) body.generationConfig.responseSchema = opts.schema;
    }
    const send = function (m) {
      let b = body;
      if (/gemma/.test(m)) { // Gemma models: no system field / JSON mode, so fold them into the prompt
        const c = JSON.parse(JSON.stringify(contents));
        const last = c[c.length - 1].parts[0];
        last.text = (opts.system ? opts.system + "\n\n" : "") + last.text + (opts.json ? "\n\nReply with ONLY valid JSON, no other text." : "");
        b = { contents: c, generationConfig: { temperature: body.generationConfig.temperature } };
      }
      return http("POST", BASE + "/models/" + encodeURIComponent(m) + ":generateContent", opts.key, JSON.stringify(b));
    };
    const isBusy = function (r) { return r.status === 503 || r.status === 500 || r.status === 502 || r.status === 504 || (r.status === 0 && r.text === "timeout"); };
    const isModelErr = function (r) { return r.status === 404 || (r.status === 400 && /model/i.test(r.text) && !/API key/i.test(r.text)); };

    const queue = [opts.model || DEFAULT_MODEL];
    const tried = {};
    let listed = false, res = null, used = null, sawRate = false, sawBusy = false;
    for (let step = 0; step < 8; step++) {
      let m = null;
      for (let i = 0; i < queue.length; i++) if (!tried[queue[i]]) { m = queue[i]; break; }
      if (!m) {
        if (listed) break;
        listed = true;
        try { (await listModels(opts.key)).forEach(function (x) { if (queue.indexOf(x) < 0) queue.push(x); }); } catch (e) { break; }
        continue;
      }
      tried[m] = true;
      res = await send(m);
      if (isBusy(res)) { await sleep(1200); res = await send(m); }
      if (res.status === 200) { used = m; break; }
      if (res.status === 0 && res.text !== "timeout") throw new Error("NETWORK");
      if (/API key not valid|API_KEY_INVALID|API key expired/i.test(res.text) || res.status === 401) throw new Error("BADKEY");
      if (res.status === 429) { sawRate = true; continue; }
      if (isBusy(res)) { sawBusy = true; continue; }
      if (isModelErr(res) || res.status === 403) continue;
      throw new Error(errMsg(res)); // a real bad request: don't hammer other models
    }
    if (!used) {
      if (sawBusy) throw new Error("BUSY");
      if (sawRate) throw new Error("RATE");
      if (res && /PERMISSION_DENIED/i.test(res.text)) throw new Error("BADKEY");
      throw new Error(res ? errMsg(res) : "No model available");
    }
    if (used !== opts.model && opts.onModel) opts.onModel(used);
    const j = JSON.parse(res.text);
    const cand = j.candidates && j.candidates[0];
    const parts = (cand && cand.content && cand.content.parts) || [];
    const text = parts.filter(function (p) { return !p.thought && p.text; }).map(function (p) { return p.text; }).join("");
    if (!text) throw new Error((cand && cand.finishReason) ? "Blocked: " + cand.finishReason : "Empty response");
    if (!opts.json) return text;
    return parseJSON(text);
  }

  function parseJSON(text) {
    try { return JSON.parse(text); } catch (e) {}
    const m = text.match(/[\[{][\s\S]*[\]}]/);
    if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
    throw new Error("Bad JSON from AI");
  }

  const MCQ_SCHEMA = {
    type: "ARRAY",
    items: {
      type: "OBJECT",
      properties: {
        q: { type: "STRING" },
        options: { type: "ARRAY", items: { type: "STRING" } },
        answer: { type: "INTEGER" },
        explanation: { type: "STRING" }
      },
      required: ["q", "options", "answer", "explanation"]
    }
  };

  const CQ_SCHEMA = {
    type: "OBJECT",
    properties: {
      stem: { type: "STRING" },
      parts: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: { label: { type: "STRING" }, question: { type: "STRING" }, marks: { type: "INTEGER" }, answer: { type: "STRING" } },
          required: ["label", "question", "marks", "answer"]
        }
      }
    },
    required: ["stem", "parts"]
  };

  return { generate: generate, discoverModel: discoverModel, MCQ_SCHEMA: MCQ_SCHEMA, CQ_SCHEMA: CQ_SCHEMA, DEFAULT_MODEL: DEFAULT_MODEL, isNative: function () { return !!window.AndroidBridge; } };
})();
