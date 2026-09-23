// Schnelle Plausibilitätsprüfung der Kursdaten und Skripte: `npm run check`
import { DATA, GLOSSARY, PARAGRAPHS } from "../public/js/data.js";
import { GENERATORS } from "../public/js/trainer.js";
import { readFileSync } from "node:fs";

const errors = [];
const fail = msg => errors.push(msg);

DATA.forEach((m, mi) => {
  if (m.id !== mi) fail(`Modul ${mi}: id ${m.id} passt nicht zum Index`);
  for (const k of ["label", "n", "day", "lead"]) if (!m[k]) fail(`Modul ${mi}: Feld ${k} fehlt`);
  m.lessons.forEach((l, li) => {
    for (const k of ["t", "s", "intro"]) if (!l[k]) fail(`Lektion ${mi}-${li}: Feld ${k} fehlt`);
    if (!Array.isArray(l.blocks) || !l.blocks.length) fail(`Lektion ${mi}-${li}: keine Blöcke`);
    if (!Array.isArray(l.laws)) fail(`Lektion ${mi}-${li}: laws fehlt`);
  });
  m.quiz.forEach((q, qi) => {
    if (!Array.isArray(q.o) || q.o.length < 2) fail(`Quiz ${mi}-${qi}: zu wenige Optionen`);
    if (!Number.isInteger(q.a) || q.a < 0 || q.a >= q.o.length) fail(`Quiz ${mi}-${qi}: Lösung außerhalb der Optionen`);
    if (!q.e || !q.l) fail(`Quiz ${mi}-${qi}: Erklärung/Norm fehlt`);
  });
  (m.drills || []).forEach((d, di) => { if (!d.t || !d.task || !d.sol) fail(`Übung ${mi}-${di}: unvollständig`); });
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
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`OK – ${DATA.length} Module, ${lessons} Lektionen, ${quiz} Quizfragen, ${GLOSSARY.length} Glossarbegriffe`);
