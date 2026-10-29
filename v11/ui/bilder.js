// Bildpfade (Originalbilder aus v10).
import { TIER } from '../engine/namen.js';

export const spielerFarbe = ['#C8352E', '#2F6FB5', '#7A4A9E', '#4E8A4A', '#D08A2E', '#2F8A86'];
export const bild = {
  brett: './brett/brett-web.png',
  hinten: (biom) => `./plaettchen/hinten/${biom}.png`,
  vorne: (f) => {
    if (f.biom === 'vulkan') {
      if (f.inhalt === 'vulkanfels') return f.kompass ? './plaettchen/vorne/vulkan-vulkanfels.png' : './plaettchen/vorne/vulkan-leer.png';
      return f.ring === 0 ? './plaettchen/vorne/vulkan-krater.png' : './plaettchen/vorne/vulkan-leer.png';
    }
    if (f.tier) return `./plaettchen/vorne/${f.biom}-tier.png`;
    if (!f.inhalt || f.inhalt === 'leer') return null;
    return `./plaettchen/vorne/${f.biom}-${f.inhalt}.png`;
  },
  tier: (t) => (TIER[t] ? `./kreise/tier/${t}.png` : null),
  marker: (m) => `./kreise/marker/${m}.png`,
  tag: (def) => (def?.bild ? `./karten/tag/${def.bild}.png` : null),
  spezial: (def) => (def?.bild ? `./karten/spezial/${def.bild}.png` : null),
  route: (r) => `./karten/route/${r}.png`,
  rueckseite: (art) => `./karten/rueckseite/${art}.png`,
  werkzeug: (id) => ({ steinaxt: 'steinaxt', axt: 'steinaxt', spitzhacke: 'spitzhacke', hacke: 'spitzhacke', holzspeer: 'holzspeer', steinmachete: 'machete', bandage: 'bandage' })[id] ? `./karten/werkzeug/${({ steinaxt: 'steinaxt', axt: 'steinaxt', spitzhacke: 'spitzhacke', hacke: 'spitzhacke', holzspeer: 'holzspeer', steinmachete: 'machete', bandage: 'bandage' })[id]}.png` : null,
  rohstoff: (r) => `./karten/rohstoff/${({ blaetter: 'blatt' })[r] ?? r}.png`,
  charakter: (c) => `./spieler/${c}.png`,
  charakterRueckseite: './spieler/rueckseite.png',
  herz: './chips/herz.png', energie: './chips/energie.png',
};

// Lage der Zahlenreihe auf der Spielerkarte (Originalbild 1752 × 1068), wie V10.
const KARTE = { breite: 1752, hoehe: 1068, zahl0: 0.121, zahl6: 0.491, herzY: 0.66, energieY: 0.861, chip: 0.056 };

// Chip auf der Zahlenreihe der Spielerkarte (0 bis 6), Lage in Prozent.
export function chipOrt(wert, art) {
  const x = (KARTE.zahl0 + ((KARTE.zahl6 - KARTE.zahl0) * Math.max(0, Math.min(6, wert))) / 6) * 100;
  const y = (art === 'herz' ? KARTE.herzY : KARTE.energieY) * 100;
  const w = KARTE.chip * 100, h = ((KARTE.chip * KARTE.breite) / KARTE.hoehe) * 100;
  return `left:${(x - w / 2).toFixed(2)}%;top:${(y - h / 2).toFixed(2)}%;width:${w.toFixed(2)}%;height:${h.toFixed(2)}%`;
}
