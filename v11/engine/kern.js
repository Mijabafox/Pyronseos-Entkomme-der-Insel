// Grundbausteine der Engine: Gruppen, Werte, Schaden, Vorrat, Würfe, Protokoll.
// Der Spielzustand wird in place verändert (schnell für die Simulation).
import { ganz } from './rng.js';
import { abstand } from './hex.js';
import { ROHSTOFFE } from './config.js';

export const MODUS_NAME = { koop: 'Koop', team: 'Team (2 gegen 2)', pvp: 'PvP (jeder gegen jeden)' };
export const TEAM_NAMEN = ['Team Sonne', 'Team Mond'];
export const TEAM_SYMBOL = ['☀️', '🌙'];

export const leereHand = () => Object.fromEntries(ROHSTOFFE.map((r) => [r, 0]));

export const aktiv = (s) => s.spieler[s.aktiv];
export const imSpiel = (p) => !p.liegt && !p.ausgeschieden;

// Indizes der Figuren, die zusammen fliehen bzw. eine Kasse/Feuerkette teilen.
export function gruppe(s, i = s.aktiv) {
  if (s.modus === 'koop') return s.spieler.map((_, k) => k);
  if (s.modus === 'team') {
    const t = teamVon(s, i);
    return s.spieler.flatMap((p, k) => (teamVon(s, k) === t ? [k] : []));
  }
  return [i];
}
export function teamVon(s, i) {
  if (s.modus !== 'team') return null;
  const id = s.spieler[i].id;
  const t = s.teams.findIndex((tm) => tm.includes(id));
  return t < 0 ? null : t;
}
export function gruppenSchluessel(s, i) {
  return s.modus === 'koop' ? 'alle' : s.modus === 'team' ? `team${teamVon(s, i)}` : s.spieler[i].id;
}
export const gleicheGruppe = (s, a, b) => a === b || gruppe(s, a).includes(b);

// Anzahl fliehender Personen (Kosten werden damit multipliziert).
export function fliehende(s) {
  return s.modus === 'koop' ? s.spieler.length : s.modus === 'team' ? s.cfg.match.teamGroesse : 1;
}

export function herzenMax(s, p) {
  const u = s.cfg.charaktere.ueberlebenskuenstler;
  return p.charakter === 'ueberlebenskuenstler' && u.aktiv ? u.herzen : s.cfg.figur.herzen;
}
export const energieMax = (s) => s.cfg.figur.energie;

export function log(s, text, i = s.aktiv) {
  if (!s.protokoll) return;
  const wer = i === null || i === undefined ? '' : `${s.spieler[i].name}: `;
  s.log.push(`Tag ${s.tag} · ${wer}${text}`);
}
export function logAllgemein(s, text) { if (s.protokoll) s.log.push(`Tag ${s.tag} · ${text}`); }

export function zaehle(s, schluessel, n = 1) { s.statistik[schluessel] = (s.statistik[schluessel] ?? 0) + n; }

// Kartenereignis für die Anzeige in der Tischmitte.
export function kartenEreignis(s, art, karte, spieler, ergebnis) {
  const nr = (s.ereignisse.at(-1)?.nr ?? 0) + 1;
  s.ereignisse.push({ nr, art, karte, spieler, ergebnis, tag: s.tag });
  if (s.ereignisse.length > 40) s.ereignisse.shift();
}

export function wurf(s, wuerfel, zweck, i = s.aktiv) {
  // testWuerfe: nur für Regeltests (vorgegebene Würfe), sonst Zufall aus der Würfelquelle.
  const wert = s.testWuerfe?.length ? s.testWuerfe.shift() : ganz(s, 'wuerfel', 1, wuerfel);
  s.wuerfe.push({ wuerfel: `W${wuerfel}`, wert, zweck, spieler: i });
  if (s.wuerfe.length > 12) s.wuerfe.shift();
  return wert;
}

// Wurf mit Glück: misslingt er und liegt Glück bereit, wird neu geworfen, das Bessere zählt.
export function wurfMitGlueck(s, wuerfel, zweck, gelungen) {
  const w = wurf(s, wuerfel, zweck);
  if (gelungen(w) || !s.zug.neuWurf) return { wert: w, glueck: null };
  s.zug.neuWurf = false;
  const w2 = wurf(s, wuerfel, `Glück: ${zweck} neu`);
  return { wert: Math.max(w, w2), glueck: w2 };
}

// ---- Vorrat ----
export function vorratNehmen(s, art, n) {
  if (n <= 0) return 0;
  if (s.cfg.vorrat.unbegrenzt) return n;
  const da = s.vorrat[art] ?? 0;
  const g = Math.min(da, n);
  if (g < n) zaehle(s, `vorratLeer_${art}`, n - g);
  if (!s.cfg.vorrat.leerOhneErtrag) { s.vorrat[art] = da - n; return n; }
  s.vorrat[art] = da - g;
  return g;
}
export function vorratZurueck(s, art, n) {
  if (n <= 0 || s.cfg.vorrat.unbegrenzt || !s.cfg.vorrat.rueckgabe) return;
  s.vorrat[art] = (s.vorrat[art] ?? 0) + n;
}

// Rohstoff vom Vorrat in die Hand. Gibt die erhaltene Menge zurück.
export function rohstoffGeben(s, i, art, n) {
  const g = vorratNehmen(s, art, n);
  s.spieler[i].hand[art] += g;
  return g;
}
// Rohstoffe aus der Hand abgeben (zurück in den Vorrat).
export function bezahlen(s, i, kosten) {
  const p = s.spieler[i];
  for (const [art, n] of Object.entries(kosten)) {
    const m = Math.min(n ?? 0, p.hand[art]);
    p.hand[art] -= m;
    vorratZurueck(s, art, m);
  }
}
export function kannBezahlen(p, kosten) {
  return Object.entries(kosten).every(([art, n]) => p.hand[art] >= (n ?? 0));
}

// ---- Herzen und Energie ----
export function heilen(s, i, n) {
  const p = s.spieler[i];
  const vorher = p.herzen;
  p.herzen = Math.min(herzenMax(s, p), p.herzen + n);
  return p.herzen - vorher;
}
export function energieAendern(s, i, n) {
  const p = s.spieler[i];
  const vorher = p.energie;
  p.energie = Math.max(0, Math.min(energieMax(s), p.energie + n));
  return p.energie - vorher;
}

export function schaden(s, i, n, grund) {
  const p = s.spieler[i];
  if (n <= 0 || !imSpiel(p)) return 0;
  if (p.schutz) {
    p.schutz = false;
    log(s, `${grund}: kein Schaden dank Adrenalin`, i);
    return 0;
  }
  const neu = Math.max(0, p.herzen - n);
  const verlust = p.herzen - neu;
  p.herzen = neu;
  zaehle(s, 'herzVerlust', verlust);
  log(s, `${grund}: −${n} Herz${n > 1 ? 'en' : ''}`, i);
  if (neu === 0) amBoden(s, i);
  return verlust;
}

export function amBoden(s, i) {
  if (s.modus === 'pvp') return ausscheiden(s, i, 'hat keine Herzen mehr und scheidet aus');
  s.spieler[i].liegt = true;
  zaehle(s, 'amBoden');
  log(s, `liegt am Boden – ${s.modus === 'team' ? 'der Teampartner' : 'ein Mitspieler'} kann mit einer Pflanzenbandage reanimieren`, i);
}

export function ausscheiden(s, i, grund) {
  const p = s.spieler[i];
  p.ausgeschieden = true; p.liegt = false; p.herzen = 0;
  zaehle(s, 'ausgeschieden');
  if (p.route) {
    if (s.cfg.duelle.routeBeiAusscheiden === 'zurueckZumKompass') {
      const fels = Object.values(s.felder).find((f) => f.inhalt === 'vulkanfels');
      if (fels) fels.kompass = true;
    }
    s.routenAblage.push(p.route);
    p.route = null;
  }
  log(s, grund, i);
}

// ---- Felder ----
export function aufdecken(s, key) {
  const f = s.felder[key];
  if (!f || f.aufgedeckt) return f;
  f.aufgedeckt = true;
  if (f.inhalt === 'tier' && f.tier === null) {
    const t = s.tierBeutel.pop() ?? null;
    f.tier = t;
    if (!t) f.inhalt = 'leer';
  }
  return f;
}

export const feldVon = (s, i) => s.felder[s.spieler[i].feld];

export function beiFeuer(s, i) {
  const c = feldVon(s, i).coord;
  return Object.values(s.felder).some((f) => f.bau?.art === 'lagerfeuer' && f.bau.brennt && abstand(f.coord, c) <= 1);
}
export const imShelter = (s, i) => feldVon(s, i).bau?.art === 'shelter';

export function waffenBonus(s, p) {
  const w = p.ausruestung.waffe;
  return w ? s.cfg.crafting.rezepte[w]?.kampf ?? 0 : 0;
}

export function handSumme(p) {
  return ROHSTOFFE.reduce((n, r) => n + p.hand[r], 0) + p.karten.length + (p.route ? 1 : 0);
}

export const istGross = (s, tier) => tier in s.cfg.tiere.gross;
