// Konfiguration: Laden, Zusammenführen, Pfadzugriff. Alle Spielwerte stehen in config.json.

export const ROHSTOFFE = ['holz', 'stein', 'blaetter', 'seil', 'abfall', 'nahrung'];

export const klon = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const istObjekt = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

// Tiefes Zusammenführen: Werte aus `ueber` ersetzen die aus `basis`. Arrays werden ersetzt.
export function zusammenfuehren(basis, ueber) {
  if (!istObjekt(ueber)) return klon(ueber === undefined ? basis : ueber);
  const erg = istObjekt(basis) ? klon(basis) : {};
  for (const [k, v] of Object.entries(ueber)) erg[k] = istObjekt(v) && istObjekt(erg[k]) ? zusammenfuehren(erg[k], v) : klon(v);
  return erg;
}

export function lesen(obj, pfad) {
  return pfad.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function setzen(obj, pfad, wert) {
  const teile = pfad.split('.');
  let o = obj;
  for (let i = 0; i < teile.length - 1; i++) {
    if (o[teile[i]] == null || typeof o[teile[i]] !== 'object') o[teile[i]] = {};
    o = o[teile[i]];
  }
  o[teile[teile.length - 1]] = wert;
  return obj;
}

// Unterschiede zwischen zwei Konfigurationen (für A/B-Bericht).
export function unterschiede(a, b, pfad = '', erg = []) {
  if (istObjekt(a) && istObjekt(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) unterschiede(a[k], b[k], pfad ? `${pfad}.${k}` : k, erg);
  } else if (JSON.stringify(a) !== JSON.stringify(b)) erg.push({ pfad, a, b });
  return erg;
}

let standardCache = null;

// Lädt die Standard-Konfiguration (Node: Dateisystem, Browser: fetch).
export async function standardLaden() {
  if (standardCache) return klon(standardCache);
  const url = new URL('../config/config.json', import.meta.url);
  if (typeof process !== 'undefined' && process.versions?.node && url.protocol === 'file:') {
    const fs = await import('node:fs');
    standardCache = JSON.parse(fs.readFileSync(url, 'utf8'));
  } else {
    standardCache = await (await fetch(url)).json();
  }
  return klon(standardCache);
}

// Lädt eine Konfigurationsdatei (Teil- oder Vollkonfiguration) und führt sie mit dem Standard zusammen.
export async function konfigAus(teil) {
  return zusammenfuehren(await standardLaden(), teil ?? {});
}

export function summe(obj) { return Object.values(obj ?? {}).reduce((s, v) => s + (v ?? 0), 0); }
export function mal(kosten, n) { const e = {}; for (const [k, v] of Object.entries(kosten)) e[k] = v * n; return e; }
export function rohstoffText(r, trenner = ' + ') {
  const namen = { holz: 'Holz', stein: 'Stein', blaetter: 'Blätter', seil: 'Seil', abfall: 'Abfall', nahrung: 'Nahrung' };
  return Object.entries(r ?? {}).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${namen[k] ?? k}`).join(trenner) || 'nichts';
}
