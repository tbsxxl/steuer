import { DATA, GLOSSARY, PARAGRAPHS } from "./data.js";
import { GENERATORS, ri, fmt } from "./trainer.js";

/* =========================================================
   Kursplan (Kurstage je Modul) – Grundlage für Countdown und „Heute"-Hinweis
   ========================================================= */
const SCHEDULE = [
  ["2026-10-07", "2026-10-08"],
  ["2026-10-09", "2026-10-12", "2026-10-13", "2026-10-14"],
  ["2026-10-15", "2026-10-16", "2026-10-19"],
  ["2026-10-19"],
  ["2026-10-20"],
  ["2026-10-21", "2026-10-22", "2026-10-23"],
];
const COURSE_DAYS = [...new Set(SCHEDULE.flat())].sort();
const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

const TOTAL_LESSONS = DATA.reduce((n, m) => n + m.lessons.length, 0);
const TOTAL_QUIZ = DATA.reduce((n, m) => n + m.quiz.length, 0);
const TOTAL_DRILLS = DATA.reduce((n, m) => n + (m.drills || []).length, 0) + Object.values(GENERATORS).flat().length;

const $ = (sel, root = document) => root.querySelector(sel);
const main = $("#main");

/* =========================================================
   Hilfsfunktionen
   ========================================================= */
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function strip(html) {
  return String(html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDay(iso, long = false) {
  const [y, m, d] = iso.split("-").map(Number);
  const wd = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return long ? `${wd}, ${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}` : `${wd} ${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.`;
}
function daysBetween(a, b) {
  const p = s => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((p(b) - p(a)) / 86400000);
}
function readingMinutes(l) {
  const text = [l.intro, ...l.blocks.map(b => b.h + " " + b.p), l.ex, l.warn, l.vis].map(strip).join(" ");
  return Math.max(2, Math.round(text.split(" ").length / 180));
}
let toastTimer = 0;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

/* =========================================================
   Fortschritt (nur lokal im Browser)
   ========================================================= */
const PROGRESS_KEY = "stb_progress";
function emptyProgress() { return { v: 3, read: {}, quiz: {}, wrong: {}, cards: {}, drills: {}, test: null, last: null }; }
// Lektionen werden über stabile IDs gespeichert. Ältere Stände (v1) speicherten
// „Modul-Lektion“ als Position; deren Positionen entsprechen den IDs „m{Modul}l{Lektion}“.
const legacyId = key => { const m = /^(\d+)-(\d+)$/.exec(key); return m ? `m${m[1]}l${m[2]}` : key; };
function normalizeProgress(p) {
  const base = emptyProgress();
  if (!p || typeof p !== "object") return base;
  for (const k of ["read", "quiz", "wrong", "cards", "drills"]) if (p[k] && typeof p[k] === "object") base[k] = p[k];
  if (p.test && typeof p.test === "object") base.test = p.test;
  if (p.last && typeof p.last === "object") base.last = p.last;
  if (p.v !== 2) {
    base.read = Object.fromEntries(Object.keys(base.read).map(k => [legacyId(k), 1]));
    if (base.last && Number.isInteger(base.last.mi)) base.last = { id: `m${base.last.mi}l${base.last.li}` };
  }
  if (base.last && typeof base.last.id !== "string") base.last = null;
  // Bis v2 war Rechnungswesen Modul 0 und Abgabenordnung Modul 1 – seit dem neuen Kursplan umgekehrt.
  if (p.v !== 3) {
    const swap = mi => (mi === 0 ? 1 : mi === 1 ? 0 : mi);
    const remap = obj => Object.fromEntries(Object.entries(obj).map(([k, v]) => {
      const m = /^(\d+)-(\d+)$/.exec(k);
      return [m ? `${swap(Number(m[1]))}-${m[2]}` : k, v];
    }));
    base.quiz = Object.fromEntries(Object.entries(base.quiz).map(([k, v]) => [/^\d+$/.test(k) ? String(swap(Number(k))) : k, v]));
    base.wrong = remap(base.wrong);
    base.drills = remap(base.drills);
  }
  return base;
}
let progress = (() => {
  try {
    const raw = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "null"), p = normalizeProgress(raw);
    if (raw && raw.v !== p.v) localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); // Umstellung sofort sichern
    return p;
  } catch (e) { return emptyProgress(); }
})();
function saveProgress() {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch (e) { /* privater Modus */ }
  updateChrome();
}
const LESSON_POS = new Map(DATA.flatMap((m, mi) => m.lessons.map((l, li) => [l.id, { mi, li }])));
const lessonId = (mi, li) => DATA[mi].lessons[li].id;
const isRead = (mi, li) => !!progress.read[lessonId(mi, li)];
function moduleStats(mi) {
  const m = DATA[mi];
  const read = m.lessons.filter((_, li) => isRead(mi, li)).length;
  const quiz = progress.quiz[mi];
  return { read, total: m.lessons.length, quiz, done: read === m.lessons.length && (quiz || 0) >= 60 };
}
function overallPct() {
  const readL = Object.keys(progress.read).filter(id => LESSON_POS.has(id)).length;
  const quizDone = DATA.filter((_, mi) => (progress.quiz[mi] || 0) > 0).length;
  return Math.min(100, Math.round((readL + quizDone) / (TOTAL_LESSONS + DATA.length) * 100));
}
function nextLesson() {
  const last = progress.last && LESSON_POS.get(progress.last.id);
  if (last && !isRead(last.mi, last.li)) return last;
  for (let mi = 0; mi < DATA.length; mi++)
    for (let li = 0; li < DATA[mi].lessons.length; li++)
      if (!isRead(mi, li)) return { mi, li };
  return null;
}
function wrongKeys() {
  return Object.keys(progress.wrong).filter(k => { const [mi, qi] = k.split("-").map(Number); return DATA[mi] && DATA[mi].quiz[qi]; });
}

/* Fortschrittsbalken & Ringe: Breiten per CSSOM setzen (CSP erlaubt keine style-Attribute). */
function applyBars(root = document) {
  root.querySelectorAll("[data-w]").forEach(el => { el.style.width = `${el.dataset.w}%`; });
  root.querySelectorAll("[data-p]").forEach(el => { el.style.setProperty("--p", el.dataset.p); });
}

/* =========================================================
   Seitenleiste
   ========================================================= */
let route = { name: "home" };

function renderNav() {
  const activeMi = route.mi ?? -1;
  let h = `<div class="nav-label">Module</div>`;
  DATA.forEach((m, mi) => {
    const st = moduleStats(mi);
    const pct = Math.round(st.read / st.total * 100);
    const active = mi === activeMi;
    h += `<a class="nav-mod" href="#/m/${mi}" aria-current="${active}">
      <span class="n">${m.n}</span>
      <span class="t"><b>${m.label}</b><small>${esc(m.day)}</small></span>
      <span class="ring${st.done ? " done" : ""}" data-p="${pct}" title="${st.read}/${st.total} Lektionen gelesen${st.quiz != null ? ` · Quiz ${st.quiz} %` : ""}"></span>
    </a>`;
    if (active) {
      h += `<div class="nav-sub">`;
      m.lessons.forEach((l, li) => {
        const cur = route.name === "lesson" && route.li === li;
        h += `<a href="#/m/${mi}/l/${li}" class="${isRead(mi, li) ? "read" : ""}"${cur ? ` aria-current="page"` : ""}><span class="tick">${isRead(mi, li) ? "✓" : li + 1}</span><span>${l.t}</span></a>`;
      });
      h += `<a class="sp" href="#/m/${mi}/einfach"${route.name === "easy" ? ` aria-current="page"` : ""}><span class="tick">☺</span><span>Einfach erklärt</span></a>`;
      h += `<a class="sp" href="#/m/${mi}/quiz"${route.name === "quiz" ? ` aria-current="page"` : ""}><span class="tick">◆</span><span>Wissenscheck · ${m.quiz.length} Fragen</span></a>`;
      h += `<a class="sp" href="#/m/${mi}/ueben"${route.name === "drill" ? ` aria-current="page"` : ""}><span class="tick">✎</span><span>Üben · Fälle &amp; Rechentrainer</span></a>`;
      h += `</div>`;
    }
  });
  $("#nav").innerHTML = h;

  const wrong = wrongKeys().length;
  const tool = (hash, name, ico, label, extra = "") =>
    `<a class="nav-tool" href="${hash}"${route.name === name ? ` aria-current="page"` : ""}><span class="ico" aria-hidden="true">${ico}</span>${label}${extra}</a>`;
  $("#navTools").innerHTML = `<div class="nav-label">Werkzeuge</div>` +
    tool("#/", "home", "⌂", "Übersicht") +
    tool("#/test", "test", "◎", "Abschlusstest") +
    tool("#/wiederholen", "review", "↻", "Fehler wiederholen", wrong ? `<span class="badge">${wrong}</span>` : "") +
    tool("#/uebungen", "drillsAll", "✎", "Alle Übungsfälle", drillAgainCount() ? `<span class="badge">${drillAgainCount()}</span>` : "") +
    tool("#/karten", "cards", "▭", "Karteikarten") +
    tool("#/glossar", "ref", "§", "Glossar &amp; Paragrafen") +
    tool("#/druck", "print", "⎙", "Skript drucken / PDF");
  applyBars($("#sidebar"));
}

function updateChrome() {
  const pct = overallPct();
  $("#sideProgressPct").textContent = `${pct} %`;
  $("#sideProgressBar").style.width = `${pct}%`;
  renderNav();
}

/* =========================================================
   Router
   ========================================================= */
function parseRoute() {
  let raw = location.hash.replace(/^#\/?/, "");
  try { raw = decodeURIComponent(raw); } catch (e) { /* ungültige Kodierung – roh verwenden */ }
  const parts = raw.split("/").filter(Boolean);
  const modIdx = n => (Number.isInteger(n) && n >= 0 && n < DATA.length ? n : null);
  if (parts[0] === "m") {
    const mi = modIdx(Number(parts[1]));
    if (mi == null) return { name: "home" };
    if (parts[2] === "l") {
      const li = Number(parts[3]);
      if (Number.isInteger(li) && li >= 0 && li < DATA[mi].lessons.length) return { name: "lesson", mi, li };
      return { name: "module", mi };
    }
    if (parts[2] === "einfach") return { name: "easy", mi };
    if (parts[2] === "quiz") return { name: "quiz", mi };
    if (parts[2] === "ueben") return { name: "drill", mi };
    return { name: "module", mi };
  }
  if (parts[0] === "test") return { name: "test" };
  if (parts[0] === "wiederholen") return { name: "review" };
  if (parts[0] === "karten") return { name: "cards" };
  if (parts[0] === "uebungen") return { name: "drillsAll" };
  if (parts[0] === "glossar") return { name: "ref", anchor: parts[1] || null };
  if (parts[0] === "druck") return { name: "print", mi: parts[1] != null ? modIdx(Number(parts[1])) : null };
  if (parts[0] === "suche") return { name: "search", q: parts.slice(1).join("/") };
  return { name: "home" };
}

const VIEWS = {
  home: viewHome, module: viewModule, easy: viewEasy, drillsAll: viewDrillsAll, lesson: viewLesson, quiz: viewQuiz, drill: viewDrill,
  test: viewQuiz, review: viewQuiz, cards: viewCards, ref: viewRef, print: viewPrint, search: viewSearch,
};

function render({ focus = true } = {}) {
  route = parseRoute();
  if (route.name !== "search") {
    const input = $("#searchInput");
    if (input.value) input.value = "";
  }
  const { title, html, wide, after } = VIEWS[route.name](route);
  document.title = title ? `${title} · Steuerrecht Intensivkurs` : "Steuerrecht Intensivkurs · Lernapp 2026";
  main.classList.toggle("wide", !!wide);
  main.innerHTML = html;
  applyBars(main);
  renderNav();
  closeNav();
  if (after) after();
  if (focus) {
    if (!route.anchor) window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  }
}

/* =========================================================
   Startseite
   ========================================================= */
function courseStatus() {
  const today = isoToday();
  const first = COURSE_DAYS[0], last = COURSE_DAYS[COURSE_DAYS.length - 1];
  const modsOn = iso => SCHEDULE.map((d, mi) => (d.includes(iso) ? mi : -1)).filter(mi => mi >= 0);
  if (today < first) {
    const n = daysBetween(today, first);
    return { text: `Kursstart in <b>${n} ${n === 1 ? "Tag" : "Tagen"}</b> · ${fmtDay(first, true)}`, today: [] };
  }
  if (today > last) return { text: "<b>Kurs abgeschlossen</b> – jetzt alles wiederholen und festigen", today: [] };
  const idx = COURSE_DAYS.indexOf(today);
  if (idx >= 0) {
    const mods = modsOn(today);
    return { text: `<b>Heute Kurstag ${idx + 1} von ${COURSE_DAYS.length}</b> · ${mods.map(mi => DATA[mi].label).join(" & ")}`, today: mods };
  }
  const next = COURSE_DAYS.find(d => d > today);
  return { text: `Kurs läuft · nächster Kurstag ${fmtDay(next, true)} (${modsOn(next).map(mi => DATA[mi].label).join(" & ")})`, today: [] };
}

function viewHome() {
  const status = courseStatus();
  const pct = overallPct();
  const readCount = Object.keys(progress.read).filter(id => LESSON_POS.has(id)).length;
  const quizVals = Object.values(progress.quiz).filter(v => typeof v === "number");
  const quizAvg = quizVals.length ? Math.round(quizVals.reduce((a, b) => a + b, 0) / quizVals.length) : null;
  const wrong = wrongKeys().length;
  const next = nextLesson();

  let h = `<section class="hero">
    <div class="kicker">Lern- &amp; Übungsplattform <span class="sep">/</span> <span class="dim">Veranlagungsjahr 2026</span></div>
    <h1 class="title">Steuerrecht von Grund auf</h1>
    <p class="sub">Vorbereitung auf den 13-Tage-Intensivkurs: sechs Module entlang des Kursaufbaus – jede Lektion erklärt das Thema von null an, mit Praxisbeispielen, Stolperfallen, Rechenschemata und Übungen zum Selbstlösen.</p>
    <div class="chips">
      <span class="chip live">${status.text}</span>
      <span class="chip"><b>${TOTAL_LESSONS}</b> Lektionen</span>
      <span class="chip"><b>${TOTAL_QUIZ}</b> Quizfragen</span>
      <span class="chip"><b>${TOTAL_DRILLS}</b> Übungen</span>
      <span class="chip"><b>${GLOSSARY.length}</b> Begriffe</span>
    </div>
  </section>

  <div class="stats">
    <div class="card stat"><div class="v">${pct}<small> %</small></div><div class="l">Gesamtfortschritt</div><div class="bar statbar"><i data-w="${pct}"></i></div></div>
    <div class="card stat"><div class="v">${readCount}<small> / ${TOTAL_LESSONS}</small></div><div class="l">Lektionen gelesen</div></div>
    <div class="card stat"><div class="v">${quizAvg == null ? "–" : quizAvg}<small>${quizAvg == null ? "" : " %"}</small></div><div class="l">Ø Wissenscheck</div></div>
    <div class="card stat"><div class="v">${progress.test ? progress.test.pct : "–"}<small>${progress.test ? " %" : ""}</small></div><div class="l">Abschlusstest</div></div>
  </div>`;

  if (next) {
    const m = DATA[next.mi], l = m.lessons[next.li];
    h += `<a class="card continue" href="#/m/${next.mi}/l/${next.li}">
      <div class="txt"><small>${readCount ? "Weiterlernen" : "Jetzt starten"} · Modul ${m.n}</small><b>${l.t}</b><span>${m.label} · Lektion ${next.li + 1} von ${m.lessons.length} · ca. ${readingMinutes(l)} Min.</span></div>
      <span class="arr" aria-hidden="true">→</span></a>`;
  } else {
    h += `<a class="card continue" href="#/test"><div class="txt"><small>Alle Lektionen gelesen</small><b>Zeit für den Abschlusstest</b><span>20 gemischte Fragen aus allen Modulen</span></div><span class="arr" aria-hidden="true">→</span></a>`;
  }

  h += `<h2 class="h2">Module</h2><div class="modgrid">`;
  DATA.forEach((m, mi) => {
    const st = moduleStats(mi);
    h += `<a class="card modcard${status.today.includes(mi) ? " today" : ""}" href="#/m/${mi}">
      <div class="top"><span class="n">${m.n}</span><div><h3>${m.label}</h3><div class="day">${esc(m.day)}${status.today.includes(mi) ? " · heute" : ""}</div></div></div>
      <p>${m.lead}</p>
      <div class="bar"><i data-w="${Math.round(st.read / st.total * 100)}"></i></div>
      <div class="meta"><span>${st.read}/${st.total} Lektionen</span><span class="${(st.quiz || 0) >= 60 ? "ok" : ""}">${st.quiz != null ? `Quiz ${st.quiz} %` : `${m.quiz.length} Quizfragen`}</span></div>
    </a>`;
  });
  h += `</div>`;

  h += `<h2 class="h2">Lernwerkzeuge</h2><div class="tools">
    <a class="card tool" href="#/test"><span class="ico">◎</span><div><b>Abschlusstest</b><span>20 gemischte Fragen aus allen Modulen – mit Auswertung je Modul.</span></div></a>
    <a class="card tool" href="#/wiederholen"><span class="ico">↻</span><div><b>Fehler wiederholen</b><span>${wrong ? `${wrong} ${wrong === 1 ? "Frage wartet" : "Fragen warten"} auf dich.` : "Falsch beantwortete Fragen landen automatisch hier."}</span></div></a>
    <a class="card tool" href="#/karten"><span class="ico">▭</span><div><b>Karteikarten</b><span>Alle ${GLOSSARY.length} Abkürzungen und Begriffe zum Durchklicken.</span></div></a>
    <a class="card tool" href="#/glossar"><span class="ico">§</span><div><b>Glossar &amp; Paragrafen</b><span>Die wichtigsten Normen mit Gesetzestext zum Nachschlagen.</span></div></a>
    <a class="card tool" href="#/m/1/ueben"><span class="ico">✎</span><div><b>Rechentrainer</b><span>Aufgaben mit immer neuen Zahlen – AfA, USt, GewSt, ESt …</span></div></a>
    <a class="card tool" href="#/druck"><span class="ico">⎙</span><div><b>Skript drucken</b><span>Alle Lektionen und Lösungen als Druckversion oder PDF.</span></div></a>
  </div>`;

  const today = isoToday();
  h += `<h2 class="h2">Kursplan</h2><div class="card schedule"><table><tbody>`;
  COURSE_DAYS.forEach((d, i) => {
    const mods = SCHEDULE.map((ds, mi) => (ds.includes(d) ? mi : -1)).filter(mi => mi >= 0);
    const cls = d === today ? "now" : d < today ? "past" : "";
    h += `<tr class="${cls}"><td class="d">Tag ${i + 1} · ${fmtDay(d)}</td><td>${mods.map(mi => `<a href="#/m/${mi}">${DATA[mi].n} · ${DATA[mi].label}</a>`).join(" &amp; ")}</td></tr>`;
  });
  h += `</tbody></table></div>`;

  return { html: h };
}

/* =========================================================
   Modul
   ========================================================= */
function moduleHeader(mi, active) {
  const m = DATA[mi];
  const tab = (hash, key, label, cnt) => `<a href="${hash}"${active === key ? ` aria-current="page"` : ""}>${label}<span class="cnt">${cnt}</span></a>`;
  return `<div class="kicker">Modul ${m.n} <span class="sep">/</span> <span class="dim">${esc(m.day)}</span></div>
    <h1 class="title">${m.label}</h1>
    <p class="lead">${m.lead}</p>
    ${m.ref ? `<p class="modref">${esc(m.ref)} · ${esc(m.time)}</p>` : ""}
    <nav class="tabs" aria-label="Bereiche des Moduls">
      ${tab(`#/m/${mi}`, "learn", "Lektionen", m.lessons.length)}
      ${tab(`#/m/${mi}/einfach`, "easy", "Einfach erklärt", m.lessons.length)}
      ${tab(`#/m/${mi}/quiz`, "quiz", "Wissenscheck", m.quiz.length)}
      ${tab(`#/m/${mi}/ueben`, "drill", "Üben", (m.drills || []).length + (GENERATORS[mi] || []).length)}
    </nav>`;
}

function viewModule({ mi }) {
  const m = DATA[mi];
  let h = moduleHeader(mi, "learn") + `<div class="lessonlist">`;
  m.lessons.forEach((l, li) => {
    const rd = isRead(mi, li);
    h += `<a class="card lrow${rd ? " read" : ""}" href="#/m/${mi}/l/${li}">
      <span class="num">${rd ? "✓" : li + 1}</span>
      <span class="t"><b>${l.t}</b><span>${l.s}</span></span>
      <span class="min">${readingMinutes(l)} Min.</span></a>`;
  });
  h += `</div>`;
  h += planHtml(mi);
  return { title: m.label, html: h };
}

/* Gliederung laut Kursplan mit Verweis auf die passenden Lektionen */
function planHtml(mi) {
  const m = DATA[mi];
  if (!m.plan) return "";
  const covered = new Set(m.plan.flatMap(([, ids]) => ids));
  const extra = m.lessons.map((l, li) => [l, li]).filter(([l]) => !covered.has(l.id));
  const link = id => { const p = LESSON_POS.get(id); return `<a href="#/m/${p.mi}/l/${p.li}">${p.li + 1}. ${DATA[p.mi].lessons[p.li].t}</a>`; };
  return `<h2 class="h2">Gliederung laut Kursplan</h2><div class="card plan"><ol>${m.plan.map(([t, ids]) =>
    `<li><b>${esc(t)}</b><span>${ids.map(link).join("")}</span></li>`).join("")}</ol>
    ${extra.length ? `<p class="dim">Zusätzlich in der App: ${extra.map(([l]) => link(l.id)).join(", ")}</p>` : ""}</div>`;
}

/* Herkunft der Inhalte: q = aus den Kursunterlagen, m = Unterlagen + Ergänzung, e = Ergänzung.
   Seitenangaben beziehen sich auf die Seitenzahl im PDF. */
const SRC_LABEL = { q: "Kursunterlage", m: "Unterlage + Ergänzung", e: "Ergänzung" };
const SRC_HINT = {
  q: "Inhalt stammt aus den Kursunterlagen (eigene Formulierung).",
  m: "Kern aus den Kursunterlagen, um weitere Details ergänzt.",
  e: "Nicht in den Kursunterlagen enthalten – zusätzliche Information.",
};
function srcChip(src) {
  if (!src) return "";
  const where = src.d ? ` · ${esc(src.d)}, S. ${src.s}` : "";
  return `<span class="src src-${src.k}" title="${SRC_HINT[src.k]}">${SRC_LABEL[src.k]}${where}</span>`;
}
function hideExtras() { try { return localStorage.getItem("stb_hide_extra") === "1"; } catch (e) { return false; } }
function applyHideExtras() { document.documentElement.classList.toggle("hide-extra", hideExtras()); }
applyHideExtras();
function lessonSources(l) {
  const all = [...l.blocks.map(b => b.src), ...Object.values(l.srcs || {}), ...(l.deep || []).map(d => d.src)].filter(Boolean);
  const byDoc = new Map();
  all.forEach(s => { if (s.d) { if (!byDoc.has(s.d)) byDoc.set(s.d, new Set()); byDoc.get(s.d).add(s.s); } });
  const extra = all.filter(s => s.k === "e").length;
  let h = `<div class="srcbox"><div class="eyebrow">Quellen dieser Lektion</div>`;
  if (byDoc.size) h += `<ul>${[...byDoc].map(([d, pages]) => `<li><b>${esc(d)}</b>, S. ${[...pages].sort((a, b) => a - b).join(", ")}</li>`).join("")}</ul>`;
  else h += `<p>Diese Lektion stützt sich nicht direkt auf die Kursunterlagen.</p>`;
  h += `<p class="muted">${extra ? `${extra} Abschnitt${extra > 1 ? "e" : ""} als „Ergänzung“ markiert (nicht aus den Unterlagen). ` : ""}<a href="#/glossar/herkunft">Wie die Kennzeichnung funktioniert</a></p></div>`;
  return h;
}

// „Einfach erklärt“: Erklärung in Alltagssprache, Bild aus dem Alltag, Merksatz
function easyBox(l, title = "") {
  if (!l.easy) return "";
  return `<div class="callout c-easy"><div class="ctag">Einfach erklärt <span class="ctag-note">· eigene Vereinfachung</span></div>${title}<p>${l.easy.p}</p>`
    + `<p class="easy-bild"><b>Stell dir vor:</b> ${l.easy.bild}</p>`
    + `<p class="easy-merk"><b>Merksatz:</b> ${l.easy.merk}</p></div>`;
}

function viewEasy({ mi }) {
  const m = DATA[mi];
  let h = moduleHeader(mi, "easy")
    + `<p class="easy-lead">Jede Lektion in wenigen Sätzen, ohne Fachsprache — zum Einstieg oder zum schnellen Wiederholen. Die ausführliche Fassung steht in der jeweiligen Lektion.</p>`;
  m.lessons.forEach((l, li) => {
    h += easyBox(l, `<h3 class="easy-t"><a href="#/m/${mi}/l/${li}">${li + 1}. ${l.t}</a></h3>`);
  });
  return { title: `Einfach erklärt · ${m.label}`, html: h };
}

/* =========================================================
   Lektion
   ========================================================= */
// Vertiefung: Details aus den Kursunterlagen, aufklappbar (im Druck immer offen)
function deepPara(p) {
  const i = p.indexOf("<table");
  if (i < 0) return `<p>${p}</p>`;
  return `${i > 0 ? `<p>${p.slice(0, i)}</p>` : ""}<div class="deep-tw">${p.slice(i)}</div>`;
}

function deepHtml(l, open = false) {
  if (!l.deep || !l.deep.length) return "";
  const fromDocs = l.deep.filter(d => d.src && d.src.k !== "e").length;
  return `<details class="deep"${open ? " open" : ""}><summary><span class="deep-t">Vertiefung</span><span class="deep-n">${l.deep.length} ${l.deep.length === 1 ? "Thema" : "Themen"}${fromDocs ? " · aus den Kursunterlagen" : ""}</span></summary>
    <div class="deep-body">${l.deep.map(d => `<section class="deep-item" data-src="${d.src ? d.src.k : ""}"><h4>${d.h}</h4>${srcChip(d.src)}${deepPara(d.p)}</section>`).join("")}</div></details>`;
}

function lessonBody(l, print = false) {
  const sr = l.srcs || {};
  let h = `<p class="intro">${l.intro}</p>${easyBox(l)}<div class="blocks">`;
  l.blocks.forEach(b => { h += `<section class="block" data-src="${b.src ? b.src.k : ""}"><h3>${b.h}</h3>${srcChip(b.src)}<p>${b.p}</p></section>`; });
  h += `</div>`;
  if (l.figs) {
    h += `<table class="figtable"><thead><tr><th colspan="2">${l.figs.title}</th></tr></thead><tbody>`;
    l.figs.rows.forEach(r => { h += `<tr><td>${r[0]}</td><td class="v">${r[1]}</td></tr>`; });
    h += `</tbody></table>${srcChip(sr.figs)}`;
  }
  if (l.vis) h += `<div class="vis-wrap" data-src="${sr.vis ? sr.vis.k : ""}">${l.vis}${srcChip(sr.vis)}</div>`;
  if (l.ex) h += `<div class="callout c-ex" data-src="${sr.ex ? sr.ex.k : ""}"><div class="ctag">Praxisbeispiel</div>${srcChip(sr.ex)}<p>${l.ex}</p></div>`;
  if (l.warn) h += `<div class="callout c-warn" data-src="${sr.warn ? sr.warn.k : ""}"><div class="ctag">Stolperfalle</div>${srcChip(sr.warn)}<p>${l.warn}</p></div>`;
  h += deepHtml(l, print);
  if (l.laws && l.laws.length) h += `<div class="eyebrow">Rechtsgrundlagen</div><div class="laws">${l.laws.map(x => `<span class="law">${x}</span>`).join("")}</div>`;
  h += lessonSources(l);
  return h;
}

function viewLesson({ mi, li }) {
  const m = DATA[mi], l = m.lessons[li];
  progress.last = { id: l.id };
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch (e) {}
  const rd = isRead(mi, li);
  const prev = li > 0 ? { hash: `#/m/${mi}/l/${li - 1}`, t: m.lessons[li - 1].t, label: "Vorherige Lektion" }
    : mi > 0 ? { hash: `#/m/${mi - 1}/l/${DATA[mi - 1].lessons.length - 1}`, t: DATA[mi - 1].lessons.at(-1).t, label: `Modul ${DATA[mi - 1].n}` } : null;
  const next = li < m.lessons.length - 1 ? { hash: `#/m/${mi}/l/${li + 1}`, t: m.lessons[li + 1].t, label: "Nächste Lektion" }
    : { hash: `#/m/${mi}/quiz`, t: `Wissenscheck ${m.label}`, label: "Modul abschließen" };

  const h = `<article class="lesson">
    <div class="kicker"><a href="#/m/${mi}">Modul ${m.n}</a> <span class="sep">/</span> <span class="dim">${m.label}</span> <span class="sep">·</span> <span class="dim">Lektion ${li + 1} von ${m.lessons.length} · ca. ${readingMinutes(l)} Min.</span></div>
    <h1 class="title">${l.t}</h1>
    <div class="subtitle">${l.s}</div>
    <div class="srcbar"><a class="srcbar-l" href="#/glossar/herkunft">Herkunft:</a><span class="src src-q">Kursunterlage</span><span class="src src-m">Unterlage + Ergänzung</span><span class="src src-e">Ergänzung</span>
      <button type="button" class="btn ghost small" data-action="toggle-extra" aria-pressed="${hideExtras()}">${hideExtras() ? "Ergänzungen einblenden" : "Ergänzungen ausblenden"}</button></div>
    ${lessonBody(l)}
    <div class="lesson-foot">
      <button type="button" class="btn sec readtoggle" data-action="toggle-read" data-mi="${mi}" data-li="${li}" aria-pressed="${rd}">${rd ? "✓ Gelesen" : "Als gelesen markieren"}</button>
      <span class="spacer"></span>
      <a class="btn" href="${next.hash}" data-markread="${l.id}">${li < m.lessons.length - 1 ? "Gelesen &amp; weiter →" : "Zum Wissenscheck →"}</a>
    </div>
    <nav class="pager" aria-label="Lektionen blättern">
      ${prev ? `<a class="prev" href="${prev.hash}"><small>← ${prev.label}</small><b>${prev.t}</b></a>` : ""}
      <a class="next" href="${next.hash}"><small>${next.label} →</small><b>${next.t}</b></a>
    </nav>
  </article>`;
  return { title: l.t, html: h };
}

/* =========================================================
   Quiz-Engine (Modul-Quiz, Abschlusstest, Fehler wiederholen)
   ========================================================= */
let quiz = null;

function buildTest(n = 20) {
  const total = TOTAL_QUIZ;
  const per = DATA.map(m => Math.max(2, Math.round(n * m.quiz.length / total)));
  let sum = per.reduce((a, b) => a + b, 0);
  while (sum > n) { const i = per.indexOf(Math.max(...per)); per[i]--; sum--; }
  while (sum < n) { const i = per.indexOf(Math.min(...per)); per[i]++; sum++; }
  const items = [];
  DATA.forEach((m, mi) => shuffle(m.quiz.map((_, qi) => qi)).slice(0, per[mi]).forEach(qi => items.push({ mi, qi })));
  return shuffle(items);
}

function newQuiz(key) {
  let items;
  if (key === "test") items = buildTest();
  else if (key === "review") items = shuffle(wrongKeys().map(k => { const [mi, qi] = k.split("-").map(Number); return { mi, qi }; }));
  else { const mi = Number(key.split(":")[1]); items = shuffle(DATA[mi].quiz.map((_, qi) => ({ mi, qi }))); }
  quiz = { key, items, idx: 0, score: 0, answered: null, order: null, results: [], done: items.length === 0 };
}

function quizKey(r) { return r.name === "quiz" ? `mod:${r.mi}` : r.name; }

function viewQuiz(r) {
  const key = quizKey(r);
  if (!quiz || quiz.key !== key) newQuiz(key);
  const isMod = r.name === "quiz";
  let head;
  if (isMod) head = moduleHeader(r.mi, "quiz");
  else if (r.name === "test") head = `<div class="kicker">Alle Module</div><h1 class="title">Abschlusstest</h1><p class="lead">20 zufällig gemischte Fragen aus allen sechs Modulen. Am Ende siehst du, wo du sicher bist – und wo noch Lücken sind.</p>`;
  else head = `<div class="kicker">Gezielt üben</div><h1 class="title">Fehler wiederholen</h1><p class="lead">Hier sammeln sich alle Fragen, die du falsch beantwortet hast. Beantwortest du eine richtig, verschwindet sie aus der Liste.</p>`;
  const title = isMod ? `Wissenscheck ${DATA[r.mi].label}` : r.name === "test" ? "Abschlusstest" : "Fehler wiederholen";
  return { title, html: head + `<div id="quizArea">${quizBody()}</div>` };
}

function quizBody() {
  const q = quiz;
  if (!q.items.length) {
    return `<div class="card empty"><div class="big">✓</div><p>Keine offenen Fehler – stark!<br>Falsch beantwortete Fragen aus Wissenschecks und Abschlusstest landen automatisch hier.</p><div class="btnrow"><a class="btn" href="#/test">Abschlusstest starten</a></div></div>`;
  }
  if (q.done) return quizResult();
  const it = q.items[q.idx];
  const item = DATA[it.mi].quiz[it.qi];
  if (!q.order) q.order = shuffle(item.o.map((_, i) => i));
  const pct = Math.round(q.idx / q.items.length * 100);
  const showSrc = !q.key.startsWith("mod:");
  let h = `<div class="quiz">
    <div class="bar qbar"><i data-w="${pct}"></i></div>
    <div class="qmeta"><span>Frage ${q.idx + 1} / ${q.items.length}</span><span>${q.score} richtig</span></div>
    ${showSrc ? `<div class="qsrc">Modul ${DATA[it.mi].n} · ${DATA[it.mi].label}</div>` : ""}
    <div class="qq" id="qq">${item.q}</div>
    <div class="qopts" role="group" aria-labelledby="qq">`;
  q.order.forEach((orig, pos) => {
    let cls = "";
    if (q.answered != null) {
      if (orig === item.a) cls = q.answered === pos ? "correct" : "reveal";
      else if (q.answered === pos) cls = "wrong";
    }
    h += `<button type="button" class="qopt ${cls}" data-action="answer" data-pos="${pos}"${q.answered != null ? " disabled" : ""}><span class="k">${pos + 1}</span><span>${item.o[orig]}</span></button>`;
  });
  h += `</div>`;
  if (q.answered != null) {
    const ok = q.order[q.answered] === item.a;
    h += `<div class="qfb ${ok ? "ok" : "no"}" role="status"><b>${ok ? "Richtig." : "Nicht ganz."}</b> ${item.e}<br><span class="law">${item.l}</span> ${srcChip(item.src)}</div>
      <div class="btnrow"><button type="button" class="btn" data-action="next" id="nextBtn">${q.idx + 1 >= q.items.length ? "Ergebnis ansehen" : "Weiter →"}</button><span class="muted">oder Enter drücken</span></div>`;
  } else {
    h += `<p class="muted">Tipp: Antworten auch mit den Tasten 1–4 wählen.</p>`;
  }
  return h + `</div>`;
}

function quizResult() {
  const q = quiz;
  const n = q.items.length;
  const pct = Math.round(q.score / n * 100);
  const msg = pct >= 85 ? "Stark – das sitzt." : pct >= 70 ? "Gut. Ein, zwei Themen noch einmal ansehen." : pct >= 50 ? "Solide Basis. Geh die Lektionen noch einmal durch." : "Erst die Lektionen durcharbeiten, dann wiederholen.";
  let h = `<div class="card score"><div class="pct">${pct} %</div><div class="frac">${q.score} von ${n} richtig</div><div class="msg">${msg}</div>`;
  if (q.key === "test") {
    h += `<div class="bymod">`;
    DATA.forEach((m, mi) => {
      const rs = q.results.filter(r => r.mi === mi);
      if (!rs.length) return;
      const ok = rs.filter(r => r.ok).length;
      h += `<div class="r"><a href="#/m/${mi}">${m.n} · ${m.label}</a><div class="bar"><i data-w="${Math.round(ok / rs.length * 100)}"></i></div><span>${ok}/${rs.length}</span></div>`;
    });
    h += `</div>`;
  }
  const wrong = wrongKeys().length;
  h += `<div class="btnrow">
    <button type="button" class="btn" data-action="restart">${q.key === "review" ? "Erneut wiederholen" : "Nochmal (neu gemischt)"}</button>
    ${wrong && q.key !== "review" ? `<a class="btn sec" href="#/wiederholen">${wrong} Fehler wiederholen</a>` : ""}
    ${q.key.startsWith("mod:") ? `<a class="btn sec" href="#/m/${q.key.split(":")[1]}">Zu den Lektionen</a>` : `<a class="btn sec" href="#/">Zur Übersicht</a>`}
  </div></div>`;
  return h;
}

function rerenderQuiz() {
  const area = $("#quizArea");
  if (!area) return;
  area.innerHTML = quizBody();
  applyBars(area);
}

function answer(pos) {
  const q = quiz;
  if (!q || q.done || q.answered != null) return;
  const it = q.items[q.idx];
  const item = DATA[it.mi].quiz[it.qi];
  q.answered = pos;
  const ok = q.order[pos] === item.a;
  const k = `${it.mi}-${it.qi}`;
  if (ok) { q.score++; delete progress.wrong[k]; } else progress.wrong[k] = 1;
  q.results.push({ mi: it.mi, ok });
  saveProgress();
  rerenderQuiz();
  $("#nextBtn")?.focus({ preventScroll: true });
}

function nextQuestion() {
  const q = quiz;
  if (!q || q.answered == null) return;
  q.idx++;
  q.answered = null;
  q.order = null;
  if (q.idx >= q.items.length) {
    q.done = true;
    const pct = Math.round(q.score / q.items.length * 100);
    if (q.key.startsWith("mod:")) progress.quiz[Number(q.key.split(":")[1])] = pct;
    if (q.key === "test") progress.test = { pct, n: q.items.length, date: isoToday() };
    saveProgress();
  }
  rerenderQuiz();
  $("#quizArea")?.scrollIntoView({ block: "nearest" });
}

/* =========================================================
   Üben: Fälle, Rechentrainer, Bilanz-Builder
   ========================================================= */
const genState = {};
// Erwarteter Zahlenwert aus der Lösung (hervorgehobener Ergebnisbetrag), sofern eindeutig
function expectedValue(answerHtml) {
  const m = /<span class="genres">([\s\S]*?)<\/span>/.exec(answerHtml || "");
  if (!m) return null;
  const nums = strip(m[1]).match(/-?\d{1,3}(?:\.\d{3})*(?:,\d+)?|-?\d+(?:,\d+)?/g) || [];
  return nums.length === 1 ? parseDe(nums[0]) : null;
}
function parseDe(t) {
  const v = Number(String(t).trim().replace(/\s|€|%/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(v) ? v : null;
}
function checkGen(mi, gi) {
  const k = `${mi}-${gi}`, st = genState[k], inp = $(`#gin-${k}`);
  if (!st || !inp) return;
  st.input = inp.value;
  const v = parseDe(inp.value);
  st.verdict = v == null ? "no" : Math.abs(v - st.expect) <= Math.max(0.5, Math.abs(st.expect) * 0.001) ? "ok" : "no";
  if (st.verdict === "ok") st.show = true;
  $(`#gen-${mi}-${gi}`).innerHTML = genCard(mi, gi);
}

function genCard(mi, gi) {
  const g = GENERATORS[mi][gi];
  const k = `${mi}-${gi}`;
  if (!genState[k]) genState[k] = { data: g.make(), show: false };
  const st = genState[k];
  if (st.expect === undefined) st.expect = expectedValue(st.data.a);
  const check = st.expect != null && !st.show
    ? `<div class="gen-check"><label class="sr-only" for="gin-${k}">Dein Ergebnis</label><input class="gen-input" id="gin-${k}" inputmode="decimal" autocomplete="off" placeholder="Dein Ergebnis" data-mi="${mi}" data-gi="${gi}" value="${st.input ? esc(st.input) : ""}"><button type="button" class="btn small sec" data-action="gen-check" data-mi="${mi}" data-gi="${gi}">Prüfen</button></div>
      ${st.verdict ? `<div class="gen-verdict ${st.verdict}">${st.verdict === "ok" ? "✓ Richtig!" : "✗ Noch nicht – rechne nach oder sieh dir die Lösung an."}</div>` : ""}` : "";
  return `<div class="gen-title"><b>${g.title}</b><span class="gen-level">${g.level}</span></div>
    <div class="gen-q">${st.data.q}</div>
    ${check}
    ${st.show ? `<div class="gen-a">${st.data.a}</div>` : ""}
    <div class="gen-btns">
      <button type="button" class="btn small" data-action="gen-toggle" data-mi="${mi}" data-gi="${gi}">${st.show ? "Lösung ausblenden" : "Lösung zeigen"}</button>
      <button type="button" class="btn sec small" data-action="gen-new" data-mi="${mi}" data-gi="${gi}">Neue Zahlen</button>
    </div>`;
}

let builder = null;
function newBuilder() {
  const av = ri(80, 200) * 1000, vorr = ri(30, 90) * 1000, ford = ri(40, 120) * 1000, bank = ri(20, 80) * 1000;
  const verb = ri(30, 80) * 1000, darl = ri(40, 120) * 1000;
  const summe = av + vorr + ford + bank;
  return { av, vorr, ford, bank, verb, darl, summe, ek: summe - verb - darl };
}
function builderCard() {
  if (!builder) builder = newBuilder();
  const s = builder;
  return `<h3>Bilanz selbst aufstellen</h3>
    <p>Ermittle Bilanzsumme und Eigenkapital. Die Werte wechseln bei jeder neuen Aufgabe.</p>
    <div class="bg-grid">
      <span>Anlagevermögen</span><b>${fmt(s.av)} €</b>
      <span>Vorräte</span><b>${fmt(s.vorr)} €</b>
      <span>Forderungen aus L+L</span><b>${fmt(s.ford)} €</b>
      <span>Bank</span><b>${fmt(s.bank)} €</b>
      <span>Verbindlichkeiten aus L+L</span><b>${fmt(s.verb)} €</b>
      <span>Bankdarlehen</span><b>${fmt(s.darl)} €</b>
    </div>
    <div class="builder-inputs">
      <label>Bilanzsumme (Summe aller Aktiva)<input type="text" id="b_summe" inputmode="numeric" placeholder="z. B. 350.000"></label>
      <label>Eigenkapital (Bilanzsumme − Schulden)<input type="text" id="b_ek" inputmode="numeric" placeholder="z. B. 200.000"></label>
    </div>
    <div class="btnrow"><button type="button" class="btn small" data-action="b-check">Prüfen</button><button type="button" class="btn sec small" data-action="b-new">Neue Aufgabe</button></div>
    <div id="builderResult" aria-live="polite"></div>`;
}
function checkBuilder() {
  const s = builder;
  const num = id => parseInt(($("#" + id).value || "").replace(/[^0-9]/g, ""), 10);
  const us = num("b_summe"), uek = num("b_ek");
  const out = $("#builderResult");
  if (Number.isNaN(us) || Number.isNaN(uek)) { out.innerHTML = `<div class="br-line no">Bitte beide Felder ausfüllen.</div>`; return; }
  const okS = us === s.summe, okE = uek === s.ek;
  let h = `<div class="br-line ${okS ? "ok" : "no"}">Bilanzsumme: ${fmt(us)} € ${okS ? "✓ richtig" : `✗ – richtig wäre ${fmt(s.summe)} € (${fmt(s.av)} + ${fmt(s.vorr)} + ${fmt(s.ford)} + ${fmt(s.bank)})`}</div>`;
  h += `<div class="br-line ${okE ? "ok" : "no"}">Eigenkapital: ${fmt(uek)} € ${okE ? "✓ richtig" : `✗ – richtig wäre ${fmt(s.ek)} € (${fmt(s.summe)} − ${fmt(s.verb)} − ${fmt(s.darl)})`}</div>`;
  if (okS && okE) h += `<div class="br-line ok">Perfekt – Aktiva = Passiva = ${fmt(s.summe)} €. Das Eigenkapital ist die Restgröße nach Abzug aller Schulden.</div>`;
  out.innerHTML = h;
}

/* Übungsfälle: Denkanstoß → Lösung Schritt für Schritt → Selbsteinschätzung */
const DIFF = { 1: "Einstieg", 2: "Mittel", 3: "Anspruchsvoll" };
const drillState = {};
const drillFilter = { st: "all", diff: "0" };
const drillKey = (mi, di) => `${mi}-${di}`;
const drillSteps = d => d.sol.split("\n").filter(x => x.trim());
function drillAgainCount() { return Object.values(progress.drills || {}).filter(v => v === "again").length; }
function lessonLink(lid) {
  for (let mi = 0; mi < DATA.length; mi++) {
    const li = DATA[mi].lessons.findIndex(l => l.id === lid);
    if (li >= 0) return `<a class="dlesson" href="#/m/${mi}/l/${li}">Zur Lektion: ${DATA[mi].lessons[li].t} →</a>`;
  }
  return "";
}
function drillInner(mi, di) {
  const d = DATA[mi].drills[di], key = drillKey(mi, di);
  const st = drillState[key] || (drillState[key] = { hint: false, shown: 0 });
  const steps = drillSteps(d), n = steps.length, rated = progress.drills[key];
  let h = "";
  if (st.hint && d.hint) h += `<div class="dhint"><b>Denkanstoß:</b> ${d.hint}</div>`;
  if (st.shown > 0) h += `<div class="dsol">${steps.slice(0, st.shown).join("\n")}</div>`;
  h += `<div class="dctrl">`;
  if (d.hint && !st.hint && st.shown === 0) h += `<button type="button" class="btn sec small" data-action="d-hint" data-key="${key}">Denkanstoß</button>`;
  if (st.shown < n) {
    h += `<button type="button" class="btn small" data-action="d-step" data-key="${key}">${st.shown ? "Nächster Schritt" : "Ersten Lösungsschritt zeigen"} <span class="cnt">${st.shown}/${n}</span></button>`;
    h += `<button type="button" class="btn ghost small" data-action="d-all" data-key="${key}">Ganze Lösung</button>`;
  } else {
    h += `<span class="dask">Wie lief es?</span>
      <button type="button" class="btn small ${rated === "ok" ? "ok on" : "sec"}" data-action="d-rate" data-key="${key}" data-v="ok" aria-pressed="${rated === "ok"}">✓ Konnte ich</button>
      <button type="button" class="btn small sec${rated === "again" ? " again on" : ""}" data-action="d-rate" data-key="${key}" data-v="again" aria-pressed="${rated === "again"}">↻ Nochmal üben</button>
      <button type="button" class="btn ghost small" data-action="d-hide" data-key="${key}">Lösung verbergen</button>`;
  }
  return h + `</div>`;
}
function drillHtml(mi, di, label) {
  const d = DATA[mi].drills[di], key = drillKey(mi, di), rated = progress.drills[key];
  const badge = rated === "ok" ? `<span class="dstat ok">✓ gelöst</span>` : rated === "again" ? `<span class="dstat again">↻ nochmal</span>` : "";
  return `<div class="card drill" id="drill-${key}">
    <div class="dh"><span class="dnum">${label}</span><div class="dtitle"><h3>${d.t}</h3>
      <div class="dlevel">${d.lvl || "Übung"} <span class="diff d${d.diff}" title="Schwierigkeit">${"●".repeat(d.diff || 1)}${"○".repeat(3 - (d.diff || 1))} ${DIFF[d.diff || 1]}</span>${badge}</div>${srcChip(d.src)}</div></div>
    <div class="dtask">${d.task}</div>
    <div class="dbody" id="dbody-${key}">${drillInner(mi, di)}</div>
    <div class="dfoot">${lessonLink(d.lid)}</div>
  </div>`;
}
function rerenderDrill(key) {
  const [mi, di] = key.split("-").map(Number);
  const card = $(`#drill-${key}`);
  if (card) card.outerHTML = drillHtml(mi, di, card.querySelector(".dnum").textContent);
}
function drillAction(a, key) {
  const [mi, di] = key.split("-").map(Number);
  const st = drillState[key] || (drillState[key] = { hint: false, shown: 0 });
  const n = drillSteps(DATA[mi].drills[di]).length;
  if (a === "d-hint") st.hint = true;
  if (a === "d-step") st.shown = Math.min(n, st.shown + 1);
  if (a === "d-all") st.shown = n;
  if (a === "d-hide") { st.shown = 0; st.hint = false; }
  const body = $(`#dbody-${key}`);
  if (body) body.innerHTML = drillInner(mi, di);
}
function rateDrill(key, v) {
  if (progress.drills[key] === v) delete progress.drills[key]; else progress.drills[key] = v;
  saveProgress();
  rerenderDrill(key);
  const sum = $("#drillSummary");
  if (sum) { sum.outerHTML = drillSummary(currentDrillList()); applyBars($("#drillSummary")); }
  renderNav();
}
let drillListCache = [];
function currentDrillList() { return drillListCache; }
function drillSummary(list) {
  const ok = list.filter(([mi, di]) => progress.drills[drillKey(mi, di)] === "ok").length;
  const again = list.filter(([mi, di]) => progress.drills[drillKey(mi, di)] === "again").length;
  return `<div class="drill-sum" id="drillSummary"><div class="bar"><i data-w="${list.length ? Math.round(ok / list.length * 100) : 0}"></i></div>
    <span><b>${ok}</b> von ${list.length} gelöst${again ? ` · <b>${again}</b> zum Wiederholen` : ""}</span></div>`;
}
function drillFilterBar() {
  const chip = (f, v, label) => `<button type="button" class="chip${drillFilter[f] === v ? " live" : ""}" data-action="d-filter" data-f="${f}" data-v="${v}" aria-pressed="${drillFilter[f] === v}">${label}</button>`;
  return `<div class="drill-filter" role="group" aria-label="Übungsfälle filtern">
    ${chip("st", "all", "Alle")}${chip("st", "open", "Offen")}${chip("st", "again", "Nochmal üben")}${chip("st", "ok", "Gelöst")}
    <span class="sep"></span>
    ${chip("diff", "0", "Jede Schwierigkeit")}${chip("diff", "1", "● Einstieg")}${chip("diff", "2", "●● Mittel")}${chip("diff", "3", "●●● Anspruchsvoll")}
  </div>`;
}
function filteredDrills(list) {
  return list.filter(([mi, di]) => {
    const st = progress.drills[drillKey(mi, di)], d = DATA[mi].drills[di];
    if (drillFilter.st === "open" && st) return false;
    if (drillFilter.st === "again" && st !== "again") return false;
    if (drillFilter.st === "ok" && st !== "ok") return false;
    if (drillFilter.diff !== "0" && String(d.diff || 1) !== drillFilter.diff) return false;
    return true;
  });
}
function drillListHtml(list, withModule) {
  drillListCache = list;
  const shown = filteredDrills(list);
  let h = drillSummary(list) + drillFilterBar();
  if (!shown.length) return h + `<div class="card empty">Keine Fälle für diesen Filter.</div>`;
  let lastMi = -1;
  shown.forEach(([mi, di]) => {
    if (withModule && mi !== lastMi) { h += `<h3 class="drill-mod"><a href="#/m/${mi}/ueben">Modul ${DATA[mi].n} · ${DATA[mi].label}</a></h3>`; lastMi = mi; }
    h += drillHtml(mi, di, `${withModule ? DATA[mi].n + "·" : "A"}${di + 1}`);
  });
  return h;
}

function viewDrill({ mi }) {
  const m = DATA[mi];
  const gens = GENERATORS[mi] || [];
  const ds = m.drills || [];
  let h = moduleHeader(mi, "drill");
  if (DATA[mi].label === "Rechnungswesen") h += `<div class="card builder" id="builder">${builderCard()}</div>`;
  if (gens.length) {
    h += `<p class="note"><b>Rechentrainer:</b> Jede Aufgabe erzeugt auf Knopfdruck neue Zahlen. Rechne selbst, trage dein Ergebnis ein und prüfe es – oder deck die Lösung auf.</p><div class="gengrid">`;
    gens.forEach((_, gi) => { h += `<div class="card gencard" id="gen-${mi}-${gi}">${genCard(mi, gi)}</div>`; });
    h += `</div>`;
  }
  if (ds.length) {
    h += `<h2 class="h2">Übungsfälle</h2><p class="note">So übst du am wirksamsten: Fall zuerst selbst auf Papier lösen. Wenn du hängst, hilft der <b>Denkanstoß</b>. Dann die Lösung <b>Schritt für Schritt</b> aufdecken und am Ende ehrlich einschätzen – „Nochmal üben“ sammelt die Fälle unter <a href="#/uebungen">Alle Übungsfälle</a>.</p>`;
    h += drillListHtml(ds.map((_, di) => [mi, di]), false);
  }
  if (!ds.length && !gens.length) h += `<div class="card empty">Für dieses Modul gibt es keine Rechenfälle.</div>`;
  return { title: `Üben · ${m.label}`, html: h };
}

function viewDrillsAll() {
  const list = DATA.flatMap((m, mi) => (m.drills || []).map((_, di) => [mi, di]));
  const h = `<div class="kicker">Üben</div><h1 class="title">Alle Übungsfälle</h1>
    <p class="lead">Alle ${list.length} Fälle aus allen Modulen an einem Ort. Filtere nach „Nochmal üben“, um gezielt die Fälle zu wiederholen, die noch nicht sitzen.</p>
    ${drillListHtml(list, true)}`;
  return { title: "Alle Übungsfälle", html: h };
}

/* =========================================================
   Karteikarten (Glossar)
   ========================================================= */
let cards = null;
function newCards(all = false) {
  const idx = GLOSSARY.map((_, i) => i);
  let open = idx.filter(i => !progress.cards[GLOSSARY[i][0]]);
  if (all || !open.length) open = idx;
  cards = { deck: shuffle(open), i: 0, flipped: false, known: 0 };
}
function cardsBody() {
  const c = cards;
  const knownTotal = GLOSSARY.filter(g => progress.cards[g[0]]).length;
  if (c.i >= c.deck.length) {
    return `<div class="card empty"><div class="big">✓</div><p>Stapel durch! ${knownTotal} von ${GLOSSARY.length} Begriffen sitzen.</p>
      <div class="btnrow"><button type="button" class="btn" data-action="cards-restart">Offene Karten üben</button><button type="button" class="btn sec" data-action="cards-all">Alle Karten neu mischen</button></div></div>`;
  }
  const [term, def] = GLOSSARY[c.deck[c.i]];
  return `<div class="qmeta"><span>Karte ${c.i + 1} / ${c.deck.length}</span><span>${knownTotal} / ${GLOSSARY.length} gewusst</span></div>
    <div class="bar"><i data-w="${Math.round(c.i / c.deck.length * 100)}"></i></div>
    <div class="flash"><button type="button" class="face" data-action="card-flip" aria-live="polite">
      ${c.flipped ? `<span class="hint">${esc(term)}</span><span class="def">${def}</span>` : `<span class="term">${esc(term)}</span><span class="hint">Antippen zum Umdrehen · Leertaste</span>`}
    </button></div>
    <div class="flash-ctrl">
      <button type="button" class="btn sec" data-action="card-again">← Nochmal</button>
      <button type="button" class="btn ok" data-action="card-know">Gewusst →</button>
    </div>`;
}
function viewCards() {
  if (!cards) newCards();
  return { title: "Karteikarten", html: `<div class="kicker">Glossar</div><h1 class="title">Karteikarten</h1><p class="lead">Begriff ansehen, Bedeutung im Kopf formulieren, umdrehen. Was du weißt, wird abgelegt – der Rest kommt wieder.</p><div id="cardArea">${cardsBody()}</div>` };
}
function rerenderCards() { const a = $("#cardArea"); if (a) { a.innerHTML = cardsBody(); applyBars(a); } }
function cardStep(known) {
  const c = cards;
  if (!c || c.i >= c.deck.length) return;
  const term = GLOSSARY[c.deck[c.i]][0];
  if (known) progress.cards[term] = 1;
  else { delete progress.cards[term]; c.deck.push(c.deck[c.i]); }
  c.i++;
  c.flipped = false;
  saveProgress();
  rerenderCards();
}

/* =========================================================
   Glossar & Paragrafen
   ========================================================= */
// Erklärung der Herkunftskennzeichnung und Übersicht, welche Unterlage wie oft genutzt wird
function herkunftHtml() {
  const count = new Map(), kinds = { q: 0, m: 0, e: 0 };
  const add = s => { if (!s) return; kinds[s.k]++; if (s.d) count.set(s.d, (count.get(s.d) || 0) + 1); };
  DATA.forEach(m => {
    m.lessons.forEach(l => { l.blocks.forEach(b => add(b.src)); Object.values(l.srcs || {}).forEach(add); (l.deep || []).forEach(d => add(d.src)); });
    m.quiz.forEach(q => add(q.src)); (m.drills || []).forEach(d => add(d.src));
  });
  const docs = [...count].sort((a, b) => a[0].localeCompare(b[0], "de", { numeric: true }));
  return `<section class="card herkunft" id="herkunft">
    <h2 class="h2">Woher stammen die Inhalte?</h2>
    <p>Jeder Abschnitt, jede Quizfrage und jeder Übungsfall ist gekennzeichnet:</p>
    <ul class="legend">
      <li>${srcChip({ k: "q", d: "Dokument", s: "x" })} Inhalt stammt aus den Kursunterlagen (in eigenen Worten wiedergegeben). Die Seitenzahl ist die Seite im PDF.</li>
      <li>${srcChip({ k: "m", d: "Dokument", s: "x" })} Der Kern steht in den Unterlagen, die App ergänzt weitere Details, Zahlen oder Beispiele.</li>
      <li>${srcChip({ k: "e" })} Steht so nicht in den Kursunterlagen – zusätzliche Information. Mit „Ergänzungen ausblenden“ in jeder Lektion lassen sich diese Abschnitte verbergen.</li>
      <li><span class="src src-easy">Einfach erklärt</span> Die Kurzfassungen sind immer eigene Vereinfachungen.</li>
    </ul>
    <p class="muted">Die Zuordnung wurde durch einen Textabgleich mit den Unterlagen ermittelt und stichprobenartig geprüft. Sie zeigt die passendste Stelle, nicht jede Fundstelle. Im Zweifel gilt das Original.</p>
    <p class="muted">Insgesamt: ${kinds.q} × Kursunterlage, ${kinds.m} × Unterlage + Ergänzung, ${kinds.e} × Ergänzung.</p>
    <details><summary>Genutzte Unterlagen (${docs.length})</summary><ul class="doclist">${docs.map(([d, n]) => `<li>${esc(d)} <span class="muted">· ${n} Verweise</span></li>`).join("")}</ul></details>
  </section>`;
}

function viewRef(r) {
  const sorted = GLOSSARY.map((g, i) => ({ g, i })).sort((a, b) => a.g[0].localeCompare(b.g[0], "de"));
  const letters = [...new Set(sorted.map(x => x.g[0][0].toUpperCase()))];
  let h = `<div class="kicker">Nachschlagen</div><h1 class="title">Glossar &amp; Paragrafen</h1>
    <p class="lead">Alle Abkürzungen und die wichtigsten Normen an einem Ort. Die Suche oben durchsucht auch diese Seite.</p>
    ${herkunftHtml()}
    <h2 class="h2">Abkürzungen &amp; Begriffe</h2>
    <div class="gloss-letters">${letters.map(L => `<a href="#/glossar/L-${encodeURIComponent(L)}">${L}</a>`).join("")}</div>
    <div class="card glosslist">`;
  let lastL = "";
  sorted.forEach(({ g: [k, v], i }) => {
    const L = k[0].toUpperCase();
    const letterId = L !== lastL ? ` data-letter="${esc(L)}"` : "";
    lastL = L;
    h += `<div class="glossitem" id="g${i}"${letterId}><div class="gk">${esc(k)}</div><div class="gv">${v}</div></div>`;
  });
  h += `</div><h2 class="h2">Die wichtigsten Paragrafen</h2><p class="muted">Auszüge im (teils gekürzten) Wortlaut. Maßgeblich ist stets die aktuelle amtliche Fassung.</p>`;
  PARAGRAPHS.forEach((grp, gi) => {
    h += `<div class="para-group"><div class="para-gname">${grp.g}</div><div class="card">`;
    grp.items.forEach(([p, d, txt], ii) => {
      h += `<div class="paraitem" id="p${gi}-${ii}"><span class="pk">${p}</span><span class="pd">${d}</span>${txt ? `<div class="ptext">${txt}</div>` : ""}</div>`;
    });
    h += `</div></div>`;
  });
  return {
    title: "Glossar & Paragrafen", html: h,
    after: () => {
      if (!r.anchor) return;
      const el = r.anchor.startsWith("L-") ? main.querySelector(`[data-letter="${CSS.escape(r.anchor.slice(2))}"]`) : document.getElementById(r.anchor);
      if (el) requestAnimationFrame(() => { el.scrollIntoView({ block: "start" }); if (el.classList.contains("glossitem") || el.classList.contains("paraitem")) el.classList.add("hl"); });
    },
  };
}

/* =========================================================
   Druckversion
   ========================================================= */
function viewPrint(r) {
  const mods = r.mi == null ? DATA.map((_, i) => i) : [r.mi];
  let h = `<div class="noprint"><div class="kicker">Druckversion</div><h1 class="title">Skript drucken</h1>
    <p class="lead">Alle Lektionen und Übungsfälle mit Lösungen am Stück – zum Ausdrucken oder als PDF speichern („Drucken" → „Als PDF sichern").</p>
    <div class="btnrow"><button type="button" class="btn" data-action="print">Jetzt drucken</button>
    ${DATA.map((m, mi) => `<a class="btn sec small" href="#/druck/${mi}"${r.mi === mi ? ` aria-current="page"` : ""}>${m.n}</a>`).join("")}
    <a class="btn ghost small" href="#/druck">Alle Module</a></div></div>`;
  mods.forEach(mi => {
    const m = DATA[mi];
    h += `<section class="print-lesson"><div class="kicker">Modul ${m.n} · ${esc(m.day)}</div><h1 class="title">${m.label}</h1><p class="lead">${m.lead}</p></section>`;
    m.lessons.forEach((l, li) => {
      h += `<article class="lesson"><h2 class="h2">${li + 1}. ${l.t}</h2><div class="subtitle">${l.s}</div>${lessonBody(l, true)}</article>`;
    });
    if ((m.drills || []).length) {
      h += `<h2 class="h2">Übungsfälle ${m.label}</h2>`;
      m.drills.forEach((d, i) => {
        h += `<div class="card drill"><div class="dh"><span class="dnum">A${i + 1}</span><div class="dtitle"><h3>${d.t}</h3><div class="dlevel">${d.lvl || "Übung"} · ${DIFF[d.diff || 1]}</div>${srcChip(d.src)}</div></div>
          <div class="dtask">${d.task}</div>${d.hint ? `<div class="dhint"><b>Denkanstoß:</b> ${d.hint}</div>` : ""}<div class="dsol">${d.sol}</div></div>`;
      });
    }
  });
  return { title: "Skript drucken", html: h };
}

/* =========================================================
   Suche
   ========================================================= */
const SEARCH_INDEX = (() => {
  const idx = [];
  DATA.forEach((m, mi) => m.lessons.forEach((l, li) => {
    const body = strip([l.intro, ...l.blocks.map(b => b.p), l.ex, l.warn].join(" "));
    const easyText = l.easy ? strip([l.easy.p, l.easy.bild, l.easy.merk].join(" ")) : "";
    const deepText = (l.deep || []).map(d => strip(d.h + " " + d.p)).join(" ");
    const hay = [l.t, easyText, deepText, l.s, body, l.blocks.map(b => b.h).join(" "), (l.laws || []).join(" "), l.figs ? l.figs.rows.flat().join(" ") : "", strip(l.vis)].join(" ").toLowerCase();
    idx.push({ type: "lesson", hash: `#/m/${mi}/l/${li}`, mod: `Modul ${m.n} · ${m.label}`, title: strip(l.t), body, hay });
  }));
  DATA.forEach((m, mi) => (m.drills || []).forEach(d => {
    const body = strip(d.task);
    idx.push({ type: "drill", hash: `#/m/${mi}/ueben`, mod: `Übung · ${m.label}`, title: strip(d.t), body, hay: (d.t + " " + body + " " + strip(d.sol)).toLowerCase() });
  }));
  GLOSSARY.forEach(([k, v], i) => idx.push({ type: "gloss", hash: `#/glossar/g${i}`, mod: "Glossar", title: k, body: strip(v), hay: (k + " " + strip(v)).toLowerCase() }));
  PARAGRAPHS.forEach((g, gi) => g.items.forEach(([p, d, txt], ii) => idx.push({ type: "para", hash: `#/glossar/p${gi}-${ii}`, mod: `Paragraf · ${g.g}`, title: `${p} – ${d}`, body: strip(txt), hay: (p + " " + d + " " + strip(txt)).toLowerCase() })));
  return idx;
})();

function snippet(text, term) {
  const i = text.toLowerCase().indexOf(term);
  if (i < 0) return esc(text.slice(0, 150)) + (text.length > 150 ? " …" : "");
  const s = Math.max(0, i - 60);
  const part = (s > 0 ? "… " : "") + text.slice(s, i + term.length + 110) + " …";
  return highlight(part, term);
}
function highlight(text, term) {
  const e = esc(text);
  const t = esc(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return t ? e.replace(new RegExp(t, "gi"), m => `<mark>${m}</mark>`) : e;
}

function viewSearch(r) {
  const term = (r.q || "").trim();
  const t = term.toLowerCase();
  const input = $("#searchInput");
  if (input.value !== term && document.activeElement !== input) input.value = term;
  if (t.length < 2) return { title: "Suche", html: `<h1 class="title">Suche</h1><p class="lead">Mindestens zwei Zeichen eingeben.</p>` };
  const hits = SEARCH_INDEX.filter(x => x.hay.includes(t));
  const groups = [["lesson", "Lektionen"], ["drill", "Übungsfälle"], ["gloss", "Glossar"], ["para", "Paragrafen"]];
  let h = `<div class="kicker">Suche</div><h1 class="title">${hits.length} Treffer für „${esc(term)}"</h1>`;
  groups.forEach(([type, label]) => {
    const gs = hits.filter(x => x.type === type);
    if (!gs.length) return;
    h += `<div class="search-cat">${label} · ${gs.length}</div>`;
    gs.slice(0, 30).forEach(x => {
      h += `<a class="card hit" href="${x.hash}"><small>${esc(x.mod)}</small><b>${highlight(x.title, t)}</b>${x.body ? `<p>${snippet(x.body, t)}</p>` : ""}</a>`;
    });
  });
  if (!hits.length) h += `<div class="card empty">Keine Treffer. Versuch einen anderen Begriff – z. B. „AfA", „Vorsteuer" oder „§ 15".</div>`;
  return { title: `Suche: ${term}`, html: h };
}

let searchOrigin = null;
function onSearchInput(e) {
  const q = e.target.value;
  if (q.trim().length >= 2) {
    const hash = `#/suche/${encodeURIComponent(q.trim())}`;
    if (route.name === "search") {
      history.replaceState(null, "", hash);
      render({ focus: false });
    } else {
      searchOrigin = location.hash || "#/";
      location.hash = hash;
    }
  } else if (!q && route.name === "search") {
    location.hash = searchOrigin || "#/";
  }
}

/* =========================================================
   Aktionen (Event-Delegation – kein Inline-JavaScript)
   ========================================================= */
function setRead(mi, li, value) {
  const k = lessonId(mi, li);
  if (value) progress.read[k] = 1; else delete progress.read[k];
  saveProgress();
}

document.addEventListener("click", e => {
  const markLink = e.target.closest("[data-markread]");
  if (markLink) { const pos = LESSON_POS.get(markLink.dataset.markread); if (pos && !isRead(pos.mi, pos.li)) setRead(pos.mi, pos.li, true); }

  const el = e.target.closest("[data-action]");
  if (!el) return;
  const a = el.dataset.action;
  const mi = Number(el.dataset.mi), gi = Number(el.dataset.gi);
  switch (a) {
    case "toggle-extra": {
      const now = !hideExtras();
      try { localStorage.setItem("stb_hide_extra", now ? "1" : "0"); } catch (e) { /* privater Modus */ }
      applyHideExtras();
      el.setAttribute("aria-pressed", String(now));
      el.textContent = now ? "Ergänzungen einblenden" : "Ergänzungen ausblenden";
      break;
    }
    case "toggle-read": {
      const li = Number(el.dataset.li);
      const now = !isRead(mi, li);
      setRead(mi, li, now);
      el.setAttribute("aria-pressed", String(now));
      el.textContent = now ? "✓ Gelesen" : "Als gelesen markieren";
      break;
    }
    case "answer": answer(Number(el.dataset.pos)); break;
    case "next": nextQuestion(); break;
    case "restart": newQuiz(quiz.key); rerenderQuiz(); renderNav(); break;
    case "gen-toggle": genState[`${mi}-${gi}`].show = !genState[`${mi}-${gi}`].show; $(`#gen-${mi}-${gi}`).innerHTML = genCard(mi, gi); break;
    case "gen-new": genState[`${mi}-${gi}`] = { data: GENERATORS[mi][gi].make(), show: false }; $(`#gen-${mi}-${gi}`).innerHTML = genCard(mi, gi); break;
    case "gen-check": checkGen(mi, gi); break;
    case "d-hint": case "d-step": case "d-all": case "d-hide": drillAction(a, el.dataset.key); break;
    case "d-rate": rateDrill(el.dataset.key, el.dataset.v); break;
    case "d-filter": drillFilter[el.dataset.f] = el.dataset.v; render({ focus: false }); break;
    case "b-check": checkBuilder(); break;
    case "b-new": builder = newBuilder(); $("#builder").innerHTML = builderCard(); break;
    case "card-flip": cards.flipped = !cards.flipped; rerenderCards(); $("#cardArea .face")?.focus(); break;
    case "card-know": cardStep(true); break;
    case "card-again": cardStep(false); break;
    case "cards-restart": newCards(); rerenderCards(); break;
    case "cards-all": newCards(true); rerenderCards(); break;
    case "print": window.print(); break;
    case "export": exportProgress(); break;
    case "reset":
      if (confirm("Lernfortschritt wirklich vollständig zurücksetzen?")) { progress = emptyProgress(); saveProgress(); quiz = null; cards = null; render(); toast("Fortschritt zurückgesetzt"); }
      break;
  }
});

document.addEventListener("keydown", e => {
  const typing = e.target.closest && e.target.closest("input, textarea, select, [contenteditable]");
  if (e.key === "Enter" && e.target.classList && e.target.classList.contains("gen-input")) { e.preventDefault(); checkGen(Number(e.target.dataset.mi), Number(e.target.dataset.gi)); return; }
  if (e.key === "/" && !typing) { e.preventDefault(); $("#searchInput").focus(); return; }
  if (e.key === "Escape") {
    if (document.body.classList.contains("nav-open")) { closeNav(); return; }
    if (e.target.id === "searchInput" && e.target.value) { e.target.value = ""; onSearchInput({ target: e.target }); return; }
  }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (["quiz", "test", "review"].includes(route.name) && quiz && !quiz.done) {
    if (quiz.answered == null && /^[1-9]$/.test(e.key)) {
      const pos = Number(e.key) - 1;
      if (quiz.order && pos < quiz.order.length) { e.preventDefault(); answer(pos); }
    } else if (quiz.answered != null && (e.key === "Enter" || e.key === "ArrowRight") && e.target.tagName !== "BUTTON") {
      e.preventDefault(); nextQuestion();
    }
  }
  if (route.name === "cards" && cards && cards.i < cards.deck.length) {
    if (e.key === " " && e.target.tagName !== "BUTTON") { e.preventDefault(); cards.flipped = !cards.flipped; rerenderCards(); }
    else if (e.key === "ArrowRight") cardStep(true);
    else if (e.key === "ArrowLeft") cardStep(false);
  }
});

/* Export / Import */
function exportProgress() {
  const blob = new Blob([JSON.stringify({ app: "steuerkurs", version: 2, exported: new Date().toISOString(), progress }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `steuerkurs-fortschritt-${isoToday()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast("Fortschritt exportiert");
}
$("#importFile").addEventListener("change", async e => {
  const file = e.target.files && e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const json = JSON.parse(await file.text());
    const p = json && json.progress ? json.progress : json;
    if (!p || typeof p !== "object" || !p.read) throw new Error("kein Fortschritt");
    progress = normalizeProgress(p);
    saveProgress();
    quiz = null; cards = null;
    render();
    toast("Fortschritt importiert");
  } catch (err) {
    toast("Datei konnte nicht gelesen werden");
  }
});

/* Mobile Navigation */
function openNav() { document.body.classList.add("nav-open"); $("#menuBtn").setAttribute("aria-expanded", "true"); $("#sidebar").querySelector("a")?.focus(); }
function closeNav() { if (!document.body.classList.contains("nav-open")) return; document.body.classList.remove("nav-open"); $("#menuBtn").setAttribute("aria-expanded", "false"); }
$("#menuBtn").addEventListener("click", () => (document.body.classList.contains("nav-open") ? closeNav() : openNav()));
$("#scrim").addEventListener("click", closeNav);

/* Design hell/dunkel */
function syncThemeButton() {
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  const btn = $("#themeBtn");
  btn.textContent = dark ? "☀" : "☾";
  btn.setAttribute("aria-label", dark ? "Helles Design einschalten" : "Dunkles Design einschalten");
}
$("#themeBtn").addEventListener("click", () => {
  const t = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", t);
  try { localStorage.setItem("stb_theme", t); } catch (e) {}
  syncThemeButton();
});
syncThemeButton();

/* Drucken: Lösungen immer mitdrucken */
window.addEventListener("beforeprint", () => document.querySelectorAll("main details").forEach(d => { d.dataset.wasOpen = d.open ? "1" : ""; d.open = true; }));
window.addEventListener("afterprint", () => document.querySelectorAll("main details").forEach(d => { if (d.dataset.wasOpen === "") d.open = false; }));

$("#searchInput").addEventListener("input", onSearchInput);
window.addEventListener("hashchange", () => render());

/* Start */
updateChrome();
render({ focus: false });

/* Offline-Unterstützung und automatische Updates.
   iPad/iPhone (besonders als Home-Bildschirm-App) laden eine offene Seite oft tagelang nicht neu.
   Deshalb: beim Zurückkehren in die App nach einer neuen Version fragen und nach dem Update einmal neu laden. */
if ("serviceWorker" in navigator && location.protocol === "https:") {
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then(reg => {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") reg.update().catch(() => {});
      });
    }).catch(() => {});
  });
}
