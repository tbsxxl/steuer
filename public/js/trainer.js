// Rechentrainer: erzeugt bei jedem Aufruf neue Zahlen (Schlüssel = Modulindex)

export function ri(min,max){return Math.floor(Math.random()*(max-min+1))+min;}
export function fmt(n){return n.toLocaleString('de-DE');}
export const GENERATORS = {
  0:[ // Rechnungswesen
    {title:"AfA berechnen",level:"linear, Monatsregel",
     make:()=>{const ak=ri(12,60)*1000;const nd=[3,5,8,10,13][ri(0,4)];const mon=ri(1,12);const jahr=Math.round(ak/nd);const anteil=Math.round(jahr*(13-mon)/12);return{
       q:`Anschaffung einer Maschine am 1. <b>${['Jan','Feb','März','Apr','Mai','Juni','Juli','Aug','Sep','Okt','Nov','Dez'][mon-1]}</b> für <b>${fmt(ak)} €</b> netto, Nutzungsdauer <b>${nd} Jahre</b> (linear). Wie hoch ist die AfA im Anschaffungsjahr?`,
       a:`Jahres-AfA = ${fmt(ak)} ÷ ${nd} = <b>${fmt(jahr)} €</b>. Im Anschaffungsjahr zeitanteilig ab ${['Jan','Feb','März','Apr','Mai','Juni','Juli','Aug','Sep','Okt','Nov','Dez'][mon-1]} = ${13-mon} Monate → ${fmt(jahr)} × ${13-mon}/12 = <span class="genres">${fmt(anteil)} €</span>`
     };}},
    {title:"USt-Zahllast",level:"Voranmeldung",
     make:()=>{const aus=ri(20,80)*1000;const ein=ri(8,40)*1000;const ust=Math.round(aus*0.19);const vst=Math.round(ein*0.19);const zl=ust-vst;return{
       q:`Ausgangsumsätze <b>${fmt(aus)} €</b> netto (19 %), Eingangsrechnungen mit Vorsteuer <b>${fmt(ein)} €</b> netto (19 %). Wie hoch ist die USt-Zahllast?`,
       a:`USt = ${fmt(aus)} × 19 % = ${fmt(ust)} €. Vorsteuer = ${fmt(ein)} × 19 % = ${fmt(vst)} €. Zahllast = ${fmt(ust)} − ${fmt(vst)} = <span class="genres">${fmt(zl)} €</span>`
     };}},
    {title:"GWG oder nicht?",level:"Einordnung 2026",
     make:()=>{const preis=ri(150,1400);let kat,erkl;if(preis<=250){kat='Sofortaufwand';erkl='≤ 250 € netto → sofort als Betriebsausgabe abziehbar, keine Aufnahme ins GWG-Verzeichnis nötig.';}else if(preis<=800){kat='GWG — Sofortabschreibung';erkl='über 250 € und ≤ 800 € netto → GWG (§ 6 Abs. 2 EStG), sofort voll abziehbar (alternativ wahlweise Sammelposten).';}else if(preis<=1000){kat='Sammelposten';erkl='über 800 €, aber ≤ 1.000 € → Sammelposten (§ 6 Abs. 2a), Auflösung über 5 Jahre (alternativ reguläre AfA).';}else{kat='reguläre AfA';erkl='über 1.000 € → kein GWG, normale Abschreibung über die Nutzungsdauer.';}return{
       q:`Ein Wirtschaftsgut (kein digitales Gerät) kostet <b>${fmt(preis)} €</b> netto. Wie wird es steuerlich behandelt?`,
       a:`<b>${kat}.</b> ${erkl} <span class="genres">${kat}</span>`
     };}},
    {title:"Skonto berechnen",level:"Zahlungsverkehr",
     make:()=>{const netto=ri(2,20)*1000;const sk=[2,3][ri(0,1)];const brutto=Math.round(netto*1.19);const skzahl=Math.round(brutto*(100-sk)/100);return{
       q:`Eine Eingangsrechnung lautet über <b>${fmt(netto)} €</b> netto (19 % USt). Bei Zahlung binnen 10 Tagen gewährt der Lieferant <b>${sk} % Skonto</b>. Wie viel ist bei Skontoabzug zu überweisen?`,
       a:`Bruttobetrag = ${fmt(netto)} × 1,19 = ${fmt(brutto)} €. Abzüglich ${sk} % Skonto → ${fmt(brutto)} × ${(100-sk)}/100 = <span class="genres">${fmt(skzahl)} €</span> (Skonto mindert auch die Vorsteuer entsprechend)`
     };}},
    {title:"Rohgewinn & Handelsspanne",level:"Kalkulation",
     make:()=>{const ek=ri(20,60)*1000;const auf=ri(30,80);const vk=Math.round(ek*(100+auf)/100);const rg=vk-ek;return{
       q:`Wareneinsatz <b>${fmt(ek)} €</b>, Aufschlag <b>${auf} %</b>. Wie hoch sind Verkaufspreis (netto) und Rohgewinn?`,
       a:`Verkaufspreis = ${fmt(ek)} × ${(100+auf)}/100 = ${fmt(vk)} €. Rohgewinn = ${fmt(vk)} − ${fmt(ek)} = <span class="genres">${fmt(rg)} €</span>`
     };}}
  ],
  4:[ // GewSt/KSt
    {title:"Gewerbesteuer berechnen",level:"GmbH",
     make:()=>{const g=ri(80,300)*1000;const hs=[350,400,450,470][ri(0,3)];const mb=Math.round(g*0.035);const gs=Math.round(mb*hs/100);return{
       q:`GmbH, Gewerbeertrag <b>${fmt(g)} €</b>, Hebesatz <b>${hs} %</b>, keine Hinzurechnungen/Kürzungen. Wie hoch ist die Gewerbesteuer? (kein Freibetrag bei der GmbH)`,
       a:`Messbetrag = ${fmt(g)} × 3,5 % = ${fmt(mb)} €. GewSt = ${fmt(mb)} × ${hs} % = <span class="genres">${fmt(gs)} €</span>`
     };}},
    {title:"Körperschaftsteuer + SolZ",level:"KSt 2026",
     make:()=>{const zve=ri(50,400)*1000;const kst=Math.round(zve*0.15);const sol=Math.round(kst*0.055);return{
       q:`Eine GmbH hat ein zu versteuerndes Einkommen von <b>${fmt(zve)} €</b> (2026). Wie hoch sind Körperschaftsteuer und Solidaritätszuschlag?`,
       a:`KSt = ${fmt(zve)} × 15 % = ${fmt(kst)} €. SolZ = ${fmt(kst)} × 5,5 % = ${fmt(sol)} €. Gesamt = <span class="genres">${fmt(kst+sol)} €</span> (effektiv 15,825 %)`
     };}},
    {title:"GewSt Einzelunternehmen mit Freibetrag",level:"§ 35 Anrechnung",
     make:()=>{const g=ri(40,120)*1000;const hs=[380,400,420][ri(0,2)];const nachFB=Math.max(0,g-24500);const mb=Math.round(nachFB*0.035);const gs=Math.round(mb*hs/100);const anr=Math.round(mb*4.0);return{
       q:`Einzelunternehmen, Gewerbeertrag <b>${fmt(g)} €</b>, Hebesatz <b>${hs} %</b>. Wie hoch ist die Gewerbesteuer (nach Freibetrag 24.500 €)?`,
       a:`Nach Freibetrag: ${fmt(g)} − 24.500 = ${fmt(nachFB)} €. Messbetrag × 3,5 % = ${fmt(mb)} €. GewSt = ${fmt(mb)} × ${hs} % = <span class="genres">${fmt(gs)} €</span>. § 35 EStG rechnet 4,0 × ${fmt(mb)} = ${fmt(anr)} € auf die ESt an → GewSt weitgehend neutralisiert.`
     };}},
    {title:"Gesamtbelastung Ausschüttung",level:"anspruchsvoll",
     make:()=>{const g=ri(60,200)*1000;const hs=400;const gewst=Math.round(g*0.14);const kst=Math.round(g*0.15825);const nach=g-gewst-kst;const ausst=Math.round(nach*0.26375);const netto=nach-ausst;const last=Math.round((gewst+kst+ausst)/g*1000)/10;return{
       q:`GmbH-Gewinn <b>${fmt(g)} €</b> (Hebesatz 400 %). Alles wird an den Alleingesellschafter ausgeschüttet (Abgeltungsteuer 25 % + SolZ). Wie hoch ist die Gesamtbelastung in %?`,
       a:`GewSt ≈ ${fmt(gewst)} €, KSt+SolZ ≈ ${fmt(kst)} €, Rest ${fmt(nach)} €. Abgeltungsteuer 26,375 % = ${fmt(ausst)} €. Netto ${fmt(netto)} €. Gesamtsteuer/Gewinn = <span class="genres">≈ ${last} %</span>`
     };}}
  ],
  2:[ // Einkommensteuer
    {title:"Entfernungspauschale",level:"Pendler",
     make:()=>{const km=ri(15,60);const tage=ri(190,225);const p=km*0.38;const jahr=Math.round(p*tage);return{
       q:`Ein Arbeitnehmer fährt an <b>${tage} Tagen</b> je <b>${km} km</b> (einfache Strecke) zur Arbeit. Wie hoch ist die Entfernungspauschale im Jahr?`,
       a:`Seit 2026 gilt 0,38 € ab dem ersten Kilometer. Pro Tag: ${km} km × 0,38 € = ${p.toFixed(2).replace('.',',')} €. × ${tage} Tage = <span class="genres">${fmt(jahr)} €</span>${jahr>1230?' — übersteigt den Pauschbetrag von 1.230 €, Einzelnachweis lohnt sich.':' — liegt unter dem Pauschbetrag von 1.230 €.'}`
     };}},
    {title:"zu versteuerndes Einkommen",level:"Veranlagung",
     make:()=>{const lohn=ri(35,90)*1000;const kv=ri(35,60)*100;const sonst=ri(3,20)*100;const eink=lohn-1230;const zve=eink-kv-sonst;return{
       q:`Bruttolohn <b>${fmt(lohn)} €</b>, Basis-Kranken-/Pflegeversicherung <b>${fmt(kv)} €</b>, weitere Sonderausgaben <b>${fmt(sonst)} €</b>. Wie hoch ist das zu versteuernde Einkommen?`,
       a:`Einkünfte = ${fmt(lohn)} − 1.230 (AN-Pauschbetrag) = ${fmt(eink)} €. zvE = ${fmt(eink)} − ${fmt(kv)} − ${fmt(sonst)} = <span class="genres">${fmt(zve)} €</span>`
     };}},
    {title:"Ehegattensplitting-Vorteil",level:"Splitting",
     make:()=>{const a=ri(50,90)*1000;const b=ri(0,25)*1000;const halb=Math.round((a+b)/2);return{
       q:`Ehepaar: Partner A verdient <b>${fmt(a)} €</b> zvE, Partner B <b>${fmt(b)} €</b>. Auf welches Einkommen wird beim Splitting der Tarif angewendet (Splitting-Grundlage)?`,
       a:`Gemeinsames zvE = ${fmt(a)} + ${fmt(b)} = ${fmt(a+b)} €. Halbiert: <span class="genres">${fmt(halb)} €</span> — auf diese Hälfte wird der Tarif angewendet, das Ergebnis dann verdoppelt. Vorteil ist umso größer, je ungleicher die Einkommen.`
     };}},
    {title:"Abschreibung Immobilie (V+V)",level:"§ 7 Abs. 4",
     make:()=>{const kauf=ri(200,500)*1000;const grund=Math.round(kauf*ri(20,35)/100);const geb=kauf-grund;const afa=Math.round(geb*0.02);return{
       q:`Vermietete Immobilie: Kaufpreis <b>${fmt(kauf)} €</b>, davon Grundanteil <b>${fmt(grund)} €</b>. Wie hoch ist die jährliche Gebäude-AfA (2 %)?`,
       a:`Nur das Gebäude wird abgeschrieben: ${fmt(kauf)} − ${fmt(grund)} = ${fmt(geb)} € Gebäudewert. AfA = ${fmt(geb)} × 2 % = <span class="genres">${fmt(afa)} €/Jahr</span> (Grund und Boden nie abschreibbar)`
     };}}
  ],
  3:[ // Lohnsteuer
    {title:"Sachbezug-Freigrenze",level:"§ 8 Abs. 2",
     make:()=>{const wert=ri(40,60);const ok=wert<=50;return{
       q:`Ein Arbeitgeber gewährt einen monatlichen Sachbezug (Tankgutschein) von <b>${wert} €</b>. Ist er steuerfrei?`,
       a:ok?`<b>Ja, steuerfrei.</b> ${wert} € ≤ 50 € Freigrenze (§ 8 Abs. 2). <span class="genres">steuerfrei</span>`:`<b>Nein.</b> ${wert} € > 50 € → Freigrenze überschritten, der <b>gesamte</b> Betrag (${wert} €) ist steuer- und beitragspflichtig (Freigrenze, kein Freibetrag). <span class="genres">voll steuerpflichtig</span>`
     };}},
    {title:"Verpflegungsmehraufwand",level:"Reisekosten",
     make:()=>{const std=[9,11,24,14][ri(0,3)];let pausch;if(std>=24)pausch=28;else if(std>8)pausch=14;else pausch=0;const tage=ri(2,8);return{
       q:`Ein Arbeitnehmer ist an <b>${tage} Tagen</b> auf Dienstreise mit jeweils <b>über ${std>=24?'24':std} Stunden</b> Abwesenheit. Wie hoch ist die Verpflegungspauschale gesamt? (Zwischentage)`,
       a:`Bei ${std>=24?'ganztägiger (24 h)':'über 8 h'} Abwesenheit: ${pausch} €/Tag. × ${tage} Tage = <span class="genres">${fmt(pausch*tage)} €</span> (An-/Abreisetage je 14 €, hier als volle Tage gerechnet)`
     };}}
  ],
  5:[ // Umsatzsteuer
    {title:"Kleinunternehmer prüfen",level:"§ 19 · 2026",
     make:()=>{const vj=ri(15,35)*1000;const lj=ri(40,120)*1000;const ok=vj<=25000&&lj<=100000;return{
       q:`Vorjahresumsatz <b>${fmt(vj)} €</b>, laufendes Jahr voraussichtlich <b>${fmt(lj)} €</b>. Kann die Kleinunternehmerregelung genutzt werden? (2026)`,
       a:ok?`<b>Ja.</b> Vorjahr ${fmt(vj)} ≤ 25.000 € und laufendes Jahr ${fmt(lj)} ≤ 100.000 €. <span class="genres">Kleinunternehmer möglich</span>`:`<b>Nein.</b> ${vj>25000?`Vorjahr ${fmt(vj)} € > 25.000 €`:`laufendes Jahr ${fmt(lj)} € > 100.000 €`} → Regelbesteuerung. <span class="genres">keine KU-Regelung</span>`
     };}},
    {title:"USt herausrechnen (brutto→netto)",level:"Steuersatz",
     make:()=>{const brutto=ri(50,500)*10;const satz=[19,7][ri(0,1)];const netto=Math.round(brutto/(1+satz/100)*100)/100;const ust=Math.round((brutto-netto)*100)/100;return{
       q:`Ein Bruttobetrag von <b>${fmt(brutto)} €</b> enthält <b>${satz} %</b> Umsatzsteuer. Wie hoch sind Netto und USt?`,
       a:`Netto = ${fmt(brutto)} ÷ ${(1+satz/100).toString().replace('.',',')} = ${netto.toLocaleString('de-DE')} €. USt = <span class="genres">${ust.toLocaleString('de-DE')} €</span>`
     };}},
    {title:"Vorsteuerüberhang",level:"Erstattung",
     make:()=>{const aus=ri(5,25)*1000;const ein=ri(30,70)*1000;const ust=Math.round(aus*0.19);const vst=Math.round(ein*0.19);const saldo=ust-vst;return{
       q:`Ein Existenzgründer hat hohe Investitionen: Ausgangsumsätze <b>${fmt(aus)} €</b> netto, Eingangsrechnungen <b>${fmt(ein)} €</b> netto (je 19 %). Wie hoch ist die Zahllast bzw. Erstattung?`,
       a:`USt ${fmt(ust)} € − Vorsteuer ${fmt(vst)} € = ${fmt(saldo)} €. Negativ → <span class="genres">Vorsteuererstattung ${fmt(-saldo)} €</span> vom Finanzamt (typisch in der Gründungsphase)`
     };}}
  ]
};
