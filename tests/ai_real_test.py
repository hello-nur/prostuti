"""Real end-to-end AI test for Prostuti.

Runs the actual app (web/) in a phone-sized headless Chromium, with a stand-in for the
Android bridge that makes the same real HTTPS calls to Google Gemini the APK makes.
Uses the GEMINI_API_KEY secret. Writes test-results/results.md + screenshots.
The key itself is never written to the results.
"""
import base64, functools, http.server, json, os, sys, threading, time, urllib.request, urllib.error

WEB = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "web")
OUT = os.path.abspath("test-results")
os.makedirs(OUT, exist_ok=True)
KEY = os.environ.get("GEMINI_API_KEY", "").strip()
GROQ_KEY = os.environ.get("GROQ_API_KEY", "").strip()
SECRETS = [k for k in (KEY, GROQ_KEY) if k]
def scrub(t):
    for k in SECRETS: t = t.replace(k, "***")
    return t

from playwright.sync_api import sync_playwright

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_POST(self):  # /__proxy : performs the request like the Android bridge, in parallel threads
        n = int(self.headers.get("Content-Length", 0))
        req = json.loads(self.rfile.read(n))
        out = json.dumps(native_request(req["method"], req["url"], req["key"], req["body"])).encode()
        self.send_response(200); self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(out))); self.end_headers(); self.wfile.write(out)

srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8765), functools.partial(Quiet, directory=WEB))
threading.Thread(target=srv.serve_forever, daemon=True).start()

calls = []      # every Gemini call: model, status, seconds
results = []    # every test step

def native_request(method, url, key, body):
    """Same behaviour as MainActivity.Bridge.request (80 s read timeout)."""
    t0 = time.time()
    groq = url.startswith("https://api.groq.com/")
    if groq:
        try: model = "groq:" + json.loads(body).get("model", "?") if method == "POST" else "groq:(list models)"
        except Exception: model = "groq:?"
    else:
        model = url.split("/models/")[-1].split(":")[0] if "/models/" in url else "(list models)"
    if not (groq or url.startswith("https://generativelanguage.googleapis.com/")):
        return {"status": 0, "b64": base64.b64encode(b"blocked url").decode()}
    try:
        req = urllib.request.Request(url, data=body.encode() if method == "POST" else None, method=method)
        req.add_header("Content-Type", "application/json; charset=utf-8")
        if key: req.add_header("Authorization" if groq else "x-goog-api-key", ("Bearer " + key) if groq else key)
        req.add_header("User-Agent", "Prostuti-test/1.0")
        with urllib.request.urlopen(req, timeout=80) as r:
            status, text = r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        status, text = e.code, e.read().decode("utf-8", "replace")
    except Exception as e:
        status, text = 0, str(e)
    dt = time.time() - t0
    info = ""
    if status != 200:
        try: info = json.loads(text)["error"]["message"][:160]
        except Exception: info = text[:160]
    calls.append({"model": model, "status": status, "sec": round(dt, 1), "info": scrub(info)})
    return {"status": status, "b64": base64.b64encode(text.encode()).decode()}

BRIDGE = """
window.AndroidBridge = {
  openUrl: function (u) {},
  request: function (id, method, url, key, body) {
    fetch("/__proxy", { method: "POST", body: JSON.stringify({ method: method, url: url, key: key, body: body }) })
      .then(function (r) { return r.json(); })
      .then(function (r) { window.__bridgeCb(id, r.status, r.b64); })
      .catch(function () { window.__bridgeCb(id, 0, btoa("proxy error")); });
  }
};
"""

def step(name, fn, page, limit):
    t0 = time.time(); ok = False; detail = ""
    n_before = len(calls)
    try:
        detail = fn(page, limit) or ""
        ok = True
    except Exception as e:
        detail = "FAILED: " + str(e).split("\n")[0][:300]
    dt = round(time.time() - t0, 1)
    try: page.screenshot(path=f"{OUT}/{len(results)+1:02d}_{name.replace(' ', '_')}.png")
    except Exception: pass
    used = [f"{c['model']}→{c['status']} ({c['sec']}s)" for c in calls[n_before:]]
    results.append({"name": name, "ok": ok, "sec": dt, "detail": scrub(detail), "calls": used})
    print(("PASS" if ok else "FAIL"), name, dt, "s |", detail[:200], "|", ", ".join(used), flush=True)

HIDE_TOAST = "() => { const t = document.querySelector('.toast'); if (t) t.style.display = 'none'; }"

def wait_until(page, js, limit):
    page.wait_for_function(js, timeout=limit * 1000, polling=500)

def onboard(page, limit):
    page.goto("http://127.0.0.1:8765/index.html"); page.wait_for_timeout(800)
    page.fill("#obName", "Test Student"); page.click("[data-a=obStep][data-d='1']")
    page.click("[data-a=obSet][data-val=HSC]"); page.click("[data-a=obStep][data-d='1']")
    page.click("[data-a=obSet][data-val=science]"); page.click("[data-a=obStep][data-d='1']")
    page.click("[data-a=obSet][data-val=bn]"); page.click("[data-a=obStep][data-d='1']")
    page.wait_for_selector(".admit")
    return "HSC Science, Bangla version"

def key_test(page, limit):
    page.click("[data-a=go][data-v=settings]")
    page.fill("#sGroq", GROQ_KEY); page.fill("#sKey", KEY); page.click("[data-a=testKey]")
    want = (1 if GROQ_KEY else 0) + (1 if KEY else 0)
    wait_until(page, f"() => (document.querySelector('#keyMsg').textContent.match(/[✓✗]/g) || []).length >= {want}", limit)
    msg = page.inner_text("#keyMsg").replace("\n", " | ")
    page.click("[data-a=back]")
    if "✓" not in msg: raise Exception(msg)
    return msg

def tutor(page, limit):
    page.click(".nav [data-v=tutor]")
    page.fill("#chatIn", "Explain Newton's 3rd law with examples"); page.click("[data-a=chatSend]")
    wait_until(page, "() => document.querySelectorAll('#chat .msg.a').length && !document.querySelector('#chat .msg.a .spin')", limit)
    txt = page.locator("#chat .msg.a").last.inner_text()
    if txt.startswith("⚠"): raise Exception(txt)
    return f"{len(txt)} chars: " + txt[:160].replace("\n", " ")

def gen_mcq(page, limit):
    page.click(".nav [data-v=subjects]")
    page.click("[data-a=go][data-id=hsc_phy]")
    page.click("[data-a=chapter][data-c='1']")
    page.evaluate(HIDE_TOAST)
    page.click("[data-a=chGen]")
    wait_until(page, "() => document.querySelector('.qtext') || (document.querySelector('.toast') && document.querySelector('.toast').style.display !== 'none')", limit)
    if not page.locator(".qtext").count(): raise Exception(page.inner_text(".toast"))
    n = page.locator(".qnav button").count()
    return f"{n} questions. Q1: " + page.inner_text(".qtext")[:150] + " | options: " + " / ".join(o.inner_text().replace("\n", " ") for o in page.locator(".opt").all())

def explain(page, limit):
    page.locator(".opt").first.click(); page.click("[data-a=qExplain]")
    wait_until(page, "() => !document.querySelector('.card .spin') && (document.querySelector('.card.small') || !document.querySelector('[data-a=qExplain]'))", limit)
    if not page.locator(".card.small").count(): raise Exception("no explanation shown")
    t = page.inner_text(".card.small")
    page.click("[data-a=back]")
    if page.locator("#askOk").count(): page.click("#askOk")
    page.wait_for_timeout(300)
    if page.locator("[data-a=tab][data-v=home]").count(): page.locator("[data-a=tab][data-v=home]").first.click()
    return t[:200].replace("\n", " ")

def cq(page, limit):
    page.click(".nav [data-v=subjects]")
    page.click("[data-a=go][data-id=hsc_che]")
    page.click("[data-a=chapter][data-c='6']")
    page.click("[data-a=chCQ]")
    wait_until(page, "() => document.querySelector('.cq') || document.querySelector('[data-a=cqAgain]')", limit)
    if not page.locator(".cq").count(): raise Exception(page.inner_text("main")[:200])
    return f"{page.locator('details.ans').count()} parts. Stem: " + page.locator(".cq").first.inner_text()[:150].replace("\n", " ")

def mock(page, limit):
    page.click("[data-a=back]")
    page.click(".nav [data-v=mock]")
    page.click("[data-a=mockPreset][data-n='30']")
    page.click("[data-a=mockSrc][data-v=ai]")
    page.evaluate(HIDE_TOAST)
    page.click("[data-a=mockStart]")
    wait_until(page, "() => document.querySelector('.qtext') || (document.querySelector('.toast') && document.querySelector('.toast').style.display !== 'none' && !document.querySelector('.modal'))", limit)
    if not page.locator(".qtext").count(): raise Exception(page.inner_text(".toast"))
    return f"{page.locator('.qnav button').count()} questions, timer {page.inner_text('#timer')}"

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    ctx.add_init_script(BRIDGE)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    step("onboarding", onboard, page, 30)
    if not (KEY or GROQ_KEY):
        results.append({"name": "API key secrets", "ok": False, "sec": 0, "detail": "Neither GROQ_API_KEY nor GEMINI_API_KEY is set", "calls": []})
    else:
        step("key test", key_test, page, 120)
        step("AI tutor chat", tutor, page, 120)
        step("generate 10 MCQs", gen_mcq, page, 180)
        step("explain answer", explain, page, 120)
        step("creative question", cq, page, 180)
        step("AI mock 30 questions", mock, page, 240)
    model = page.evaluate("(function(){var s=(JSON.parse(localStorage.getItem('prostuti_v1')||'{}').settings||{});return 'Groq: '+(s.groqModel||'-')+' / Gemini: '+(s.model||'-');})()")
    br.close()

lines = ["# Prostuti real AI test", "", f"Keys used: Groq {'yes' if GROQ_KEY else 'no'}, Gemini {'yes' if KEY else 'no'}", "", f"Saved model after test: `{model}`", "",
         "| Step | Result | Time | Details |", "|---|---|---|---|"]
for r in results:
    lines.append(f"| {r['name']} | {'✅ PASS' if r['ok'] else '❌ FAIL'} | {r['sec']} s | {r['detail'].replace('|', '/')[:300]} |")
lines += ["", "## Every Gemini call", "", "| # | Model | Status | Seconds | Error |", "|---|---|---|---|---|"]
for i, c in enumerate(calls, 1):
    lines.append(f"| {i} | {c['model']} | {c['status']} | {c['sec']} | {c['info'].replace('|', '/')} |")
lines += ["", "Page errors: " + ("none" if not errors else "; ".join(errors)[:500])]
open(f"{OUT}/results.md", "w").write("\n".join(lines))
print("\n".join(lines))
srv.shutdown()
sys.exit(0 if all(r["ok"] for r in results) else 1)
