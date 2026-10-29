// Werkzeug als kleiner Ausschnitt der Werkzeugkarte (wie V10).
const AUSSCHNITT = { x: 48, y: 168, breite: 432, hoehe: 300, kartenBreite: 528, kartenHoehe: 804 };
function werkzeugSymbol(id, name, x, y, b) {
  const src = bild.werkzeug(id);
  if (!src) return '';
  const a = AUSSCHNITT, h = b * (a.hoehe / a.breite);
  return `<g class="werkzeug-icon"><title>${esc(name)}</title><rect x="${(x - b / 2 - 1).toFixed(2)}" y="${(y - h / 2 - 1).toFixed(2)}" width="${b + 2}" height="${(h + 2).toFixed(2)}" rx="2"/><svg x="${(x - b / 2).toFixed(2)}" y="${(y - h / 2).toFixed(2)}" width="${b}" height="${h.toFixed(2)}" viewBox="${a.x} ${a.y} ${a.breite} ${a.hoehe}" preserveAspectRatio="xMidYMid slice"><image href="${src}" width="${a.kartenBreite}" height="${a.kartenHoehe}"/></svg></g>`;
}

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
// Kartenrahmen auf dem Brettbild (Rasterpixel aus V10): dort liegen Tages-, Spezial- und Routenkarten.
const KARTENFELDER = { oben_rechts: [4428, 180, 5315, 779], unten_links: [180, 4716, 1067, 5315], unten_rechts: [4428, 4716, 5315, 5315] };
export const RAHMEN = Object.fromEntries(Object.entries(KARTENFELDER).map(([n, [x0, y0, x1, y1]]) => [n, { x: (x0 - RASTER.mitteX) * OT, y: (y0 - RASTER.mitteY) * OT, breite: (x1 - x0) * OT, hoehe: (y1 - y0) * OT }]));

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

// opt: { ziele:Set, kette:{gueltig:Set, ungueltig:Set}, hervor, spur:[{von,nach,spieler}], zielStrand:Set, sammelfeld, trinken, figurenZiehbar, figurGewaehlt }
export function brettSvg(s, opt = {}) {
  const teile = [];
  teile.push(`<image class="brett-bild" href="${bild.brett}" x="${BRETT.x.toFixed(2)}" y="${BRETT.y.toFixed(2)}" width="${BRETT.w.toFixed(2)}" height="${BRETT.h.toFixed(2)}" preserveAspectRatio="none"/>`);
  for (const f of Object.values(s.felder)) {
    const c = pixel(f.coord, SE);
    const kl = ['feld', `b-${f.biom}`, f.aufgedeckt ? 'offen' : 'verdeckt'];
    if (opt.ziele?.has(f.key)) kl.push('ziel');
    if (opt.zielStrand?.has(f.key)) kl.push('floss-ziel');
    let inhalt = '';
    if (opt.sammelfeld === f.key) kl.push('sammelfeld');
    if (f.aufgedeckt) {
      const v = bild.vorne(f);
      if (v) inhalt += plaettchen(v, c);
      if (f.tier && bild.tier(f.tier)) inhalt += kreis(bild.tier(f.tier), c.x, c.y + 2, 17, 'token', TIER[f.tier]?.name ?? f.tier);
      if (f.bau) {
        const off = f.tier ? { x: 13, y: -9, r: 9 } : { x: 0, y: 0, r: 14 };
        inhalt += kreis(bild.marker(f.bau.art), c.x + off.x, c.y + off.y, off.r, 'bau-marker', f.bau.art === 'lagerfeuer' ? 'Lagerfeuer' : 'Shelter');
      }
    } else inhalt += plaettchen(bild.hinten(f.biom), c);
    if (Object.values(s.notFloss ?? {}).some((n) => n.feld === f.key)) inhalt += kreis(bild.marker('floss'), c.x - 13, c.y + 11, 10, 'bau-marker', 'Not-Floss liegt bereit');
    if (opt.sammelfeld === f.key) inhalt += `<text class="sammel-marker" x="${c.x - 14}" y="${c.y + 16}">📍<title>Sammelfeld fürs Floss</title></text>`;
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
    const l = Math.hypot(q.x - p.x, q.y - p.y) || 1, dx = (q.x - p.x) / l, dy = (q.y - p.y) / l;
    const o = { x: q.x - dx * 16, y: q.y - dy * 16 };
    const u = { x: o.x - dx * 10 - dy * 6, y: o.y - dy * 10 + dx * 6 }, w = { x: o.x - dx * 10 + dy * 6, y: o.y - dy * 10 - dx * 6 };
    const z = (n) => n.toFixed(1);
    teile.push(`<g class="ki-spur" style="--farbe:${spielerFarbe[sp.spieler]}"><line x1="${z(p.x)}" y1="${z(p.y)}" x2="${z(o.x)}" y2="${z(o.y)}"/><polygon points="${z(o.x)},${z(o.y)} ${z(u.x)},${z(u.y)} ${z(w.x)},${z(w.y)}"/><circle class="ki-ziel" cx="${z(q.x)}" cy="${z(q.y)}" r="20"/></g>`);
  }
  // Figuren wie V10: Kreis mit Kürzel (Zahl am Namensende oder die ersten zwei Buchstaben), Werkzeuge als kleine Kartenausschnitte.
  const proFeld = new Map();
  for (const p of s.spieler) if (!p.ausgeschieden) proFeld.set(p.feld, (proFeld.get(p.feld) ?? 0) + 1);
  const gezaehlt = new Map();
  s.spieler.forEach((p, i) => {
    const f = s.felder[p.feld];
    if (!f || p.ausgeschieden) return;
    const n = proFeld.get(p.feld), k = gezaehlt.get(p.feld) ?? 0;
    gezaehlt.set(p.feld, k + 1);
    const c = pixel(f.coord, SE);
    const w = ((2 * Math.PI) / n) * k, d = n <= 2 ? 10 : 12;
    const x = c.x + (n === 1 ? -4 : Math.sin(w) * d), y = c.y + 4 + (n === 1 ? 0 : -Math.cos(w) * d);
    const r = n <= 2 ? 10 : 8;
    const kuerzel = p.name.match(/(\d+)$/)?.[1] ?? p.name.slice(0, 2);
    const werkzeuge = [p.ausruestung.axt && ['axt', 'Steinaxt'], p.ausruestung.hacke && ['hacke', 'Spitzhacke'], p.ausruestung.waffe && [p.ausruestung.waffe, p.ausruestung.waffe === 'holzspeer' ? 'Holzspeer' : 'Steinmachete']].filter(Boolean);
    const gr = r < 10 ? 10 : 13;
    const symbole = werkzeuge.map(([id, name], m) => werkzeugSymbol(id, name, x + r + gr / 2 + 1, y - r + 3 + m * (gr * 0.78 + 1), gr)).join('');
    const ziehbar = opt.figurenZiehbar ? ` ziehbar${opt.figurGewaehlt === i ? ' gewaehlt' : ''}` : '';
    teile.push(`<g class="figur${i === s.aktiv && !s.ende ? ' aktiv' : ''}${p.liegt ? ' liegt' : ''}${ziehbar}"${opt.figurenZiehbar ? ` data-figur="${i}"` : ''}><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${spielerFarbe[i]}"/><text x="${x.toFixed(1)}" y="${(y + 3.5).toFixed(1)}"${r < 10 ? ' style="font-size:8px"' : ''}>${esc(kuerzel)}</text>${symbole}<title>${esc(p.name)}${p.liegt ? ' (am Boden)' : ''}${werkzeuge.length ? ` · ${werkzeuge.map((x) => x[1]).join(', ')}` : ''}</title></g>`);
  });
  // Trinken-Knopf direkt auf dem Feld (wie V10)
  if (opt.trinken && s.felder[opt.trinken]) {
    const c = pixel(s.felder[opt.trinken].coord, SE);
    teile.push(`<g class="feld-knopf" data-aktion='{"typ":"trinken"}' role="button"><title>Trinken: Energie auffüllen, danach endet der Zug</title><rect x="${c.x - 22}" y="${c.y - 33}" width="44" height="13" rx="4"/><text x="${c.x}" y="${c.y - 23.5}">💧 Trinken</text></g>`);
  }
  return `<svg class="brett" viewBox="${-HALB} ${-HALB} ${2 * HALB} ${2 * HALB}" xmlns="http://www.w3.org/2000/svg">${teile.join('')}</svg>`;
}
