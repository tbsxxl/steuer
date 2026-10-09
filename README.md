# Steuerrecht Intensivkurs – Lernapp 2026

Lern- und Übungsplattform zur Vorbereitung auf den 13-Tage-Intensivkurs Steuerrecht
(Veranlagungsjahr 2026): 6 Module, 53 Lektionen, 136 Quizfragen, 65 Übungsfälle,
Rechentrainer mit Zufallszahlen, Glossar und Paragrafensammlung.

Läuft auf **Cloudflare Workers** als reine statische Seite – kein Server-Code, keine Datenbank.
Der Lernfortschritt bleibt lokal im Browser (Export/Import als JSON-Datei möglich).

## Funktionen

- **Lesemodus** mit Seitenleiste, Weiter/Zurück und „Als gelesen markieren“
- **Wissenscheck** je Modul, **Abschlusstest** (20 gemischte Fragen mit Auswertung je Modul)
- **Fehler wiederholen**: falsch beantwortete Fragen werden automatisch gesammelt
- **Üben**: Übungsfälle mit aufklappbarer Lösung, Rechentrainer, Bilanz-Builder
- **Karteikarten** aus dem Glossar, **Volltextsuche** (Taste `/`)
- **Kursplan** mit Countdown bzw. „Heute Kurstag X“
- **Druckversion/PDF** des gesamten Skripts, **Hell/Dunkel**, **offline nutzbar** (Service Worker)
- Tastatur: `1`–`4` Antwort wählen, `Enter` weiter, Leertaste/`←`/`→` bei Karteikarten

## Aufbau

```
public/
  index.html            App-Gerüst
  css/app.css           Design (Newsreader + IBM Plex, selbst gehostet)
  js/data.js            Kursinhalte: Module, Lektionen, Quiz, Übungen, Glossar, Paragrafen
  js/trainer.js         Rechentrainer (Aufgaben mit Zufallszahlen)
  js/app.js             Oberfläche, Routing (#/m/0/l/3 …), Fortschritt
  sw.js                 Offline-Cache
  _headers, _redirects  Sicherheits-/Cache-Header, Weiterleitung alter Links
scripts/check.js        Plausibilitätsprüfung der Kursdaten (`npm run check`)
wrangler.jsonc          Cloudflare-Konfiguration
```

Inhalte ändern: nur `public/js/data.js` bearbeiten, danach `npm run check`.
Jede Lektion hat eine feste `id` — der Lernfortschritt hängt daran. IDs nie ändern
oder wiederverwenden; neue Lektionen bekommen eine neue, sprechende ID.
Nach größeren Änderungen an Dateinamen in `public/sw.js` die Cache-Version (`CACHE`) erhöhen.

## Lokal starten

```bash
npm install
npm run dev        # http://localhost:8787
```

## Auf Cloudflare veröffentlichen

1. [Cloudflare-Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Import a repository**.
2. GitHub verbinden und `tbsxxl/steuer` auswählen.
3. Einstellungen übernehmen (Cloudflare erkennt `wrangler.jsonc`, Deploy-Befehl `npx wrangler deploy`) → **Deploy**.

Danach wird bei jedem Push auf den Produktions-Branch automatisch neu veröffentlicht.
Adresse: `https://steuer.<dein-account>.workers.dev`, eigene Domain unter Worker → Settings → Domains & Routes.

Alternativ lokal: `npx wrangler login` und `npm run deploy`.

## Lizenzen

Schriften: Newsreader und IBM Plex (SIL Open Font License 1.1), selbst gehostet unter `public/fonts/`.
