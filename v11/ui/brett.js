// Spielbrett als SVG (Originalbrett aus v10, Plättchen, Tier-Token, Kreis-Marker).
import { pixel } from '../engine/hex.js';
import { bild, spielerFarbe } from './bilder.js';
import { esc } from './dom.js';
import { TIER, INHALT } from '../engine/namen.js';

const RASTER = { breite: 5496, hoehe: 5496, mitteX: 2748, mitteY: 2754, hex: 193.421 };
export const SE = 30; // Hex-Grösse in SVG-Einheiten
const OT = SE / RASTER.hex;
const BRETT = { x: -RASTER.mitteX * OT, y: -RASTER.mitteY * OT, w: RASTER.breite * OT, h: RASTER.hoehe * OT };
export const HALB = Math.ceil(Math.max(BRETT.x + BRETT.w, BRETT.y + BRETT.h, -BRETT.x, -BRETT.y));

function hexPunkte(c, r) {
  const p = [];
  for (let k = 0; k < 6; k++) { const w = (Math.PI / 3) * k; p.push(`${(c.x + r * Math.cos(w)).toFixed(2)},${(c.y + r * Math.sin(w)).toFixed(2)}`); }
  return p.join(' ');
}
function plaettchen(href, c, klasse = '') {
  const w = SE * 2, h = SE * Math.sqrt(3);
  return `<image class="plaettchen ${klasse}" href="${href}" x="${(c.x - w / 2).toFixed(2)}" y="${(c.y - h / 2).toFixed(2)}" width="${w}" height="${h.toFixed(2)}" preserveAspectRatio="none"/>`;
}
function kreis(href, x, y, r, klasse, titel) {
  return `<image class="${klasse}" href="${href}" x="${(x - r).toFixed(2)}" y="${(y - r).toFixed(2)}" width="${2 * r}" height="${2 * r}"><title>${esc(titel)}</title></image>`;
}

// opt: { ziele:Set, kette:{gueltig:Set, ungueltig:Set}, hervor, figurenZeigen, spur:[{von,nach,spieler}], zielStrand:Set, sammelfeld }
export function brettSvg(s, opt = {}) {
  const teile = [];
  teile.push(`<image class="brett-bild" href="${bild.brett}" x="${BRETT.x.toFixed(2)}" y="${BRETT.y.toFixed(2)}" width="${BRETT.w.toFixed(2)}" height="${BRETT.h.toFixed(2)}" preserveAspectRatio="none"/>`);
  for (const f of Object.values(s.felder)) {
    const c = pixel(f.coord, SE);
    const kl = ['feld', `b-${f.biom}`, f.aufgedeckt ? 'offen' : 'verdeckt'];
    if (opt.ziele?.has(f.key)) kl.push('ziel');
    if (opt.zielStrand?.has(f.key)) kl.push('floss-ziel');
    let inhalt = '';
    if (f.aufgedeckt) {
      const v = bild.vorne(f);
      if (v) inhalt += plaettchen(v, c);
      if (f.tier && bild.tier(f.tier)) inhalt += kreis(bild.tier(f.tier), c.x, c.y + 2, 15, 'token', TIER[f.tier]?.name ?? f.tier);
      if (f.bau) {
        const off = f.tier ? { x: 13, y: -10, r: 9 } : { x: 0, y: 0, r: 14 };
        inhalt += kreis(bild.marker(f.bau.art), c.x + off.x, c.y + off.y, off.r, 'bau-marker', f.bau.art === 'lagerfeuer' ? 'Lagerfeuer' : 'Shelter');
      }
    } else inhalt += plaettchen(bild.hinten(f.biom), c);
    if (Object.values(s.notFloss ?? {}).some((n) => n.feld === f.key)) inhalt += kreis(bild.marker('floss'), c.x - 13, c.y + 11, 10, 'bau-marker', 'Not-Floss liegt bereit');
    if (opt.sammelfeld === f.key) inhalt += `<text class="sammel-marker" x="${c.x - 15}" y="${c.y + 17}">📍<title>Sammelfeld fürs Floss</title></text>`;
    const titel = f.aufgedeckt ? `${f.kuestenNr !== null ? `Strandfeld ${f.kuestenNr}: ` : ''}${f.tier ? TIER[f.tier]?.name : INHALT[f.inhalt] ?? ''}` : f.kuestenNr !== null ? `Strandfeld ${f.kuestenNr}` : 'verdeckt';
    teile.push(`<g class="${kl.join(' ')}" data-feld="${f.key}">${inhalt}<polygon class="flaeche" points="${hexPunkte(c, SE)}"/><title>${esc(titel)}</title></g>`);
  }
  // Feuerkette markieren
  if (opt.kette) {
    for (const [menge, klasse, titel] of [[opt.kette.gueltig, 'gueltig', 'Feuer zählt zur Küstenfeuer-Kette'], [opt.kette.ungueltig, 'ungueltig', 'Feuer verletzt den Mindestabstand – zählt nicht']]) {
      for (const k of menge ?? []) { const f = s.felder[k]; if (!f) continue; teile.push(`<polygon class="ketten-rand ${klasse}" points="${hexPunkte(pixel(f.coord, SE), SE - 3)}"><title>${titel}</title></polygon>`); }
    }
  }
  for (const k of opt.ziele ?? []) { const f = s.felder[k]; if (f) teile.push(`<polygon class="ziel-rand" points="${hexPunkte(pixel(f.coord, SE), SE)}"/>`); }
  if (opt.hervor && s.felder[opt.hervor]) teile.push(`<polygon class="hervor-rand" points="${hexPunkte(pixel(s.felder[opt.hervor].coord, SE), SE)}"/>`);
  // Spur der letzten KI-Bewegung
  for (const sp of opt.spur ?? []) {
    const a = s.felder[sp.von], b = s.felder[sp.nach];
    if (!a || !b) continue;
    const p = pixel(a.coord, SE), q = pixel(b.coord, SE);
    teile.push(`<line class="ki-spur" x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" style="stroke:${spielerFarbe[sp.spieler]}"/>`);
  }
  // Figuren
  const proFeld = new Map();
  for (const p of s.spieler) proFeld.set(p.feld, (proFeld.get(p.feld) ?? 0) + 1);
  const gezaehlt = new Map();
  s.spieler.forEach((p, i) => {
    const f = s.felder[p.feld];
    if (!f || p.ausgeschieden) return;
    const n = proFeld.get(p.feld), k = gezaehlt.get(p.feld) ?? 0;
    gezaehlt.set(p.feld, k + 1);
    const c = pixel(f.coord, SE);
    const w = (2 * Math.PI * k) / n;
    const d = n === 1 ? 0 : 11;
    const x = c.x + Math.sin(w) * d, y = c.y - Math.cos(w) * d + 3;
    const r = n <= 2 ? 10 : 8;
    const werkzeug = [p.ausruestung.axt && '🪓', p.ausruestung.hacke && '⛏️', p.ausruestung.waffe && (p.ausruestung.waffe === 'holzspeer' ? '🔱' : '🗡️')].filter(Boolean).join('');
    teile.push(`<g class="figur${i === s.aktiv && !s.ende ? ' aktiv' : ''}${p.liegt ? ' liegt' : ''}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${spielerFarbe[i]}"/><text x="${x.toFixed(1)}" y="${(y + 3.5).toFixed(1)}">${i + 1}</text>${werkzeug ? `<text class="werkzeug-zeichen" x="${(x + r + 1).toFixed(1)}" y="${(y - r + 4).toFixed(1)}">${werkzeug}</text>` : ''}<title>${esc(p.name)}${p.liegt ? ' (am Boden)' : ''}${werkzeug ? ` · ${werkzeug}` : ''}</title></g>`);
  });
  return `<svg class="brett" viewBox="${-HALB} ${-HALB} ${2 * HALB} ${2 * HALB}" xmlns="http://www.w3.org/2000/svg">${teile.join('')}</svg>`;
}
