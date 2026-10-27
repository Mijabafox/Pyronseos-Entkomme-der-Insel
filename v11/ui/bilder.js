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
