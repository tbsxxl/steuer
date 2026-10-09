// Schnelle Plausibilitätsprüfung der Kursdaten und Skripte: `npm run check`
import { DATA, GLOSSARY, PARAGRAPHS } from "../public/js/data.js";
import { GENERATORS } from "../public/js/trainer.js";
import { readFileSync } from "node:fs";

const errors = [];
const fail = msg => errors.push(msg);
// Lernfortschritt hängt an den Lektions-IDs: Sie müssen eindeutig sein und dürfen sich nicht ändern.
const lessonIds = new Set();
const validSrc = s => !!s && (s.k === "e" || ((s.k === "q" || s.k === "m") && typeof s.d === "string" && Number.isInteger(s.s)));

DATA.forEach((m, mi) => {
  if (m.id !== mi) fail(`Modul ${mi}: id ${m.id} passt nicht zum Index`);
  for (const k of ["label", "n", "day", "lead"]) if (!m[k]) fail(`Modul ${mi}: Feld ${k} fehlt`);
  m.lessons.forEach((l, li) => {
    if (!l.id || !/^[a-z0-9-]+$/.test(l.id)) fail(`Lektion ${mi}-${li}: ID fehlt oder ungültig`);
    else if (lessonIds.has(l.id)) fail(`Lektion ${mi}-${li}: ID ${l.id} doppelt`);
    else lessonIds.add(l.id);
    for (const k of ["t", "s", "intro"]) if (!l[k]) fail(`Lektion ${mi}-${li}: Feld ${k} fehlt`);
    if (!Array.isArray(l.blocks) || !l.blocks.length) fail(`Lektion ${mi}-${li}: keine Blöcke`);
    if (!l.easy || !l.easy.p || !l.easy.bild || !l.easy.merk) fail(`Lektion ${mi}-${li}: „Einfach erklärt“ fehlt oder ist unvollständig`);
    // Herkunft: jeder Abschnitt ist als Kursunterlage (q), Unterlage + Ergänzung (m) oder Ergänzung (e) gekennzeichnet
    l.blocks.forEach((b, bi) => { if (!validSrc(b.src)) fail(`Lektion ${mi}-${li}, Block ${bi}: Herkunft fehlt`); });
    for (const part of ["figs", "vis", "ex", "warn"]) if (l[part] && !validSrc((l.srcs || {})[part])) fail(`Lektion ${mi}-${li}, ${part}: Herkunft fehlt`);
    if (!Array.isArray(l.laws)) fail(`Lektion ${mi}-${li}: laws fehlt`);
  });
  m.quiz.forEach((q, qi) => {
    if (!Array.isArray(q.o) || q.o.length < 2) fail(`Quiz ${mi}-${qi}: zu wenige Optionen`);
    if (!Number.isInteger(q.a) || q.a < 0 || q.a >= q.o.length) fail(`Quiz ${mi}-${qi}: Lösung außerhalb der Optionen`);
    if (!q.e || !q.l) fail(`Quiz ${mi}-${qi}: Erklärung/Norm fehlt`);
    if (!validSrc(q.src)) fail(`Quiz ${mi}-${qi}: Herkunft fehlt`);
  });
  (m.drills || []).forEach((d, di) => { if (!d.t || !d.task || !d.sol) fail(`Übung ${mi}-${di}: unvollständig`); if (!validSrc(d.src)) fail(`Übung ${mi}-${di}: Herkunft fehlt`);
    if (![1, 2, 3].includes(d.diff)) fail(`Übung ${mi}-${di}: Schwierigkeit fehlt`);
    if (!d.hint) fail(`Übung ${mi}-${di}: Denkanstoß fehlt`);
    if (!DATA.some(x => x.lessons.some(l => l.id === d.lid))) fail(`Übung ${mi}-${di}: Lektion ${d.lid} unbekannt`);
    if (!/class="step"/.test(d.sol)) fail(`Übung ${mi}-${di}: Lösung ohne Schritte`); });
});

GLOSSARY.forEach((g, i) => { if (!Array.isArray(g) || g.length !== 2) fail(`Glossar ${i}: Format`); });
PARAGRAPHS.forEach((g, i) => g.items.forEach((it, j) => { if (it.length < 2) fail(`Paragraf ${i}-${j}: Format`); }));

for (const [mi, gens] of Object.entries(GENERATORS)) {
  if (!DATA[mi]) fail(`Rechentrainer für unbekanntes Modul ${mi}`);
  gens.forEach(g => { for (let i = 0; i < 50; i++) { const r = g.make(); if (!r.q || !r.a || /NaN|undefined/.test(r.q + r.a)) { fail(`Rechentrainer „${g.title}": ungültige Aufgabe`); break; } } });
}

// Die Content-Security-Policy verbietet Inline-Skripte und style-Attribute.
const raw = ["public/js/data.js", "public/js/trainer.js", "public/js/app.js", "public/index.html", "public/404.html"].map(f => [f, readFileSync(f, "utf8")]);
for (const [f, src] of raw) {
  if (/\son[a-z]+\s*=\s*["'{]/i.test(src)) fail(`${f}: Inline-Eventhandler (CSP)`);
  if (/\sstyle\s*=\s*["']/i.test(src)) fail(`${f}: style-Attribut (CSP)`);
  if (f.endsWith(".html") && /<script(?![^>]*\ssrc=)[^>]*>/i.test(src)) fail(`${f}: Inline-Skript (CSP)`);
}

const lessons = DATA.reduce((n, m) => n + m.lessons.length, 0);
const quiz = DATA.reduce((n, m) => n + m.quiz.length, 0);
// Ältere Fortschrittsstände speicherten Positionen: die ursprünglichen Lektionen müssen ihre IDs behalten.
for (const [mi, n] of [[0, 10], [1, 5], [2, 5], [3, 3], [4, 4], [5, 4]]) for (let li = 0; li < n; li++) if (!lessonIds.has(`m${mi}l${li}`)) fail(`Lektions-ID m${mi}l${li} fehlt (Fortschrittsmigration)`);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`OK – ${DATA.length} Module, ${lessons} Lektionen, ${quiz} Quizfragen, ${DATA.reduce((n, m) => n + (m.drills || []).length, 0)} Übungsfälle, ${GLOSSARY.length} Glossarbegriffe`);
