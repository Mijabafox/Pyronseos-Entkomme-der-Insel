// Regler-Beschreibung: aus der Konfiguration abgeleitet, mit Namen, Mindest- und Höchstwerten.
// Jeder Zahlen-, Ja/Nein- und Auswahlwert der config.json wird so zum Regler (Browser und Simulation).
import { ROHSTOFFE, lesen } from './config.js';

export const ABSOLUT_MAX_SPIELER = 4;

export const BEREICHE = {
  match: 'Partie', figur: 'Figur', charaktere: 'Charaktere', zug: 'Zug', tiere: 'Tiere', crafting: 'Crafting',
  brett: 'Brett', fluchtwege: 'Fluchtwege', vorrat: 'Materialvorrat', duelle: 'Duelle', sichtbarkeit: 'Sichtbarkeit',
  routen: 'Routenkarten', spezialkarten: 'Spezialkarten', ki: 'KI (Bots)', browser: 'Browser',
};

const NAMEN = {
  modus: 'Modus', spieler: 'Spielerzahl', seed: 'Seed (leer = zufällig)', spielerMin: 'Spieler mindestens', spielerMax: 'Spieler höchstens',
  teamGroesse: 'Personen pro Team', ruhig: 'Ruhige Tage', ereignisse: 'Ereignis-Tage', lava: 'Lava-Karte am Ende',
  herzen: 'Herzen', energie: 'Energie', reanimationHerzen: 'Herzen nach Reanimation', axt: 'Steinaxt', hacke: 'Spitzhacke', waffe: 'Waffe',
  regel: 'Startfeld-Regel', tierfeldErlaubt: 'Startfeld darf Tier/Spezial sein', aktiv: 'aktiv', kampf: 'Kampfbonus',
  kacheln: 'Zusatzkacheln Weitsicht', zusatzfelder: 'Zusatzfelder bei 0 Energie', wuerfel: 'Würfel (Seiten)', schwelle: 'Schwelle', bonus: 'Bonus',
  radius: 'Radius', schrittEnergie: 'Energie pro Schritt', abbauEnergie: 'Energie pro Abbau', werkzeug: 'Werkzeug',
  rasten: 'Rasten (Energie)', rastenShelter: 'Rasten im Shelter', nahrungEnergie: 'Nahrung gibt Energie',
  auffuellen: 'Wasser füllt auf bis', zugende: 'Trinken beendet den Zug', durchlaufen: 'Wasserfeld durchlaufen erlaubt',
  proZug: 'pro Zug', maxKarten: 'höchstens Karten pro Seite', kompassEnergie: 'Kompass bergen kostet Energie',
  zielKlein: 'Zielwert kleines Tier', zielGross: 'Zielwert grosses Tier', nahrungKlein: 'Nahrung kleines Tier', nahrungGross: 'Nahrung grosses Tier',
  zuruecksetzen: 'Zurücksetzen bei Niederlage', fluchtEnergie: 'Flucht kostet Energie', hinterhaltKleinSchaden: 'Hinterhalt: Schaden bei kleinem Tier',
  lagerfeuerHerzen: 'Lagerfeuer heilt', bandageHerzen: 'Bandage heilt', festeBiome: 'Feste Biom-Zonen',
  kentertBis: 'Not-Floss kentert bis Wurf', landBis: 'Not-Floss zurück an Land bis Wurf', schadenKoop: 'Koop: Schaden beim Kentern',
  nachLandGratis: 'Nach «zurück an Land»: nächster Versuch gratis', nachLandNaechsterTag: 'Nächster Versuch erst am nächsten Tag',
  feuer: 'Feuer', abstand: 'Mindestabstand', brennsprit: 'Brennsprit nötig', unbegrenzt: 'Vorrat unbegrenzt',
  leerOhneErtrag: 'Leerer Stapel = kein Ertrag', rueckgabe: 'Abgegebene Karten zurück in den Vorrat',
  rohstoff: 'Beute: Rohstoff', spezial: 'Beute: Spezialkarte', route: 'Beute: Routenkarte (raubbar)', routeBeiAusscheiden: 'Routenkarte beim Ausscheiden',
  rohstoffe: 'Rohstoffe sichtbar für', charakter: 'Charakter sichtbar für', spezialkarten: 'Spezialkarten sichtbar für', routeRichtung: 'Richtung der Routenkarte sichtbar für',
  jeRichtung: 'Routenkarten je Richtung', stapel: 'Stapelgrösse', anzahl: 'Anzahl',
  vergesslichkeit: 'Vergesslichkeit (%)', vergessenNachTagen: 'Vergessen nach Tagen', zeitbudgetMs: 'Zeitbudget pro Zug (ms, Stufe gut)', stichproben: 'Stichproben (Stufe gut)',
  standardStufe: 'Standard-Stufe', risiko: 'Risikobereitschaft', kooperation: 'Kooperation', aggression: 'Aggression', ungeduld: 'Ungeduld',
  sparsamkeit: 'Sparsamkeit', siegweg: 'Bevorzugter Siegweg', fehlerquote: 'Fehlerquote (%)', aufmerksamkeit: 'Aufmerksamkeitsfehler (%)',
  pauseStandard: 'Pause «Sehr langsam» (s)', pauseMin: 'Pause mindestens (s)', pauseMax: 'Pause höchstens (s)',
  duenenKeime: 'Keime Dünen', gebirgeKeime: 'Keime Gebirge', waldKeime: 'Keime Wald', wieseKeime: 'Keime Wiese',
  holz: 'Holz', stein: 'Stein', blaetter: 'Blätter', seil: 'Seil', abfall: 'Abfall', nahrung: 'Nahrung',
};

const AUSWAHL = {
  'match.modus': ['koop', 'team', 'pvp'],
  'figur.startfeld.regel': ['zufall', 'fix'],
  'figur.startAusruestung.waffe': [null, 'holzspeer', 'steinmachete'],
  'duelle.routeBeiAusscheiden': ['zurueckZumKompass', 'ablage'],
  'ki.standardStufe': ['zufall', 'sehrEinfach', 'einfach', 'normal', 'gut'],
  'ki.persoenlichkeit.siegweg': ['keiner', 'floss', 'feuer', 'wrack'],
};
const AUSWAHL_MUSTER = [
  [/^zug\.ertrag\.[^.]+\.werkzeug$/, [null, 'axt', 'hacke']],
  [/^sichtbarkeit\.[^.]+\.[^.]+$/, ['alle', 'team', 'niemand']],
];
const BEREICH = {
  'match.spieler': [2, ABSOLUT_MAX_SPIELER], 'match.spielerMin': [1, ABSOLUT_MAX_SPIELER], 'match.spielerMax': [2, ABSOLUT_MAX_SPIELER],
  'match.teamGroesse': [2, 2], 'match.tage.ruhig': [0, 60], 'match.tage.ereignisse': [0, 60], 'match.seed': [0, 4294967295],
  'figur.herzen': [1, 12], 'figur.energie': [1, 12], 'figur.reanimationHerzen': [1, 12],
  'zug.weitsicht.wuerfel': [1, 12], 'zug.weitsicht.radius': [0, 8], 'zug.wasser.auffuellen': [0, 12],
  'tiere.zielKlein': [1, 12], 'tiere.zielGross': [1, 12],
  'fluchtwege.floss.not.kentertBis': [0, 6], 'fluchtwege.floss.not.landBis': [0, 6],
  'spezialkarten.stapel': [1, 80], 'routen.jeRichtung': [1, 6],
  'ki.vergesslichkeit': [0, 100], 'ki.fehlerquote': [0, 100], 'ki.zeitbudgetMs': [1, 2000], 'ki.stichproben': [1, 32],
  'browser.pauseStandard': [1, 5], 'browser.pauseMin': [1, 5], 'browser.pauseMax': [1, 5],
};
const KOSTEN_SCHLUESSEL = new Set(['kosten', 'proPerson', 'basis', 'bonus', 'bandageKosten', 'startRohstoffe']);
const UEBERSPRINGEN = new Set(['meta', 'tageskarten']);
const TEXTFELDER = new Set(['name', 'symbol', 'text', 'flavor', 'bild', 'art', 'effekte', 'ausspielen', 'reaktiv', 'nurModi', 'immerImStapel', 'beschreibung']);

function bereichFuer(pfad, wert) {
  if (BEREICH[pfad]) return BEREICH[pfad];
  if (/persoenlichkeit\.(risiko|kooperation|aggression|ungeduld|sparsamkeit|aufmerksamkeit|fehlerquote)$/.test(pfad)) return [0, 100];
  if (/\.(feuer)$/.test(pfad)) return [1, 21];
  if (/\.(abstand)$/.test(pfad)) return [1, 42];
  if (/^brett\.plaettchen\./.test(pfad)) return [0, 60];
  if (/^vorrat\.karten\./.test(pfad)) return [0, 99];
  if (/radius$/i.test(pfad)) return [0, 8];
  return [typeof wert === 'number' && wert < 0 ? -20 : 0, Math.max(20, typeof wert === 'number' ? wert * 3 : 20)];
}

function name(pfad) {
  const teile = pfad.split('.');
  const letzter = teile.at(-1);
  if (/^\d+$/.test(letzter)) return `${letzter} Personen`;
  let n = NAMEN[letzter] ?? letzter;
  const vor = teile.at(-2);
  if (/^\d+$/.test(vor)) n = `${vor} Personen: ${n}`;
  return n;
}

// Liste aller Regler { pfad, bereich, gruppe, name, typ, min, max, optionen }.
export function regler(cfg) {
  const erg = [];
  const gehe = (obj, pfad) => {
    for (const [k, v] of Object.entries(obj)) {
      const p = pfad ? `${pfad}.${k}` : k;
      const top = p.split('.')[0];
      if (UEBERSPRINGEN.has(top) || TEXTFELDER.has(k)) continue;
      if (p.startsWith('spezialkarten.karten')) continue; // eigener Karteneditor
      const auswahl = AUSWAHL[p] ?? AUSWAHL_MUSTER.find(([m]) => m.test(p))?.[1];
      if (auswahl) { erg.push(eintrag(p, 'auswahl', v, { optionen: auswahl })); continue; }
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        if (KOSTEN_SCHLUESSEL.has(k)) {
          for (const r of ROHSTOFFE) erg.push(eintrag(`${p}.${r}`, 'zahl', v[r] ?? 0, { min: 0, max: 30 }));
          continue;
        }
        gehe(v, p);
      } else if (typeof v === 'boolean') erg.push(eintrag(p, 'bool', v));
      else if (typeof v === 'number' || v === null) {
        const [min, max] = bereichFuer(p, v);
        erg.push(eintrag(p, 'zahl', v, { min, max }));
      } else if (p === 'zug.wasser.auffuellen') erg.push(eintrag(p, 'zahl', v, { min: 0, max: 12 }));
    }
  };
  gehe(cfg, '');
  return erg;
}

function eintrag(pfad, typ, wert, extra = {}) {
  const teile = pfad.split('.');
  return { pfad, bereich: teile[0], gruppe: teile.slice(0, -1).join('.'), name: name(pfad), typ, ...extra };
}

export function reglerWert(cfg, r) {
  const v = lesen(cfg, r.pfad);
  return v === undefined && r.typ === 'zahl' ? 0 : v;
}
