// Beobachtungs-Snapshot: Was eine Figur am Tisch wissen darf.
// Der Snapshot hat die gleiche Form wie der Spielzustand (damit Regel-Hilfen darauf laufen),
// aber alles Verdeckte ist entfernt: verdeckte Plättchen, Tierbeutel, Stapel-Reihenfolgen,
// künftige Tageskarten, fremde verdeckte Handkarten, fremde Routen-Richtungen, Zufallszustände.
import { gruppe, teamVon } from './kern.js';
import { klon } from './config.js';

export const VERDECKT = 'verdeckt';

// Darf Spieler `ich` die Information `art` (rohstoffe, charakter, spezialkarten, routeRichtung) von `von` sehen?
export function darfSehen(s, ich, von, art) {
  if (ich === von) return true;
  if (s.ende) return true;
  const regel = s.cfg.sichtbarkeit[s.modus]?.[art] ?? 'niemand';
  if (regel === 'alle') return true;
  if (regel === 'team') return gruppe(s, ich).includes(von);
  return false;
}

export function sicht(s, ich) {
  const felder = {};
  for (const [k, f] of Object.entries(s.felder)) {
    felder[k] = {
      key: f.key, coord: { ...f.coord }, ring: f.ring, biom: f.biom, duene: f.duene, kuestenNr: f.kuestenNr, richtung: f.richtung,
      aufgedeckt: f.aufgedeckt, bau: f.bau ? { ...f.bau } : null,
      inhalt: f.aufgedeckt ? f.inhalt : null, tier: f.aufgedeckt ? f.tier : null, kompass: f.aufgedeckt ? f.kompass : null,
    };
  }
  const spieler = s.spieler.map((p, k) => {
    const o = {
      id: p.id, index: k, name: p.name, ki: p.ki, feld: p.feld, herzen: p.herzen, energie: p.energie,
      ausruestung: { ...p.ausruestung }, schutz: k === ich ? p.schutz : false, liegt: p.liegt, ausgeschieden: p.ausgeschieden,
      anzahlRohstoffe: Object.values(p.hand).reduce((a, n) => a + n, 0), anzahlKarten: p.karten.length, hatRoute: p.route !== null,
      team: teamVon(s, k),
      charakter: darfSehen(s, ich, k, 'charakter') ? p.charakter : null,
      hand: darfSehen(s, ich, k, 'rohstoffe') ? { ...p.hand } : null,
      karten: darfSehen(s, ich, k, 'spezialkarten') ? [...p.karten] : null,
      route: p.route === null ? null : darfSehen(s, ich, k, 'routeRichtung') ? p.route : VERDECKT,
    };
    return o;
  });
  const ereignisse = s.ereignisse.map((e) => {
    const verdeckt = (e.art === 'gezogen' && !darfSehen(s, ich, e.spieler, 'spezialkarten')) || (e.art === 'route' && !darfSehen(s, ich, e.spieler, 'routeRichtung'));
    return verdeckt ? { ...e, karte: null, ergebnis: 'verdeckt' } : { ...e };
  });
  return {
    ich, cfg: s.cfg, seed: null, modus: s.modus, teams: s.teams ? klon(s.teams) : null, aktiv: s.aktiv, tag: s.tag,
    zug: klon(s.zug), felder, spieler,
    anzahl: {
      tierBeutel: s.tierBeutel.length, spezialStapel: s.spezialStapel.length, routenStapel: s.routenStapel.length,
      tagesStapel: s.tagesStapel.length, routenAblage: s.routenAblage.length,
    },
    tierAblage: [...s.tierAblage], spezialAblage: [...s.spezialAblage],
    tagesKarte: s.tagesKarte, tagesAblage: [...s.tagesAblage],
    vorrat: s.vorrat ? { ...s.vorrat } : null,
    sammelfeld: s.sammelfeld, notFloss: klon(s.notFloss), ende: s.ende ? klon(s.ende) : null,
    wuerfe: klon(s.wuerfe), ereignisse,
    // Felder, die die Regel-Hilfen erwarten, aber verdeckt sind:
    tierBeutel: null, spezialStapel: null, routenStapel: null, tagesStapel: null, routenAblage: null, rng: null,
    protokoll: false, log: [], statistik: null,
  };
}
