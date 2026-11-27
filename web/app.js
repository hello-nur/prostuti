/* Prostuti — SSC / HSC / Admission exam preparation app */
(function () {
"use strict";
const C = window.CATALOG, SUB = C.SUBJECTS, AI = window.AI;
const CFG = window.PROSTUTI_CONFIG || {};
const KEY = "prostuti_v1";

/* ---------------- storage ---------------- */
function defaults() {
  return {
    profile: null,
    settings: { lang: "en", theme: "system", apiKey: "", model: "", goal: 30, examDate: "" },
    stats: { ans: {}, days: {}, history: [] },
    bm: [], mis: [], ai: [], chat: []
  };
}
function load() {
  let d = defaults();
  try {
    const j = JSON.parse(localStorage.getItem(KEY) || "null");
    if (j) { d = Object.assign(d, j); d.settings = Object.assign(defaults().settings, j.settings || {}); d.stats = Object.assign(defaults().stats, j.stats || {}); }
  } catch (e) {}
  return d;
}
let S = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast(L("Storage is full — clear some AI questions in Settings.", "স্টোরেজ পূর্ণ — সেটিংস থেকে কিছু AI প্রশ্ন মুছুন।")); } }

/* ---------------- helpers ---------------- */
const $ = (s, r) => (r || document).querySelector(s);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const bn = () => S.settings.lang === "bn";
const L = (en, b) => (bn() ? b : en);
const BD = "০১২৩৪৫৬৭৮৯";
const N = x => (bn() ? String(x).replace(/\d/g, d => BD[d]) : String(x));
const sn = id => (SUB[id] ? (bn() ? SUB[id].bn : SUB[id].en) : id);
const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const qn = n => N(n) + " " + (bn() ? "প্রশ্ন" : n === 1 ? "question" : "questions");
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const LET_EN = ["A", "B", "C", "D"], LET_BN = ["ক", "খ", "গ", "ঘ"];
const letter = (i, q) => {
  const b = !q ? bn() : q.src === "bank" ? q.s === "ban" : contentLang(q.s) === "bn";
  return b ? LET_BN[i] : LET_EN[i];
};
function md(t) { // tiny, safe markdown for AI text
  return esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/^#{1,4}\s*(.+)$/gm, "<b>$1</b>").replace(/^\s*[\*\-]\s+/gm, "• ");
}

/* ---------------- question pool ---------------- */
const BANK = window.QBANK.map((r, i) => ({ id: "b" + i, s: r[0], c: r[1], q: r[2], o: r[3], a: r[4], e: r[5], src: "bank" }));
let BYID = {};
function reindex() { BYID = {}; BANK.concat(S.ai).forEach(q => { BYID[q.id] = q; }); }
reindex();
const pool = (filter) => BANK.concat(S.ai).filter(filter);

/* ---------------- profile helpers ---------------- */
const P = () => S.profile || {};
function mySubs() {
  const p = P();
  if (p.exam === "ADM") return (C.EXAMS.ADM.targets[p.target] || C.EXAMS.ADM.targets.du_a).subs;
  const ex = C.EXAMS[p.exam] || C.EXAMS.SSC;
  return ex.groups[p.group] || ex.groups.science;
}
function examLabel() {
  const p = P();
  if (p.exam === "ADM") { const t = C.EXAMS.ADM.targets[p.target]; return t ? (bn() ? t.bn : t.en) : L("Admission", "ভর্তি"); }
  const g = C.GROUPS[p.group];
  return (bn() ? C.EXAMS[p.exam].bn : C.EXAMS[p.exam].en) + " " + N(p.year || "") + (g ? " · " + (bn() ? g.bn : g.en) : "");
}
const examDate = () => S.settings.examDate || C.DEFAULT_DATES[P().exam] || "";
const defaultNeg = () => (P().exam === "ADM" ? ((C.EXAMS.ADM.targets[P().target] || {}).neg || 0) : 0);
const apiKey = () => S.settings.apiKey || CFG.apiKey || "";
const contentLang = (sid) => (sid === "ban" ? "bn" : sid === "eng" ? "en" : (P().version || "bn"));

/* ---------------- stats ---------------- */
function record(q, ok) {
  const a = S.stats.ans[q.id] || { c: 0, w: 0 };
  ok ? a.c++ : a.w++; a.t = Date.now(); S.stats.ans[q.id] = a;
  const d = today(); S.stats.days[d] = (S.stats.days[d] || 0) + 1;
  const mi = S.mis.indexOf(q.id);
  if (!ok && mi < 0) S.mis.unshift(q.id);
  if (ok && mi >= 0) S.mis.splice(mi, 1);
}
function streak() {
  let n = 0; const d = new Date();
  if (!S.stats.days[today()]) d.setDate(d.getDate() - 1);
  for (;;) {
    const k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    if (S.stats.days[k]) { n++; d.setDate(d.getDate() - 1); } else break;
  }
  return n;
}
function subStats(sid, ch) {
  let c = 0, w = 0;
  for (const id in S.stats.ans) { const q = BYID[id]; if (!q || q.s !== sid || (ch != null && q.c !== ch)) continue; c += S.stats.ans[id].c; w += S.stats.ans[id].w; }
  return { c, w, n: c + w, p: pct(c, c + w) };
}
function weakChapters(limit) {
  const m = {};
  for (const id in S.stats.ans) {
    const q = BYID[id]; if (!q || mySubs().indexOf(q.s) < 0) continue;
    const k = q.s + "|" + q.c; m[k] = m[k] || { s: q.s, c: q.c, ok: 0, n: 0 };
    m[k].ok += S.stats.ans[id].c; m[k].n += S.stats.ans[id].c + S.stats.ans[id].w;
  }
  return Object.values(m).filter(x => x.n >= 3).map(x => Object.assign(x, { p: pct(x.ok, x.n) })).filter(x => x.p < 70).sort((a, b) => a.p - b.p).slice(0, limit || 5);
}
function smartPick(list, n) { // wrong first, then unseen, then the rest
  const t = [[], [], []];
  shuffle(list).forEach(q => { const a = S.stats.ans[q.id]; t[!a ? 1 : (a.w > a.c ? 0 : 2)].push(q); });
  return t[0].concat(t[1], t[2]).slice(0, n);
}

/* ---------------- router ---------------- */
let stack = [];
let quiz = null, timerId = null, modalOpen = null;
function go(v, p) { stack.push({ v, p: p || {} }); render(); window.scrollTo(0, 0); }
function replace(v, p) { stack[stack.length - 1] = { v, p: p || {} }; render(); window.scrollTo(0, 0); }
function tab(v) { if (v === "mock") mockCfg = null; stack = [{ v, p: {} }]; render(); window.scrollTo(0, 0); }
function back() {
  if (modalOpen) { closeModal(); return true; }
  const cur = stack[stack.length - 1];
  if (cur && cur.v === "quiz" && quiz && !quiz.done) { confirmLeave(); return true; }
  if (stack.length > 1) { stack.pop(); stopTimer(); render(); return true; }
  if (cur && cur.v !== "home" && S.profile) { tab("home"); return true; }
  return false;
}
window.appBack = back; // called by Android back button

/* ---------------- UI primitives ---------------- */
let toastT;
function toast(m) {
  let t = $(".toast"); if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.textContent = m; t.style.display = "block"; clearTimeout(toastT); toastT = setTimeout(() => { t.style.display = "none"; }, 2600);
}
function modal(html, onClose) {
  closeModal();
  const m = document.createElement("div"); m.className = "modal";
  m.innerHTML = '<div class="sheet" role="dialog" aria-modal="true">' + html + "</div>";
  m.addEventListener("click", e => { if (e.target === m) closeModal(); });
  document.body.appendChild(m); modalOpen = { el: m, onClose };
}
function closeModal() { if (modalOpen) { modalOpen.el.remove(); const f = modalOpen.onClose; modalOpen = null; if (f) f(); } }
function ask(title, body, okText, onOk, danger) {
  modal('<h2 style="margin:0 0 6px;font-size:19px">' + esc(title) + '</h2><p class="mute" style="margin:0 0 16px">' + esc(body) + '</p><div class="row"><button class="btn line grow" data-a="closeModal">' + L("Cancel", "বাতিল") + '</button><button class="btn grow ' + (danger ? "red" : "") + '" id="askOk">' + esc(okText) + "</button></div>");
  $("#askOk").onclick = () => { closeModal(); onOk(); };
}
const ICON = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  book: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>',
  mock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
  ai: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  prog: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'
};
const svg = k => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[k] + "</svg>";

/* ---------------- render ---------------- */
function applyTheme() {
  const t = S.settings.theme;
  if (t === "system") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", t);
  document.documentElement.lang = bn() ? "bn" : "en";
}
function render() {
  applyTheme();
  if (!S.profile && (!stack.length || stack[0].v !== "onboard")) stack = [{ v: "onboard", p: { step: 0 } }];
  if (!stack.length) stack = [{ v: "home", p: {} }];
  const cur = stack[stack.length - 1];
  const V = VIEWS[cur.v] || VIEWS.home;
  const out = V(cur.p);
  const tabs = [["home", L("Home", "হোম")], ["subjects", L("Subjects", "বিষয়")], ["mock", L("Mock Test", "মডেল টেস্ট")], ["tutor", L("AI Tutor", "AI শিক্ষক")], ["progress", L("Progress", "অগ্রগতি")]];
  const root = stack[0].v;
  $("#app").innerHTML =
    (out.top === false ? "" : '<header class="top">' + (stack.length > 1 || out.backBtn ? '<button class="iconbtn" data-a="back" aria-label="Back">‹</button>' : "") + "<h1>" + (out.title || "") + "</h1>" + (out.right || "") + "</header>") +
    '<main class="' + (out.nav === false ? "noNav" : "") + '">' + out.html + "</main>" +
    (out.nav === false ? "" : '<nav class="nav"><div class="in">' + tabs.map(t => '<button data-a="tab" data-v="' + t[0] + '" class="' + (root === t[0] ? "on" : "") + '">' + svg(t[0] === "subjects" ? "book" : t[0] === "progress" ? "prog" : t[0] === "tutor" ? "ai" : t[0]) + "<span>" + t[1] + "</span></button>").join("") + "</div></nav>");
  if (out.after) out.after();
}

/* ---------------- actions (delegated) ---------------- */
const ACT = {
  back: () => back(), tab: d => tab(d.v), closeModal: () => closeModal(),
  go: d => go(d.v, Object.assign({}, d)),
};
document.addEventListener("click", e => {
  const b = e.target.closest("[data-a]"); if (!b) return;
  const f = ACT[b.dataset.a]; if (f) { e.preventDefault(); f(b.dataset, b); }
});

/* =================================================================
   VIEWS
   ================================================================= */
const VIEWS = {};

/* ---------- Onboarding ---------- */
let draft = null;
VIEWS.onboard = function (p) {
  draft = draft || Object.assign({ name: "", exam: "", group: "", target: "", board: "Dhaka", year: "2027", version: "bn" }, S.profile || {});
  const st = p.step || 0;
  const steps = '<div class="steps">' + [0, 1, 2, 3].map(i => '<i class="' + (i <= st ? "on" : "") + '"></i>').join("") + "</div>";
  let h = "";
  if (st === 0) {
    h = '<div style="padding-top:10px"><div style="display:flex;gap:8px;margin-bottom:14px" aria-hidden="true">' + [0, 1, 2, 3].map(i => '<span class="num" style="width:40px;height:40px;' + (i === 1 ? "background:var(--pri);border-color:var(--pri);color:var(--pri-ink)" : "") + '">' + LET_BN[i] + "</span>").join("") + "</div>" +
      '<div class="ob-hero">' + L("Your exam, prepared — one bubble at a time.", "তোমার পরীক্ষার পূর্ণ প্রস্তুতি — এক একটি বৃত্ত ভরাট করে।") + "</div>" +
      '<p class="mute">' + L("Chapter-wise MCQ practice, board-style mock tests, AI-made questions and an AI tutor for SSC, HSC and university admission.", "SSC, HSC ও ভর্তি পরীক্ষার জন্য অধ্যায়ভিত্তিক MCQ, বোর্ড স্টাইল মডেল টেস্ট, AI প্রশ্ন ও AI শিক্ষক।") + "</p>" +
      '<label class="f">App language / অ্যাপের ভাষা</label><div class="chips">' +
      '<button class="chip ' + (!bn() ? "on" : "") + '" data-a="setLang" data-l="en">English</button><button class="chip ' + (bn() ? "on" : "") + '" data-a="setLang" data-l="bn">বাংলা</button></div>' +
      '<label class="f" for="obName">' + L("Your name", "তোমার নাম") + '</label><input class="in" id="obName" autocomplete="given-name" value="' + esc(draft.name) + '" placeholder="' + L("e.g. Nusrat", "যেমন: নুসরাত") + '"></div>';
  } else if (st === 1) {
    h = '<div class="ob-hero" style="font-size:24px">' + L("Which exam are you preparing for?", "কোন পরীক্ষার প্রস্তুতি নিচ্ছ?") + '</div><div style="display:grid;gap:10px;margin-top:14px">' +
      [["SSC", L("SSC / Dakhil", "এসএসসি / দাখিল"), L("Class 9–10 syllabus", "নবম–দশম শ্রেণির সিলেবাস")], ["HSC", L("HSC / Alim", "এইচএসসি / আলিম"), L("Class 11–12 syllabus", "একাদশ–দ্বাদশ শ্রেণির সিলেবাস")], ["ADM", L("University / Medical / Engineering admission", "বিশ্ববিদ্যালয় / মেডিকেল / ইঞ্জিনিয়ারিং ভর্তি"), L("HSC syllabus + GK, with negative marking", "HSC সিলেবাস + সাধারণ জ্ঞান, নেগেটিভ মার্কিংসহ")]]
        .map(x => '<button class="li card" style="margin:0;border:2px solid ' + (draft.exam === x[0] ? "var(--pri)" : "transparent") + '" data-a="obSet" data-k="exam" data-val="' + x[0] + '"><span class="num">' + (draft.exam === x[0] ? "✓" : "") + '</span><span class="t"><b>' + x[1] + "</b><span>" + x[2] + "</span></span></button>").join("") + "</div>";
  } else if (st === 2) {
    if (draft.exam === "ADM") {
      h = '<div class="ob-hero" style="font-size:24px">' + L("Target admission test", "লক্ষ্য ভর্তি পরীক্ষা") + '</div><div class="chips" style="margin-top:14px">' +
        Object.entries(C.EXAMS.ADM.targets).map(([k, t]) => '<button class="chip ' + (draft.target === k ? "on" : "") + '" data-a="obSet" data-k="target" data-val="' + k + '">' + (bn() ? t.bn : t.en) + "</button>").join("") + "</div>";
    } else {
      h = '<div class="ob-hero" style="font-size:24px">' + L("Your group", "তোমার বিভাগ") + '</div><div style="display:grid;gap:10px;margin-top:14px">' +
        Object.entries(C.GROUPS).map(([k, g]) => '<button class="li card" style="margin:0;border:2px solid ' + (draft.group === k ? "var(--pri)" : "transparent") + '" data-a="obSet" data-k="group" data-val="' + k + '"><span class="num">' + (draft.group === k ? "✓" : "") + '</span><span class="t"><b>' + (bn() ? g.bn : g.en) + "</b><span>" + C.EXAMS[draft.exam].groups[k].map(sn).join(", ") + "</span></span></button>").join("") + "</div>";
    }
  } else {
    h = '<div class="ob-hero" style="font-size:24px">' + L("A few last details", "শেষ কয়েকটি তথ্য") + "</div>" +
      (draft.exam !== "ADM" ? '<label class="f" for="obBoard">' + L("Education board", "শিক্ষা বোর্ড") + '</label><select class="in" id="obBoard">' + C.BOARDS.map(b => '<option ' + (draft.board === b ? "selected" : "") + ">" + b + "</option>").join("") + "</select>" : "") +
      '<label class="f" for="obYear">' + L("Exam year", "পরীক্ষার বছর") + '</label><select class="in" id="obYear">' + ["2026", "2027", "2028", "2029"].map(y => '<option ' + (draft.year === y ? "selected" : "") + ">" + y + "</option>").join("") + "</select>" +
      '<label class="f">' + L("Your version (language of AI questions)", "তোমার ভার্সন (AI প্রশ্নের ভাষা)") + '</label><div class="chips"><button class="chip ' + (draft.version === "bn" ? "on" : "") + '" data-a="obSet" data-k="version" data-val="bn" data-stay="1">বাংলা ভার্সন</button><button class="chip ' + (draft.version === "en" ? "on" : "") + '" data-a="obSet" data-k="version" data-val="en" data-stay="1">English Version</button></div>' +
      '<p class="tiny mute" style="margin-top:14px">' + L("You can change all of this later in Settings.", "পরে সেটিংস থেকে সব পরিবর্তন করা যাবে।") + "</p>";
  }
  const canNext = st === 0 ? true : st === 1 ? !!draft.exam : st === 2 ? !!(draft.exam === "ADM" ? draft.target : draft.group) : true;
  return {
    title: "", nav: false, top: false,
    html: '<div style="padding-top:calc(env(safe-area-inset-top) + 18px)">' + steps + h +
      '<div class="row" style="margin-top:24px">' + (st > 0 ? '<button class="btn line" data-a="obStep" data-d="-1">' + L("Back", "পেছনে") + "</button>" : "") +
      '<button class="btn grow" data-a="obStep" data-d="1" ' + (canNext ? "" : "disabled") + ">" + (st === 3 ? L("Start preparing", "প্রস্তুতি শুরু করো") : L("Continue", "পরবর্তী")) + "</button></div></div>"
  };
};
function obCapture() {
  const n = $("#obName"); if (n) draft.name = n.value.trim();
  const b = $("#obBoard"); if (b) draft.board = b.value;
  const y = $("#obYear"); if (y) draft.year = y.value;
}
ACT.setLang = d => { obCapture(); S.settings.lang = d.l; save(); render(); };
ACT.obSet = d => { obCapture(); draft[d.k] = d.val; if (d.k === "exam") { draft.group = ""; draft.target = ""; } render(); };
ACT.obStep = d => {
  obCapture();
  const cur = stack[stack.length - 1]; const st = (cur.p.step || 0) + Number(d.d);
  if (st > 3) {
    const first = !S.profile;
    S.profile = draft; draft = null;
    if (!first) S.settings.examDate = "";
    save(); stack = [{ v: "home", p: {} }]; render();
    toast(L("All set! Good luck 🎯", "সব প্রস্তুত! শুভকামনা 🎯"));
    return;
  }
  if (st < 0) { if (S.profile) { draft = null; tab("settings"); } return; }
  cur.p.step = st; render(); window.scrollTo(0, 0);
};

/* ---------- Home ---------- */
VIEWS.home = function () {
  const p = P(), ed = examDate();
  let days = null;
  if (ed) { const t = new Date(ed + "T10:00:00"); days = Math.ceil((t - new Date()) / 86400000); }
  const done = S.stats.days[today()] || 0, goal = S.settings.goal || 30;
  const totalAns = Object.values(S.stats.ans).reduce((s, a) => s + a.c + a.w, 0);
  const totalOk = Object.values(S.stats.ans).reduce((s, a) => s + a.c, 0);
  const h = new Date().getHours();
  const hello = h < 12 ? L("Good morning", "শুভ সকাল") : h < 17 ? L("Good afternoon", "শুভ অপরাহ্ন") : L("Good evening", "শুভ সন্ধ্যা");
  const qod = qOfDay();
  const weak = weakChapters(3);
  const ringR = 26, ringC = 2 * Math.PI * ringR, ringP = Math.min(1, done / goal);
  const html =
    '<div class="admit"><div class="bub" aria-hidden="true">' + Array.from({ length: 16 }, (_, i) => '<i class="' + ([1, 6, 8, 15].indexOf(i) >= 0 ? "f" : "") + '"></i>').join("") + "</div>" +
    '<div class="k">' + esc(examLabel()) + (p.board && p.exam !== "ADM" ? " · " + esc(p.board) : "") + "</div>" +
    (days == null ? '<div style="font-size:22px;font-weight:700;margin:6px 0">' + L("Set your exam date", "পরীক্ষার তারিখ দাও") + '</div><button class="btn ghost" style="min-height:40px" data-a="go" data-v="settings">' + L("Set date", "তারিখ ঠিক করো") + "</button>"
      : days > 0 ? '<div class="row" style="align-items:flex-end;gap:8px;margin-top:6px"><span class="big">' + N(days) + '</span><span style="padding-bottom:6px">' + L("days left", "দিন বাকি") + '</span></div><div class="k" style="margin-top:4px">' + L("Exam starts", "পরীক্ষা শুরু") + " " + esc(new Date(ed + "T10:00:00").toLocaleDateString(bn() ? "bn-BD" : "en-GB", { day: "numeric", month: "long", year: "numeric" })) + "</div>"
      : '<div style="font-size:22px;font-weight:700;margin:6px 0">' + L("Exam time — you've got this!", "পরীক্ষা চলছে — তুমি পারবে!") + "</div>") + "</div>" +
    '<div class="card row"><svg class="ring" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="' + ringR + '" fill="none" stroke="var(--line)" stroke-width="7"/><circle cx="32" cy="32" r="' + ringR + '" fill="none" stroke="var(--pri)" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + ringC + '" stroke-dashoffset="' + ringC * (1 - ringP) + '" transform="rotate(-90 32 32)"/><text x="32" y="37" text-anchor="middle" font-size="15" font-weight="700" fill="currentColor">' + N(Math.round(ringP * 100)) + '%</text></svg>' +
    '<div class="grow"><b>' + esc(hello) + (p.name ? ", " + esc(p.name) : "") + '!</b><div class="small mute">' + L("Today", "আজ") + " " + N(done) + "/" + N(goal) + " " + L("questions", "প্রশ্ন") + " · 🔥 " + N(streak()) + " " + L("day streak", "দিনের ধারাবাহিকতা") + "</div></div></div>" +
    '<div class="grid2">' +
    tileBtn("⚡", L("Quick practice", "দ্রুত অনুশীলন"), L("10 mixed MCQs", "১০টি মিশ্র MCQ"), "quick") +
    tileBtn("⏱", L("Mock test", "মডেল টেস্ট"), L("Timed, board style", "সময়সহ, বোর্ড স্টাইল"), "tabMock") +
    tileBtn("✨", L("AI questions", "AI প্রশ্ন"), L("Fresh MCQs any chapter", "যেকোনো অধ্যায়ে নতুন MCQ"), "tabSubjects") +
    tileBtn("✍", L("Creative (CQ)", "সৃজনশীল প্রশ্ন"), L("AI-made with answers", "AI তৈরি, উত্তরসহ"), "pickCQ") +
    tileBtn("✗", L("My mistakes", "আমার ভুলগুলো"), L(S.mis.length + " to fix", N(S.mis.length) + "টি ঠিক করতে হবে"), "mistakes") +
    tileBtn("★", L("Bookmarks", "বুকমার্ক"), L(S.bm.length + " saved", N(S.bm.length) + "টি সংরক্ষিত"), "bookmarks") +
    "</div>" +
    (qod ? '<div class="sec">' + L("Question of the day", "আজকের প্রশ্ন") + '</div><button class="card li" style="margin:0 0 12px" data-a="qod"><span class="t"><span>' + esc(sn(qod.s)) + "</span><b>" + esc(qod.q) + '</b></span><span class="pill">' + L("Answer", "উত্তর দাও") + "</span></button>" : "") +
    (weak.length ? '<div class="sec">' + L("Needs work", "দুর্বল অধ্যায়") + '</div><div class="list">' + weak.map(w => '<button class="li" data-a="practiceCh" data-s="' + w.s + '" data-c="' + w.c + '"><span class="t"><b>' + esc(SUB[w.s].ch[w.c]) + "</b><span>" + esc(sn(w.s)) + " · " + N(w.p) + "% " + L("correct", "সঠিক") + '</span></span><span class="pill r">' + L("Practice", "অনুশীলন") + "</span></button>").join("") + "</div>" : "") +
    '<div class="stat"><div><b>' + N(totalAns) + "</b><span>" + L("answered", "উত্তর দিয়েছ") + "</span></div><div><b>" + N(pct(totalOk, totalAns)) + "%</b><span>" + L("accuracy", "সঠিকতা") + "</span></div><div><b>" + N(S.stats.history.length) + "</b><span>" + L("tests taken", "টেস্ট দিয়েছ") + "</span></div></div>";
  return { title: "Prostuti", html, right: '<button class="iconbtn" data-a="go" data-v="settings" aria-label="Settings">⚙</button>' };
};
function tileBtn(ic, t, s, a) { return '<button class="tile" data-a="' + a + '"><span class="ic">' + ic + "</span><b>" + t + "</b><span>" + s + "</span></button>"; }
function qOfDay() {
  const list = BANK.filter(q => mySubs().indexOf(q.s) >= 0); if (!list.length) return null;
  let h = 0; const k = today(); for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
  return list[h % list.length];
}
ACT.qod = () => startQuiz({ mode: "practice", title: L("Question of the day", "আজকের প্রশ্ন"), qs: [qOfDay()] });
ACT.quick = () => {
  const list = smartPick(pool(q => mySubs().indexOf(q.s) >= 0), 10);
  startQuiz({ mode: "practice", title: L("Quick practice", "দ্রুত অনুশীলন"), qs: list });
};
ACT.tabMock = () => tab("mock");
ACT.tabSubjects = () => tab("subjects");
ACT.mistakes = () => go("saved", { kind: "mis" });
ACT.bookmarks = () => go("saved", { kind: "bm" });

/* ---------- Subjects ---------- */
VIEWS.subjects = function () {
  const subs = mySubs();
  const html = '<p class="small mute" style="margin:0 0 12px">' + esc(examLabel()) + "</p>" +
    '<div class="list">' + subs.map(id => {
      const s = SUB[id], st = subStats(id), have = pool(q => q.s === id).length;
      return '<button class="li" data-a="go" data-v="subject" data-id="' + id + '"><span class="tile" style="padding:0;box-shadow:none;min-height:0;background:none"><span class="ic">' + esc(s.icon) + '</span></span><span class="t"><b>' + esc(sn(id)) + "</b><span>" + N(s.ch.length) + " " + L("chapters", "অধ্যায়") + " · " + qn(have) + (st.n ? " · " + N(st.p) + "%" : "") + '</span>' + (st.n ? '<div class="bar" style="margin-top:6px"><i style="width:' + st.p + '%"></i></div>' : "") + '</span><span class="mute">›</span></button>';
    }).join("") + "</div>";
  return { title: L("Subjects", "বিষয়সমূহ"), html };
};
VIEWS.subject = function (p) {
  const s = SUB[p.id];
  const st = subStats(p.id);
  const html =
    '<div class="card"><div class="row"><div class="grow"><div class="small mute">' + L("Your accuracy", "তোমার সঠিকতা") + '</div><b style="font-size:26px">' + (st.n ? N(st.p) + "%" : "—") + '</b></div><div class="small mute" style="text-align:end">' + N(st.n) + " " + L("answered", "উত্তর") + "</div></div>" + (st.n ? '<div class="bar" style="margin-top:8px"><i style="width:' + st.p + '%"></i></div>' : "") + "</div>" +
    '<div class="grid2" style="margin-bottom:6px">' +
    '<button class="btn" data-a="practiceSub" data-s="' + p.id + '">' + L("Practice all", "সব অনুশীলন") + "</button>" +
    '<button class="btn ghost" data-a="mockSub" data-s="' + p.id + '">' + L("Subject mock", "বিষয় মডেল টেস্ট") + "</button></div>" +
    '<div class="sec">' + L("Chapters", "অধ্যায়সমূহ") + '</div><div class="list">' +
    s.ch.map((c, i) => {
      const n = pool(q => q.s === p.id && q.c === i).length, cs = subStats(p.id, i);
      return '<button class="li" data-a="chapter" data-s="' + p.id + '" data-c="' + i + '"><span class="num">' + N(i + 1) + '</span><span class="t"><b>' + esc(c) + "</b><span>" + (n ? qn(n) : L("AI questions only", "শুধু AI প্রশ্ন")) + (cs.n ? " · " + N(cs.p) + "% " + L("correct", "সঠিক") : "") + "</span></span>" + (cs.n ? '<span class="pill ' + (cs.p < 50 ? "r" : cs.p < 75 ? "a" : "") + '">' + N(cs.p) + "%</span>" : '<span class="mute">›</span>') + "</button>";
    }).join("") + "</div>";
  return { title: esc(sn(p.id)), html };
};
ACT.practiceSub = d => {
  const list = smartPick(pool(q => q.s === d.s), 20);
  if (!list.length) return toast(L("No saved questions yet — generate some with AI from a chapter.", "এখনো প্রশ্ন নেই — অধ্যায় থেকে AI দিয়ে তৈরি করো।"));
  startQuiz({ mode: "practice", title: sn(d.s), qs: list });
};
ACT.mockSub = d => go("mocksetup", { subs: d.s });
ACT.practiceCh = d => {
  const s = d.s, c = Number(d.c);
  const list = smartPick(pool(q => q.s === s && q.c === c), 15);
  if (!list.length) return aiGenerate(s, c, 10, "medium");
  startQuiz({ mode: "practice", title: SUB[s].ch[c], qs: list });
};
ACT.chapter = d => {
  const s = d.s, c = Number(d.c), n = pool(q => q.s === s && q.c === c).length;
  modal('<div class="small mute">' + esc(sn(s)) + '</div><h2 style="margin:2px 0 14px;font-size:19px">' + esc(SUB[s].ch[c]) + "</h2>" +
    (n ? '<button class="btn block" data-a="chPractice" data-s="' + s + '" data-c="' + c + '">' + L("Practice", "অনুশীলন") + " (" + qn(n) + ")</button>" : '<p class="small mute">' + L("No built-in questions for this chapter yet. Let AI make some!", "এই অধ্যায়ে এখনো প্রশ্ন নেই। AI দিয়ে তৈরি করো!") + "</p>") +
    '<div class="sec" style="margin-top:16px">✨ ' + L("Generate new MCQs with AI", "AI দিয়ে নতুন MCQ তৈরি") + "</div>" +
    '<label class="f" style="margin-top:4px">' + L("How many", "কতটি") + '</label><div class="chips" id="gN">' + [5, 10, 15, 20].map(x => '<button class="chip ' + (x === 10 ? "on" : "") + '" data-a="pickChip" data-g="gN" data-val="' + x + '">' + N(x) + "</button>").join("") + "</div>" +
    '<label class="f">' + L("Difficulty", "কাঠিন্য") + '</label><div class="chips" id="gD">' + [["easy", L("Easy", "সহজ")], ["medium", L("Board standard", "বোর্ড মান")], ["hard", L("Hard / Admission", "কঠিন / ভর্তি")]].map(x => '<button class="chip ' + (x[0] === "medium" ? "on" : "") + '" data-a="pickChip" data-g="gD" data-val="' + x[0] + '">' + x[1] + "</button>").join("") + "</div>" +
    '<button class="btn block ghost" style="margin-top:14px" data-a="chGen" data-s="' + s + '" data-c="' + c + '">' + L("Generate & start", "তৈরি করে শুরু করো") + "</button>" +
    '<div class="grid2" style="margin-top:10px"><button class="btn line" data-a="chCQ" data-s="' + s + '" data-c="' + c + '">✍ ' + L("Creative Q", "সৃজনশীল") + '</button><button class="btn line" data-a="chAsk" data-s="' + s + '" data-c="' + c + '">💬 ' + L("Ask tutor", "শিক্ষককে প্রশ্ন") + "</button></div>");
};
ACT.pickChip = (d, b) => { const g = $("#" + d.g); g.querySelectorAll(".chip").forEach(x => x.classList.remove("on")); b.classList.add("on"); };
const chipVal = id => { const b = $("#" + id + " .chip.on"); return b ? b.dataset.val : null; };
ACT.chPractice = d => { closeModal(); ACT.practiceCh(d); };
ACT.chGen = d => { const n = Number(chipVal("gN") || 10), df = chipVal("gD") || "medium"; closeModal(); aiGenerate(d.s, Number(d.c), n, df); };
ACT.chCQ = d => { closeModal(); go("cq", { s: d.s, c: Number(d.c) }); };
ACT.chAsk = d => { closeModal(); tab("tutor"); setTimeout(() => { const t = $("#chatIn"); if (t) { t.value = L("Explain the key concepts of ", "এই অধ্যায়ের মূল বিষয়গুলো সহজভাবে বুঝিয়ে দাও: ") + SUB[d.s].ch[d.c] + " (" + sn(d.s) + ")"; t.focus(); } }, 50); };
ACT.pickCQ = () => {
  modal('<h2 style="margin:0 0 12px;font-size:19px">' + L("Creative question — pick a subject", "সৃজনশীল প্রশ্ন — বিষয় বাছাই") + '</h2><div class="list">' + mySubs().filter(x => x !== "eng" && x.indexOf("gk_") !== 0).map(id => '<button class="li" data-a="cqSub" data-s="' + id + '"><span class="t"><b>' + esc(sn(id)) + '</b></span><span class="mute">›</span></button>').join("") + "</div>");
};
ACT.cqSub = d => { closeModal(); go("subject", { id: d.s }); toast(L("Tap a chapter, then 'Creative Q'", "একটি অধ্যায়ে চাপ দাও, তারপর 'সৃজনশীল'")); };

/* ---------- AI: generate MCQs ---------- */
function needKey() {
  if (apiKey()) return false;
  modal('<h2 style="margin:0 0 6px;font-size:19px">✨ ' + L("Turn on AI (free)", "AI চালু করো (ফ্রি)") + '</h2><p class="small mute" style="margin:0 0 10px">' + L("AI features use Google Gemini's free API. You need a free key once:", "AI ফিচার Google Gemini-এর ফ্রি API ব্যবহার করে। একবার একটি ফ্রি কী লাগবে:") + "</p>" + keySteps() +
    '<button class="btn block" style="margin-top:12px" data-a="toSettings">' + L("Add my key", "কী যোগ করো") + "</button>");
  return true;
}
function keySteps() {
  return '<ol class="small" style="padding-inline-start:20px;margin:0">' +
    "<li>" + L("Open", "খোলো") + ' <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a></li>' +
    "<li>" + L("Sign in with any Google account", "যেকোনো Google অ্যাকাউন্ট দিয়ে সাইন ইন করো") + "</li>" +
    "<li>" + L("Tap “Create API key” and copy it", "“Create API key” চাপো এবং কপি করো") + "</li>" +
    "<li>" + L("Paste it in Settings → AI key", "সেটিংস → AI কী-তে পেস্ট করো") + "</li></ol>";
}
ACT.toSettings = () => { closeModal(); go("settings"); };
function aiErr(e) {
  const m = String(e && e.message || e);
  if (m === "NOKEY") return L("Add your free Gemini key in Settings.", "সেটিংসে তোমার ফ্রি Gemini কী দাও।");
  if (m === "BADKEY") return L("Your AI key is not valid. Check it in Settings.", "AI কী সঠিক নয়। সেটিংসে দেখো।");
  if (m === "RATE") return L("Free AI limit reached for now. Try again in a minute (or tomorrow).", "এখনকার ফ্রি সীমা শেষ। এক মিনিট পর (বা কাল) আবার চেষ্টা করো।");
  if ((m === "NETWORK" || /fetch|network/i.test(m)) && !AI.isNative() && navigator.onLine) return L("AI can't connect from this web preview — it works in the Android app.", "এই ওয়েব প্রিভিউ থেকে AI সংযোগ হয় না — অ্যান্ড্রয়েড অ্যাপে কাজ করবে।");
  if (m === "NETWORK" || /fetch|network|timeout/i.test(m)) return L("No internet connection. Built-in questions still work offline.", "ইন্টারনেট সংযোগ নেই। বিল্ট-ইন প্রশ্ন অফলাইনে চলবে।");
  return L("AI error: ", "AI সমস্যা: ") + m;
}
function busy(msg) { modal('<div class="row" style="padding:8px 0"><span class="spin"></span><b>' + esc(msg) + '</b></div><p class="small mute" style="margin:8px 0 0">' + L("This usually takes 5–20 seconds.", "সাধারণত ৫–২০ সেকেন্ড লাগে।") + "</p>"); }
function sysPrompt(sid) {
  const p = P(), lang = contentLang(sid);
  const lvl = p.exam === "ADM" ? "university admission test (" + ((C.EXAMS.ADM.targets[p.target] || {}).en || "") + ")" : p.exam + " (" + ((C.GROUPS[p.group] || {}).en || "") + " group)";
  return "You are an expert teacher and question setter for the Bangladesh NCTB curriculum, preparing a student for the " + lvl + " exam. " +
    "Write accurate, exam-standard content exactly like Bangladesh education board" + (p.exam === "ADM" ? " and university admission" : "") + " questions. " +
    "Write everything in " + (lang === "bn" ? "Bangla (standard Bangla script, NCTB Bangla-version terminology)" : "English (NCTB English-version terminology)") + ". " +
    "Use Unicode symbols for math and chemistry (x², √, π, H₂O, →), never LaTeX. Double-check every fact and calculation before answering.";
}
async function aiGenerate(s, c, n, diff) {
  if (needKey()) return;
  busy(L("Making " + n + " new questions…", N(n) + "টি নতুন প্রশ্ন তৈরি হচ্ছে…"));
  const dmap = { easy: "easy, knowledge-level", medium: "board-exam standard (mix of knowledge, comprehension and application)", hard: "hard, admission-test standard with tricky distractors" };
  try {
    const out = await AI.generate({
      key: apiKey(), model: S.settings.model, system: sysPrompt(s), json: true, schema: AI.MCQ_SCHEMA, temperature: 0.9,
      onModel: m => { S.settings.model = m; save(); },
      prompt: "Create " + n + " different " + dmap[diff] + " multiple-choice questions for the subject '" + SUB[s].en + "', chapter '" + SUB[s].ch[c] + "'. " +
        "Cover different topics of the chapter; avoid trivial or repeated questions. Each item: q (question), options (exactly 4 short options, no letter prefixes), answer (0-based index of the single correct option), explanation (1–3 sentences why it is correct). Vary the position of the correct answer."
    });
    const arr = (Array.isArray(out) ? out : (out.questions || [])).filter(x => x && x.q && Array.isArray(x.options) && x.options.length === 4 && x.answer >= 0 && x.answer <= 3);
    if (!arr.length) throw new Error("AI returned no usable questions");
    const stamp = Date.now().toString(36);
    const qs = arr.map((x, i) => ({ id: "a" + stamp + i, s, c, q: String(x.q), o: x.options.map(String), a: Number(x.answer), e: String(x.explanation || ""), src: "ai", d: diff }));
    S.ai = qs.concat(S.ai).slice(0, 3000); reindex(); save();
    closeModal();
    startQuiz({ mode: "practice", title: "✨ " + SUB[s].ch[c], qs });
  } catch (e) { closeModal(); toast(aiErr(e)); }
}

/* ---------- Quiz engine ---------- */
function startQuiz(o) {
  const qs = (o.qs || []).filter(Boolean);
  if (!qs.length) return toast(L("No questions available.", "কোনো প্রশ্ন পাওয়া যায়নি।"));
  quiz = {
    mode: o.mode, title: o.title, i: 0, done: false,
    items: qs.map(q => ({ id: q.id, perm: shuffle([0, 1, 2, 3]) })),
    ans: {}, shown: {}, ai: {},
    limit: o.limit || 0, neg: o.neg || 0, start: Date.now(), meta: o.meta || {}
  };
  stopTimer();
  go("quiz", {});
  if (quiz.limit) timerId = setInterval(tick, 1000);
}
function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }
function remaining() { return Math.max(0, quiz.limit - Math.floor((Date.now() - quiz.start) / 1000)); }
const mmss = s => N(String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"));
function tick() {
  if (!quiz || quiz.done) return stopTimer();
  const r = remaining(), el = $("#timer");
  if (el) { el.textContent = "⏱ " + mmss(r); el.classList.toggle("low", r < 60); }
  if (r <= 0) { stopTimer(); toast(L("Time's up! Submitting…", "সময় শেষ! জমা দেওয়া হচ্ছে…")); finishQuiz(); }
}
VIEWS.quiz = function () {
  if (!quiz) return VIEWS.home();
  const it = quiz.items[quiz.i], q = BYID[it.id];
  const practice = quiz.mode === "practice";
  const chosen = quiz.ans[quiz.i];
  const reveal = practice ? quiz.shown[quiz.i] : false;
  const isBm = S.bm.indexOf(q.id) >= 0;
  const answered = Object.keys(quiz.ans).length;
  let html = '<div class="qhead"><span class="pill">' + N(quiz.i + 1) + " / " + N(quiz.items.length) + "</span>" +
    '<span class="small mute grow" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(sn(q.s)) + " · " + esc(SUB[q.s].ch[q.c] || "") + "</span>" +
    (quiz.limit ? '<span class="timer" id="timer">⏱ ' + mmss(remaining()) + "</span>" : "") + "</div>";
  if (quiz.items.length > 1) {
    html += '<div class="qnav" id="qnav">' + quiz.items.map((x, k) => {
      let cls = "";
      if (practice && quiz.shown[k]) cls = BYID[x.id].a === x.perm[quiz.ans[k]] ? "okk" : "nok";
      else if (quiz.ans[k] != null) cls = "d";
      return '<button class="' + cls + (k === quiz.i ? " c" : "") + '" data-a="qJump" data-k="' + k + '" aria-label="Question ' + (k + 1) + '">' + N(k + 1) + "</button>";
    }).join("") + "</div>";
  }
  html += '<div class="qtext">' + esc(q.q) + "</div>";
  it.perm.forEach((oi, k) => {
    let cls = "";
    if (reveal) { if (oi === q.a) cls = "ok"; else if (k === chosen) cls = "no"; }
    else if (k === chosen) cls = "sel";
    html += '<button class="opt ' + cls + '" data-a="qPick" data-k="' + k + '" ' + (reveal ? "disabled" : "") + '><span class="b">' + letter(k, q) + "</span><span>" + esc(q.o[oi]) + "</span></button>";
  });
  if (reveal) {
    const ok = q.a === it.perm[chosen];
    html += '<div class="explain"><b>' + (ok ? "✓ " + L("Correct!", "সঠিক!") : "✗ " + L("Correct answer: ", "সঠিক উত্তর: ") + letter(it.perm.indexOf(q.a), q)) + "</b>" + esc(q.e) + "</div>";
    if (quiz.ai[quiz.i]) html += '<div class="card small" style="white-space:pre-wrap">' + (quiz.ai[quiz.i] === 1 ? '<span class="spin"></span>' : md(quiz.ai[quiz.i])) + "</div>";
    else html += '<button class="btn line block" style="margin-bottom:6px" data-a="qExplain">✨ ' + L("Explain in detail with AI", "AI দিয়ে বিস্তারিত ব্যাখ্যা") + "</button>";
  }
  const last = quiz.i === quiz.items.length - 1;
  html += '<div class="footbar">' +
    '<button class="btn line" data-a="qBm" aria-label="Bookmark" style="min-width:52px">' + (isBm ? "★" : "☆") + "</button>" +
    (quiz.i > 0 ? '<button class="btn line" data-a="qMove" data-d="-1">‹</button>' : "") +
    (practice
      ? (last && reveal ? '<button class="btn grow" data-a="qFinish">' + L("Finish", "শেষ করো") + "</button>" : '<button class="btn grow" data-a="qMove" data-d="1" ' + (reveal ? "" : "disabled") + ">" + L("Next", "পরবর্তী") + " ›</button>")
      : (last ? '<button class="btn grow red" data-a="qSubmit">' + L("Submit", "জমা দাও") + " (" + N(answered) + "/" + N(quiz.items.length) + ")</button>" : '<button class="btn grow" data-a="qMove" data-d="1">' + L("Next", "পরবর্তী") + " ›</button>")) +
    "</div>";
  if (!practice && !last) html += '<button class="btn line block" data-a="qSubmit" style="margin-top:4px">' + L("Submit now", "এখনই জমা দাও") + "</button>";
  return {
    title: esc(quiz.title), nav: false, html,
    after: () => { const n = $("#qnav .c"); if (n) n.scrollIntoView({ block: "nearest", inline: "center" }); }
  };
};
ACT.qPick = d => {
  const k = Number(d.k);
  if (quiz.mode === "practice") {
    if (quiz.shown[quiz.i]) return;
    quiz.ans[quiz.i] = k; quiz.shown[quiz.i] = true;
    const it = quiz.items[quiz.i], q = BYID[it.id];
    record(q, q.a === it.perm[k]); save();
  } else {
    quiz.ans[quiz.i] = quiz.ans[quiz.i] === k ? undefined : k;
    if (quiz.ans[quiz.i] === undefined) delete quiz.ans[quiz.i];
  }
  render();
};
ACT.qMove = d => { quiz.i = Math.max(0, Math.min(quiz.items.length - 1, quiz.i + Number(d.d))); render(); window.scrollTo(0, 0); };
ACT.qJump = d => { quiz.i = Number(d.k); render(); window.scrollTo(0, 0); };
ACT.qBm = () => {
  const id = quiz.items[quiz.i].id, k = S.bm.indexOf(id);
  if (k >= 0) S.bm.splice(k, 1); else S.bm.unshift(id);
  save(); render(); toast(k >= 0 ? L("Removed from bookmarks", "বুকমার্ক থেকে সরানো হয়েছে") : L("Bookmarked ★", "বুকমার্ক করা হয়েছে ★"));
};
ACT.qExplain = async () => {
  if (needKey()) return;
  const i = quiz.i, it = quiz.items[i], q = BYID[it.id];
  quiz.ai[i] = 1; render();
  try {
    const opts = it.perm.map((oi, k) => letter(k, q) + ") " + q.o[oi]).join("\n");
    const mine = quiz.ans[i] != null ? letter(quiz.ans[i], q) : "-";
    const t = await AI.generate({
      key: apiKey(), model: S.settings.model, system: sysPrompt(q.s), onModel: m => { S.settings.model = m; save(); }, temperature: 0.4,
      prompt: "Question: " + q.q + "\n" + opts + "\nCorrect answer: " + letter(it.perm.indexOf(q.a), q) + "\nStudent chose: " + mine +
        "\nExplain step by step why the correct answer is right" + (mine !== letter(it.perm.indexOf(q.a), q) ? " and why the student's choice is wrong" : "") +
        ". Add one quick memory tip. Keep it under 150 words, plain text, short lines."
    });
    quiz.ai[i] = t;
  } catch (e) { delete quiz.ai[i]; toast(aiErr(e)); }
  if (stack[stack.length - 1].v === "quiz" && quiz && quiz.i === i) render();
};
ACT.qFinish = () => finishQuiz();
ACT.qSubmit = () => {
  const left = quiz.items.length - Object.keys(quiz.ans).length;
  ask(L("Submit test?", "টেস্ট জমা দেবে?"), left ? L(left + " question(s) unanswered.", N(left) + "টি প্রশ্নের উত্তর দেওয়া হয়নি।") : L("All questions answered.", "সব প্রশ্নের উত্তর দেওয়া হয়েছে।"), L("Submit", "জমা দাও"), finishQuiz);
};
function confirmLeave() {
  ask(L("Leave this test?", "টেস্ট ছেড়ে যাবে?"), quiz.mode === "mock" ? L("Your answers will be lost.", "তোমার উত্তরগুলো হারিয়ে যাবে।") : L("Your progress so far is saved.", "এ পর্যন্ত অগ্রগতি সংরক্ষিত।"), L("Leave", "ছেড়ে যাও"), () => {
    if (quiz.mode === "practice" && Object.keys(quiz.shown).length) { finishQuiz(); return; }
    quiz.done = true; stopTimer(); back();
  }, true);
}
function finishQuiz() {
  stopTimer();
  if (!quiz || quiz.done) return;
  quiz.done = true;
  let c = 0, w = 0, sk = 0; const subs = {};
  quiz.items.forEach((it, k) => {
    const q = BYID[it.id], ch = quiz.ans[k];
    subs[q.s] = subs[q.s] || [0, 0]; subs[q.s][1]++;
    if (ch == null) { sk++; return; }
    const ok = q.a === it.perm[ch];
    if (ok) { c++; subs[q.s][0]++; } else w++;
    if (quiz.mode === "mock") record(q, ok);
  });
  const score = Math.max(0, c - w * quiz.neg);
  const res = { t: Date.now(), mode: quiz.mode, title: quiz.title, n: quiz.items.length, c, w, sk, neg: quiz.neg, score: Math.round(score * 100) / 100, dur: Math.round((Date.now() - quiz.start) / 1000), subs, items: quiz.items.map((it, k) => [it.id, it.perm, quiz.ans[k] == null ? -1 : quiz.ans[k]]) };
  if (quiz.mode === "mock" || quiz.items.length >= 5) { S.stats.history.unshift(res); S.stats.history = S.stats.history.slice(0, 40); }
  save();
  stack = stack.filter(x => x.v !== "quiz");
  go("result", { res });
}

/* ---------- Result & review ---------- */
VIEWS.result = function (p) {
  const r = p.res, acc = pct(r.c, r.c + r.w);
  const msg = acc >= 80 ? L("Excellent! A+ form 🎉", "অসাধারণ! A+ প্রস্তুতি 🎉") : acc >= 60 ? L("Good work — keep going 💪", "ভালো হয়েছে — চালিয়ে যাও 💪") : L("Keep practising — review your mistakes 📘", "আরও অনুশীলন দরকার — ভুলগুলো দেখে নাও 📘");
  const html = '<div class="card" style="text-align:center"><div class="small mute">' + esc(r.title) + '</div><div class="score" style="margin:10px 0 4px">' + N(r.score) + '<span style="font-size:24px;color:var(--mute)">/' + N(r.n) + "</span></div><b>" + msg + "</b>" +
    '<div class="stat" style="margin:16px 0 0"><div><b style="color:var(--ok)">' + N(r.c) + "</b><span>" + L("correct", "সঠিক") + '</span></div><div><b style="color:var(--red)">' + N(r.w) + "</b><span>" + L("wrong", "ভুল") + "</span></div><div><b>" + N(r.sk) + "</b><span>" + L("skipped", "বাদ") + "</span></div></div>" +
    '<p class="small mute" style="margin:12px 0 0">' + L("Accuracy", "সঠিকতা") + " " + N(acc) + "% · " + L("Time", "সময়") + " " + mmss(r.dur) + (r.neg ? " · " + L("Negative", "নেগেটিভ") + " −" + N(r.neg) + "/" + L("wrong", "ভুল") : "") + "</p></div>" +
    (Object.keys(r.subs).length > 1 ? '<div class="sec">' + L("By subject", "বিষয়ভিত্তিক") + '</div><div class="card">' + Object.entries(r.subs).map(([s, v]) => '<div style="margin-bottom:10px"><div class="row small"><span class="grow">' + esc(sn(s)) + "</span><b>" + N(v[0]) + "/" + N(v[1]) + '</b></div><div class="bar ' + (pct(v[0], v[1]) < 50 ? "r" : "") + '"><i style="width:' + pct(v[0], v[1]) + '%"></i></div></div>').join("") + "</div>" : "") +
    '<div class="grid2"><button class="btn ghost" data-a="review">' + L("Review answers", "উত্তর দেখো") + '</button><button class="btn" data-a="tab" data-v="home">' + L("Done", "শেষ") + "</button></div>" +
    (r.w ? '<button class="btn line block" style="margin-top:10px" data-a="retryWrong">' + L("Retry wrong ones", "ভুলগুলো আবার") + " (" + N(r.w) + ")</button>" : "");
  return { title: L("Result", "ফলাফল"), html, nav: false };
};
ACT.review = () => { const r = stack[stack.length - 1].p.res; go("review", { res: r }); };
ACT.retryWrong = () => {
  const r = stack[stack.length - 1].p.res;
  const qs = r.items.filter(x => x[2] >= 0 && BYID[x[0]] && BYID[x[0]].a !== x[1][x[2]]).map(x => BYID[x[0]]);
  startQuiz({ mode: "practice", title: L("Retry mistakes", "ভুলগুলো আবার"), qs });
};
VIEWS.review = function (p) {
  const r = p.res;
  const html = r.items.map((x, k) => {
    const q = BYID[x[0]]; if (!q) return "";
    const ch = x[2], ok = ch >= 0 && q.a === x[1][ch];
    return '<div class="card"><div class="row small" style="margin-bottom:6px"><span class="pill ' + (ch < 0 ? "a" : ok ? "" : "r") + '">' + N(k + 1) + " · " + (ch < 0 ? L("Skipped", "বাদ") : ok ? L("Correct", "সঠিক") : L("Wrong", "ভুল")) + '</span><span class="mute grow" style="text-align:end">' + esc(sn(q.s)) + '</span></div><b style="display:block;margin-bottom:8px;white-space:pre-wrap">' + esc(q.q) + "</b>" +
      x[1].map((oi, j) => '<div class="small" style="padding:4px 0;' + (oi === q.a ? "color:var(--ok);font-weight:700" : j === ch ? "color:var(--red);text-decoration:line-through" : "") + '">' + letter(j, q) + ") " + esc(q.o[oi]) + "</div>").join("") +
      '<div class="explain small" style="margin-bottom:0">' + esc(q.e) + "</div></div>";
  }).join("");
  return { title: L("Review", "পর্যালোচনা"), html, nav: false };
};

/* ---------- Saved (mistakes / bookmarks) ---------- */
VIEWS.saved = function (p) {
  const ids = (p.kind === "bm" ? S.bm : S.mis).filter(id => BYID[id]);
  const title = p.kind === "bm" ? L("Bookmarks", "বুকমার্ক") : L("My mistakes", "আমার ভুলগুলো");
  if (!ids.length) return { title, html: '<div class="empty"><div class="art">' + (p.kind === "bm" ? "☆" : "✓") + "</div>" + (p.kind === "bm" ? L("Tap ☆ during practice to save hard questions here.", "অনুশীলনের সময় ☆ চাপলে কঠিন প্রশ্ন এখানে জমা হবে।") : L("No mistakes to fix. Wrong answers will appear here automatically.", "ঠিক করার মতো ভুল নেই। ভুল উত্তরগুলো এখানে নিজে থেকে আসবে।")) + "</div>" };
  const html = '<button class="btn block" style="margin-bottom:12px" data-a="practiceSaved" data-k="' + p.kind + '">' + L("Practice these", "এগুলো অনুশীলন করো") + " (" + N(Math.min(ids.length, 30)) + ")</button>" +
    '<div class="list">' + ids.slice(0, 100).map(id => { const q = BYID[id]; return '<div class="li"><span class="t"><b>' + esc(q.q) + "</b><span>" + esc(sn(q.s)) + " · ✓ " + esc(q.o[q.a]) + "</span></span></div>"; }).join("") + "</div>";
  return { title, html };
};
ACT.practiceSaved = d => {
  const ids = (d.k === "bm" ? S.bm : S.mis).filter(id => BYID[id]);
  startQuiz({ mode: "practice", title: d.k === "bm" ? L("Bookmarks", "বুকমার্ক") : L("My mistakes", "আমার ভুলগুলো"), qs: shuffle(ids).slice(0, 30).map(id => BYID[id]) });
};

/* ---------- Mock test setup ---------- */
VIEWS.mock = function () { return VIEWS.mocksetup({ root: true }); };
let mockCfg = null;
VIEWS.mocksetup = function (p) {
  const adm = P().exam === "ADM";
  if (!mockCfg || p.subs) { mockCfg = { subs: p.subs ? [p.subs] : mySubs().slice(), n: adm ? 50 : 30, min: adm ? 45 : 30, neg: defaultNeg(), src: "bank" }; delete p.subs; }
  const m = mockCfg;
  const presets = [
    ["board", "📝 " + L("Board MCQ", "বোর্ড MCQ"), L("30 questions · 30 min · no negative", "৩০ প্রশ্ন · ৩০ মিনিট · নেগেটিভ নেই"), 30, 30, 0],
    ["adm", "🎓 " + L("Admission style", "ভর্তি স্টাইল"), L("50 questions · 45 min · −0.25", "৫০ প্রশ্ন · ৪৫ মিনিট · −০.২৫"), 50, 45, 0.25],
    ["quick", "⚡ " + L("Quick test", "দ্রুত টেস্ট"), L("10 questions · 10 min", "১০ প্রশ্ন · ১০ মিনিট"), 10, 10, 0]
  ];
  const avail = pool(q => m.subs.indexOf(q.s) >= 0).length;
  const html =
    '<div class="sec" style="margin-top:4px">' + L("Format", "ফরম্যাট") + '</div><div class="list">' + presets.map(x => '<button class="li" data-a="mockPreset" data-n="' + x[3] + '" data-m="' + x[4] + '" data-g="' + x[5] + '"><span class="t"><b>' + x[1] + "</b><span>" + x[2] + "</span></span>" + (m.n === x[3] && m.min === x[4] && m.neg === x[5] ? '<span class="pill">✓</span>' : "") + "</button>").join("") + "</div>" +
    '<div class="sec">' + L("Subjects", "বিষয়") + '</div><div class="chips">' + mySubs().map(id => '<button class="chip ' + (m.subs.indexOf(id) >= 0 ? "on" : "") + '" data-a="mockSub2" data-s="' + id + '">' + esc(sn(id)) + "</button>").join("") + "</div>" +
    '<div class="grid2" style="margin-top:6px"><div><label class="f" for="mN">' + L("Questions", "প্রশ্ন") + '</label><select class="in" id="mN">' + [10, 20, 25, 30, 40, 50, 60, 100].map(x => "<option " + (x === m.n ? "selected" : "") + ' value="' + x + '">' + N(x) + "</option>").join("") + "</select></div>" +
    '<div><label class="f" for="mT">' + L("Minutes", "মিনিট") + '</label><select class="in" id="mT">' + [10, 15, 20, 25, 30, 45, 60, 90].map(x => "<option " + (x === m.min ? "selected" : "") + ' value="' + x + '">' + N(x) + "</option>").join("") + "</select></div></div>" +
    '<label class="f" for="mG">' + L("Negative marking per wrong answer", "প্রতি ভুলে নেগেটিভ মার্ক") + '</label><select class="in" id="mG">' + [0, 0.25, 0.5].map(x => "<option " + (x === m.neg ? "selected" : "") + ' value="' + x + '">' + (x ? "−" + N(x) : L("None", "নেই")) + "</option>").join("") + "</select>" +
    '<label class="f">' + L("Questions from", "প্রশ্নের উৎস") + '</label><div class="chips" id="mS"><button class="chip ' + (m.src === "bank" ? "on" : "") + '" data-a="mockSrc" data-v="bank">' + L("Saved bank", "সংরক্ষিত প্রশ্ন") + " (" + N(avail) + ')</button><button class="chip ' + (m.src === "ai" ? "on" : "") + '" data-a="mockSrc" data-v="ai">✨ ' + L("Fresh AI set", "নতুন AI সেট") + "</button></div>" +
    '<p class="tiny mute" style="margin:8px 0 0">' + (m.src === "ai" ? L("AI writes a brand-new paper (up to 30 questions per call). Needs internet.", "AI একদম নতুন প্রশ্নপত্র তৈরি করবে (প্রতিবারে সর্বোচ্চ ৩০টি)। ইন্টারনেট লাগবে।") : L("Uses built-in and your saved AI questions. Works offline.", "বিল্ট-ইন ও তোমার সংরক্ষিত AI প্রশ্ন ব্যবহার হবে। অফলাইনে চলে।")) + "</p>" +
    '<button class="btn block" style="margin-top:18px" data-a="mockStart">' + L("Start mock test", "মডেল টেস্ট শুরু করো") + "</button>";
  return { title: L("Mock Test", "মডেল টেস্ট"), html };
};
function mockRead() { const n = $("#mN"), t = $("#mT"), g = $("#mG"); if (n) mockCfg.n = Number(n.value); if (t) mockCfg.min = Number(t.value); if (g) mockCfg.neg = Number(g.value); }
ACT.mockPreset = d => { mockCfg.n = Number(d.n); mockCfg.min = Number(d.m); mockCfg.neg = Number(d.g); render(); };
ACT.mockSub2 = d => { mockRead(); const k = mockCfg.subs.indexOf(d.s); if (k >= 0) { if (mockCfg.subs.length > 1) mockCfg.subs.splice(k, 1); } else mockCfg.subs.push(d.s); render(); };
ACT.mockSrc = d => { mockRead(); mockCfg.src = d.v; render(); };
ACT.mockStart = async () => {
  mockRead(); const m = mockCfg;
  const title = L("Mock test", "মডেল টেস্ট") + (m.subs.length === 1 ? " · " + sn(m.subs[0]) : "");
  if (m.src === "bank") {
    // spread evenly across subjects
    const per = {}; m.subs.forEach(s => { per[s] = shuffle(pool(q => q.s === s)); });
    const out = []; let added = true;
    while (out.length < m.n && added) { added = false; m.subs.forEach(s => { if (out.length < m.n && per[s].length) { out.push(per[s].pop()); added = true; } }); }
    if (out.length < m.n) toast(L("Only " + out.length + " questions available — generate more with AI.", "মাত্র " + N(out.length) + "টি প্রশ্ন আছে — AI দিয়ে আরও তৈরি করো।"));
    return startQuiz({ mode: "mock", title, qs: shuffle(out), limit: Math.round(m.min * 60 * (out.length / m.n || 1)), neg: m.neg });
  }
  if (needKey()) return;
  const n = Math.min(m.n, 30);
  busy(L("Writing your question paper…", "তোমার প্রশ্নপত্র তৈরি হচ্ছে…"));
  try {
    const subs = m.subs.map(s => SUB[s].en + " (chapters: " + SUB[s].ch.join("; ") + ")").join("\n");
    const out = await AI.generate({
      key: apiKey(), model: S.settings.model, system: sysPrompt(m.subs.length === 1 ? m.subs[0] : "mix"), json: true, temperature: 0.9,
      onModel: x => { S.settings.model = x; save(); },
      schema: { type: "ARRAY", items: { type: "OBJECT", properties: { subject: { type: "STRING" }, chapter: { type: "INTEGER" }, q: { type: "STRING" }, options: { type: "ARRAY", items: { type: "STRING" } }, answer: { type: "INTEGER" }, explanation: { type: "STRING" } }, required: ["subject", "chapter", "q", "options", "answer", "explanation"] } },
      prompt: "Create a " + n + "-question MCQ model test paper" + (m.neg ? " in university admission style" : " in Bangladesh board exam style") + ", spread across these subjects:\n" + subs +
        "\nFor each item return: subject (exactly the English subject name given above), chapter (0-based index in that subject's chapter list), q, options (exactly 4), answer (0-based correct index), explanation (1–2 sentences). Vary difficulty and the correct answer position."
    });
    const byName = {}; m.subs.forEach(s => { byName[SUB[s].en.toLowerCase()] = s; });
    const stamp = Date.now().toString(36);
    const qs = (Array.isArray(out) ? out : []).filter(x => x && x.q && Array.isArray(x.options) && x.options.length === 4 && x.answer >= 0 && x.answer <= 3).map((x, i) => {
      const s = byName[String(x.subject || "").toLowerCase()] || m.subs[i % m.subs.length];
      const c = Math.max(0, Math.min(SUB[s].ch.length - 1, Number(x.chapter) || 0));
      return { id: "a" + stamp + "m" + i, s, c, q: String(x.q), o: x.options.map(String), a: Number(x.answer), e: String(x.explanation || ""), src: "ai" };
    });
    if (!qs.length) throw new Error("AI returned no usable questions");
    S.ai = qs.concat(S.ai).slice(0, 3000); reindex(); save(); closeModal();
    startQuiz({ mode: "mock", title: "✨ " + title, qs, limit: Math.round(m.min * 60 * qs.length / m.n), neg: m.neg });
  } catch (e) { closeModal(); toast(aiErr(e)); }
};

/* ---------- Creative question (CQ) ---------- */
VIEWS.cq = function (p) {
  const s = p.s, c = p.c, lang = contentLang(s);
  const after = () => { if (!p.data && !p.loading && !p.err) loadCQ(p); };
  let html = '<div class="small mute" style="margin-bottom:8px">' + esc(sn(s)) + " · " + esc(SUB[s].ch[c]) + "</div>";
  if (p.loading) html += '<div class="card row"><span class="spin"></span><b>' + L("Writing a creative question…", "সৃজনশীল প্রশ্ন তৈরি হচ্ছে…") + "</b></div>";
  else if (p.err) html += '<div class="card"><b>' + esc(p.err) + '</b><button class="btn block" style="margin-top:12px" data-a="cqAgain">' + L("Try again", "আবার চেষ্টা") + "</button></div>";
  else if (p.data) {
    const d = p.data;
    html += '<div class="card cq"><h3 style="margin-top:0">' + (lang === "bn" ? "উদ্দীপক" : "Stimulus") + "</h3>" + md(d.stem) + "</div>" +
      '<div class="card cq">' + (d.parts || []).map(x => "<h3>" + esc(x.label) + ") " + esc(x.question) + ' <span class="pill">' + N(x.marks) + "</span></h3>" + '<details class="ans"><summary>' + L("Show model answer", "নমুনা উত্তর দেখো") + "</summary><div>" + md(x.answer) + "</div></details>").join("") + "</div>" +
      '<p class="tiny mute">' + L("Write your own answer on paper first, then compare.", "আগে খাতায় নিজে উত্তর লেখো, তারপর মিলিয়ে নাও।") + "</p>" +
      '<button class="btn block" data-a="cqAgain">✨ ' + L("Another creative question", "আরেকটি সৃজনশীল প্রশ্ন") + "</button>";
  }
  return { title: L("Creative Question", "সৃজনশীল প্রশ্ন"), html, nav: false, after };
};
async function loadCQ(p) {
  if (needKey()) { stack.pop(); render(); return; }
  p.loading = true; render();
  const lang = contentLang(p.s);
  try {
    const d = await AI.generate({
      key: apiKey(), model: S.settings.model, system: sysPrompt(p.s), json: true, schema: AI.CQ_SCHEMA, temperature: 0.9,
      onModel: m => { S.settings.model = m; save(); },
      prompt: "Create one Bangladesh board-standard creative question (srijonshil prosno) for '" + SUB[p.s].en + "', chapter '" + SUB[p.s].ch[p.c] + "'. " +
        "stem: a realistic stimulus of 3–6 sentences (may include data, an experiment, a situation or a described figure). parts: exactly 4 items with labels " + (lang === "bn" ? "ক, খ, গ, ঘ" : "a, b, c, d") +
        " — knowledge (1 mark), comprehension (2 marks), application (3 marks), higher-order ability (4 marks). answer: a full model answer as an examiner expects for those marks, with steps for calculations."
    });
    p.data = d; p.loading = false;
  } catch (e) { p.loading = false; p.err = aiErr(e); }
  const cur = stack[stack.length - 1]; if (cur && cur.p === p) render();
}
ACT.cqAgain = () => { const cur = stack[stack.length - 1]; replace("cq", { s: cur.p.s, c: cur.p.c }); };

/* ---------- AI Tutor ---------- */
VIEWS.tutor = function () {
  const hasKey = !!apiKey();
  const chips = [
    L("Explain Newton's 3rd law with examples", "নিউটনের ৩য় সূত্র উদাহরণসহ বুঝিয়ে দাও"),
    L("Make me a 7-day study routine", "আমার জন্য ৭ দিনের পড়ার রুটিন বানাও"),
    L("Tips to score A+ in MCQ", "MCQ-তে A+ পাওয়ার টিপস দাও"),
    L("How do I solve a creative question?", "সৃজনশীল প্রশ্নের উত্তর কীভাবে লিখব?")
  ];
  let html = "";
  if (!hasKey) html += '<div class="card"><h2>✨ ' + L("Turn on your AI tutor (free)", "তোমার AI শিক্ষক চালু করো (ফ্রি)") + "</h2>" + keySteps() + '<button class="btn block" style="margin-top:12px" data-a="go" data-v="settings">' + L("Add my key", "কী যোগ করো") + "</button></div>";
  if (!S.chat.length) html += '<div class="empty" style="padding-top:12px"><div class="art">💬</div>' + L("Ask anything from your syllabus — in Bangla, English or Banglish.", "সিলেবাসের যেকোনো প্রশ্ন করো — বাংলা, ইংরেজি বা বাংলিশে।") + '</div><div class="chips" style="justify-content:center;margin-bottom:12px">' + chips.map(c => '<button class="chip" data-a="chatChip">' + esc(c) + "</button>").join("") + "</div>";
  html += '<div id="chat">' + S.chat.map(m => '<div class="msg ' + (m.role === "user" ? "u" : "a") + '">' + (m.role === "user" ? esc(m.text) : md(m.text)) + "</div>").join("") + (chatBusy ? '<div class="msg a"><span class="spin"></span></div>' : "") + "</div>";
  html += '<div class="composer"><textarea class="in grow" id="chatIn" rows="1" placeholder="' + L("Type your question…", "তোমার প্রশ্ন লেখো…") + '"></textarea><button class="btn" data-a="chatSend" aria-label="Send" ' + (chatBusy ? "disabled" : "") + ">➤</button></div>";
  return {
    title: L("AI Tutor", "AI শিক্ষক"), html,
    right: S.chat.length ? '<button class="iconbtn" data-a="chatClear" aria-label="Clear chat">🗑</button>' : "",
    after: () => { if (S.chat.length) window.scrollTo(0, document.body.scrollHeight); }
  };
};
let chatBusy = false;
ACT.chatChip = (d, b) => { $("#chatIn").value = b.textContent; ACT.chatSend(); };
ACT.chatClear = () => ask(L("Clear chat?", "চ্যাট মুছবে?"), L("This removes the conversation.", "পুরো কথোপকথন মুছে যাবে।"), L("Clear", "মুছো"), () => { S.chat = []; save(); render(); }, true);
ACT.chatSend = async () => {
  const inp = $("#chatIn"); const text = (inp && inp.value || "").trim();
  if (!text || chatBusy) return;
  if (needKey()) return;
  const hist = S.chat.slice(-12);
  S.chat.push({ role: "user", text }); chatBusy = true; save(); render();
  const p = P();
  try {
    const t = await AI.generate({
      key: apiKey(), model: S.settings.model, history: hist, temperature: 0.6, onModel: m => { S.settings.model = m; save(); },
      system: "You are 'Prostuti Tutor', a friendly, encouraging expert teacher for a Bangladeshi student preparing for " + (p.exam === "ADM" ? "university admission tests" : p.exam + " (" + ((C.GROUPS[p.group] || {}).en || "") + " group, " + (p.version === "en" ? "English" : "Bangla") + " version)") +
        ". Follow the NCTB syllabus. Explain step by step with simple examples. Reply in the same language the student writes in (Bangla, English or Banglish→Bangla). Keep answers short enough for a phone screen; use plain text, short paragraphs and simple lists, no tables, no LaTeX (use Unicode like x², √). If the question is outside studies, gently guide back to studies.",
      prompt: text
    });
    S.chat.push({ role: "model", text: t });
  } catch (e) { S.chat.push({ role: "model", text: "⚠ " + aiErr(e) }); }
  chatBusy = false; S.chat = S.chat.slice(-60); save();
  if (stack[0].v === "tutor") render();
};

/* ---------- Progress ---------- */
VIEWS.progress = function () {
  const subs = mySubs();
  const totalAns = Object.values(S.stats.ans).reduce((s, a) => s + a.c + a.w, 0);
  const totalOk = Object.values(S.stats.ans).reduce((s, a) => s + a.c, 0);
  const days = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); days.push([d, S.stats.days[k] || 0]); }
  const mx = Math.max(S.settings.goal || 30, ...days.map(x => x[1]));
  const weak = weakChapters(6);
  const html =
    '<div class="stat"><div><b>' + N(totalAns) + "</b><span>" + L("answered", "উত্তর") + "</span></div><div><b>" + N(pct(totalOk, totalAns)) + "%</b><span>" + L("accuracy", "সঠিকতা") + "</span></div><div><b>🔥 " + N(streak()) + "</b><span>" + L("day streak", "দিন ধারাবাহিক") + "</span></div></div>" +
    '<div class="card"><h2>' + L("Last 7 days", "গত ৭ দিন") + '</h2><div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;align-items:end;height:120px">' +
    days.map(x => '<div style="display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end"><span class="tiny mute">' + (x[1] ? N(x[1]) : "") + '</span><div style="width:100%;max-width:28px;border-radius:6px 6px 2px 2px;background:' + (x[1] >= (S.settings.goal || 30) ? "var(--pri)" : "var(--pri-soft)") + ";height:" + Math.max(4, Math.round((x[1] / mx) * 80)) + 'px"></div><span class="tiny mute">' + esc(x[0].toLocaleDateString(bn() ? "bn-BD" : "en-GB", { weekday: "narrow" })) + "</span></div>").join("") +
    '</div><p class="tiny mute" style="margin:8px 0 0">' + L("Dark bars = daily goal reached", "গাঢ় দাগ = দৈনিক লক্ষ্য পূরণ") + "</p></div>" +
    '<div class="sec">' + L("Subjects", "বিষয়ভিত্তিক") + '</div><div class="card">' + subs.map(s => { const st = subStats(s); return '<div style="margin-bottom:12px"><div class="row small"><span class="grow">' + esc(sn(s)) + "</span><b>" + (st.n ? N(st.p) + "%" : "—") + '</b><span class="mute tiny">' + N(st.n) + '</span></div><div class="bar ' + (st.n && st.p < 50 ? "r" : st.n && st.p < 75 ? "a" : "") + '"><i style="width:' + st.p + '%"></i></div></div>'; }).join("") + "</div>" +
    (weak.length ? '<div class="sec">' + L("Weak chapters", "দুর্বল অধ্যায়") + '</div><div class="list">' + weak.map(w => '<button class="li" data-a="practiceCh" data-s="' + w.s + '" data-c="' + w.c + '"><span class="t"><b>' + esc(SUB[w.s].ch[w.c]) + "</b><span>" + esc(sn(w.s)) + '</span></span><span class="pill r">' + N(w.p) + "%</span></button>").join("") + "</div>" : "") +
    '<div class="sec">' + L("Test history", "টেস্টের ইতিহাস") + "</div>" +
    (S.stats.history.length ? '<div class="list">' + S.stats.history.map((r, i) => '<button class="li" data-a="histOpen" data-i="' + i + '"><span class="t"><b>' + esc(r.title) + "</b><span>" + esc(new Date(r.t).toLocaleString(bn() ? "bn-BD" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })) + '</span></span><span class="pill ' + (pct(r.c, r.n) < 50 ? "r" : "") + '">' + N(r.score) + "/" + N(r.n) + "</span></button>").join("") + "</div>" : '<div class="empty">' + L("Your mock tests will appear here.", "তোমার মডেল টেস্টগুলো এখানে দেখা যাবে।") + "</div>");
  return { title: L("Progress", "অগ্রগতি"), html };
};
ACT.histOpen = d => go("result", { res: S.stats.history[Number(d.i)] });

/* ---------- Settings ---------- */
VIEWS.settings = function () {
  const st = S.settings, p = P();
  const aiCount = S.ai.length;
  const html =
    '<div class="card"><div class="row"><div class="grow"><b>' + esc(p.name || L("Student", "শিক্ষার্থী")) + '</b><div class="small mute">' + esc(examLabel()) + (p.board && p.exam !== "ADM" ? " · " + esc(p.board) : "") + " · " + (p.version === "en" ? "English Version" : "বাংলা ভার্সন") + '</div></div><button class="btn ghost" data-a="editProfile">' + L("Edit", "সম্পাদনা") + "</button></div></div>" +
    '<div class="card"><h2>' + L("Preferences", "পছন্দ") + "</h2>" +
    '<label class="f">' + L("App language", "অ্যাপের ভাষা") + '</label><div class="chips"><button class="chip ' + (!bn() ? "on" : "") + '" data-a="setS" data-k="lang" data-val="en">English</button><button class="chip ' + (bn() ? "on" : "") + '" data-a="setS" data-k="lang" data-val="bn">বাংলা</button></div>' +
    '<label class="f">' + L("Theme", "থিম") + '</label><div class="chips">' + [["system", L("Auto", "স্বয়ংক্রিয়")], ["light", L("Light", "লাইট")], ["dark", L("Dark", "ডার্ক")]].map(x => '<button class="chip ' + (st.theme === x[0] ? "on" : "") + '" data-a="setS" data-k="theme" data-val="' + x[0] + '">' + x[1] + "</button>").join("") + "</div>" +
    '<label class="f" for="sGoal">' + L("Daily goal (questions)", "দৈনিক লক্ষ্য (প্রশ্ন)") + '</label><select class="in" id="sGoal" data-ch="goal">' + [10, 20, 30, 50, 75, 100].map(x => "<option " + (x === st.goal ? "selected" : "") + ' value="' + x + '">' + N(x) + "</option>").join("") + "</select>" +
    '<label class="f" for="sDate">' + L("Exam start date", "পরীক্ষা শুরুর তারিখ") + '</label><input class="in" type="date" id="sDate" data-ch="examDate" value="' + esc(examDate()) + '">' +
    '<p class="tiny mute" style="margin:6px 0 0">' + L("Prefilled with the announced 2027 start date — change it if the board reschedules.", "২০২৭ সালের ঘোষিত শুরুর তারিখ দেওয়া আছে — বোর্ড পরিবর্তন করলে বদলে নাও।") + "</p></div>" +
    '<div class="card"><h2>✨ ' + L("AI (Google Gemini — free)", "AI (Google Gemini — ফ্রি)") + "</h2>" +
    (CFG.apiKey && !st.apiKey ? '<p class="small" style="margin:0 0 8px">✓ ' + L("A built-in key is active. You can add your own for higher limits.", "বিল্ট-ইন কী চালু আছে। বেশি ব্যবহারের জন্য নিজের কী দিতে পারো।") + "</p>" : keySteps()) +
    '<label class="f" for="sKey">' + L("Your Gemini API key", "তোমার Gemini API কী") + '</label><input class="in" id="sKey" type="password" autocomplete="off" spellcheck="false" placeholder="AIza…" value="' + esc(st.apiKey) + '">' +
    '<div class="grid2" style="margin-top:10px"><button class="btn" data-a="saveKey">' + L("Save key", "কী সংরক্ষণ") + '</button><button class="btn line" data-a="testKey">' + L("Test", "পরীক্ষা") + "</button></div>" +
    '<p class="tiny mute" id="keyMsg" style="margin:8px 0 0">' + L("Model", "মডেল") + ": " + esc(st.model || AI.DEFAULT_MODEL) + " · " + L("chosen automatically", "স্বয়ংক্রিয়ভাবে নির্বাচিত") + "</p>" +
    '<p class="tiny mute" style="margin:6px 0 0">' + L("Your key stays on this phone and is sent only to Google.", "তোমার কী শুধু এই ফোনে থাকে এবং শুধু Google-এ পাঠানো হয়।") + "</p></div>" +
    '<div class="card"><h2>' + L("Data", "ডেটা") + '</h2><p class="small mute" style="margin:0 0 10px">' + N(BANK.length) + " " + L("built-in questions", "বিল্ট-ইন প্রশ্ন") + " · " + N(aiCount) + " " + L("saved AI questions", "সংরক্ষিত AI প্রশ্ন") + "</p>" +
    '<div class="grid2"><button class="btn line" data-a="clearAI" ' + (aiCount ? "" : "disabled") + ">" + L("Delete AI questions", "AI প্রশ্ন মুছো") + '</button><button class="btn line" style="color:var(--red)" data-a="resetAll">' + L("Reset everything", "সব রিসেট") + "</button></div></div>" +
    '<p class="tiny mute" style="text-align:center">Prostuti v1.0 · ' + L("Built-in questions follow the NCTB syllabus; AI questions may occasionally contain mistakes — check with your textbook.", "বিল্ট-ইন প্রশ্ন NCTB সিলেবাস অনুযায়ী; AI প্রশ্নে মাঝে মাঝে ভুল থাকতে পারে — পাঠ্যবই মিলিয়ে নাও।") + "</p>";
  return {
    title: L("Settings", "সেটিংস"), html, nav: false,
    after: () => document.querySelectorAll("[data-ch]").forEach(el => el.addEventListener("change", () => { S.settings[el.dataset.ch] = el.dataset.ch === "goal" ? Number(el.value) : el.value; save(); toast(L("Saved", "সংরক্ষিত")); }))
  };
};
ACT.setS = d => { S.settings[d.k] = d.val; save(); render(); };
ACT.editProfile = () => { draft = Object.assign({}, S.profile); go("onboard", { step: 1 }); };
ACT.saveKey = () => { S.settings.apiKey = $("#sKey").value.trim(); S.settings.model = ""; save(); toast(L("Key saved", "কী সংরক্ষিত")); };
ACT.testKey = async () => {
  ACT.saveKey(); if (!apiKey()) return toast(L("Paste your key first", "আগে কী পেস্ট করো"));
  const m = $("#keyMsg"); m.innerHTML = '<span class="spin" style="width:14px;height:14px;border-width:2px;vertical-align:middle"></span> ' + L("Testing…", "পরীক্ষা হচ্ছে…");
  try {
    const t = await AI.generate({ key: apiKey(), model: S.settings.model, prompt: "Reply with just: OK", temperature: 0, onModel: x => { S.settings.model = x; save(); } });
    m.textContent = "✓ " + L("AI is working", "AI কাজ করছে") + " (" + (S.settings.model || AI.DEFAULT_MODEL) + ") — " + t.trim().slice(0, 20);
  } catch (e) { m.textContent = "✗ " + aiErr(e); }
};
ACT.clearAI = () => ask(L("Delete saved AI questions?", "সংরক্ষিত AI প্রশ্ন মুছবে?"), L("Built-in questions and your scores stay.", "বিল্ট-ইন প্রশ্ন ও স্কোর থাকবে।"), L("Delete", "মুছো"), () => {
  const ids = new Set(S.ai.map(q => q.id)); S.ai = []; S.bm = S.bm.filter(i => !ids.has(i)); S.mis = S.mis.filter(i => !ids.has(i)); reindex(); save(); render();
}, true);
ACT.resetAll = () => ask(L("Reset everything?", "সব রিসেট করবে?"), L("Profile, progress, bookmarks and AI questions will be erased. This cannot be undone.", "প্রোফাইল, অগ্রগতি, বুকমার্ক ও AI প্রশ্ন মুছে যাবে। এটি ফেরানো যাবে না।"), L("Reset", "রিসেট"), () => {
  S = defaults(); save(); reindex(); stack = []; render();
}, true);

/* ---------------- boot ---------------- */
document.addEventListener("keydown", e => { if (e.key === "Escape" && modalOpen) closeModal(); if (e.key === "Enter" && !e.shiftKey && e.target.id === "chatIn") { e.preventDefault(); ACT.chatSend(); } });
document.addEventListener("click", e => { // open web links outside the app
  const a = e.target.closest("a[href^='http']"); if (!a) return;
  if (window.AndroidBridge && window.AndroidBridge.openUrl) { e.preventDefault(); window.AndroidBridge.openUrl(a.href); }
});
render();
})();
