// Seedbarer Zufall. Jede Quelle (Brett, Tageskarten, Spezialkarten, Tierbeutel,
// Würfel, Bots ...) hat einen eigenen Zustand, damit Vergleiche fair bleiben.

export const QUELLEN = ['brett', 'start', 'tag', 'spezial', 'tier', 'route', 'wuerfel', 'beute', 'bot'];

// Ein Schritt des Generators (splitmix-artig, 32 Bit). Gibt Wert in [0,1) und neuen Zustand.
export function schritt(zustand) {
  const t = (zustand + 0x6d2b79f5) | 0;
  let n = t;
  n = Math.imul(n ^ (n >>> 15), n | 1);
  n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
  return { wert: ((n ^ (n >>> 14)) >>> 0) / 4294967296, zustand: t };
}

// Leitet aus dem Partie-Seed und einem Namen einen Startzustand ab.
export function ableiten(seed, name) {
  let h = Math.imul((seed >>> 0) ^ 0x9e3779b9, 2654435761) >>> 0;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619) >>> 0;
  return h | 0;
}

export function neueQuellen(seed) {
  const q = {};
  for (const n of QUELLEN) q[n] = ableiten(seed, n);
  return q;
}

// Zufallszahl aus einer Quelle im Spielzustand ziehen (mutiert state.rng[quelle]).
export function zufall(state, quelle) {
  const r = schritt(state.rng[quelle]);
  state.rng[quelle] = r.zustand;
  return r.wert;
}

export function ganz(state, quelle, min, max) {
  return min + Math.floor(zufall(state, quelle) * (max - min + 1));
}

export function mischen(state, quelle, liste) {
  const a = [...liste];
  for (let i = a.length - 1; i > 0; i--) {
    const j = ganz(state, quelle, 0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function wahl(state, quelle, liste) {
  return liste[ganz(state, quelle, 0, liste.length - 1)];
}

// Eigenständiger Generator (für Bots und Werkzeuge ausserhalb des Spielzustands).
export class Zufall {
  constructor(zustand) { this.zustand = zustand | 0; }
  wert() { const r = schritt(this.zustand); this.zustand = r.zustand; return r.wert; }
  int(min, max) { return min + Math.floor(this.wert() * (max - min + 1)); }
  wahl(liste) { return liste[this.int(0, liste.length - 1)]; }
  mischen(liste) {
    const a = [...liste];
    for (let i = a.length - 1; i > 0; i--) { const j = this.int(0, i); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
}
