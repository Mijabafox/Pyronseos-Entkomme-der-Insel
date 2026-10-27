// Wissen eines Bots: Wege, Schätzungen und Bedarf – alles nur aus dem Beobachtungs-Snapshot.
import { nachbarn, schluessel, abstand, MITTE } from '../engine/hex.js';
import { ROHSTOFFE } from '../engine/config.js';
import { gruppe, istGross, waffenBonus, herzenMax } from '../engine/kern.js';
import { tagesMods } from '../engine/effekte.js';
import { QUELLEN, STRANDRING } from '../engine/brett.js';
import { feuerZeile, feuerPersonen, feuerDerGruppe, flossKosten, wrackKosten, routenBesitzer, rezeptKosten, kampfBonus, tierZiel, siegChance } from '../engine/engine.js';
import { wunschkette, ketteFertig } from '../engine/feuer.js';

export const ich = (sv) => sv.spieler[sv.ich];
export const feldVon = (sv, i) => sv.felder[sv.spieler[i].feld];
export const istWasser = (f) => f.aufgedeckt && QUELLEN.includes(f.inhalt);
export const tageRest = (sv) => sv.anzahl.tagesStapel; // inkl. Lava
export const fliehendeAnzahl = (sv) => (sv.modus === 'koop' ? sv.spieler.length : sv.modus === 'team' ? sv.cfg.match.teamGroesse : 1);

// Dijkstra mit Binär-Heap: Kosten = Energie pro Schritt + Aufschläge (verdeckt, Tier, Gegner in der Nähe).
// opt: { ziel(f) -> bool, tierErlaubt(f), aufschlagVerdeckt, meiden: Set(keys), gegnerNaehe: [{coord, radius}] }
class Heap {
  constructor() { this.a = []; }
  push(k, p) { const a = this.a; a.push([p, k]); let i = a.length - 1; while (i > 0) { const j = (i - 1) >> 1; if (a[j][0] <= a[i][0]) break; [a[i], a[j]] = [a[j], a[i]]; i = j; } }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m; } }
    return top;
  }
  get leer() { return this.a.length === 0; }
}

const NACHBARN = new Map();
function nachbarnVon(sv, k) {
  let n = NACHBARN.get(k);
  if (!n) { n = nachbarn(sv.felder[k].coord).map(schluessel).filter((x) => sv.felder[x]); NACHBARN.set(k, n); }
  return n;
}

export function schrittEnergie(sv, f) {
  const mods = tagesMods(sv);
  let k = sv.cfg.zug.schrittEnergie;
  for (const x of mods.schrittMin) if (!x.biom || x.biom.includes(f.biom)) k = Math.max(k, x.wert);
  return k + mods.schrittPlus;
}

// Volle Distanzkarte ab start (ohne Ziel). Felder mit Tier werden nicht durchquert (nur als Endpunkt erreichbar).
export function distanzen(sv, start, opt = {}) {
  const kosten = new Map([[start, 0]]), vor = new Map(), energie = new Map([[start, 0]]), fertig = new Set();
  const h = new Heap();
  h.push(start, 0);
  while (!h.leer) {
    const [c, k] = h.pop();
    if (fertig.has(k)) continue;
    fertig.add(k);
    if (k !== start && sv.felder[k].tier) continue; // Tierfeld: Endpunkt, nicht weiter
    for (const n of nachbarnVon(sv, k)) {
      if (fertig.has(n)) continue;
      const f = sv.felder[n];
      if (opt.meiden?.has(n)) continue;
      const e = schrittEnergie(sv, f);
      let x = c + e;
      if (!f.aufgedeckt) x += opt.aufschlagVerdeckt ?? 0.6;
      if (f.tier) x += 0.5;
      if (opt.gegnerNaehe) for (const g of opt.gegnerNaehe) if (abstand(g.coord, f.coord) <= g.radius) x += 1.5;
      if (opt.zufallsKosten) x += opt.zufallsKosten(n);
      if (x < (kosten.get(n) ?? Infinity)) { kosten.set(n, x); vor.set(n, k); energie.set(n, energie.get(k) + e); h.push(n, x); }
    }
  }
  return { start, kosten, vor, energie };
}

export function pfadAus(d, ziel) {
  if (!d.kosten.has(ziel) || ziel === d.start) return [];
  const p = [ziel];
  let c = d.vor.get(ziel);
  while (c !== d.start) { p.unshift(c); c = d.vor.get(c); }
  return p;
}

// Nächstes Feld, das `ziel` erfüllt (Tierfelder nur, wenn tierErlaubt).
export function weg(sv, start, opt) {
  const d = opt.dist ?? distanzen(sv, start, opt);
  let best = null, bk = Infinity;
  for (const [k, c] of d.kosten) {
    if (k === start || c >= bk) continue;
    const f = sv.felder[k];
    if (!opt.ziel(f)) continue;
    if (f.tier && !(opt.tierErlaubt?.(f) ?? false)) continue;
    // Pfad darf kein anderes Tierfeld enthalten (Tierfelder werden nur als Endpunkt erreicht – siehe distanzen)
    best = k; bk = c;
  }
  if (best === null) return null;
  const pfad = pfadAus(d, best);
  return { ziel: best, pfad, kosten: bk, energie: d.energie.get(best) };
}

// Wahrscheinlichkeit, dass ein verdecktes Feld eines Bioms einen bestimmten Inhalt hat (aus Konfiguration und Gesehenem).
export function inhaltsChance(sv, gedaechtnis, biom, inhalt) {
  const pool = sv.cfg.brett.plaettchen[biom] ?? {};
  const gesamt = Object.values(pool).reduce((a, n) => a + n, 0);
  if (!gesamt) return 0;
  const gesehen = gedaechtnis?.gesehenProBiom?.[biom] ?? {};
  const gesehenGesamt = Object.values(gesehen).reduce((a, n) => a + n, 0);
  const rest = Math.max(0, (pool[inhalt] ?? 0) - (gesehen[inhalt] ?? 0));
  return Math.max(0, rest / Math.max(1, gesamt - gesehenGesamt));
}

// Kasse der Gruppe (nur sichtbare Hände).
export function kasse(sv, mitglieder = gruppe(sv, sv.ich)) {
  const k = Object.fromEntries(ROHSTOFFE.map((r) => [r, 0]));
  for (const i of mitglieder) { const h = sv.spieler[i].hand; if (h) for (const r of ROHSTOFFE) k[r] += h[r]; }
  return k;
}

// Fehlende Rohstoffe für Kosten, Seil darf aus überschüssigen Blättern gemacht werden.
export function fehlend(sv, kosten, vorhanden) {
  const f = {};
  const seilRezept = sv.cfg.crafting.rezepte.seil;
  const blattProSeil = seilRezept?.aktiv ? seilRezept.kosten.blaetter ?? 2 : Infinity;
  for (const [r, n] of Object.entries(kosten)) {
    let da = vorhanden[r] ?? 0;
    if (r === 'seil' && blattProSeil !== Infinity) da += Math.floor(Math.max(0, (vorhanden.blaetter ?? 0) - (kosten.blaetter ?? 0)) / blattProSeil);
    if (n > da) f[r] = n - da;
  }
  return f;
}
export const summe = (o) => Object.values(o).reduce((a, n) => a + n, 0);

export const GEWICHT = { holz: 1, stein: 1.4, blaetter: 0.8, seil: 2, abfall: 1.2, nahrung: 2.5 };
export const gewichtet = (o) => Object.entries(o).reduce((a, [r, n]) => a + n * (GEWICHT[r] ?? 1), 0);

// Gemeinsame Feuerkette: Wunschpositionen (alle Bots der Gruppe rechnen gleich).
const MUSTER = new Map();
function muster(feuer, abst) {
  const k = `${feuer}:${abst}`;
  if (!MUSTER.has(k)) {
    const m = [];
    for (let start = 1; start <= STRANDRING; start++) { const pos = wunschkette(start, feuer, STRANDRING); if (ketteFertig(pos, feuer, abst, STRANDRING)) m.push(pos); }
    MUSTER.set(k, m);
  }
  return MUSTER.get(k);
}
const STRAND_CACHE = new WeakMap();
export function strandKarte(sv) {
  let m = STRAND_CACHE.get(sv.felder);
  if (!m) { m = new Map(Object.values(sv.felder).filter((f) => f.kuestenNr !== null).map((f) => [f.kuestenNr, f])); STRAND_CACHE.set(sv.felder, m); }
  return m;
}
export function feuerPlan(sv, mitglieder = gruppe(sv, sv.ich)) {
  const z = feuerZeile(sv, feuerPersonen(sv, mitglieder));
  if (!z) return null;
  const eigene = feuerDerGruppe(sv, mitglieder);
  const ids = new Set(mitglieder.map((i) => sv.spieler[i].id));
  const strand = strandKarte(sv);
  const baubar = (f) => f && (f.bau === null || (f.bau.art === 'lagerfeuer' && (sv.modus === 'koop' || ids.has(f.bau.besitzer))));
  const orte = mitglieder.filter((i) => !sv.spieler[i].ausgeschieden).map((i) => sv.felder[sv.spieler[i].feld].coord);
  let beste = null, bestWert = -Infinity, k = 0;
  for (const pos of muster(z.feuer, z.abstand)) {
    let w = -(k++) * 0.001;
    for (const n of pos) {
      const f = strand.get(n);
      if (eigene.has(n)) w += 100;
      if (!baubar(f)) w -= 1000;
      else if (f.tier) w -= 5;
      else if (!f.aufgedeckt) w -= 0.2;
      for (const c of orte) w -= abstand(c, f.coord) * 0.05;
    }
    if (w > bestWert) { bestWert = w; beste = pos; }
  }
  if (!beste) return null;
  return { ...z, positionen: beste, fehlen: beste.filter((n) => !eigene.has(n)), gebaut: beste.filter((n) => eigene.has(n)) };
}

// Kosten des gewählten Siegwegs für die ganze Gruppe.
export function wegKosten(sv, weg, art = 'solide') {
  if (weg === 'floss') return flossKosten(sv, art);
  if (weg === 'wrack') return wrackKosten(sv);
  if (weg === 'feuer') {
    const p = feuerPlan(sv);
    if (!p) return null;
    const n = p.fehlen.length;
    return Object.fromEntries(Object.entries(sv.cfg.crafting.rezepte.lagerfeuer.kosten).map(([r, k]) => [r, k * n]));
  }
  return {};
}

export function kampfAussicht(sv, i, tier) {
  const p = sv.spieler[i];
  return siegChance(tierZiel(sv, tier), kampfBonus(sv, p));
}

export function gegnerVon(sv, i = sv.ich) {
  const g = gruppe(sv, i);
  return sv.spieler.filter((p, k) => !g.includes(k) && !p.ausgeschieden && !p.liegt).map((p) => p.index);
}

export { gruppe, istGross, waffenBonus, herzenMax, routenBesitzer, rezeptKosten, MITTE, abstand };
