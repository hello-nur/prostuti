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

  // Pick a working Flash model from the account's model list (model names change often).
  async function discoverModel(key) {
    const res = await http("GET", BASE + "/models?pageSize=200", key);
    if (res.status !== 200) throw new Error(errMsg(res));
    const all = (JSON.parse(res.text).models || []).filter(function (m) {
      const n = m.name || "";
      return (m.supportedGenerationMethods || []).indexOf("generateContent") >= 0 &&
        /flash/.test(n) && !/(image|tts|live|audio|embed|vision|transcribe|translate)/.test(n);
    });
    let list = all.filter(function (m) { return !/(preview|exp)/.test(m.name); });
    if (!list.length) list = all;
    if (!list.length) throw new Error("No Flash model available for this key");
    const ver = function (n) { const m = n.match(/gemini-(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : 0; };
    list.sort(function (a, b) {
      const la = /lite/.test(a.name) ? 1 : 0, lb = /lite/.test(b.name) ? 1 : 0;
      return (ver(b.name) - ver(a.name)) || (la - lb);
    });
    return list[0].name.replace(/^models\//, "");
  }

  async function generate(opts) {
    // opts: {key, model, system, prompt, history:[{role,text}], json:bool, schema, temperature, onModel}
    if (!opts.key) throw new Error("NOKEY");
    let model = opts.model || DEFAULT_MODEL;
    const contents = (opts.history || []).map(function (h) { return { role: h.role === "user" ? "user" : "model", parts: [{ text: h.text }] }; });
    contents.push({ role: "user", parts: [{ text: opts.prompt }] });
    const body = { contents: contents, generationConfig: { temperature: opts.temperature == null ? 0.7 : opts.temperature } };
    if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };
    if (opts.json) {
      body.generationConfig.responseMimeType = "application/json";
      if (opts.schema) body.generationConfig.responseSchema = opts.schema;
    }
    const send = function (m) { return http("POST", BASE + "/models/" + encodeURIComponent(m) + ":generateContent", opts.key, JSON.stringify(body)); };
    let res = await send(model);
    if (res.status === 404 || (res.status === 400 && /model/i.test(res.text) && !/API key/i.test(res.text))) {
      model = await discoverModel(opts.key);
      if (opts.onModel) opts.onModel(model);
      res = await send(model);
    }
    if (res.status !== 200) {
      const m = errMsg(res);
      if (res.status === 429) throw new Error("RATE");
      if (/API key not valid|API_KEY_INVALID|PERMISSION_DENIED/i.test(res.text)) throw new Error("BADKEY");
      throw new Error(m);
    }
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
