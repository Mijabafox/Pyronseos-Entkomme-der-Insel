// Anzeigetexte der Oberfläche, die aus der Konfiguration abgeleitet werden (gemeinsam für Spiel und Regeln).
import { rohstoffText } from '../engine/config.js';
import { REZEPT } from '../engine/namen.js';

// Rezeptnamen wie auf den Karten (Grossbuchstaben, Umlaute).
const REZEPT_NAME = { seil: 'Seil', steinaxt: 'Steinaxt', spitzhacke: 'Spitzhacke', holzspeer: 'Holzspeer', steinmachete: 'Machete', bandage: 'Bandage', lagerfeuer: 'Lagerfeuer', shelter: 'Shelter' };
export const rezeptName = (id) => REZEPT_NAME[id] ?? REZEPT[id]?.name ?? id;
export const rezeptSymbol = (id) => REZEPT[id]?.symbol ?? '🛠';

// Wirkung eines Rezepts mit den Werten der aktuellen Konfiguration.
export function rezeptWirkung(cfg, id) {
  const r = cfg.crafting.rezepte[id] ?? {};
  switch (id) {
    case 'seil': return 'Grundmaterial für Werkzeuge, Waffen, Shelter und Floss';
    case 'steinaxt': return `Baum: ${(cfg.zug.ertrag.baum.basis.holz ?? 0) + (cfg.zug.ertrag.baum.bonus?.holz ?? 0)} statt ${cfg.zug.ertrag.baum.basis.holz ?? 0} Holz`;
    case 'spitzhacke': return `Fels: ${(cfg.zug.ertrag.fels.basis.stein ?? 0) + (cfg.zug.ertrag.fels.bonus?.stein ?? 0)} statt ${cfg.zug.ertrag.fels.basis.stein ?? 0} Stein · nötig, um den Kompass zu bergen`;
    case 'holzspeer': case 'steinmachete': return `Waffe: +${r.kampf ?? 0} im Kampf (Tier und Duell)`;
    case 'bandage': return `wird direkt eingesetzt: +${cfg.crafting.bandageHerzen} Herzen oder Wiederbelebung (selbes oder Nachbarfeld) mit ${cfg.figur.reanimationHerzen} Herzen`;
    case 'lagerfeuer': return `nur auf leerem oder abgebautem Feld; wärmt eigenes Feld + Nachbarfelder (Frost, Mücken), am Strandring Teil des Signalfeuers${cfg.crafting.lagerfeuerHerzen > 0 ? `, beim Bau +${cfg.crafting.lagerfeuerHerzen} Herzen` : ', heilt nicht'}`;
    case 'shelter': return `nur auf leerem oder abgebautem Feld; betreten oder drin bleiben: +${cfg.zug.rastenShelter} Energie, Zug endet; schützt vor Frost und Giftwolke`;
    default: return REZEPT[id]?.wirkung ?? '';
  }
}

// Charakter-Fähigkeit in einem Satz.
export function charakterText(cfg, id) {
  const c = cfg.charaktere[id];
  if (!c) return '';
  switch (id) {
    case 'ueberlebenskuenstler': return `${c.herzen} Herzen (Start und Maximum)`;
    case 'jaeger': return `+${c.kampf} in jedem Tierkampf, auch ohne Waffe`;
    case 'kundschafter': return `Weitsicht: immer ${c.kacheln} Plättchen mehr aufdecken`;
    case 'laeufer': return `fällt die Energie auf 0, noch ${c.zusatzfelder} Feld gratis (1× pro Zug)`;
    case 'sanitaeter': return `Bandage aus nur ${rohstoffText(c.bandageKosten)}, ohne Nahrung`;
    case 'sammlerin': return `bei jedem Abbau W${c.wuerfel}: bei ${c.schwelle}–${c.wuerfel} sofort ${c.bonus} Rohstoff derselben Sorte dazu`;
    default: return '';
  }
}
