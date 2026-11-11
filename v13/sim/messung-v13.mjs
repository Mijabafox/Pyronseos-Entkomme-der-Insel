// Messung für den CHANGELOG V13: Erreichbarkeit der drei Fluchtwege (je allein) und Test-Schalter im A/B-Vergleich.
// Aufruf: node sim/messung-v13.mjs [partien]
import { standardLaden, zusammenfuehren, klon } from '../engine/config.js';
import { serie, auswerten } from './simulation.js';
import { schalterSetzen } from '../engine/schalter.js';

const n = Number(process.argv[2] ?? 40);
const cfg = await standardLaden();
const pz = (x) => `${(100 * x).toFixed(1)} %`;
const faelle = [['koop', 2], ['koop', 3], ['koop', 4], ['team', 4], ['pvp', 2], ['pvp', 3], ['pvp', 4]];
console.log(`Erreichbarkeit (je ${n} Partien, die anderen beiden Wege ausgeschaltet)`);
console.log(['Weg', ...faelle.map(([m, k]) => `${m} ${k}`)].join(' | '));
for (const weg of ['floss', 'feuer', 'wrack']) {
  const aus = Object.fromEntries(['floss', 'feuer', 'wrack'].filter((w) => w !== weg).map((w) => [w, { aktiv: false }]));
  const c = zusammenfuehren(klon(cfg), { fluchtwege: aus });
  const z = [weg];
  for (const [m, k] of faelle) { const a = auswerten(serie(c, { partien: n, seed: 1, modus: m, spieler: k, bots: 'normal' })); z.push(`${pz(a.proWeg[weg])}${a.abbrueche ? ` (${a.abbrueche} Abbr.)` : ''}`); }
  console.log(z.join(' | '));
}
console.log(`\nTest-Schalter A/B (Koop 3 und PvP 3, je ${2 * n} Partien, gleiche Seeds)`);
for (const id of ['ruhigeTage', 'tierschaden', 'energieProTag', 'spieldauer']) {
  for (const [m, k] of [['koop', 3], ['pvp', 3]]) {
    const a = auswerten(serie(cfg, { partien: 2 * n, seed: 1, modus: m, spieler: k, bots: 'normal' }));
    const b = auswerten(serie(schalterSetzen(klon(cfg), id, true), { partien: 2 * n, seed: 1, modus: m, spieler: k, bots: 'normal' }));
    console.log(`${id} ${m} ${k}: Standard ${pz(a.siegquote)} (K.O. ${a.ko.toFixed(2)}) · Alternative ${pz(b.siegquote)} (K.O. ${b.ko.toFixed(2)})`);
  }
}
