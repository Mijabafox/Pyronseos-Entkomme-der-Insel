// Gedächtnis eines Bots: merkt sich, was er gesehen hat, und vergisst mit der Zeit Details.
// Das Brett liegt offen auf dem Tisch und wird nicht vergessen. Vergessen werden Dinge,
// die man nur einmal sieht: wer welche Karte gespielt hat, wer was erbeutet hat, wie das Plättchen ursprünglich war.
import { ROHSTOFFE } from '../engine/config.js';

export class Gedaechtnis {
  constructor(rng, vergesslichkeit = 0.05, nachTagen = 3) {
    this.rng = rng;
    this.vergesslichkeit = vergesslichkeit;
    this.nachTagen = nachTagen;
    this.gesehen = new Map(); // Feld -> ursprünglicher Inhalt
    this.gesehenProBiom = {};
    this.karten = []; // { tag, spieler, karte, art }
    this.ereignisNr = 0;
    this.letzterTag = 0;
    this.routeRichtung = new Map(); // spielerIndex -> Richtung (wenn je gesehen)
  }

  beobachten(sv) {
    for (const f of Object.values(sv.felder)) {
      if (!f.aufgedeckt || this.gesehen.has(f.key)) continue;
      const inhalt = f.tier ? 'tier' : f.inhalt;
      this.gesehen.set(f.key, inhalt);
      const b = (this.gesehenProBiom[f.biom] ??= {});
      b[inhalt] = (b[inhalt] ?? 0) + 1;
    }
    for (const e of sv.ereignisse) {
      if (e.nr <= this.ereignisNr) continue;
      this.ereignisNr = e.nr;
      if (e.karte && (e.art === 'gespielt' || e.art === 'gezogen')) this.karten.push({ tag: sv.tag, spieler: e.spieler, karte: e.karte, art: e.art });
    }
    for (const p of sv.spieler) if (p.route && p.route !== 'verdeckt') this.routeRichtung.set(p.index, p.route);
    if (sv.tag !== this.letzterTag) { this.letzterTag = sv.tag; this.vergessen(sv.tag); }
  }

  vergessen(tag) {
    if (this.vergesslichkeit <= 0) return;
    this.karten = this.karten.filter((k) => tag - k.tag < this.nachTagen || this.rng.wert() >= this.vergesslichkeit);
    for (const [i] of this.routeRichtung) if (this.rng.wert() < this.vergesslichkeit / 2) this.routeRichtung.delete(i);
  }

  // Welche Spezialkarten hat ein Mitspieler wahrscheinlich (gezogen gesehen, noch nicht gespielt)?
  vermuteteKarten(spieler) {
    const z = new Map();
    for (const k of this.karten) if (k.spieler === spieler) z.set(k.karte, (z.get(k.karte) ?? 0) + (k.art === 'gezogen' ? 1 : -1));
    return [...z.entries()].filter(([, n]) => n > 0).map(([k]) => k);
  }

  // Schätzung: Anteil Gefahren unter den restlichen Spezialkarten.
  gefahrAnteil(sv) {
    const karten = sv.cfg.spezialkarten.karten;
    const rest = {};
    for (const [id, k] of Object.entries(karten)) if (k.aktiv) rest[id] = k.anzahl ?? 0;
    for (const id of sv.spezialAblage) if (rest[id]) rest[id]--;
    for (const p of sv.spieler) for (const id of p.karten ?? []) if (rest[id]) rest[id]--;
    let g = 0, n = 0;
    for (const [id, a] of Object.entries(rest)) { n += a; if (karten[id].art === 'gefahr') g += a; }
    return n ? g / n : 0.4;
  }
}

export function leererBedarf() { return Object.fromEntries(ROHSTOFFE.map((r) => [r, 0])); }
