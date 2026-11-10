// Test-Schalter für Playtests (V12). Standard = aktueller Regelstand, jede Alternative einzeln umstellbar.
// Ein Schalter setzt nur Werte in der Konfiguration; Protokoll und Simulation schreiben den Stand mit.
import { setzen, lesen, klon } from './config.js';

const KLEIN = ['hase', 'wildhuhn', 'schwein', 'krebs'], GROSS = ['baer', 'tiger', 'schlange', 'krokodil'];
const setzeAlle = (cfg, paare) => { for (const [p, v] of paare) setzen(cfg, p, klon(v)); };
const gleich = (cfg, paare) => paare.every(([p, v]) => JSON.stringify(lesen(cfg, p)) === JSON.stringify(v));

function schalter(id, name, standard, alternative, std, alt) {
  return { id, name, standard, alternative, std, alt };
}

export const SCHALTER = [
  schalter('ruhigeTage', 'Ruhige Tage', '7 Ruhige + 12 Ereignisse', '10 Ruhige + 9 Ereignisse',
    [['match.tage.ruhig', 7], ['match.tage.ereignisse', 12]], [['match.tage.ruhig', 10], ['match.tage.ereignisse', 9]]),
  schalter('tierschaden', 'Tierschaden', 'klein −1, gross −2', 'klein 0, gross −1',
    [...KLEIN.map((t) => [`tiere.schaden.${t}`, 1]), ...GROSS.map((t) => [`tiere.schaden.${t}`, 2])],
    [...KLEIN.map((t) => [`tiere.schaden.${t}`, 0]), ...GROSS.map((t) => [`tiere.schaden.${t}`, 1])]),
  schalter('shelterPreis', 'Shelter-Preis', '1 Holz, 1 Abfall', '3 Holz, 2 Seil',
    [['crafting.rezepte.shelter.kosten', { holz: 1, abfall: 1 }]], [['crafting.rezepte.shelter.kosten', { holz: 3, seil: 2 }]]),
  schalter('feuerabstaende', 'Feuerabstände', '9 / 7 / 5 / 4', '13 / 9 / 7 / 6',
    [9, 7, 5, 4].map((a, k) => [`fluchtwege.feuer.tabelle.${k + 1}.abstand`, a]), [13, 9, 7, 6].map((a, k) => [`fluchtwege.feuer.tabelle.${k + 1}.abstand`, a])),
  schalter('werkzeuglimit', 'Werkzeug-/Waffenlimit', 'kein Limit', 'max. 1 pro Typ',
    [['ausruestung.limitProTyp', false]], [['ausruestung.limitProTyp', true]]),
  schalter('fluchtVorTier', 'Flucht vor Tierfeld', 'aus (Pflichtkampf)', 'beim Betreten für 1 Energie 1 Feld zurück oder zur Seite',
    [['tiere.flucht', false]], [['tiere.flucht', true]]),
  schalter('werkzeugeOffen', 'Werkzeuge offen', 'aus (alles auf der Hand)', 'Werkzeuge und Waffen offen, Diebstahl nur aus verdeckten Karten',
    [['ausruestung.offen', false]], [['ausruestung.offen', true]]),
  schalter('energieProTag', '+1 Energie pro Tag', 'an', 'aus',
    [['zug.energieProTag', 1]], [['zug.energieProTag', 0]]),
  schalter('spieldauer', 'Spieldauer', '20 Tage', '30 Tage (10 Ruhige + 19 Ereignisse + Lava)',
    [], [['match.tage.ruhig', 10], ['match.tage.ereignisse', 19]]),
];

const nach = (id) => SCHALTER.find((x) => x.id === id);

// Stand eines Schalters: 'standard', 'alternative' oder 'eigen' (Werte von Hand verstellt).
export function schalterStand(cfg, id) {
  const s = nach(id);
  if (!s) return 'eigen';
  if (id === 'spieldauer') return gleich(cfg, s.alt) ? 'alternative' : 'standard';
  if (id === 'ruhigeTage' && gleich(cfg, nach('spieldauer').alt)) return 'standard'; // 30 Tage überschreibt die Tagesmischung
  return gleich(cfg, s.std) ? 'standard' : gleich(cfg, s.alt) ? 'alternative' : 'eigen';
}

// Schalter stellen (verändert cfg). `an` = Alternative aktiv.
export function schalterSetzen(cfg, id, an) {
  const s = nach(id);
  if (!s) throw new Error(`Unbekannter Test-Schalter «${id}». Bekannt: ${SCHALTER.map((x) => x.id).join(', ')}`);
  if (id === 'spieldauer' && !an) { setzeAlle(cfg, nach('ruhigeTage').std); return cfg; }
  setzeAlle(cfg, an ? s.alt : s.std);
  return cfg;
}

// Alle Schalter mit Stand (für Anzeige, Protokoll und Simulation).
export function schalterListe(cfg) {
  return SCHALTER.map((s) => { const stand = schalterStand(cfg, s.id); return { ...s, stand, wert: stand === 'alternative' ? s.alternative : stand === 'standard' ? s.standard : 'eigener Wert (Regler)' }; });
}
export function schalterKurz(cfg) {
  return schalterListe(cfg).map((s) => `${s.name}: ${s.wert}`).join(' · ');
}
export function schalterAktiv(cfg) {
  return schalterListe(cfg).filter((s) => s.stand !== 'standard').map((s) => s.id);
}
