/* Prostuti — free AI client: Groq (fast, generous free tier) + Google Gemini (free tier).
   The app tries Groq first (if a Groq key is set), then Gemini, and switches automatically
   when one is busy, out of free quota or slow.
   In the Android app, requests go through the native bridge (window.AndroidBridge) so there are
   no CORS limits. In a normal browser it falls back to fetch(). */
window.AI = (function () {
  const GEMINI = "https://generativelanguage.googleapis.com/v1beta";
  const GROQ = "https://api.groq.com/openai/v1";
  const DEFAULT_MODEL = "gemini-flash-latest";
  const GROQ_MODELS = ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "openai/gpt-oss-20b", "qwen/qwen3-32b"];
  let cbSeq = 0;
  const pending = {};
  const cooldown = {}; // provider -> time until which we skip it (after quota / overload errors)

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

  function http(method, url, key, body, tmo) {
    tmo = tmo || 25000;
    if (window.AndroidBridge && window.AndroidBridge.request) {
      return new Promise(function (resolve) {
        const id = "r" + (++cbSeq);
        pending[id] = resolve;
        window.AndroidBridge.request(id, method, url, key, body || "");
        setTimeout(function () { if (pending[id]) { delete pending[id]; resolve({ status: 0, text: "timeout" }); } }, tmo);
      });
    }
    const ctl = new AbortController();
    const t = setTimeout(function () { ctl.abort(); }, tmo);
    const headers = { "Content-Type": "application/json" };
    if (url.indexOf(GROQ) === 0) headers.Authorization = "Bearer " + key; else headers["x-goog-api-key"] = key;
    return fetch(url, { method: method, headers: headers, body: method === "POST" ? body : undefined, signal: ctl.signal })
      .then(function (r) { return r.text().then(function (t2) { clearTimeout(t); return { status: r.status, text: t2 }; }); })
      .catch(function (e) { clearTimeout(t); return { status: 0, text: (e && e.name === "AbortError") ? "timeout" : String(e && e.message || e) }; });
  }

  function errMsg(res) {
    if (res.status === 0) return res.text === "timeout" ? "BUSY" : "NETWORK";
    try { const j = JSON.parse(res.text); return (j.error && j.error.message) || ("HTTP " + res.status); }
    catch (e) { return "HTTP " + res.status; }
  }
  const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  const isBusy = function (r) { return r.status === 503 || r.status === 500 || r.status === 502 || r.status === 504 || r.status === 498 || (r.status === 0 && r.text === "timeout"); };

  // Turn a Gemini-style schema into a short JSON example for providers without schema support.
  function schemaHint(s) {
    if (!s) return "";
    const ex = function (n) {
      if (n.type === "ARRAY") return [ex(n.items)];
      if (n.type === "OBJECT") { const o = {}; Object.keys(n.properties).forEach(function (k) { o[k] = ex(n.properties[k]); }); return o; }
      if (n.type === "INTEGER") return 0;
      return "...";
    };
    return JSON.stringify(ex(s));
  }

  /* ---------------- Gemini ---------------- */
  let modelCache = null;
  async function listGemini(key) {
    if (modelCache) return modelCache;
    const res = await http("GET", GEMINI + "/models?pageSize=200", key, "", 15000);
    if (res.status !== 200) throw new Error(errMsg(res));
    const all = (JSON.parse(res.text).models || []).filter(function (m) {
      const n = m.name || "";
      return (m.supportedGenerationMethods || []).indexOf("generateContent") >= 0 &&
        /flash/.test(n) && !/(image|tts|live|audio|embed|vision|transcribe|translate|native|omni)/.test(n);
    });
    const ver = function (n) { const m = n.match(/(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : 0; };
    const rank = function (n) { return (/(preview|exp)/.test(n) ? 2 : 0) + (/lite/.test(n) ? 1 : 0); };
    all.sort(function (a, b) { return (rank(a.name) - rank(b.name)) || (ver(b.name) - ver(a.name)); });
    modelCache = all.map(function (m) { return m.name.replace(/^models\//, ""); });
    return modelCache;
  }

  async function gemini(opts, tmo, deadline) {
    const contents = (opts.history || []).map(function (h) { return { role: h.role === "user" ? "user" : "model", parts: [{ text: h.text }] }; });
    contents.push({ role: "user", parts: [{ text: opts.prompt }] });
    const base = { contents: contents, generationConfig: { temperature: opts.temperature == null ? 0.7 : opts.temperature } };
    if (opts.system) base.systemInstruction = { parts: [{ text: opts.system }] };
    if (opts.json) { base.generationConfig.responseMimeType = "application/json"; if (opts.schema) base.generationConfig.responseSchema = opts.schema; }
    const noThink = {};
    const send = function (m) {
      const b = JSON.parse(JSON.stringify(base));
      if (!noThink[m]) { // Flash models "think" first by default, which is slow
        if (/gemini-2\.5/.test(m)) b.generationConfig.thinkingConfig = { thinkingBudget: 0 };
        else if (/gemini-(3|flash-latest|flash-lite-latest)/.test(m)) b.generationConfig.thinkingConfig = { thinkingLevel: "low" };
      }
      return http("POST", GEMINI + "/models/" + encodeURIComponent(m) + ":generateContent", opts.key, JSON.stringify(b), tmo);
    };
    const queue = [opts.model || DEFAULT_MODEL];
    const tried = {};
    let listed = false, res = null, quota = 0, busy = 0, attempts = 0;
    while (attempts < 4 && Date.now() < deadline) {
      let m = null;
      for (let i = 0; i < queue.length; i++) if (!tried[queue[i]]) { m = queue[i]; break; }
      if (!m) {
        if (listed) break;
        listed = true;
        try { (await listGemini(opts.key)).forEach(function (x) { if (queue.indexOf(x) < 0) queue.push(x); }); } catch (e) { break; }
        continue;
      }
      tried[m] = true; attempts++;
      res = await send(m);
      if (res.status === 400 && /thinking/i.test(res.text)) { noThink[m] = true; res = await send(m); }
      if (res.status === 200) {
        const j = JSON.parse(res.text);
        const cand = j.candidates && j.candidates[0];
        const parts = (cand && cand.content && cand.content.parts) || [];
        const text = parts.filter(function (p) { return !p.thought && p.text; }).map(function (p) { return p.text; }).join("");
        if (!text) throw new Error((cand && cand.finishReason) ? "Blocked: " + cand.finishReason : "Empty response");
        if (m !== opts.model && opts.onModel) opts.onModel("gemini", m);
        return text;
      }
      if (res.status === 0 && res.text !== "timeout") throw new Error("NETWORK");
      if (res.status === 401 || /API key not valid|API_KEY_INVALID|API key expired/i.test(res.text)) throw new Error("BADKEY");
      if (res.status === 429) { if (++quota >= 2) break; continue; }   // free quota used up: don't hammer
      if (isBusy(res)) { busy++; continue; }
      if (res.status === 404 || res.status === 403 || (res.status === 400 && /model/i.test(res.text))) continue;
      throw new Error(errMsg(res));
    }
    if (quota) throw new Error("RATE");
    if (busy) throw new Error("BUSY");
    throw new Error(res ? errMsg(res) : "No Gemini model available");
  }

  /* ---------------- Groq (OpenAI-compatible) ---------------- */
  let groqList = null;
  async function groqModels(key) {
    if (groqList) return groqList;
    groqList = GROQ_MODELS.slice();
    try {
      const res = await http("GET", GROQ + "/models", key, "", 15000);
      if (res.status === 200) {
        const ids = (JSON.parse(res.text).data || []).map(function (m) { return m.id; });
        const ok = GROQ_MODELS.filter(function (m) { return ids.indexOf(m) >= 0; });
        const extra = ids.filter(function (id) { return /(gpt-oss|llama-3\.3|llama-4|qwen)/.test(id) && !/(guard|whisper|tts|vision|safeguard)/.test(id) && ok.indexOf(id) < 0; });
        if (ok.length || extra.length) groqList = ok.concat(extra);
      }
    } catch (e) {}
    return groqList;
  }

  async function groq(opts, tmo, deadline) {
    const msgs = [];
    const wantArray = opts.json && opts.schema && opts.schema.type === "ARRAY";
    let sys = opts.system || "";
    if (opts.json) {
      const hint = opts.schema ? schemaHint(opts.schema) : "";
      sys += (sys ? "\n\n" : "") + "Reply with ONLY one valid JSON object, no markdown and no extra text. " +
        (wantArray ? "Put the list inside the key \"items\", exactly like: {\"items\": " + hint + "}" : (hint ? "Use exactly this shape: " + hint : "")) +
        " Escape any double quotes inside strings.";
    }
    if (sys) msgs.push({ role: "system", content: sys });
    (opts.history || []).forEach(function (h) { msgs.push({ role: h.role === "user" ? "user" : "assistant", content: h.text }); });
    msgs.push({ role: "user", content: opts.prompt });
    const list = await groqModels(opts.groqKey);
    const order = opts.groqModel ? [opts.groqModel].concat(list.filter(function (m) { return m !== opts.groqModel; })) : list;
    let res = null, quota = 0, busy = 0, bad = 0;
    for (let i = 0; i < order.length && i < 4 && Date.now() < deadline; i++) {
      const m = order[i];
      const body = { model: m, messages: msgs, temperature: opts.temperature == null ? 0.7 : opts.temperature, max_completion_tokens: opts.json ? 16000 : 3000 };
      if (opts.json) body.response_format = { type: "json_object" };
      if (/gpt-oss/.test(m)) body.reasoning_effort = "low";
      if (/qwen3/.test(m)) body.reasoning_format = "hidden";
      res = await http("POST", GROQ + "/chat/completions", opts.groqKey, JSON.stringify(body), tmo);
      if (res.status === 400 && opts.json && /response_format|json/i.test(res.text)) { // model without JSON mode
        delete body.response_format;
        res = await http("POST", GROQ + "/chat/completions", opts.groqKey, JSON.stringify(body), tmo);
      }
      if (res.status === 200) {
        const j = JSON.parse(res.text);
        const ch = j.choices && j.choices[0];
        const text = ((ch && ch.message && ch.message.content) || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
        if (!text || (ch && ch.finish_reason === "length")) { busy++; continue; }   // empty or cut off: try next model
        if (opts.json) { try { parseJSON(text); } catch (e) { bad++; continue; } } // unreadable JSON: try next model
        if (m !== opts.groqModel && opts.onModel) opts.onModel("groq", m);
        return text;
      }
      if (res.status === 0 && res.text !== "timeout") throw new Error("NETWORK");
      if (res.status === 401 || /invalid_api_key|Invalid API Key/i.test(res.text)) throw new Error("BADKEY_GROQ");
      if (res.status === 429 || res.status === 413) { quota++; continue; }   // limits are per model: try the next one
      if (isBusy(res)) { busy++; continue; }
      if (res.status === 404 || res.status === 400) { bad++; continue; }
      throw new Error("Groq: " + errMsg(res));
    }
    if (quota) throw new Error("RATE");
    if (busy || bad) throw new Error("BUSY");
    throw new Error(res ? "Groq: " + errMsg(res) : "No Groq model available");
  }

  /* ---------------- public: try each available service in turn ---------------- */
  async function generate(opts) {
    // opts: {key (Gemini), groqKey, model, groqModel, system, prompt, history, json, schema, temperature, timeout, onModel(provider, model)}
    const providers = [];
    if (opts.groqKey) providers.push("groq");
    if (opts.key) providers.push("gemini");
    if (!providers.length) throw new Error("NOKEY");
    const now = Date.now();
    // Skip a service that just ran out of quota / was overloaded, unless it is the only one
    const ready = providers.filter(function (p) { return !(cooldown[p] > now); });
    const order = ready.length ? ready.concat(providers.filter(function (p) { return ready.indexOf(p) < 0; })) : providers;
    const tmo = opts.timeout || 25000;
    const deadline = Date.now() + Math.max(55000, tmo * 2);
    const errors = [];
    for (let i = 0; i < order.length; i++) {
      const p = order[i];
      if (i > 0 && Date.now() > deadline - 8000) break;
      try {
        const text = p === "groq" ? await groq(opts, tmo, deadline) : await gemini(opts, tmo, deadline);
        if (opts.json) return parseJSON(text);
        return text;
      } catch (e) {
        const m = String(e && e.message || e);
        if (m === "NETWORK") throw e;
        if (m === "RATE") cooldown[p] = Date.now() + 60000;
        if (m === "BUSY") cooldown[p] = Date.now() + 20000;
        errors.push({ p: p, m: m });
      }
    }
    // Report the most useful error
    const has = function (x) { return errors.some(function (e) { return e.m === x; }); };
    if (errors.length === 1) throw new Error(errors[0].m);
    if (has("BUSY")) throw new Error("BUSY");
    if (has("RATE")) throw new Error("RATE");
    throw new Error(errors.map(function (e) { return e.m; }).join(" · "));
  }

  function parseJSON(text) {
    const t = String(text).replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    try { return JSON.parse(t); } catch (e) {}
    const m = t.match(/[\[{][\s\S]*[\]}]/);
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

  return { generate: generate, MCQ_SCHEMA: MCQ_SCHEMA, CQ_SCHEMA: CQ_SCHEMA, DEFAULT_MODEL: DEFAULT_MODEL, isNative: function () { return !!window.AndroidBridge; } };
})();
