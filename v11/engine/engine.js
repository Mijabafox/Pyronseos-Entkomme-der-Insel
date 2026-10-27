// Regel-Engine Insel-Survival V11 (Regelstand V10). Ohne Browserbezug, für Spiel und Simulation.
// API: neuePartie(cfg, optionen) · erlaubteAktionen(s) · istErlaubt(s, a) · ausfuehren(s, a)
//      entscheider(s) · handelPruefen(s, angebot) · klonen(s)
import { neueQuellen, mischen, ganz } from './rng.js';
import { abstand, nachbarn, schluessel, MITTE } from './hex.js';
import { brettAufbauen, istQuelle, STRANDRING } from './brett.js';
import { ROHSTOFFE, mal, rohstoffText, klon } from './config.js';
import {
  aktiv, imSpiel, gruppe, teamVon, gruppenSchluessel, fliehende, herzenMax, energieMax, log, logAllgemein,
  zaehle, kartenEreignis, wurf, wurfMitGlueck, rohstoffGeben, bezahlen, kannBezahlen, heilen, energieAendern,
  schaden, ausscheiden, aufdecken, feldVon, waffenBonus, istGross, leereHand, gleicheGruppe, vorratZurueck,
  MODUS_NAME, TEAM_NAMEN,
} from './kern.js';
import { effekteAnwenden, tagesMods, tagesKarteDef } from './effekte.js';
import { ketteFertig, besteTeilkette, luecken } from './feuer.js';
import { tierName, INHALT, BIOM, REZEPT } from './namen.js';

export { MODUS_NAME, TEAM_NAMEN };

// =====================================================================
// Aufbau
// =====================================================================

export function neuePartie(cfg, opt = {}) {
  const seed = (opt.seed ?? cfg.match.seed ?? 1) >>> 0;
  const modus = opt.modus ?? cfg.match.modus;
  const sitze = opt.sitze ?? Array.from({ length: cfg.match.spieler }, (_, k) => ({ name: `KI ${k + 1}`, ki: true }));
  const s = {
    cfg, seed, modus, rng: neueQuellen(seed), protokoll: opt.protokoll !== false,
    spieler: [], teams: null, aktiv: 0, tag: 1, zug: {}, felder: {},
    tierBeutel: [], tierAblage: [], spezialStapel: [], spezialAblage: [],
    routenStapel: [], routenAblage: [], tagesStapel: [], tagesKarte: null, tagesAblage: [],
    vorrat: cfg.vorrat.unbegrenzt ? null : { ...cfg.vorrat.karten },
    wuerfe: [], ende: null, sammelfeld: null, notFloss: {}, log: [], ereignisse: [],
    statistik: leereStatistik(),
    zuege: 0,
  };
  s.felder = brettAufbauen(s);
  // Tierbeutel
  const tiere = [];
  for (const gr of ['klein', 'gross']) for (const [t, n] of Object.entries(cfg.tiere[gr])) for (let k = 0; k < n; k++) tiere.push(t);
  s.tierBeutel = mischen(s, 'tier', tiere);
  s.spezialStapel = spezialStapelBauen(s);
  s.routenStapel = mischen(s, 'route', ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'].flatMap((r) => Array(cfg.routen.jeRichtung).fill(r)));
  s.tagesStapel = opt.tagesKarten ? ['lava', ...[...opt.tagesKarten].reverse()] : tagesStapelBauen(s);

  // Spieler und Charaktere
  const aktiveChar = Object.keys(cfg.charaktere).filter((c) => cfg.charaktere[c].aktiv);
  const frei = mischen(s, 'start', aktiveChar.filter((c) => !sitze.some((x) => x.charakter === c)));
  const belegt = new Set();
  const startNr = sitze.map((_, k) => {
    if (cfg.figur.startfeld.regel === 'fix') {
      const n = ((Math.round((k * STRANDRING) / sitze.length) + 3) % STRANDRING) + 1;
      belegt.add(n); return n;
    }
    let n = ganz(s, 'start', 1, STRANDRING);
    while (belegt.has(n)) n = ganz(s, 'start', 1, STRANDRING);
    belegt.add(n); return n;
  });
  const strandFeld = (n) => Object.values(s.felder).find((f) => f.kuestenNr === n);
  sitze.forEach((sitz, k) => {
    const charakter = sitz.charakter ?? frei.pop() ?? aktiveChar[k % Math.max(1, aktiveChar.length)] ?? 'jaeger';
    const f = strandFeld(startNr[k]);
    if ((f.inhalt === 'tier' || f.inhalt === 'spezial') && !cfg.figur.startfeld.tierfeldErlaubt) {
      const tausch = Object.values(s.felder).find((g) => g.kuestenNr !== null && !g.aufgedeckt && g.inhalt === 'sandbank' && !belegt.has(g.kuestenNr));
      if (tausch) tausch.inhalt = f.inhalt;
      f.inhalt = tausch ? 'sandbank' : 'leer';
    }
    aufdecken(s, f.key);
    const p = {
      id: `s${k + 1}`, index: k, name: sitz.name?.trim() || `Spieler ${k + 1}`, ki: !!sitz.ki, bot: sitz.bot ?? null,
      charakter, feld: f.key, herzen: 0, energie: cfg.figur.energie,
      ausruestung: { ...cfg.figur.startAusruestung }, hand: { ...leereHand(), ...cfg.figur.startRohstoffe },
      karten: [], route: null, schutz: false, liegt: false, ausgeschieden: false,
    };
    s.spieler.push(p);
    p.herzen = herzenMax(s, p);
    for (const r of ROHSTOFFE) if (p.hand[r] && s.vorrat) s.vorrat[r] = Math.max(0, s.vorrat[r] - p.hand[r]);
  });
  if (modus === 'team') s.teams = [s.spieler.filter((_, k) => k % 2 === 0).map((p) => p.id), s.spieler.filter((_, k) => k % 2 === 1).map((p) => p.id)];
  if (s.protokoll) {
    s.log.push(`Neue Partie mit Seed ${seed}, ${sitze.length} Spieler, Modus ${MODUS_NAME[modus]}.`);
    for (const p of s.spieler) s.log.push(`${p.name} startet auf Strandfeld ${s.felder[p.feld].kuestenNr} als ${cfg.charaktere[p.charakter]?.name ?? p.charakter}.`);
    if (s.teams) s.teams.forEach((t, k) => s.log.push(`${TEAM_NAMEN[k]}: ${t.map((id) => s.spieler.find((p) => p.id === id).name).join(' und ')}`));
  }
  tagesKarteZiehen(s);
  if (!s.ende) zugBeginnen(s);
  return s;
}

export function leereStatistik() {
  return { tageskarten: [], spezialGezogen: [], duelle: 0, raube: { rohstoff: 0, spezial: 0, route: 0 }, zurueckgesetzt: 0, wasserZugende: 0, kaempfe: 0, kaempfeVerloren: 0, kompassTag: null, feuerGebaut: 0, feuerUngueltig: 0, notFlossVersuche: 0, verlauf: [] };
}

function spezialStapelBauen(s) {
  const cfg = s.cfg, karten = cfg.spezialkarten.karten;
  const pool = [], immer = [];
  for (const [id, k] of Object.entries(karten)) {
    if (!k.aktiv) continue;
    for (let n = 0; n < (k.anzahl ?? 0); n++) (k.immerImStapel ? immer : pool).push(id);
  }
  const gezogen = mischen(s, 'spezial', pool).slice(0, Math.max(0, cfg.spezialkarten.stapel - immer.length));
  return mischen(s, 'spezial', [...immer, ...gezogen]);
}

function tagesStapelBauen(s) {
  const t = s.cfg.match.tage;
  const pool = [];
  for (const [id, k] of Object.entries(s.cfg.tageskarten.karten)) if (k.aktiv) for (let n = 0; n < (k.anzahl ?? 1); n++) pool.push(id);
  const ereignisse = mischen(s, 'tag', pool).slice(0, t.ereignisse);
  const tage = mischen(s, 'tag', [...Array(t.ruhig).fill('ruhig'), ...ereignisse]);
  return t.lava ? ['lava', ...tage] : tage;
}

// =====================================================================
// Ablauf: Tage und Züge
// =====================================================================

function tagesKarteZiehen(s) {
  const id = s.tagesStapel.pop();
  if (!id) { ende(s, 'lava', null); return; }
  if (s.tagesKarte) s.tagesAblage.push(s.tagesKarte);
  s.tagesKarte = id;
  s.statistik.tageskarten.push(id);
  const def = tagesKarteDef(s, id);
  logAllgemein(s, `Tageskarte ${def?.symbol ?? ''} ${def?.name ?? id}: ${def?.text ?? ''}`);
  if (id === 'lava') { ende(s, 'lava', null); return; }
  const merk = s.zug;
  s.zug = neuerZug(s);
  effekteAnwenden(s, s.aktiv, def?.effekte ?? [], { quelle: def?.name ?? id, standardZiel: 'alle', tageskarte: true });
  s.zug = merk;
  endePruefen(s);
}

export function neuerZug(s) {
  const c = s.cfg;
  return {
    phase: 'weitsicht_wuerfeln', wurf: null, weitsichtOffen: 0, weitsichtRadius: c.zug.weitsicht.radius,
    schritte: 0, laeuferRest: c.charaktere.laeufer.aktiv ? c.charaktere.laeufer.zusatzfelder : 0, gratisSchritte: 0,
    kampfPlus: 0, abbauFaktor: 1, neuWurf: false, messerDuell: false, kampfSieg: false, nachAufdecken: 'bewegung',
    handel: 0, kampf: null, angriffe: 0, duellGemacht: false, beute: null, wahl: null, nachher: [], zugEndeNach: false,
    getrunken: false, notFlossVersucht: false, letztesErgebnis: null, aufdeckenQuelle: null,
  };
}

function zugBeginnen(s) {
  const p = aktiv(s);
  s.zug = neuerZug(s);
  const mods = tagesMods(s);
  if (mods.weitsichtAus) s.zug.phase = 'bewegung';
  if (mods.weitsichtRadius) s.zug.weitsichtRadius = mods.weitsichtRadius;
  // Tageskarte mit «aufdecken» zu Zugbeginn (z. B. Vollmond)
  const auf = (tagesKarteDef(s)?.effekte ?? []).find((e) => e.typ === 'aufdecken');
  if (auf) {
    const c = feldVon(s, s.aktiv).coord;
    const n = Object.values(s.felder).filter((f) => !f.aufgedeckt && abstand(f.coord, c) <= (auf.radius ?? 3)).length;
    if (n > 0) {
      s.zug.nachAufdecken = s.zug.phase;
      s.zug.phase = 'weitsicht_waehlen';
      s.zug.weitsichtOffen = Math.min(auf.anzahl ?? 1, n);
      s.zug.weitsichtRadius = auf.radius ?? 3;
      s.zug.aufdeckenQuelle = tagesKarteDef(s).name;
    }
  }
  // Startfeld mit Tier (nur wenn erlaubt): Kampf ohne Flucht.
  const f = feldVon(s, s.aktiv);
  if (f.tier && s.zug.phase !== 'weitsicht_waehlen') {
    s.zug.phase = 'kampf';
    s.zug.kampf = { feld: f.key, von: f.key, tier: f.tier, hinterhalt: false, blind: true, steht: true };
  }
  void p;
}

function naechsterSpieler(s) {
  if (s.ende) return;
  const n = s.spieler.length;
  let r = s.aktiv, umlauf = false;
  for (let k = 1; k <= n; k++) {
    r = (s.aktiv + k) % n;
    if (r <= s.aktiv) umlauf = true;
    if (imSpiel(s.spieler[r])) break;
  }
  if (umlauf) {
    s.tag += 1;
    tagesTick(s);
    tagesKarteZiehen(s);
    if (s.ende) return;
    for (let k = 0; k < n && !imSpiel(s.spieler[r]); k++) r = (r + 1) % n;
  }
  if (!imSpiel(s.spieler[r])) { endePruefen(s); if (!s.ende) ende(s, 'alle_ko', null); return; }
  s.aktiv = r;
  zugBeginnen(s);
}

// Verlauf für Auswertung und Abgleich mit echten Partien.
function tagesTick(s) {
  s.statistik.verlauf.push({ tag: s.tag - 1, herzen: s.spieler.map((p) => p.herzen), energie: s.spieler.map((p) => p.energie) });
}

function rastenWert(s) {
  if (feldVon(s, s.aktiv).bau?.art === 'shelter') return s.cfg.zug.rastenShelter;
  return tagesMods(s).rastenWert ?? s.cfg.zug.rasten;
}

function zugBeenden(s) {
  const p = aktiv(s);
  if (imSpiel(p) && s.zug.schritte === 0) {
    const neu = Math.min(energieMax(s), p.energie + rastenWert(s));
    if (neu > p.energie) { log(s, `rastet: +${neu - p.energie} Energie`); p.energie = neu; }
  }
  s.zug.kampf = null;
  s.zuege += 1;
  naechsterSpieler(s);
}

function ende(s, grund, siegerId) {
  if (s.ende) return;
  let gewinner = [];
  if (siegerId) {
    const i = s.spieler.findIndex((p) => p.id === siegerId);
    gewinner = gruppe(s, i).map((k) => s.spieler[k].id);
  }
  s.ende = { grund, sieger: siegerId, gewinner, tag: s.tag };
  tagesTick({ ...s, tag: s.tag + 1, statistik: s.statistik });
  logAllgemein(s, grund === 'lava' ? 'Der Vulkan bricht aus. Alle auf der Insel verlieren.' : `Partie zu Ende: ${grund}`);
}

function endePruefen(s) {
  if (s.ende) return;
  if (s.spieler.every((p) => !imSpiel(p))) return ende(s, 'alle_ko', null);
  if (s.modus === 'pvp') {
    const rest = s.spieler.filter((p) => !p.ausgeschieden);
    if (rest.length === 1 && s.spieler.length > 1) { logAllgemein(s, `${rest[0].name} ist als Letzter übrig!`); ende(s, 'ueberlebender', rest[0].id); }
  }
  if (s.modus === 'team') {
    // Ein Team ganz ausgeschieden oder am Boden zählt nicht als Sieg (wie v10).
  }
}

// =====================================================================
// Hilfen für Regeln
// =====================================================================

const inZug = (s) => s.zug.phase === 'bewegung' || s.zug.phase === 'aktion';

export function weitsichtZiele(s) {
  const c = feldVon(s, s.aktiv).coord;
  return Object.values(s.felder).filter((f) => !f.aufgedeckt && abstand(f.coord, c) <= s.zug.weitsichtRadius).map((f) => f.key);
}

export function schrittKosten(s, ziel) {
  if (s.zug.gratisSchritte > 0 || laeuferExtra(s)) return 0;
  const m = tagesMods(s);
  let k = s.cfg.zug.schrittEnergie;
  for (const x of m.schrittMin) if (!x.biom || x.biom.includes(ziel.biom)) k = Math.max(k, x.wert);
  return k + m.schrittPlus;
}
function laeuferExtra(s) {
  const p = aktiv(s);
  return p.charakter === 'laeufer' && s.cfg.charaktere.laeufer.aktiv && p.energie === 0 && s.zug.laeuferRest > 0;
}

function bewegungsZiele(s) {
  if (s.zug.phase !== 'bewegung') return [];
  const p = aktiv(s);
  return nachbarn(feldVon(s, s.aktiv).coord).map(schluessel).filter((k) => s.felder[k] && p.energie >= schrittKosten(s, s.felder[k]));
}

export function abbauErtrag(s) {
  const p = aktiv(s), f = feldVon(s, s.aktiv), def = s.cfg.zug.ertrag[f.inhalt];
  if (!def || !f.aufgedeckt || f.tier) return null;
  const mitWerkzeug = !!(def.werkzeug && p.ausruestung[def.werkzeug]);
  const e = { ...def.basis };
  if (mitWerkzeug) for (const [k, n] of Object.entries(def.bonus ?? {})) e[k] = (e[k] ?? 0) + n;
  if (s.zug.abbauFaktor > 1) for (const k of Object.keys(e)) e[k] *= s.zug.abbauFaktor;
  return { ertrag: e, mitWerkzeug };
}
const kannAbbauen = (s) => s.zug.phase === 'bewegung' && aktiv(s).energie >= s.cfg.zug.abbauEnergie && abbauErtrag(s) !== null;

function kannKompass(s) {
  const p = aktiv(s), f = feldVon(s, s.aktiv);
  return s.zug.phase === 'bewegung' && f.aufgedeckt && f.inhalt === 'vulkanfels' && f.kompass && p.ausruestung.hacke && p.energie >= s.cfg.zug.kompassEnergie;
}

export function rezeptKosten(s, p, rezept) {
  const c = s.cfg;
  if (rezept === 'bandage' && p.charakter === 'sanitaeter' && c.charaktere.sanitaeter.aktiv) return { ...c.charaktere.sanitaeter.bandageKosten };
  return { ...c.crafting.rezepte[rezept].kosten };
}

export function craftGrund(s, rezept) {
  if (!inZug(s)) return 'nicht in dieser Phase';
  const r = s.cfg.crafting.rezepte[rezept];
  if (!r || !r.aktiv) return 'Rezept ist ausgeschaltet';
  const p = aktiv(s), f = feldVon(s, s.aktiv);
  switch (rezept) {
    case 'steinaxt': if (p.ausruestung.axt) return 'du hast schon eine Steinaxt'; break;
    case 'spitzhacke': if (p.ausruestung.hacke) return 'du hast schon eine Spitzhacke'; break;
    case 'holzspeer': case 'steinmachete': {
      const w = p.ausruestung.waffe;
      if (w && (s.cfg.crafting.rezepte[w]?.kampf ?? 0) >= (r.kampf ?? 0)) return 'du hast schon eine gleich gute Waffe';
      break;
    }
    case 'bandage': if (p.herzen >= herzenMax(s, p)) return 'du hast schon volle Herzen'; break;
    case 'lagerfeuer': case 'shelter': if (f.bau) return 'hier steht schon ein Bauwerk'; break;
  }
  return kannBezahlen(p, rezeptKosten(s, p, rezept)) ? null : 'nicht genug Rohstoffe';
}

const kannEssen = (s) => inZug(s) && aktiv(s).hand.nahrung > 0 && aktiv(s).energie < energieMax(s);

export function trinkenGrund(s) {
  const p = aktiv(s);
  if (!imSpiel(p)) return 'nicht im Spiel';
  if (!inZug(s)) return 'nicht in dieser Phase';
  if (!istQuelle(feldVon(s, s.aktiv))) return 'kein Wasserfeld';
  if (tagesMods(s).trinkenGesperrt) return 'Dürre: heute ist kein Trinken möglich';
  if (s.zug.getrunken) return 'heute schon getrunken';
  if (p.energie >= energieMax(s)) return 'Energie ist schon voll';
  return null;
}

function reanimierZiele(s) {
  if (!inZug(s)) return [];
  const p = aktiv(s);
  if (!s.cfg.crafting.rezepte.bandage.aktiv || !kannBezahlen(p, rezeptKosten(s, p, 'bandage'))) return [];
  return s.spieler.flatMap((x, k) => (x.liegt && gleicheGruppe(s, s.aktiv, k) && x.feld === p.feld ? [k] : []));
}

// ---- Routenkarte und Floss ----
export function routenBesitzer(s, mitglieder = gruppe(s)) {
  return mitglieder.find((k) => s.spieler[k].route !== null && !s.spieler[k].ausgeschieden) ?? null;
}
export function routenRichtung(s, mitglieder = gruppe(s)) {
  const b = routenBesitzer(s, mitglieder);
  return b === null ? null : s.spieler[b].route;
}
export function zielStrand(s, mitglieder = gruppe(s)) {
  const r = routenRichtung(s, mitglieder);
  return r ? Object.values(s.felder).filter((f) => f.kuestenNr !== null && f.richtung === r).map((f) => f.key) : [];
}

function sammelfeldZiele(s) {
  if (s.modus !== 'koop' || !inZug(s)) return [];
  return zielStrand(s).filter((k) => k !== s.sammelfeld);
}

export function flossKosten(s, art) {
  const f = s.cfg.fluchtwege.floss;
  return mal(art === 'not' ? f.not.proPerson : f.solide.proPerson, fliehende(s));
}
export const wrackKosten = (s) => mal(s.cfg.fluchtwege.wrack.proPerson, fliehende(s));

// Rohstoffe aller Gruppenmitglieder auf einem Feld.
export function kasseAufFeld(s, feldKey, mitglieder = gruppe(s)) {
  const k = leereHand();
  for (const i of mitglieder) if (s.spieler[i].feld === feldKey) for (const r of ROHSTOFFE) k[r] += s.spieler[i].hand[r];
  return k;
}
export function kasseGesamt(s, mitglieder = gruppe(s)) {
  const k = leereHand();
  for (const i of mitglieder) for (const r of ROHSTOFFE) k[r] += s.spieler[i].hand[r];
  return k;
}
function kasseBezahlen(s, feldKey, kosten, mitglieder = gruppe(s)) {
  const rest = { ...kosten };
  const n = s.spieler.length;
  for (let d = 0; d < n; d++) {
    const i = (s.aktiv + d) % n;
    if (!mitglieder.includes(i) || s.spieler[i].feld !== feldKey) continue;
    const teil = {};
    for (const [r, m] of Object.entries(rest)) { const x = Math.min(m, s.spieler[i].hand[r]); if (x > 0) { teil[r] = x; rest[r] = m - x; } }
    bezahlen(s, i, teil);
  }
}
function fehlendeAmOrt(s, feldKey, mitglieder = gruppe(s)) {
  return mitglieder.filter((i) => { const p = s.spieler[i]; return p.liegt || p.ausgeschieden || p.feld !== feldKey; }).length;
}

function notFlossBereit(s, feldKey) {
  const n = s.notFloss[gruppenSchluessel(s, s.aktiv)];
  return n && n.feld === feldKey ? n : null;
}

export function flossGrund(s, art) {
  const fl = s.cfg.fluchtwege.floss;
  if (!fl.aktiv || (art === 'not' && !fl.not.aktiv)) return 'dieser Fluchtweg ist ausgeschaltet';
  if (!inZug(s)) return 'nicht in dieser Phase';
  const p = aktiv(s), f = feldVon(s, s.aktiv);
  const wir = s.modus === 'pvp' ? 'du brauchst' : 'ihr braucht';
  const b = routenBesitzer(s);
  if (b === null) return `${wir} die Routenkarte (Kompass mit der Spitzhacke bergen)`;
  const r = routenRichtung(s);
  if (f.kuestenNr === null) return 'nur am Strand';
  if (f.richtung !== r) return `nur im Strandabschnitt ${r}`;
  if (tagesMods(s).flossGesperrt) return 'Sturm: heute keine Floss-Flucht';
  const fehlen = fehlendeAmOrt(s, p.feld);
  if (fehlen > 0) return `alle fliehenden Figuren müssen auf diesem Feld stehen und auf den Beinen sein (es fehlen ${fehlen})`;
  if (s.spieler[b].feld !== p.feld) return `${s.spieler[b].name} mit der Routenkarte muss auf diesem Feld stehen`;
  if (art === 'not') {
    if (s.zug.notFlossVersucht) return 'in diesem Zug wurde das Not-Floss schon versucht';
    const nf = notFlossBereit(s, p.feld);
    if (nf && fl.not.nachLandNaechsterTag && nf.tag === s.tag) return 'heute wurde das Not-Floss schon versucht – morgen geht es wieder';
    if (nf) return null;
  }
  const kosten = flossKosten(s, art);
  const kasse = kasseAufFeld(s, p.feld);
  return Object.entries(kosten).every(([k, n]) => kasse[k] >= n) ? null : `${s.modus === 'pvp' ? 'du brauchst' : 'zusammen braucht ihr'} ${rohstoffText(kosten)}`;
}

function brennspritHalter(s, feldKey) {
  if (aktiv(s).karten.includes('brennsprit')) return s.aktiv;
  return gruppe(s).find((i) => s.spieler[i].feld === feldKey && s.spieler[i].karten.includes('brennsprit')) ?? null;
}
export function wrackGrund(s) {
  const w = s.cfg.fluchtwege.wrack;
  if (!w.aktiv) return 'dieser Fluchtweg ist ausgeschaltet';
  if (!inZug(s)) return 'nicht in dieser Phase';
  const f = feldVon(s, s.aktiv);
  if (!f.aufgedeckt || f.inhalt !== 'flugzeugwrack') return 'nur auf dem Flugzeugwrack';
  const fehlen = fehlendeAmOrt(s, f.key);
  if (fehlen > 0) return `alle fliehenden Figuren müssen beim Wrack sein und auf den Beinen (es fehlen ${fehlen})`;
  if (w.brennsprit && brennspritHalter(s, f.key) === null) return `${s.modus === 'pvp' ? 'du brauchst' : 'ihr braucht'} den Brennsprit`;
  const kosten = wrackKosten(s), kasse = kasseAufFeld(s, f.key);
  return Object.entries(kosten).every(([k, n]) => kasse[k] >= n) ? null : `${s.modus === 'pvp' ? 'du brauchst' : 'zusammen braucht ihr'} ${rohstoffText(kosten)}`;
}

// ---- Küstenfeuer-Kette ----
export function feuerZeile(s, personen) {
  const t = s.cfg.fluchtwege.feuer.tabelle;
  return t[String(personen)] ?? null;
}
export const feuerPersonen = (s, mitglieder) => (s.modus === 'koop' ? s.spieler.length : mitglieder.length);

export function feuerDerGruppe(s, mitglieder = gruppe(s)) {
  const ids = s.modus === 'koop' ? null : new Set(mitglieder.map((i) => s.spieler[i].id));
  const m = new Map();
  for (const f of Object.values(s.felder)) {
    if (f.kuestenNr === null || f.bau?.art !== 'lagerfeuer' || !f.bau.brennt) continue;
    if (ids && !ids.has(f.bau.besitzer)) continue;
    m.set(f.kuestenNr, f.key);
  }
  return m;
}

export function ketteInfo(s, mitglieder = gruppe(s)) {
  const z = feuerZeile(s, feuerPersonen(s, mitglieder)) ?? { feuer: 0, abstand: 0 };
  const alle = [...feuerDerGruppe(s, mitglieder).keys()].sort((a, b) => a - b);
  const kette = besteTeilkette(alle, z.feuer, z.abstand, STRANDRING);
  return {
    mitglieder, feuer: z.feuer, abstand: z.abstand, alle, kette,
    luecken: luecken(kette, z.feuer, z.abstand, STRANDRING),
    ungueltig: alle.filter((n) => !kette.includes(n)),
    fertig: z.feuer > 0 && ketteFertig(alle, z.feuer, z.abstand, STRANDRING) !== null,
  };
}

// Würde ein Feuer auf diesem Feld zur Kette zählen? (null = kein Strandfeld)
export function feuerZaehlt(s, feldKey, mitglieder = gruppe(s)) {
  const n = s.felder[feldKey].kuestenNr;
  if (n === null) return null;
  const z = feuerZeile(s, feuerPersonen(s, mitglieder));
  if (!z) return false;
  const alle = [...feuerDerGruppe(s, mitglieder).keys()];
  if (alle.includes(n)) return true;
  return besteTeilkette([...alle, n], z.feuer, z.abstand, STRANDRING).length > besteTeilkette(alle, z.feuer, z.abstand, STRANDRING).length;
}

function ketteSiegPruefen(s) {
  if (s.ende || !s.cfg.fluchtwege.feuer.aktiv) return;
  const info = ketteInfo(s);
  if (!info.fertig) return;
  log(s, `entzündet das letzte Feuer der Küstenfeuer-Kette (${info.feuer} Feuer mit gültigem Abstand)${s.modus === 'koop' ? ' – ein Schiff sieht das Signal und holt alle ab!' : ' – ein Schiff sieht das Signal!'}`);
  ende(s, 'signalfeuer', aktiv(s).id);
}

// ---- Duelle ----
function gegner(s) {
  return s.spieler.flatMap((p, k) => (k !== s.aktiv && imSpiel(p) && !gleicheGruppe(s, s.aktiv, k) ? [k] : []));
}
function angriffsZiele(s) {
  const d = s.cfg.duelle;
  if (s.modus === 'koop' || !d.aktiv || !inZug(s) || s.zug.angriffe >= d.proZug) return [];
  const p = aktiv(s);
  if (p.energie < d.energie) return [];
  const c = feldVon(s, s.aktiv).coord;
  return gegner(s).filter((k) => abstand(feldVon(s, k).coord, c) <= d.radius);
}
function fernDuellZiele(s) {
  if (s.modus === 'koop' || !s.cfg.duelle.aktiv || !inZug(s) || s.zug.duellGemacht) return [];
  return aktiv(s).karten.includes('duell') ? gegner(s) : [];
}
export function beuteKategorien(s, verlierer) {
  const p = s.spieler[verlierer], b = s.cfg.duelle.beute, k = [];
  if (b.rohstoff && ROHSTOFFE.some((r) => p.hand[r] > 0)) k.push('rohstoff');
  if (b.spezial && p.karten.length > 0) k.push('spezial');
  if (b.route && p.route !== null) k.push('route');
  return k;
}

// ---- Spezialkarten (Joker) ----
function jokerOptionen(s) {
  const p = aktiv(s), ph = s.zug.phase, erg = [];
  const karten = s.cfg.spezialkarten.karten;
  const gesehen = new Set();
  for (const id of p.karten) {
    if (gesehen.has(id)) continue;
    gesehen.add(id);
    const def = karten[id];
    for (const o of def?.ausspielen ?? []) {
      if (!(o.phasen ?? []).includes(ph)) continue;
      if (!jokerSinnvoll(s, id, o)) continue;
      erg.push({ typ: 'joker', karte: id, wahl: o.wahl });
    }
  }
  return erg;
}
function jokerSinnvoll(s, id, o) {
  const p = aktiv(s), z = s.zug;
  if (o.bedingung?.duellMoeglich && angriffsZiele(s).length === 0 && fernDuellZiele(s).length === 0) return false;
  for (const e of o.effekte ?? []) {
    switch (e.typ) {
      case 'wurfWiederholen': if (z.neuWurf || z.phase === 'weitsicht_waehlen') return false; break;
      case 'schadenAbwehr': if (p.schutz) return false; break;
      case 'herzen': if (e.wert > 0 && p.herzen >= herzenMax(s, p)) return false; break;
      case 'energie': if (e.wert > 0 && p.energie >= energieMax(s)) return false; break;
      case 'kampfBonus': if (z.kampfPlus !== 0) return false; break;
      case 'abbauFaktor': if (z.abbauFaktor > 1) return false; break;
      case 'weitsicht': if (e.radius && z.weitsichtRadius >= e.radius) return false; break;
      case 'kampfSieg': if (e.fuer === 'duell' && z.messerDuell) return false; break;
    }
  }
  return true;
}
function karteAblegen(s, i, id) {
  const p = s.spieler[i];
  const k = p.karten.indexOf(id);
  if (k >= 0) p.karten.splice(k, 1);
  s.spezialAblage.push(id);
}

// =====================================================================
// Erlaubte Aktionen
// =====================================================================

function aktionsListe(s) {
  const a = [];
  if (kannAbbauen(s)) a.push({ typ: 'abbauen' });
  if (kannKompass(s)) a.push({ typ: 'kompassBergen' });
  for (const r of Object.keys(s.cfg.crafting.rezepte)) if (craftGrund(s, r) === null) a.push({ typ: 'craften', rezept: r });
  if (kannEssen(s)) a.push({ typ: 'essen' });
  if (trinkenGrund(s) === null) a.push({ typ: 'trinken' });
  for (const z of reanimierZiele(s)) a.push({ typ: 'reanimieren', ziel: z });
  for (const f of sammelfeldZiele(s)) a.push({ typ: 'sammelfeld', feld: f });
  for (const art of ['solide', 'not']) if (flossGrund(s, art) === null) a.push({ typ: 'flossBauen', art });
  if (wrackGrund(s) === null) a.push({ typ: 'wrackReparieren' });
  for (const z of angriffsZiele(s)) a.push({ typ: 'angreifen', ziel: z });
  for (const z of fernDuellZiele(s)) a.push({ typ: 'duell', ziel: z });
  return a;
}

export function erlaubteAktionen(s) {
  if (s.ende) return [];
  const z = s.zug;
  switch (z.phase) {
    case 'weitsicht_wuerfeln': return [{ typ: 'wuerfeln' }, ...jokerOptionen(s)];
    case 'weitsicht_waehlen': return [...weitsichtZiele(s).map((f) => ({ typ: 'aufdecken', feld: f })), ...jokerOptionen(s)];
    case 'bewegung': return [...bewegungsZiele(s).map((f) => ({ typ: 'bewegen', feld: f })), ...aktionsListe(s), ...jokerOptionen(s), { typ: 'zugBeenden' }];
    case 'aktion': return [...aktionsListe(s), ...jokerOptionen(s), { typ: 'zugBeenden' }];
    case 'kampf': return [{ typ: 'kaempfen' }, ...fluchtZiele(s).map((f) => ({ typ: 'fliehen', feld: f })), ...jokerOptionen(s)];
    case 'wahl': return z.wahl.optionen.map((o) => ({ typ: 'wahl', index: o.index }));
    case 'beute': return beuteKategorien(s, z.beute.von).map((w) => ({ typ: 'beute', wahl: w }));
    default: return [];
  }
}

const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function istErlaubt(s, a) {
  if (a.typ === 'handeln') return !s.ende && handelPruefen(s, a) === null;
  return erlaubteAktionen(s).some((x) => gleich(x, a));
}

// Wer muss jetzt entscheiden? (Beute: der Sieger, sonst die aktive Figur)
export function entscheider(s) {
  return s.zug.phase === 'beute' && s.zug.beute ? s.zug.beute.sieger : s.aktiv;
}

// =====================================================================
// Ausführen
// =====================================================================

export function ausfuehren(s, a) {
  if (!istErlaubt(s, a)) throw new Error(`Aktion nicht erlaubt in Phase ${s.zug.phase}: ${JSON.stringify(a)}`);
  const wer = s.aktiv;
  switch (a.typ) {
    case 'wuerfeln': weitsichtWuerfeln(s); break;
    case 'aufdecken': aufdeckenWahl(s, a.feld); break;
    case 'bewegen': bewegen(s, a.feld); break;
    case 'abbauen': abbauen(s); break;
    case 'kompassBergen': kompassBergen(s); break;
    case 'craften': craften(s, a.rezept); break;
    case 'essen': essen(s); break;
    case 'trinken': trinken(s); break;
    case 'reanimieren': reanimieren(s, a.ziel); break;
    case 'sammelfeld': s.sammelfeld = a.feld; log(s, `wählt Strandfeld ${s.felder[a.feld].kuestenNr} als Sammelfeld fürs Floss`); break;
    case 'flossBauen': flossBauen(s, a.art); break;
    case 'wrackReparieren': wrackReparieren(s); break;
    case 'handeln': handeln(s, a); break;
    case 'angreifen': angreifen(s, a.ziel); break;
    case 'duell': fernDuell(s, a.ziel); break;
    case 'joker': jokerSpielen(s, a.karte, a.wahl); break;
    case 'kaempfen': kaempfen(s); break;
    case 'fliehen': fliehen(s, a.feld); break;
    case 'wahl': wahlTreffen(s, a.index); break;
    case 'beute': beuteNehmen(s, a.wahl); break;
    case 'zugBeenden': zugBeenden(s); break;
  }
  nachAktion(s, wer);
  return s;
}

// Nach jeder Aktion: offene Effekte fortsetzen, «Zug endet» umsetzen, Ende prüfen.
function nachAktion(s, wer) {
  endePruefen(s);
  if (s.ende) return;
  if (s.aktiv === wer && (s.zug.phase === 'bewegung' || s.zug.phase === 'aktion') && s.zug.nachher?.length) {
    const offen = s.zug.nachher; s.zug.nachher = [];
    for (const n of offen) {
      if (effekteAnwenden(s, n.spieler, n.effekte, n.ctx)) break;
    }
    endePruefen(s);
    if (s.ende) return;
  }
  if (s.aktiv === wer && s.zug.zugEndeNach && (s.zug.phase === 'bewegung' || s.zug.phase === 'aktion')) {
    s.zug.zugEndeNach = false;
    if (imSpiel(aktiv(s))) zugBeenden(s);
  }
  if (!s.ende && !imSpiel(aktiv(s)) && s.zug.phase !== 'beute') { naechsterSpieler(s); endePruefen(s); }
}

function weitsichtWuerfeln(s) {
  const n = weitsichtZiele(s).length;
  const w = s.cfg.zug.weitsicht.wuerfel;
  const r = wurfMitGlueck(s, w, 'Weitsicht', (x) => x >= w || x >= n);
  const p = aktiv(s);
  const plus = p.charakter === 'kundschafter' && s.cfg.charaktere.kundschafter.aktiv ? s.cfg.charaktere.kundschafter.kacheln : 0;
  const k = Math.min(r.wert + plus, n);
  s.zug.wurf = r.wert;
  s.zug.weitsichtOffen = k;
  s.zug.phase = k > 0 ? 'weitsicht_waehlen' : 'bewegung';
  s.zug.nachAufdecken = 'bewegung';
  log(s, `Weitsicht: W${w} = ${r.wert}${r.glueck !== null ? ` (Glück: Neuwurf ${r.glueck}, das Bessere zählt)` : ''}${plus ? ` +${plus}` : ''} → ${k} Kachel${k === 1 ? '' : 'n'} aufdecken`);
}

function feldText(s, key) {
  const f = s.felder[key];
  const ort = f.kuestenNr !== null ? `Strandfeld ${f.kuestenNr}` : `${BIOM[f.biom]}-Feld`;
  if (!f.aufgedeckt) return ort;
  return `${ort} (${f.tier ? `${tierName(f.tier)}!` : INHALT[f.inhalt] ?? f.inhalt})`;
}

function aufdeckenWahl(s, key) {
  aufdecken(s, key);
  log(s, `deckt auf: ${feldText(s, key)}`);
  const rest = s.zug.weitsichtOffen - 1;
  if (rest > 0 && weitsichtZiele(s).length > 0) { s.zug.weitsichtOffen = rest; return; }
  const nach = s.zug.nachAufdecken;
  s.zug.weitsichtOffen = 0;
  s.zug.phase = nach;
  s.zug.nachAufdecken = 'bewegung';
  s.zug.aufdeckenQuelle = null;
  if (nach === 'weitsicht_wuerfeln') s.zug.weitsichtRadius = tagesMods(s).weitsichtRadius ?? s.cfg.zug.weitsicht.radius;
}

function bewegen(s, ziel) {
  const p = aktiv(s), von = p.feld;
  const gratis = s.zug.gratisSchritte > 0;
  const laeufer = !gratis && laeuferExtra(s);
  const kosten = Math.min(p.energie, schrittKosten(s, s.felder[ziel]));
  const warVerdeckt = !s.felder[ziel].aufgedeckt;
  s.zug.schritte += 1;
  if (gratis) s.zug.gratisSchritte -= 1;
  if (laeufer) s.zug.laeuferRest -= 1;
  p.feld = ziel;
  p.energie = Math.max(0, p.energie - kosten);
  aufdecken(s, ziel);
  log(s, `geht auf ${feldText(s, ziel)}${kosten > 0 ? `, −${kosten} Energie` : laeufer ? ' (Läufer: Zusatzfeld bei 0 Energie)' : ', gratis'}`);
  if (laeufer) zaehle(s, 'laeuferZusatzfeld');
  betreten(s, ziel, von, warVerdeckt);
}

function betreten(s, ziel, von, blind) {
  const f = s.felder[ziel];
  if (f.tier) {
    s.zug.phase = 'kampf';
    s.zug.kampf = { feld: ziel, von, tier: f.tier, hinterhalt: false, blind };
    return;
  }
  if (f.inhalt === 'spezial') { spezialfeld(s, ziel); return; }
  if (istQuelle(f) && !s.cfg.zug.wasser.durchlaufen && s.zug.phase === 'bewegung') s.zug.phase = 'aktion';
}

function spezialfeld(s, key) {
  s.felder[key].inhalt = 'leer';
  const id = s.spezialStapel.pop();
  if (!id) { log(s, 'Spezialfeld: der Stapel ist leer'); return; }
  const def = s.cfg.spezialkarten.karten[id];
  s.statistik.spezialGezogen.push({ karte: id, spieler: s.aktiv, tag: s.tag });
  const name = `Spezialkarte ${def.symbol ?? ''} ${def.name}`;
  if (def.art === 'joker') {
    if (def.nurModi && !def.nurModi.includes(s.modus)) {
      s.spezialAblage.push(id);
      kartenEreignis(s, 'sofort', id, s.aktiv, 'Im Koop ohne Wirkung');
      log(s, `${name}: im ${MODUS_NAME[s.modus].split(' ')[0]} ohne Wirkung`);
      return;
    }
    aktiv(s).karten.push(id);
    kartenEreignis(s, 'gezogen', id, s.aktiv, 'Handkarte');
    log(s, 'zieht eine Handkarte');
    return;
  }
  s.spezialAblage.push(id);
  const vorher = { herzen: aktiv(s).herzen, energie: aktiv(s).energie };
  s.zug.letztesErgebnis = null;
  effekteAnwenden(s, s.aktiv, def.effekte ?? [], { quelle: name, standardZiel: 'aktiv' });
  const p = aktiv(s);
  const teile = [];
  if (p.herzen !== vorher.herzen) teile.push(`${p.herzen > vorher.herzen ? '+' : '−'}${Math.abs(p.herzen - vorher.herzen)} Herz`);
  if (p.energie !== vorher.energie) teile.push(`${p.energie > vorher.energie ? '+' : '−'}${Math.abs(p.energie - vorher.energie)} Energie`);
  kartenEreignis(s, 'sofort', id, s.aktiv, s.zug.letztesErgebnis ?? (teile.join(', ') || 'keine Wirkung'));
}

function abbauen(s) {
  const p = aktiv(s), f = feldVon(s, s.aktiv);
  const { ertrag, mitWerkzeug } = abbauErtrag(s);
  const def = s.cfg.zug.ertrag[f.inhalt];
  let zusatz = '';
  const sm = s.cfg.charaktere.sammlerin;
  if (p.charakter === 'sammlerin' && sm.aktiv) {
    const r = wurfMitGlueck(s, sm.wuerfel, 'Sammlerin', (w) => w >= sm.schwelle);
    if (r.wert >= sm.schwelle) { const k = Object.keys(ertrag)[0]; ertrag[k] = (ertrag[k] ?? 0) + sm.bonus; zusatz = ` (Sammlerin: W${sm.wuerfel} = ${r.wert}, +${sm.bonus})`; }
    else zusatz = ` (Sammlerin: W${sm.wuerfel} = ${r.wert})`;
  }
  const erhalten = {};
  for (const [k, n] of Object.entries(ertrag)) erhalten[k] = rohstoffGeben(s, s.aktiv, k, n);
  const fehlt = Object.entries(ertrag).filter(([k, n]) => erhalten[k] < n).map(([k]) => k);
  p.energie -= s.cfg.zug.abbauEnergie;
  const doppelt = s.zug.abbauFaktor > 1;
  const name = INHALT[f.inhalt];
  f.inhalt = 'leer';
  s.zug.phase = 'aktion';
  s.zug.abbauFaktor = 1;
  zaehle(s, 'abbau');
  log(s, `baut ${name}${mitWerkzeug ? ` mit ${def.werkzeug === 'axt' ? 'Steinaxt' : 'Spitzhacke'}` : ''} ab: ${rohstoffText(erhalten)}${doppelt ? ' (Wetzstein: doppelt)' : ''}${zusatz}${fehlt.length ? ` – Vorrat leer: ${fehlt.join(', ')}` : ''}`);
}

function kompassBergen(s) {
  const p = aktiv(s), f = feldVon(s, s.aktiv);
  if (s.routenStapel.length === 0) { s.routenStapel = mischen(s, 'route', s.routenAblage); s.routenAblage = []; }
  const r = s.routenStapel.pop() ?? null;
  p.energie -= s.cfg.zug.kompassEnergie;
  p.route = r;
  f.kompass = false;
  s.zug.phase = 'aktion';
  if (s.statistik.kompassTag === null) s.statistik.kompassTag = s.tag;
  const offen = s.cfg.sichtbarkeit[s.modus].routeRichtung === 'alle';
  log(s, `birgt den Kompass mit der Spitzhacke und zieht ${offen ? `die Routenkarte (offen): Strandabschnitt ${r ?? '–'}` : 'eine Routenkarte (Richtung geheim)'} – der Zug endet`);
  kartenEreignis(s, 'route', r, s.aktiv, offen ? `Strandabschnitt ${r}` : 'Richtung geheim');
  zugBeenden(s);
}

function craften(s, rezept) {
  const p = aktiv(s), i = s.aktiv, f = feldVon(s, i);
  bezahlen(s, i, rezeptKosten(s, p, rezept));
  const n = REZEPT[rezept] ?? { name: rezept, symbol: '' };
  const r = s.cfg.crafting.rezepte[rezept];
  switch (rezept) {
    case 'seil': rohstoffGeben(s, i, 'seil', 1); break;
    case 'steinaxt': p.ausruestung.axt = true; break;
    case 'spitzhacke': p.ausruestung.hacke = true; break;
    case 'holzspeer': case 'steinmachete': p.ausruestung.waffe = rezept; break;
    case 'bandage': heilen(s, i, s.cfg.crafting.bandageHerzen); break;
    case 'lagerfeuer': {
      const zaehlt = feuerZaehlt(s, f.key);
      f.bau = { art: 'lagerfeuer', besitzer: p.id, brennt: true };
      const h = heilen(s, i, s.cfg.crafting.lagerfeuerHerzen);
      zaehle(s, 'feuerGebaut');
      if (zaehlt === false) zaehle(s, 'feuerUngueltig');
      log(s, `craftet ${n.symbol} ${n.name} (+${h} Herzen)${zaehlt === false ? ' – zählt nicht zur Küstenfeuer-Kette (Abstand zu klein)' : ''}`);
      ketteSiegPruefen(s);
      return;
    }
    case 'shelter': f.bau = { art: 'shelter', besitzer: p.id, brennt: false }; break;
    default: break;
  }
  void r;
  zaehle(s, `craft_${rezept}`);
  log(s, `craftet ${n.symbol} ${n.name}`);
}

function essen(s) {
  const p = aktiv(s);
  const neu = Math.min(energieMax(s), p.energie + s.cfg.zug.nahrungEnergie);
  const plus = neu - p.energie;
  p.energie = neu; p.hand.nahrung -= 1; vorratZurueck(s, 'nahrung', 1);
  zaehle(s, 'gegessen');
  log(s, `isst 1 Nahrung: +${plus} Energie`);
}

function trinken(s) {
  const p = aktiv(s), w = s.cfg.zug.wasser;
  const neu = Math.min(energieMax(s), w.auffuellen === 'max' ? energieMax(s) : Math.max(p.energie, w.auffuellen));
  const plus = neu - p.energie;
  p.energie = neu;
  s.zug.getrunken = true;
  zaehle(s, 'getrunken');
  if (w.zugende) {
    zaehle(s, 'wasserZugende'); s.statistik.wasserZugende += 1;
    log(s, `trinkt am Wasser: +${plus} Energie (jetzt ${neu}) – der Zug endet`);
    zugBeenden(s);
  } else log(s, `trinkt am Wasser: +${plus} Energie (jetzt ${neu})`);
}

function reanimieren(s, ziel) {
  const p = aktiv(s);
  bezahlen(s, s.aktiv, rezeptKosten(s, p, 'bandage'));
  const t = s.spieler[ziel];
  t.liegt = false; t.herzen = Math.min(herzenMax(s, t), s.cfg.figur.reanimationHerzen);
  zaehle(s, 'reanimiert');
  log(s, `reanimiert ${t.name} mit einer Pflanzenbandage`);
}

function flossBauen(s, art) {
  const p = aktiv(s), mitglieder = gruppe(s), fl = s.cfg.fluchtwege.floss;
  const kosten = flossKosten(s, art);
  const wer = s.modus === 'pvp' ? '' : s.modus === 'team' ? ' mit dem Team' : ' mit allen';
  const b = routenBesitzer(s), route = s.spieler[b].route;
  const abgeben = () => { s.spieler[b].route = null; s.routenAblage.push(route); log(s, `${s.spieler[b].name} gibt die Routenkarte ab`); };
  const zurueck = () => {
    if (s.spieler[b].ausgeschieden) return;
    s.spieler[b].route = route; s.routenAblage.pop();
    log(s, `die Routenkarte geht zurück auf die Hand von ${s.spieler[b].name}`);
  };
  if (art === 'solide') {
    kasseBezahlen(s, p.feld, kosten);
    abgeben();
    log(s, `baut${wer} ein solides Floss (${rohstoffText(kosten)}) und entkommt!`);
    delete s.notFloss[gruppenSchluessel(s, s.aktiv)];
    ende(s, 'floss', p.id);
    return;
  }
  const g = gruppenSchluessel(s, s.aktiv);
  if (notFlossBereit(s, p.feld)) log(s, `steigt${wer} aufs bereitliegende Not-Floss`);
  else { kasseBezahlen(s, p.feld, kosten); log(s, `baut${wer} ein Not-Floss (${rohstoffText(kosten)})`); }
  abgeben();
  s.zug.notFlossVersucht = true;
  s.statistik.notFlossVersuche += 1;
  const r = wurfMitGlueck(s, 6, s.modus === 'koop' ? 'Not-Floss (Gruppenwurf)' : 'Not-Floss', (w) => w > fl.not.landBis);
  if (r.glueck !== null) log(s, `Glück: Neuwurf ${r.glueck}, das bessere Ergebnis zählt`);
  if (r.wert <= fl.not.kentertBis) {
    delete s.notFloss[g];
    zurueck();
    if (s.modus === 'koop') {
      log(s, `Not-Floss: W6 = ${r.wert} – das Floss zerbricht, alle −${fl.not.schadenKoop} Herzen`);
      for (const k of mitglieder) schaden(s, k, fl.not.schadenKoop, 'Not-Floss zerbrochen');
    } else {
      log(s, `Not-Floss: W6 = ${r.wert} – das Floss kentert, K.O.`);
      for (const k of mitglieder) {
        if (s.modus === 'pvp') ausscheiden(s, k, 'gekentert – scheidet aus');
        else schaden(s, k, s.spieler[k].herzen, 'Not-Floss gekentert');
      }
    }
    zaehle(s, 'notFlossGekentert');
    return;
  }
  if (r.wert <= fl.not.landBis) {
    zurueck();
    if (fl.not.nachLandGratis) {
      s.notFloss[g] = { feld: p.feld, tag: s.tag };
      log(s, `Not-Floss: W6 = ${r.wert} – zurück an Land, das Floss bleibt liegen (nächster Versuch ohne Material${fl.not.nachLandNaechsterTag ? ', ab morgen' : ''})`);
    } else {
      delete s.notFloss[g];
      log(s, `Not-Floss: W6 = ${r.wert} – zurück an den Strand gespült, das Material ist verloren`);
    }
    zaehle(s, 'notFlossLand');
    return;
  }
  delete s.notFloss[g];
  log(s, `Not-Floss: W6 = ${r.wert} – ${s.modus === 'koop' ? 'alle schaffen es!' : 'geschafft!'}`);
  ende(s, 'notfloss', p.id);
}

function wrackReparieren(s) {
  const p = aktiv(s);
  if (s.cfg.fluchtwege.wrack.brennsprit) {
    const h = brennspritHalter(s, p.feld);
    karteAblegen(s, h, 'brennsprit');
  }
  kasseBezahlen(s, p.feld, wrackKosten(s));
  log(s, 'repariert das Flugzeugwrack und hebt ab – Flucht geglückt!');
  ende(s, 'wrack', p.id);
}

// ---- Handel ----
export function handelPartner(s) {
  const h = s.cfg.zug.handel;
  if (!h.aktiv || !inZug(s) || s.zug.handel >= h.proZug) return [];
  const c = feldVon(s, s.aktiv).coord;
  return s.spieler.flatMap((p, k) => (k !== s.aktiv && imSpiel(p) && abstand(feldVon(s, k).coord, c) <= h.radius ? [k] : []));
}
const ganzZahlig = (o) => Object.values(o ?? {}).every((n) => Number.isInteger(n) && n >= 0);
const zahl = (o) => Object.values(o ?? {}).reduce((x, n) => x + n, 0);
export function handelPruefen(s, a) {
  if (!handelPartner(s).includes(a.mit)) return 'kein Handelspartner in Reichweite (oder schon gehandelt)';
  if (!ganzZahlig(a.gebe) || !ganzZahlig(a.erhalte)) return 'ungültige Mengen';
  const max = s.cfg.zug.handel.maxKarten;
  const n1 = zahl(a.gebe) + (a.brennsprit === 'gebe' ? 1 : 0) + (a.route === 'gebe' ? 1 : 0);
  const n2 = zahl(a.erhalte) + (a.brennsprit === 'erhalte' ? 1 : 0) + (a.route === 'erhalte' ? 1 : 0);
  if (n1 === 0 && n2 === 0) return 'es wird nichts getauscht';
  if (n1 > max || n2 > max) return `höchstens ${max} Karten pro Seite`;
  const ich = aktiv(s), du = s.spieler[a.mit];
  if (!kannBezahlen(ich, a.gebe ?? {})) return 'du hast diese Karten nicht';
  if (!kannBezahlen(du, a.erhalte ?? {})) return `${du.name} hat diese Karten nicht`;
  if (a.brennsprit === 'gebe' && !ich.karten.includes('brennsprit')) return 'du hast den Brennsprit nicht';
  if (a.brennsprit === 'erhalte' && !du.karten.includes('brennsprit')) return `${du.name} hat den Brennsprit nicht`;
  if (a.route === 'gebe' && ich.route === null) return 'du hast keine Routenkarte';
  if (a.route === 'erhalte' && du.route === null) return `${du.name} hat keine Routenkarte`;
  if (a.route === 'gebe' && du.route !== null) return `${du.name} hat schon eine Routenkarte`;
  if (a.route === 'erhalte' && ich.route !== null) return 'du hast schon eine Routenkarte';
  return null;
}
function handeln(s, a) {
  const ich = aktiv(s), du = s.spieler[a.mit];
  for (const [k, n] of Object.entries(a.gebe ?? {})) { ich.hand[k] -= n; du.hand[k] += n; }
  for (const [k, n] of Object.entries(a.erhalte ?? {})) { du.hand[k] -= n; ich.hand[k] += n; }
  if (a.brennsprit) {
    const [von, zu] = a.brennsprit === 'gebe' ? [ich, du] : [du, ich];
    von.karten.splice(von.karten.indexOf('brennsprit'), 1); zu.karten.push('brennsprit');
  }
  if (a.route) {
    const [von, zu] = a.route === 'gebe' ? [ich, du] : [du, ich];
    zu.route = von.route; von.route = null;
  }
  s.zug.handel += 1;
  zaehle(s, 'handel');
  const g = [rohstoffText(a.gebe ?? {}), a.brennsprit === 'gebe' ? 'den Brennsprit' : '', a.route === 'gebe' ? 'die Routenkarte' : ''].filter((x) => x && x !== 'nichts').join(' + ');
  const e = [rohstoffText(a.erhalte ?? {}), a.brennsprit === 'erhalte' ? 'den Brennsprit' : '', a.route === 'erhalte' ? 'die Routenkarte' : ''].filter((x) => x && x !== 'nichts').join(' + ');
  log(s, e ? (g ? `handelt mit ${du.name}: gibt ${g}, erhält ${e}` : `erhält von ${du.name} ${e}`) : `schenkt ${du.name} ${g}`);
}

// ---- Kampf gegen Tiere ----
export function kampfBonus(s, p) {
  const j = s.cfg.charaktere.jaeger;
  return waffenBonus(s, p) + (p.charakter === 'jaeger' && j.aktiv ? j.kampf : 0) + s.zug.kampfPlus + tagesMods(s).kampfAlle;
}
export function tierZiel(s, tier) {
  return (istGross(s, tier) ? s.cfg.tiere.zielGross : s.cfg.tiere.zielKlein) - tagesMods(s).kampfTier;
}
export function siegChance(ziel, bonus) { return Math.min(6, Math.max(0, 7 - (ziel - bonus))) / 6; }

function fluchtZiele(s) {
  const k = s.zug.kampf;
  if (!k || k.blind || aktiv(s).energie < s.cfg.tiere.fluchtEnergie) return [];
  return nachbarn(s.felder[k.feld].coord).map(schluessel).filter((x) => s.felder[x] && x !== k.feld && !s.felder[x].tier);
}

function kaempfen(s) {
  const k = s.zug.kampf, p = aktiv(s);
  zaehle(s, 'kaempfe'); s.statistik.kaempfe += 1;
  if (s.zug.kampfSieg) { s.zug.kampfSieg = false; kampfGewonnen(s, 'mit dem Messer, ohne Würfeln'); return; }
  const bonus = kampfBonus(s, p), ziel = tierZiel(s, k.tier);
  const r = wurfMitGlueck(s, 6, `Kampf gegen ${tierName(k.tier)}`, (w) => w + bonus >= ziel);
  const text = `kämpft ${p.ausruestung.waffe ? `mit ${REZEPT[p.ausruestung.waffe]?.name}` : 'ohne Waffe'} gegen ${tierName(k.tier)}: Wurf ${r.wert}${r.glueck !== null ? ` (Glück: Neuwurf ${r.glueck})` : ''} ${bonus ? `+${bonus} ` : ''}= ${r.wert + bonus} (nötig ${ziel})`;
  s.zug.kampfPlus = 0;
  if (r.wert + bonus >= ziel) kampfGewonnen(s, text); else kampfVerloren(s, text);
}

function kampfEnde(s) {
  s.zug.phase = 'bewegung'; s.zug.kampf = null; s.zug.kampfPlus = 0; s.zug.neuWurf = false; s.zug.kampfSieg = false;
}

function kampfGewonnen(s, text) {
  const k = s.zug.kampf, p = aktiv(s), t = s.cfg.tiere;
  const n = rohstoffGeben(s, s.aktiv, 'nahrung', istGross(s, k.tier) ? t.nahrungGross : t.nahrungKlein);
  p.feld = k.feld;
  if (!k.hinterhalt) { const f = s.felder[k.feld]; f.tier = null; f.inhalt = 'leer'; }
  s.tierAblage.push(k.tier);
  zaehle(s, 'kaempfeGewonnen');
  log(s, `${text.startsWith('kämpft') ? `${text} → Sieg` : `besiegt ${tierName(k.tier)} ${text}`}: +${n} Nahrung`);
  kampfEnde(s);
}

function kampfVerloren(s, text) {
  const k = s.zug.kampf, p = aktiv(s), t = s.cfg.tiere;
  s.statistik.kaempfeVerloren += 1;
  if (k.hinterhalt) s.tierBeutel.unshift(k.tier);
  const zurueck = !k.hinterhalt && !k.steht && t.zuruecksetzen;
  if (zurueck) { p.feld = k.von; s.statistik.zurueckgesetzt += 1; }
  const wo = k.hinterhalt || k.steht ? 'bleibt auf seinem Feld' : zurueck ? `zurück auf ${feldText(s, k.von)}` : 'bleibt beim Tier';
  const gross = istGross(s, k.tier);
  kampfEnde(s);
  if (!gross && !k.hinterhalt) {
    log(s, `${text} → verloren gegen ${tierName(k.tier)}, kein Schaden – ${wo}, der Zug endet`);
    zugBeenden(s);
    return;
  }
  log(s, `${text} → verloren gegen ${tierName(k.tier)} – ${wo}, der Zug endet`);
  if (!rauchSpielen(s, s.aktiv, k.feld, k.von)) {
    const n = gross ? t.schaden[k.tier] ?? 1 : t.hinterhaltKleinSchaden;
    schaden(s, s.aktiv, n, tierName(k.tier));
  }
  if (imSpiel(aktiv(s))) zugBeenden(s);
}

function rauchSpielen(s, i, feld, bevorzugt = null) {
  const p = s.spieler[i];
  const def = s.cfg.spezialkarten.karten.rauchbombe;
  const kosten = (def?.effekte ?? []).find((e) => e.typ === 'rauch')?.energie ?? 1;
  if (!p.karten.includes('rauchbombe') || p.energie < kosten) return false;
  const sicher = (k) => s.felder[k] && !s.felder[k].tier;
  const ziel = bevorzugt && bevorzugt !== feld && sicher(bevorzugt) ? bevorzugt : nachbarn(s.felder[feld].coord).map(schluessel).find(sicher);
  if (!ziel) return false;
  karteAblegen(s, i, 'rauchbombe');
  p.feld = ziel; p.energie -= kosten;
  kartenEreignis(s, 'gespielt', 'rauchbombe', i, `0 Schaden, weicht 1 Feld aus (−${kosten} Energie)`);
  log(s, `💨 Rauch: kein Schaden, weicht auf ein sicheres Nachbarfeld aus (−${kosten} Energie)`, i);
  return true;
}

function fliehen(s, ziel) {
  const k = s.zug.kampf;
  if (k.hinterhalt) s.tierBeutel.unshift(k.tier);
  energieAendern(s, s.aktiv, -s.cfg.tiere.fluchtEnergie);
  kampfEnde(s);
  s.zug.schritte += 1;
  log(s, `flieht vor ${tierName(k.tier)}`);
  const warVerdeckt = !s.felder[ziel].aufgedeckt;
  aktiv(s).feld = ziel;
  aufdecken(s, ziel);
  betreten(s, ziel, k.feld, warVerdeckt);
}

// ---- Duelle ----
function messerImDuell(s, verteidiger, text) {
  if (s.zug.messerDuell) { s.zug.messerDuell = false; return duellErgebnis(s, verteidiger, 1, 0, `${text}: Messer – gewonnen ohne Würfeln`); }
  const v = s.spieler[verteidiger];
  if (v.karten.includes('jagdmesser')) {
    karteAblegen(s, verteidiger, 'jagdmesser');
    kartenEreignis(s, 'gespielt', 'jagdmesser', verteidiger, 'Das Duell ist ohne Würfeln gewonnen');
    return duellErgebnis(s, verteidiger, 0, 1, `${text}: ${v.name} spielt das Messer aus – gewinnt ohne Würfeln`);
  }
  return false;
}

function angreifen(s, ziel) {
  const p = aktiv(s), v = s.spieler[ziel];
  s.zug.angriffe += 1;
  energieAendern(s, s.aktiv, -s.cfg.duelle.energie);
  s.statistik.duelle += 1;
  const text = `greift ${v.name} an`;
  if (messerImDuell(s, ziel, text) !== false) return;
  const ba = waffenBonus(s, p) + s.zug.kampfPlus, bv = waffenBonus(s, v);
  let wa = wurf(s, 6, `Angriff auf ${v.name}`);
  const wv = wurf(s, 6, `${v.name} wehrt ab`, ziel);
  let g = '';
  if (wa + ba <= wv + bv && s.zug.neuWurf) { s.zug.neuWurf = false; const w2 = wurf(s, 6, 'Glück: Neuwurf'); g = ` (Glück: Neuwurf ${w2})`; wa = Math.max(wa, w2); }
  s.zug.kampfPlus = 0;
  duellErgebnis(s, ziel, wa + ba, wv + bv, `${text}: Wurf ${wa}${ba ? ` +${ba}` : ''}${g} gegen Wurf ${wv}${bv ? ` +${bv}` : ''}`);
}

function fernDuell(s, ziel) {
  karteAblegen(s, s.aktiv, 'duell');
  s.zug.duellGemacht = true;
  s.statistik.duelle += 1;
  const v = s.spieler[ziel];
  kartenEreignis(s, 'gespielt', 'duell', s.aktiv, `Duell gegen ${v.name}`);
  const text = `⚔️ fordert ${v.name} zum Duell`;
  if (messerImDuell(s, ziel, text) !== false) return;
  const wa = wurf(s, 6, `Duell gegen ${v.name}`), wv = wurf(s, 6, `${v.name} im Duell`, ziel);
  duellErgebnis(s, ziel, wa, wv, `${text}: Wurf ${wa} gegen Wurf ${wv}`);
}

function duellErgebnis(s, gegnerIdx, a, b, text) {
  if (a === b) { log(s, `${text} → Gleichstand, nichts passiert`); return true; }
  const sieg = a > b;
  log(s, `${text} → ${sieg ? 'Sieg' : 'Niederlage'}`);
  const verlierer = sieg ? gegnerIdx : s.aktiv;
  const sieger = sieg ? s.aktiv : gegnerIdx;
  zaehle(s, sieg ? 'duelleGewonnen' : 'duelleVerloren');
  if (rauchSpielen(s, verlierer, s.spieler[verlierer].feld)) return true;
  if (beuteKategorien(s, verlierer).length > 0) {
    s.zug.beute = { sieger, von: verlierer, zurueck: s.zug.phase === 'aktion' ? 'aktion' : 'bewegung' };
    s.zug.phase = 'beute';
    return true;
  }
  log(s, `${s.spieler[verlierer].name} hat nichts, was man nehmen könnte`);
  schaden(s, verlierer, s.cfg.duelle.herzen, 'Duell verloren');
  return true;
}

function beuteNehmen(s, wahl) {
  const b = s.zug.beute, von = s.spieler[b.von], zu = s.spieler[b.sieger];
  if (wahl === 'route') {
    if (zu.route) s.routenAblage.push(zu.route);
    zu.route = von.route; von.route = null;
    log(s, `wählt «Routenkarte» und nimmt ${von.name} die Routenkarte ab`, b.sieger);
  } else if (wahl === 'rohstoff') {
    const karten = ROHSTOFFE.flatMap((r) => Array(von.hand[r]).fill(r));
    const r = karten[ganz(s, 'beute', 0, karten.length - 1)];
    von.hand[r] -= 1; zu.hand[r] += 1;
    log(s, `wählt «Rohstoff» und zieht ${von.name} blind 1 Rohstoff`, b.sieger);
  } else {
    const k = ganz(s, 'beute', 0, von.karten.length - 1);
    const id = von.karten.splice(k, 1)[0];
    zu.karten.push(id);
    kartenEreignis(s, 'gezogen', id, b.sieger, `aus dem Duell gegen ${von.name}`);
    log(s, `wählt «Spezialkarte» und zieht ${von.name} blind eine Spezialkarte`, b.sieger);
  }
  s.statistik.raube[wahl] += 1;
  s.zug.phase = b.zurueck; s.zug.beute = null;
  schaden(s, b.von, s.cfg.duelle.herzen, 'Duell verloren');
}

// ---- Joker und Wahl ----
function jokerSpielen(s, id, wahl) {
  const def = s.cfg.spezialkarten.karten[id];
  const o = def.ausspielen.find((x) => x.wahl === wahl);
  karteAblegen(s, s.aktiv, id);
  log(s, `spielt ${def.symbol ?? ''} ${def.name} aus: ${o.name ?? wahl}`);
  kartenEreignis(s, 'gespielt', id, s.aktiv, o.name ?? wahl);
  zaehle(s, `joker_${id}`);
  effekteAnwenden(s, s.aktiv, o.effekte ?? [], { quelle: def.name, standardZiel: 'aktiv' });
  if (s.zug.phase === 'kampf' && s.zug.kampfSieg) { s.zug.kampfSieg = false; zaehle(s, 'kaempfe'); s.statistik.kaempfe += 1; kampfGewonnen(s, 'mit dem Messer, ohne Würfeln'); }
}

function wahlTreffen(s, index) {
  const w = s.zug.wahl;
  const o = w.optionen.find((x) => x.index === index);
  s.zug.phase = w.zurueck; s.zug.wahl = null;
  log(s, `${w.quelle}: wählt «${o.name}»`);
  effekteAnwenden(s, s.aktiv, o.effekte ?? [], w.ctx);
}

// =====================================================================
// Kopieren
// =====================================================================

// Tiefe Kopie ohne die (unveränderliche) Konfiguration. Schnell, weil die Form des Zustands bekannt ist.
export function klonen(s) {
  const k = {};
  for (const [n, v] of Object.entries(s)) {
    if (n === 'cfg') k.cfg = v;
    else if (n === 'felder') {
      const f = {};
      for (const [key, x] of Object.entries(v)) f[key] = { ...x, coord: { ...x.coord }, bau: x.bau ? { ...x.bau } : null };
      k.felder = f;
    } else if (n === 'spieler') k.spieler = v.map((p) => ({ ...p, ausruestung: { ...p.ausruestung }, hand: p.hand ? { ...p.hand } : p.hand, karten: p.karten ? [...p.karten] : p.karten }));
    else if (Array.isArray(v)) k[n] = v.every((x) => x === null || typeof x !== 'object') ? [...v] : klon(v);
    else if (v !== null && typeof v === 'object') k[n] = klon(v);
    else k[n] = v;
  }
  return k;
}

export { MITTE };
