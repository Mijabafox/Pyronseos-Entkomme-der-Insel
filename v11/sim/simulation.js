// Simulation: viele Bot-Partien, Auswertung, Parameter-Sweep, A/B-Vergleich, Abgleich mit echten Partien.
// Läuft headless (Node) und im Browser (gleicher Code). Gleiche Konfiguration + Seed = gleiche Partie.
import { Spielleiter, nachspielen } from './spielleiter.js';
import { klon, setzen, lesen, unterschiede, ROHSTOFFE } from '../engine/config.js';
import { validieren } from '../engine/validator.js';
import { kasseGesamt, flossKosten, wrackKosten } from '../engine/engine.js';
import { FLUCHTWEG_VON_GRUND } from '../engine/namen.js';
import { ableiten } from '../engine/rng.js';

export const ENDGRUENDE = ['floss', 'notfloss', 'signalfeuer', 'wrack', 'ueberlebender', 'lava', 'alle_ko', 'abbruch'];
export const WEGE = ['floss', 'feuer', 'wrack'];

// Sitze aus einer Bot-Zusammensetzung: ['normal','gut',...] oder [{stufe, persoenlichkeit}]
export function sitzeAus(bots, n) {
  const liste = Array.isArray(bots) ? bots : String(bots ?? 'normal').split(',');
  return Array.from({ length: n }, (_, k) => {
    const b = liste[k % liste.length] ?? 'normal';
    const o = typeof b === 'string' ? { stufe: b.trim() } : b;
    return { name: `KI ${k + 1}`, ki: true, stufe: o.stufe ?? 'normal', persoenlichkeit: o.persoenlichkeit ?? {}, charakter: o.charakter };
  });
}

// Eine Partie simulieren und Kennzahlen sammeln.
export function partieSimulieren(cfg, { seed, modus, spieler, bots, protokoll = false, mitZuegen = false }) {
  const n = modus === 'team' ? 2 * cfg.match.teamGroesse : spieler;
  const sitze = sitzeAus(bots, n);
  const sl = new Spielleiter(cfg, { seed, modus, sitze, protokoll });
  sl.laufen();
  const s = sl.s, st = s.statistik, e = s.ende;
  const siegerSitze = s.spieler.flatMap((p, k) => (e.gewinner.includes(p.id) ? [k] : []));
  const fluchtweg = FLUCHTWEG_VON_GRUND[e.grund] ?? null;
  const kasse = kasseGesamt(s, s.spieler.map((_, k) => k));
  const bedarf = (() => {
    const w = sl.bots.find((b) => b?.siegweg)?.siegweg;
    if (w === 'floss') return flossKosten(s, 'solide');
    if (w === 'wrack') return wrackKosten(s);
    return {};
  })();
  const r = {
    seed, modus, spieler: n, stufen: sitze.map((x) => x.stufe), charaktere: s.spieler.map((p) => p.charakter),
    grund: e.grund, sieg: e.gewinner.length > 0, fluchtweg, tag: e.tag, siegerSitze,
    siegwegeBots: sl.bots.map((b) => b?.siegweg ?? null),
    duelle: st.duelle, raube: { ...st.raube }, zurueckgesetzt: st.zurueckgesetzt, wasserZugende: st.wasserZugende,
    kaempfe: st.kaempfe, kompassTag: st.kompassTag, feuerGebaut: st.feuerGebaut ?? 0, feuerUngueltig: st.feuerUngueltig ?? 0,
    notFlossVersuche: st.notFlossVersuche, amBoden: st.amBoden ?? 0, ausgeschieden: st.ausgeschieden ?? 0,
    tageskarten: [...st.tageskarten], spezialkarten: st.spezialGezogen.map((x) => x.karte),
    vorratLeer: Object.fromEntries(ROHSTOFFE.map((x) => [x, st[`vorratLeer_${x}`] ?? 0])),
    fehltAmEnde: Object.fromEntries(Object.entries(bedarf).map(([k, v]) => [k, Math.max(0, v - (kasse[k] ?? 0))])),
    verlauf: st.verlauf, aktionen: sl.zuege.length,
  };
  if (mitZuegen) r.protokoll = sl.protokoll();
  return r;
}

// Serie: N Partien mit Seeds seed, seed+1, ...  (fortschritt(i, n) optional)
export function serie(cfg, opt, fortschritt = null) {
  const { partien = 100, seed = 1 } = opt;
  const erg = [];
  for (let k = 0; k < partien; k++) {
    erg.push(partieSimulieren(cfg, { ...opt, seed: (seed + k) >>> 0 }));
    if (fortschritt) fortschritt(k + 1, partien);
  }
  return erg;
}

const anteil = (n, m) => (m ? n / m : 0);
const mittel = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function auswerten(partien) {
  const n = partien.length;
  const z = (f) => partien.filter(f).length;
  const siege = partien.filter((p) => p.sieg);
  const fluchten = partien.filter((p) => p.fluchtweg);
  const proGrund = Object.fromEntries(ENDGRUENDE.map((g) => [g, anteil(z((p) => p.grund === g), n)]));
  const proWeg = Object.fromEntries(WEGE.map((w) => [w, anteil(z((p) => p.fluchtweg === w), n)]));
  const wegAnteil = Object.fromEntries(WEGE.map((w) => [w, anteil(fluchten.filter((p) => p.fluchtweg === w).length, fluchten.length)]));
  const gruppiert = (schluessel) => {
    const m = new Map();
    for (const p of partien) for (const k of [].concat(schluessel(p))) { const x = m.get(k) ?? { n: 0, siege: 0 }; x.n++; if (p.sieg) x.siege++; m.set(k, x); }
    return Object.fromEntries([...m].map(([k, v]) => [k, { partien: v.n, siegquote: anteil(v.siege, v.n) }]));
  };
  // Charakter: Sieg zählt, wenn die Figur (bzw. ihr Team/die Gruppe) gewonnen hat
  const charakter = {};
  for (const p of partien) p.charaktere.forEach((c, k) => {
    const x = (charakter[c] ??= { partien: 0, siege: 0 });
    x.partien++;
    if (p.siegerSitze.includes(k)) x.siege++;
  });
  for (const c of Object.values(charakter)) c.siegquote = anteil(c.siege, c.partien);
  const stufe = {};
  for (const p of partien) p.stufen.forEach((st, k) => {
    const x = (stufe[st] ??= { sitze: 0, siege: 0 });
    x.sitze++;
    if (p.siegerSitze.includes(k)) x.siege++;
  });
  for (const x of Object.values(stufe)) x.siegquote = anteil(x.siege, x.sitze);
  // Einfluss einzelner Karten: Siegquote mit / ohne Karte in der Partie
  const einfluss = (feld) => {
    const ids = new Set(partien.flatMap((p) => p[feld]));
    const e = {};
    for (const id of ids) {
      if (id === 'ruhig' || id === 'lava') continue;
      const mit = partien.filter((p) => p[feld].includes(id)), ohne = partien.filter((p) => !p[feld].includes(id));
      e[id] = { mit: mit.length, siegMit: anteil(mit.filter((p) => p.sieg).length, mit.length), siegOhne: anteil(ohne.filter((p) => p.sieg).length, ohne.length) };
      e[id].differenz = e[id].siegMit - e[id].siegOhne;
    }
    return e;
  };
  const knapp = (r) => mittel(partien.map((p) => p.vorratLeer[r] ?? 0));
  return {
    partien: n,
    siegquote: anteil(siege.length, n),
    proGrund, proWeg, wegAnteil,
    tageBisSieg: mittel(siege.map((p) => p.tag)),
    tageImSchnitt: mittel(partien.map((p) => p.tag)),
    niederlageLava: proGrund.lava, niederlageTod: anteil(z((p) => p.grund === 'alle_ko' || p.ausgeschieden > 0 && !p.sieg), n),
    proModus: gruppiert((p) => p.modus), proSpielerzahl: gruppiert((p) => `${p.spieler}`), charakter, stufe,
    knappheit: { holz: knapp('holz'), seil: knapp('seil'), fehltHolz: mittel(partien.map((p) => p.fehltAmEnde.holz ?? 0)), fehltSeil: mittel(partien.map((p) => p.fehltAmEnde.seil ?? 0)) },
    tageskarten: einfluss('tageskarten'), spezialkarten: einfluss('spezialkarten'),
    duelle: mittel(partien.map((p) => p.duelle)), raube: mittel(partien.map((p) => p.raube.rohstoff + p.raube.spezial + p.raube.route)),
    raubRoute: mittel(partien.map((p) => p.raube.route)),
    zurueckgesetzt: mittel(partien.map((p) => p.zurueckgesetzt)), wasserZugende: mittel(partien.map((p) => p.wasserZugende)),
    kompassGefunden: anteil(z((p) => p.kompassTag !== null), n), kompassTag: mittel(partien.filter((p) => p.kompassTag !== null).map((p) => p.kompassTag)),
    feuerGebaut: mittel(partien.map((p) => p.feuerGebaut)), feuerUngueltig: mittel(partien.map((p) => p.feuerUngueltig)),
    kaempfe: mittel(partien.map((p) => p.kaempfe)), abbrueche: z((p) => p.grund === 'abbruch'),
  };
}

// Hinweise wie in v10: auffällige Werte
export function hinweise(a) {
  const h = [];
  for (const w of WEGE) if ((a.wegAnteil[w] ?? 0) < 0.05 && a.siegquote > 0) h.push(`Fluchtweg «${({ floss: 'Floss', feuer: 'Küstenfeuer-Kette', wrack: 'Flugzeugwrack' })[w]}» wird praktisch nie gewählt (${(100 * a.wegAnteil[w]).toFixed(1)} % der Fluchten).`);
  if (a.siegquote < 0.1) h.push(`Siegquote nur ${(100 * a.siegquote).toFixed(1)} % – sehr schwer (oder die Bots spielen schwach).`);
  if (a.siegquote > 0.9) h.push(`Siegquote ${(100 * a.siegquote).toFixed(1)} % – sehr leicht.`);
  if (a.abbrueche) h.push(`${a.abbrueche} Partien wurden am Zuglimit abgebrochen.`);
  return h;
}

// ---- CSV ----
export function csvPartien(partien) {
  const kopf = ['seed', 'modus', 'spieler', 'stufen', 'charaktere', 'grund', 'sieg', 'fluchtweg', 'tag', 'siegerSitze', 'duelle', 'raubRohstoff', 'raubSpezial', 'raubRoute', 'zurueckgesetzt', 'wasserZugende', 'kaempfe', 'kompassTag', 'feuerGebaut', 'feuerUngueltig', 'notFlossVersuche', 'vorratLeerHolz', 'vorratLeerSeil', 'fehltHolz', 'fehltSeil', 'tageskarten', 'spezialkarten'];
  const z = (x) => `"${String(x ?? '').replaceAll('"', '""')}"`;
  return [kopf.join(';'), ...partien.map((p) => [p.seed, p.modus, p.spieler, p.stufen.join('|'), p.charaktere.join('|'), p.grund, p.sieg ? 1 : 0, p.fluchtweg ?? '', p.tag, p.siegerSitze.join('|'), p.duelle, p.raube.rohstoff, p.raube.spezial, p.raube.route, p.zurueckgesetzt, p.wasserZugende, p.kaempfe, p.kompassTag ?? '', p.feuerGebaut, p.feuerUngueltig, p.notFlossVersuche, p.vorratLeer.holz, p.vorratLeer.seil, p.fehltAmEnde.holz ?? '', p.fehltAmEnde.seil ?? '', p.tageskarten.join('|'), p.spezialkarten.join('|')].map(z).join(';'))].join('\n');
}

export function csvAuswertung(a) {
  const zeilen = [['Kennzahl', 'Wert']];
  const add = (k, v) => zeilen.push([k, typeof v === 'number' ? v.toFixed(4) : v ?? '']);
  add('Partien', a.partien); add('Siegquote', a.siegquote); add('Tage bis Sieg', a.tageBisSieg); add('Tage im Schnitt', a.tageImSchnitt);
  for (const [k, v] of Object.entries(a.proGrund)) add(`Endgrund ${k}`, v);
  for (const [k, v] of Object.entries(a.wegAnteil)) add(`Anteil Fluchtweg ${k}`, v);
  for (const [k, v] of Object.entries(a.proModus)) add(`Siegquote Modus ${k}`, v.siegquote);
  for (const [k, v] of Object.entries(a.proSpielerzahl)) add(`Siegquote ${k} Spieler`, v.siegquote);
  for (const [k, v] of Object.entries(a.charakter)) add(`Siegquote Charakter ${k}`, v.siegquote);
  for (const [k, v] of Object.entries(a.stufe)) add(`Siegquote Stufe ${k}`, v.siegquote);
  add('Knappheit Holz (leere Stapel)', a.knappheit.holz); add('Knappheit Seil (leere Stapel)', a.knappheit.seil);
  add('Duelle pro Partie', a.duelle); add('Raube pro Partie', a.raube); add('Zurücksetzungen pro Partie', a.zurueckgesetzt); add('Wasser-Zugenden pro Partie', a.wasserZugende);
  add('Kompass gefunden', a.kompassGefunden); add('Feuer gebaut pro Partie', a.feuerGebaut);
  for (const [k, v] of Object.entries(a.tageskarten)) add(`Tageskarte ${k}: Siegquote mit - ohne`, v.differenz);
  for (const [k, v] of Object.entries(a.spezialkarten)) add(`Spezialkarte ${k}: Siegquote mit - ohne`, v.differenz);
  return zeilen.map((z) => z.join(';')).join('\n');
}

// ---- Parameter-Sweep ----
export function werteListe(text) {
  if (Array.isArray(text)) return text;
  const s = String(text).trim();
  const m = /^(-?\d+(?:\.\d+)?)\s*(?::|bis|\.\.)\s*(-?\d+(?:\.\d+)?)(?:\s*(?::|schritt)\s*(\d+(?:\.\d+)?))?$/.exec(s);
  if (m) { const a = Number(m[1]), b = Number(m[2]), d = Number(m[3] ?? 1); const r = []; for (let x = a; x <= b + 1e-9; x += d) r.push(Math.round(x * 1000) / 1000); return r; }
  return s.split(',').map((x) => { const t = x.trim(); return t === 'true' ? true : t === 'false' ? false : Number.isNaN(Number(t)) ? t : Number(t); });
}

// pfad "match.spieler" steuert die Spielerzahl, alle anderen Pfade die Konfiguration.
function zelleKonfig(cfg, opt, pfad, wert) {
  if (pfad === 'match.spieler' || pfad === 'spieler') return { cfg, opt: { ...opt, spieler: wert } };
  if (pfad === 'match.modus' || pfad === 'modus') return { cfg, opt: { ...opt, modus: wert } };
  const c = klon(cfg);
  setzen(c, pfad, wert);
  return { cfg: c, opt };
}

export function sweep(cfg, opt, { pfadA, werteA, pfadB = null, werteB = [null] }, fortschritt = null) {
  const A = werteListe(werteA), B = pfadB ? werteListe(werteB) : [null];
  const zellen = [];
  let i = 0;
  for (const b of B) for (const a of A) {
    let x = zelleKonfig(cfg, opt, pfadA, a);
    if (pfadB) x = zelleKonfig(x.cfg, x.opt, pfadB, b);
    const v = validieren(x.cfg, { modus: x.opt.modus, spieler: x.opt.spieler });
    const zelle = { a, b, gueltig: v.ok, fehler: v.fehler };
    if (v.ok) zelle.auswertung = auswerten(serie(x.cfg, x.opt));
    zellen.push(zelle);
    if (fortschritt) fortschritt(++i, A.length * B.length);
  }
  return { pfadA, werteA: A, pfadB, werteB: B, zellen };
}

export function sweepCsv(sw, kennzahl = 'siegquote') {
  const wert = (z) => (z.gueltig ? lesen(z.auswertung, kennzahl) : 'ungültig');
  if (!sw.pfadB) return [`${sw.pfadA};${kennzahl};floss;feuer;wrack;lava`, ...sw.zellen.map((z) => [z.a, wert(z), z.auswertung?.proWeg.floss, z.auswertung?.proWeg.feuer, z.auswertung?.proWeg.wrack, z.auswertung?.proGrund.lava].join(';'))].join('\n');
  const kopf = [`${sw.pfadB} \\ ${sw.pfadA}`, ...sw.werteA].join(';');
  return [kopf, ...sw.werteB.map((b) => [b, ...sw.werteA.map((a) => { const z = sw.zellen.find((x) => x.a === a && x.b === b); return typeof wert(z) === 'number' ? wert(z).toFixed(3) : wert(z); })].join(';'))].join('\n');
}

// Text-Heatmap für die Konsole
export function heatmapText(sw, kennzahl = 'siegquote') {
  const stufen = ' ░▒▓█';
  const zeilen = [];
  for (const b of sw.werteB) {
    const teile = sw.werteA.map((a) => {
      const z = sw.zellen.find((x) => x.a === a && x.b === b);
      if (!z.gueltig) return '  ✕  ';
      const v = lesen(z.auswertung, kennzahl) ?? 0;
      return `${stufen[Math.min(4, Math.floor(v * 5))]}${(v * 100).toFixed(0).padStart(3)}%`;
    });
    zeilen.push(`${String(b ?? '').padStart(8)} | ${teile.join(' ')}`);
  }
  zeilen.push(`${''.padStart(8)}   ${sw.werteA.map((a) => String(a).padStart(5)).join(' ')}   (${sw.pfadA}${sw.pfadB ? ` × ${sw.pfadB}` : ''})`);
  return zeilen.join('\n');
}

// ---- A/B-Vergleich mit gleichen Seeds ----
function zTest(p1, n1, p2, n2) {
  const p = (p1 * n1 + p2 * n2) / Math.max(1, n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1 / Math.max(1, n1) + 1 / Math.max(1, n2)));
  return se === 0 ? 0 : (p1 - p2) / se;
}
function tTest(xs, ys) {
  const m = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
  const v = (a, mm) => a.reduce((s, x) => s + (x - mm) ** 2, 0) / Math.max(1, a.length - 1);
  const mx = m(xs), my = m(ys);
  const se = Math.sqrt(v(xs, mx) / Math.max(1, xs.length) + v(ys, my) / Math.max(1, ys.length));
  return se === 0 ? 0 : (mx - my) / se;
}
const signifikanz = (z) => (Math.abs(z) >= 2.58 ? 'sehr deutlich (p < 1 %)' : Math.abs(z) >= 1.96 ? 'deutlich (p < 5 %)' : Math.abs(z) >= 1.64 ? 'schwach (p < 10 %)' : 'nicht deutlich');

export function abVergleich(cfgA, cfgB, opt, fortschritt = null) {
  const a = serie(cfgA, opt, fortschritt ? (i, n) => fortschritt(i, 2 * n) : null);
  const b = serie(cfgB, opt, fortschritt ? (i, n) => fortschritt(n + i, 2 * n) : null);
  const A = auswerten(a), B = auswerten(b);
  const n = opt.partien ?? a.length;
  const quoten = [['Siegquote', A.siegquote, B.siegquote], ...WEGE.map((w) => [`Sieg per ${w}`, A.proWeg[w], B.proWeg[w]]), ['Lava', A.proGrund.lava, B.proGrund.lava], ['Kompass gefunden', A.kompassGefunden, B.kompassGefunden]];
  const mittelwerte = [['Tage im Schnitt', 'tag'], ['Duelle', 'duelle'], ['Zurücksetzungen', 'zurueckgesetzt'], ['Wasser-Zugenden', 'wasserZugende'], ['Kämpfe', 'kaempfe'], ['Feuer gebaut', 'feuerGebaut']];
  const zeilen = [
    ...quoten.map(([name, x, y]) => { const z = zTest(x, n, y, n); return { name, a: x, b: y, differenz: x - y, z, signifikanz: signifikanz(z), art: 'quote' }; }),
    ...mittelwerte.map(([name, k]) => { const xs = a.map((p) => p[k] ?? 0), ys = b.map((p) => p[k] ?? 0); const x = mittel(xs), y = mittel(ys); const z = tTest(xs, ys); return { name, a: x, b: y, differenz: x - y, z, signifikanz: signifikanz(z), art: 'mittel' }; }),
  ];
  return { partien: n, a: A, b: B, zeilen, unterschiede: unterschiede(cfgA, cfgB).filter((u) => !u.pfad.startsWith('meta')) };
}

// ---- Abgleich mit echten Partien ----
// Ein echtes Protokoll (Browser-Export) hat { format, seed, modus, sitze, konfig?, zuege?, ergebnis, zusammenfassung? }.
export function protokollKennzahlen(prot, cfg = null) {
  if (prot.zusammenfassung) return prot.zusammenfassung;
  const c = prot.konfig ?? cfg;
  if (!c || !prot.zuege) throw new Error('Protokoll ohne Konfiguration oder Zugliste');
  const { s } = nachspielen(c, prot);
  return zusammenfassungAus(s);
}

export function zusammenfassungAus(s) {
  const e = s.ende ?? { grund: 'offen', gewinner: [], tag: s.tag };
  return {
    modus: s.modus, spieler: s.spieler.length, sieg: e.gewinner.length > 0, grund: e.grund, fluchtweg: FLUCHTWEG_VON_GRUND[e.grund] ?? null, tag: e.tag,
    duelle: s.statistik.duelle, zurueckgesetzt: s.statistik.zurueckgesetzt, wasserZugende: s.statistik.wasserZugende,
    herzenVerlauf: s.statistik.verlauf.map((v) => v.herzen.reduce((a, b) => a + b, 0) / v.herzen.length),
    energieVerlauf: s.statistik.verlauf.map((v) => v.energie.reduce((a, b) => a + b, 0) / v.energie.length),
  };
}

export function abgleich(echte, botPartien) {
  const m = echte.length, n = botPartien.length;
  const quote = (xs, f) => anteil(xs.filter(f).length, xs.length);
  const durch = (xs, f) => mittel(xs.map(f).filter((x) => x !== null && x !== undefined));
  const verlaufMittel = (xs, k) => mittel(xs.map((p) => mittel(p[k] ?? [])).filter((x) => x !== null));
  const bot = botPartien.map((p) => ({ ...p, herzenVerlauf: p.verlauf.map((v) => mittel(v.herzen)), energieVerlauf: p.verlauf.map((v) => mittel(v.energie)) }));
  const zeilen = [
    ['Siegquote', quote(echte, (p) => p.sieg), quote(bot, (p) => p.sieg), 'quote'],
    ...WEGE.map((w) => [`Anteil Fluchtweg ${w}`, quote(echte, (p) => p.fluchtweg === w), quote(bot, (p) => p.fluchtweg === w), 'quote']),
    ['Tage', durch(echte, (p) => p.tag), durch(bot, (p) => p.tag), 'mittel'],
    ['Duelle', durch(echte, (p) => p.duelle), durch(bot, (p) => p.duelle), 'mittel'],
    ['Herzen im Schnitt', verlaufMittel(echte, 'herzenVerlauf'), verlaufMittel(bot, 'herzenVerlauf'), 'mittel'],
    ['Energie im Schnitt', verlaufMittel(echte, 'energieVerlauf'), verlaufMittel(bot, 'energieVerlauf'), 'mittel'],
  ].map(([name, mensch, bots, art]) => {
    const diff = (bots ?? 0) - (mensch ?? 0);
    const auffaellig = art === 'quote' ? Math.abs(diff) >= 0.15 : Math.abs(diff) >= Math.max(1, 0.25 * Math.abs(mensch ?? 0));
    return { name, mensch, bots, differenz: diff, auffaellig, art };
  });
  const befunde = zeilen.filter((z) => z.auffaellig).map((z) => `${z.name}: Bots ${fmt(z.bots, z.art)}, Menschen ${fmt(z.mensch, z.art)} – deutlich anders.`);
  const wegeBots = WEGE.map((w) => quote(bot, (p) => p.fluchtweg === w));
  if (Math.max(...wegeBots) > 0.8 * Math.max(0.001, quote(bot, (p) => p.sieg))) befunde.push('Bots wählen fast immer denselben Fluchtweg.');
  return { echte: m, bots: n, zeilen, befunde, hinweis: 'Bot-gegen-Bot-Ergebnisse messen die Balance der Regeln nur, soweit die Bots menschlich spielen. Echte Playtests bleiben der Massstab.' };
}
const fmt = (x, art) => (x === null || x === undefined ? '–' : art === 'quote' ? `${(100 * x).toFixed(0)} %` : x.toFixed(1));

export { ableiten };
