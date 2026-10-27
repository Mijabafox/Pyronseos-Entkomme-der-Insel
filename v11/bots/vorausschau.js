// Stufe «gut»: Entscheiden unter Unsicherheit durch Stichproben.
// Der Bot zieht mehrfach plausible Belegungen der unbekannten Informationen (nur aus Erlaubtem
// abgeleitet: Konfiguration, offene Ablagen, eigenes Gedächtnis), spielt jede Option bis zum
// Zugende kurz durch und wählt die beste. Das Budget ist eine feste Zahl Stichproben (reproduzierbar);
// im Browser begrenzt zusätzlich das Zeitbudget pro Zug.
import { Zufall, neueQuellen } from '../engine/rng.js';
import { klon, ROHSTOFFE } from '../engine/config.js';
import { ausfuehren, erlaubteAktionen, istErlaubt, ketteInfo, leereStatistik, klonen } from '../engine/engine.js';
import { sicht, VERDECKT } from '../engine/sicht.js';
import { gruppe, teamVon } from '../engine/kern.js';
import { abstand } from '../engine/hex.js';
import { kasse, fehlend, gewichtet, wegKosten } from './wissen.js';

const RICHTUNGEN = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];

export function determinisieren(sv, bot, rng) {
  const cfg = sv.cfg;
  const { cfg: _c, ...rest } = sv;
  const s = klon(rest);
  s.cfg = cfg;
  // Verdeckte Plättchen aus dem restlichen Pool je Biom
  for (const biom of Object.keys(cfg.brett.plaettchen)) {
    const pool = [];
    const gesehen = bot.mem.gesehenProBiom[biom] ?? {};
    for (const [inhalt, n] of Object.entries(cfg.brett.plaettchen[biom])) for (let k = 0; k < Math.max(0, n - (gesehen[inhalt] ?? 0)); k++) pool.push(inhalt);
    const verdeckt = Object.values(s.felder).filter((f) => f.biom === biom && !f.aufgedeckt);
    const gemischt = rng.mischen(pool);
    verdeckt.forEach((f, k) => { f.inhalt = gemischt[k] ?? 'leer'; f.tier = null; f.kompass = f.inhalt === 'vulkanfels'; });
  }
  // Tierbeutel
  const tiere = [];
  for (const gr of ['klein', 'gross']) for (const [t, n] of Object.entries(cfg.tiere[gr])) for (let k = 0; k < n; k++) tiere.push(t);
  for (const t of [...sv.tierAblage, ...Object.values(sv.felder).map((f) => f.tier).filter(Boolean)]) { const i = tiere.indexOf(t); if (i >= 0) tiere.splice(i, 1); }
  s.tierBeutel = rng.mischen(tiere).slice(0, sv.anzahl.tierBeutel);
  // Spezialkarten (Stapel und verdeckte Hände)
  const karten = [];
  for (const [id, k] of Object.entries(cfg.spezialkarten.karten)) if (k.aktiv) for (let n = 0; n < (k.anzahl ?? 0); n++) karten.push(id);
  const weg = (id) => { const i = karten.indexOf(id); if (i >= 0) karten.splice(i, 1); };
  sv.spezialAblage.forEach(weg);
  for (const p of sv.spieler) (p.karten ?? []).forEach(weg);
  let pool = rng.mischen(karten);
  for (const p of s.spieler) {
    if (p.karten === null) { const n = sv.spieler[p.index].anzahlKarten; p.karten = pool.slice(0, n); pool = pool.slice(n); }
    if (p.hand === null) {
      p.hand = Object.fromEntries(ROHSTOFFE.map((r) => [r, 0]));
      for (let n = 0; n < sv.spieler[p.index].anzahlRohstoffe; n++) p.hand[rng.wahl(ROHSTOFFE)]++;
    }
    if (p.route === VERDECKT) p.route = bot.mem.routeRichtung.get(p.index) ?? rng.wahl(RICHTUNGEN);
    if (p.charakter === null) p.charakter = 'jaeger';
  }
  s.spezialStapel = pool.slice(0, sv.anzahl.spezialStapel);
  s.routenStapel = Array.from({ length: sv.anzahl.routenStapel }, () => rng.wahl(RICHTUNGEN));
  s.routenAblage = Array.from({ length: sv.anzahl.routenAblage }, () => rng.wahl(RICHTUNGEN));
  // Tageskarten: unbekannte Reihenfolge
  const tage = [];
  for (const [id, k] of Object.entries(cfg.tageskarten.karten)) if (k.aktiv && !sv.tagesAblage.includes(id) && sv.tagesKarte !== id) tage.push(id);
  const gesehenRuhig = [...sv.tagesAblage, sv.tagesKarte].filter((k) => k === 'ruhig').length;
  const n = Math.max(0, sv.anzahl.tagesStapel - (cfg.match.tage.lava ? 1 : 0));
  const ruhigRest = Math.max(0, cfg.match.tage.ruhig - gesehenRuhig);
  const mix = rng.mischen([...Array(ruhigRest).fill('ruhig'), ...rng.mischen(tage)]).slice(0, n);
  s.tagesStapel = cfg.match.tage.lava ? ['lava', ...mix] : mix;
  s.rng = neueQuellen(rng.int(1, 2 ** 31 - 1));
  s.protokoll = false; s.log = []; s.statistik = leereStatistik(); s.zuege = 0; s.ereignisse = [];
  s.seed = 0;
  return s;
}

export function wert(s, ich, siegweg, fokus = null) {
  const p = s.spieler[ich];
  if (s.ende) return s.ende.gewinner.includes(p.id) ? 1000 : -400;
  const fortschritt = fokus ? -0.6 * abstand(s.felder[p.feld].coord, fokus) : 0;
  const g = gruppe(s, ich);
  let v = 0;
  if (siegweg) {
    const kosten = wegKosten(s, siegweg) ?? {};
    v -= gewichtet(fehlend(s, kosten, kasse(s, g))) * 1.2;
    if (siegweg === 'floss' && g.some((k) => s.spieler[k].route)) v += 8;
    if (siegweg === 'feuer') v += ketteInfo(s, g).kette.length * 6;
  }
  for (const k of g) { const q = s.spieler[k]; v += q.liegt || q.ausgeschieden ? -12 : q.herzen * (q.herzen <= 2 ? 2.5 : 1.2); }
  v += p.energie * 0.35;
  v += Object.values(s.felder).filter((f) => f.aufgedeckt).length * 0.04;
  for (const a of ['axt', 'hacke']) if (p.ausruestung[a]) v += 1.5;
  if (p.ausruestung.waffe) v += 1.5;
  return v + fortschritt;
}

function kandidaten(bot, sv, aktionen, standard) {
  const erg = [standard];
  const dazu = (a) => { if (a && !erg.some((x) => JSON.stringify(x) === JSON.stringify(a))) erg.push(a); };
  for (const typ of ['abbauen', 'trinken', 'essen', 'zugBeenden']) dazu(aktionen.find((a) => a.typ === typ));
  for (const a of aktionen.filter((x) => x.typ === 'craften').slice(0, 2)) dazu(a);
  const moves = aktionen.filter((a) => a.typ === 'bewegen');
  for (const a of moves.slice(0, 2)) dazu(a);
  return erg.slice(0, 4);
}

export function vorausschau(bot, sv, aktionen, standard) {
  if (standard.typ === 'handeln' || standard.typ === 'flossBauen' || standard.typ === 'wrackReparieren') return standard;
  const kand = kandidaten(bot, sv, aktionen, standard);
  if (kand.length <= 1) return standard;
  bot.innerer ??= new bot.constructor({ index: bot.index, stufe: 'normal', persoenlichkeit: { ...bot.p, fehlerquote: 0, aufmerksamkeit: 0 }, seed: bot.rng.int(1, 1e9), cfg: sv.cfg });
  const inner = bot.innerer;
  const start = bot.echtzeit ? Date.now() : 0;
  const rng = new Zufall(bot.rng.int(1, 2 ** 31 - 1));
  const ergebnis = kand.map(() => ({ summe: 0, n: 0 }));
  for (let k = 0; k < bot.stichproben; k++) {
    const welt = determinisieren(sv, bot, new Zufall(rng.int(1, 2 ** 31 - 1)));
    kand.forEach((a, i) => {
      if (bot.echtzeit && Date.now() - start > bot.zeitbudget && k > 0) return;
      const s = k === bot.stichproben - 1 && i === kand.length - 1 ? welt : klonWelt(welt);
      if (!istErlaubt(s, a)) return;
      try {
        ausfuehren(s, a);
        inner.siegweg = bot.siegweg;
        inner.mem = bot.mem;
        let schritte = 0;
        while (!s.ende && s.aktiv === sv.ich && schritte++ < 14) {
          const ak = erlaubteAktionen(s);
          if (!ak.length) break;
          // In der vorgestellten Welt ist alles «bekannt» (nur Stichprobe): direkt entscheiden, ohne Snapshot-Kopie.
          weltAlsSicht(s);
          inner.cache = new Map(); inner.cacheFuer = s;
          let b = inner.entscheidenOhneFehler(s, ak);
          if (b.typ === 'handeln' || !ak.some((x) => JSON.stringify(x) === JSON.stringify(b))) b = ak.find((x) => x.typ === 'zugBeenden') ?? ak[0];
          ausfuehren(s, b);
        }
        ergebnis[i].summe += wert(s, sv.ich, bot.siegweg, bot.ziel?.fokus ?? null);
        ergebnis[i].n += 1;
      } catch { /* unplausible Stichprobe: ignorieren */ }
    });
  }
  let best = 0, bw = -Infinity;
  // Vom Normalzug nur abweichen, wenn die Alternative klar besser ist.
  ergebnis.forEach((e, i) => { if (!e.n) return; const m = e.summe / e.n + (i === 0 ? 1.5 : 0); if (m > bw) { bw = m; best = i; } });
  return kand[best];
}

function weltAlsSicht(s) {
  s.ich = s.aktiv;
  s.anzahl = { tierBeutel: s.tierBeutel.length, spezialStapel: s.spezialStapel.length, routenStapel: s.routenStapel.length, tagesStapel: s.tagesStapel.length, routenAblage: s.routenAblage.length };
  s.spieler.forEach((p, i) => { p.anzahlRohstoffe = Object.values(p.hand).reduce((a, n) => a + n, 0); p.anzahlKarten = p.karten.length; p.team = teamVon(s, i); });
}

function klonWelt(w) { return klonen(w); }
