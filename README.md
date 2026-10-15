# Steuerrecht Intensivkurs – Lernapp 2026

Lern- und Übungsplattform zur Vorbereitung auf den 13-Tage-Intensivkurs Steuerrecht
(Veranlagungsjahr 2026): 6 Module, 54 Lektionen, 144 Quizfragen, 80 Übungsfälle,
Rechentrainer mit Zufallszahlen, Glossar und Paragrafensammlung.

Läuft auf **Cloudflare Workers** als reine statische Seite – kein Server-Code, keine Datenbank.
Der Lernfortschritt bleibt lokal im Browser (Export/Import als JSON-Datei möglich).

## Funktionen

- **Lesemodus** mit Seitenleiste, Weiter/Zurück und „Als gelesen markieren“
- **Vertiefung je Lektion** (280 Punkte): Details, Rechenbeispiele und Sonderfälle aus den Kursunterlagen, jeweils mit Herkunft und Seitenangabe
- **Wissenscheck** je Modul, **Abschlusstest** (20 gemischte Fragen mit Auswertung je Modul)
- **Fehler wiederholen**: falsch beantwortete Fragen werden automatisch gesammelt
- **Üben**: Übungsfälle mit aufklappbarer Lösung, Rechentrainer, Bilanz-Builder
- **Karteikarten** aus dem Glossar, **Volltextsuche** (Taste `/`)
- **Kursplan** (AO 07.–08.10., Rechnungswesen 09.–14.10., ESt, LSt, GewSt/KSt, USt bis 23.10.) mit Countdown, „Heute Kurstag X“ und Gliederung je Modul
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

## Private Nutzung und Zugriffsschutz

Private Lernhilfe zum persönlichen Gebrauch – kein Angebot des Kursveranstalters. Die Kursunterlagen
(PDFs) sind nicht Teil des Repositorys; die Texte der App sind eigene Zusammenfassungen, die
Quellenangaben verweisen nur auf die Fundstelle. Die Seite ist für Suchmaschinen gesperrt
(`robots.txt`, `X-Robots-Tag`, `<meta name="robots">`).

Zugriff nur für eingeladene Personen über **Cloudflare Access** (Zero Trust, bis 50 Nutzer kostenlos):

1. Cloudflare-Dashboard → **Zero Trust** öffnen (beim ersten Mal Team-Namen wählen, Free-Plan).
2. **Access → Applications → Add an application → Self-hosted**.
3. Name „Steuer-Lernapp“, Domain: die `*.workers.dev`-Adresse bzw. eigene Domain der App, Pfad leer lassen.
4. **Policy** anlegen: Action *Allow*, Include → *Emails* → eigene Adresse(n) eintragen.
5. Login-Methode: **One-time PIN** (Code per E-Mail) – ist standardmäßig aktiv.
6. Speichern. Ab dann fragt die App vor dem Öffnen nach der E-Mail-Adresse und schickt einen Code.

Für `*.workers.dev`-Adressen alternativ im Worker unter **Settings → Domains & Routes** bei
„workers.dev“ den Schalter für Cloudflare Access aktivieren und die E-Mail-Adressen freigeben.
