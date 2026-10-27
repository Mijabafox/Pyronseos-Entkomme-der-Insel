// Hex-Geometrie (axiale Koordinaten, flat-top), wie in v10.

export const RICHTUNGEN = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
];
export const MITTE = { q: 0, r: 0 };
export const KOMPASS = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];

export const schluessel = (c) => `${c.q},${c.r}`;
export function koord(k) { const [q, r] = k.split(',').map(Number); return { q, r }; }
export const plus = (a, b) => ({ q: a.q + b.q, r: a.r + b.r });
export const nachbarn = (c) => RICHTUNGEN.map((d) => plus(c, d));

export function abstand(a, b) {
  const dq = a.q - b.q, dr = a.r - b.r;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
}

export function ring(n) {
  if (n === 0) return [MITTE];
  const erg = [];
  let c = { q: RICHTUNGEN[4].q * n, r: RICHTUNGEN[4].r * n };
  for (const d of RICHTUNGEN) for (let i = 0; i < n; i++) { erg.push(c); c = plus(c, d); }
  return erg;
}

export function scheibe(n) {
  const erg = [];
  for (let i = 0; i <= n; i++) erg.push(...ring(i));
  return erg;
}

export function pixel(c, groesse) {
  return { x: groesse * 1.5 * c.q, y: groesse * Math.sqrt(3) * (c.r + c.q / 2) };
}

// Winkel im Uhrzeigersinn ab Norden (Grad).
export function winkel(c) {
  const { x, y } = pixel(c, 1);
  const w = (Math.atan2(x, -y) * 180) / Math.PI;
  return (Math.round(w * 1000) / 1000 + 360) % 360;
}

export function himmelsrichtung(grad) {
  return KOMPASS[Math.floor(((grad + 22.5) % 360) / 45)];
}
