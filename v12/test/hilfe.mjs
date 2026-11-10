// Gemeinsame Test-Hilfen.
import { standardLaden, zusammenfuehren } from '../engine/config.js';
import { neuePartie, erlaubteAktionen, ausfuehren } from '../engine/engine.js';
import { Zufall } from '../engine/rng.js';

export async function cfgMit(teil = {}) { return zusammenfuehren(await standardLaden(), teil); }

export function sitze(n) { return Array.from({ length: n }, (_, k) => ({ name: `KI ${k + 1}`, ki: true })); }

export function partie(cfg, { seed = 1, modus = 'koop', n = 3, protokoll = true } = {}) {
  return neuePartie(cfg, { seed, modus, sitze: sitze(modus === 'team' ? 4 : n), protokoll });
}

// Spielt eine Partie mit zufälligen gültigen Zügen zu Ende (deterministisch über den Seed).
export function zufallsPartie(s, seed = 7, max = 30000) {
  const z = new Zufall(seed);
  let k = 0;
  const zuege = [];
  while (!s.ende && k++ < max) {
    const a = erlaubteAktionen(s);
    let x = a[z.int(0, a.length - 1)];
    if (s.zug.phase === 'bewegung' && z.wert() < 0.6) { const b = a.filter((y) => y.typ === 'bewegen'); if (b.length) x = b[z.int(0, b.length - 1)]; }
    zuege.push(x);
    ausfuehren(s, x);
  }
  return zuege;
}

// Setzt den aktiven Zug auf eine bestimmte Phase/Lage (für gezielte Regeltests).
export function stelle(s, i, feldKey) { s.spieler[i].feld = feldKey; }
export function feldMit(s, pred) { return Object.values(s.felder).find(pred); }
