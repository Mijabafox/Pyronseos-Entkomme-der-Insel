// Anzeigetexte der Oberfläche, die aus der Konfiguration abgeleitet werden (gemeinsam für Spiel und Regeln).
import { rohstoffText } from '../engine/config.js';
import { REZEPT } from '../engine/namen.js';

// Rezeptnamen wie auf den Karten (Grossbuchstaben, Umlaute).
const REZEPT_NAME = { seil: 'Seil', steinaxt: 'Steinaxt', spitzhacke: 'Spitzhacke', holzspeer: 'Holzspeer', steinmachete: 'Steinmachete', bandage: 'Bandage', lagerfeuer: 'Lagerfeuer', shelter: 'Shelter' };
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
    case 'bandage': return `+${cfg.crafting.bandageHerzen} Herzen oder Reanimation einer Figur auf deinem Feld`;
    case 'lagerfeuer': return `beim Bau +${cfg.crafting.lagerfeuerHerzen} Herzen; auf dem Strand Teil der Küstenfeuer-Kette`;
    case 'shelter': return `Rasten im Shelter +${cfg.zug.rastenShelter} Energie, Schutz vor Giftwolke und Frost`;
    default: return REZEPT[id]?.wirkung ?? '';
  }
}

// Charakter-Fähigkeit in einem Satz.
export function charakterText(cfg, id) {
  const c = cfg.charaktere[id];
  if (!c) return '';
  switch (id) {
    case 'ueberlebenskuenstler': return `${c.herzen} Herzen statt ${cfg.figur.herzen}`;
    case 'jaeger': return `+${c.kampf} im Tierkampf`;
    case 'kundschafter': return `+${c.kacheln} Kachel bei der Weitsicht`;
    case 'laeufer': return `bei 0 Energie noch ${c.zusatzfelder} Zusatzfeld (1× pro Zug)`;
    case 'sanitaeter': return `Bandage kostet nur ${rohstoffText(c.bandageKosten)}`;
    case 'sammlerin': return `beim Abbau W${c.wuerfel}: ab ${c.schwelle} +${c.bonus} Rohstoff`;
    default: return '';
  }
}
