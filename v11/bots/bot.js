// Bots für Insel-Survival V11. Ein Bot bekommt nur den Beobachtungs-Snapshot (engine/sicht.js)
// und die Liste der erlaubten Aktionen. Auf den vollen Spielzustand hat er keinen Zugriff.
// Stufen ändern nur Planungstiefe, Fehlerquote und Entscheidungsqualität, nie den Informationszugang.
import { Zufall } from '../engine/rng.js';
import { ROHSTOFFE, klon } from '../engine/config.js';
import { nachbarn, schluessel, abstand, MITTE } from '../engine/hex.js';
import { tagesMods } from '../engine/effekte.js';
import { STRANDRING, QUELLEN } from '../engine/brett.js';
import {
  feuerZaehlt, ketteInfo, routenBesitzer, zielStrand, flossGrund, rezeptKosten, craftGrund, siegChance, kampfBonus, tierZiel,
  abbauErtrag, flossKosten,
} from '../engine/engine.js';
import { Gedaechtnis } from './gedaechtnis.js';
import {
  weg, distanzen, pfadAus, ich, feldVon, istWasser, tageRest, kasse, fehlend, summe, gewichtet, feuerPlan, wegKosten, gegnerVon, gruppe,
  istGross, waffenBonus, herzenMax, inhaltsChance, strandKarte,
} from './wissen.js';
import { vorausschau } from './vorausschau.js';

export const STUFEN = {
  zufall: { name: 'Zufall (Vergleich)' },
  sehrEinfach: { name: 'Sehr einfach', fehler: 0.1, aufmerksamkeit: 0.15, kartenNutzen: 0.4, angriff: 0.25, beuteRohstoff: 0.8, wasserPlanung: false, siegwegWechsel: false, ruecksicht: false },
  einfach: { name: 'Einfach', fehler: 0.07, aufmerksamkeit: 0.08, kartenNutzen: 0.7, angriff: 0.6, beuteRohstoff: 0.5, wasserPlanung: true, siegwegWechsel: true, ruecksicht: true },
  normal: { name: 'Normal', fehler: 0.03, aufmerksamkeit: 0.03, kartenNutzen: 1, angriff: 1, beuteRohstoff: 0, wasserPlanung: true, siegwegWechsel: true, ruecksicht: true },
  gut: { name: 'Gut', fehler: 0, aufmerksamkeit: 0, kartenNutzen: 1, angriff: 1, beuteRohstoff: 0, wasserPlanung: true, siegwegWechsel: true, ruecksicht: true, vorausschau: true },
};

const NEUTRAL = { risiko: 50, kooperation: 70, aggression: 40, ungeduld: 30, sparsamkeit: 50, siegweg: 'keiner', fehlerquote: null, aufmerksamkeit: null };
const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function botErzeugen(opt) {
  return opt.stufe === 'zufall' ? new ZufallsBot(opt) : new Bot(opt);
}

// Zufalls-Bot: spielt nur gültige Züge, zufällig. Vergleichslinie für die Simulation.
export class ZufallsBot {
  constructor({ index, seed = 1 }) { this.index = index; this.stufe = 'zufall'; this.rng = new Zufall(seed); }
  entscheiden(sv, aktionen) {
    const bew = aktionen.filter((a) => a.typ === 'bewegen');
    if (bew.length && this.rng.wert() < 0.5) return this.rng.wahl(bew);
    return this.rng.wahl(aktionen);
  }
  handelAnnehmen() { return { angenommen: this.rng.wert() < 0.5, grund: 'Zufall' }; }
}

export class Bot {
  constructor({ index, stufe = 'normal', persoenlichkeit = {}, seed = 1, cfg = null, echtzeit = false }) {
    this.index = index;
    this.stufe = STUFEN[stufe] ? stufe : 'normal';
    this.s = STUFEN[this.stufe];
    const kiCfg = cfg?.ki ?? {};
    this.p = { ...NEUTRAL, ...(kiCfg.persoenlichkeit ?? {}), ...persoenlichkeit };
    const pr = (x) => Math.max(0, Math.min(100, x ?? 50)) / 100;
    this.risiko = pr(this.p.risiko); this.koop = pr(this.p.kooperation); this.aggro = pr(this.p.aggression);
    this.ungeduld = pr(this.p.ungeduld); this.spar = pr(this.p.sparsamkeit);
    this.fehler = this.p.fehlerquote == null ? this.s.fehler : this.p.fehlerquote / 100;
    this.uebersehen = this.p.aufmerksamkeit == null ? this.s.aufmerksamkeit : this.p.aufmerksamkeit / 100;
    this.rng = new Zufall(seed);
    this.mem = new Gedaechtnis(new Zufall(seed ^ 0x5bd1e995), (kiCfg.vergesslichkeit ?? 5) / 100, kiCfg.vergessenNachTagen ?? 3);
    this.siegweg = null;
    this.ziel = null;
    this.handelVersuch = null;
    this.blind = new Set();
    this.blindFuer = null;
    this.echtzeit = echtzeit;
    this.zeitbudget = kiCfg.zeitbudgetMs ?? 30;
    this.stichproben = kiCfg.stichproben ?? 4;
    this.letzterPlan = '';
  }

  // ---------------------------------------------------------------
  // Hauptentscheid
  // ---------------------------------------------------------------
  entscheiden(sv, aktionen) {
    this.cache = new Map();
    this.mem.beobachten(sv);
    this.aufmerksamkeitWuerfeln(sv);
    let a = this.entscheidenOhneFehler(sv, aktionen);
    if (this.s.vorausschau && sv.aktiv === sv.ich && (sv.zug.phase === 'bewegung' || sv.zug.phase === 'aktion')) {
      a = vorausschau(this, sv, aktionen, a) ?? a;
    }
    // Menschliche Fehler: ab und zu eine andere, aber nicht absurde Wahl.
    if (this.fehler > 0 && this.rng.wert() < this.fehler) {
      const alt = aktionen.filter((x) => ['bewegen', 'abbauen', 'craften', 'essen', 'zugBeenden', 'aufdecken'].includes(x.typ) && !this.absurd(sv, x));
      if (alt.length) a = this.rng.wahl(alt);
    }
    if (a.typ !== 'handeln' && !aktionen.some((x) => gleich(x, a))) a = aktionen.find((x) => x.typ === 'zugBeenden') ?? aktionen[0];
    return a;
  }

  // Kein absurdes Verhalten: nicht in ein bekanntes grosses Tier laufen, wenn fast tot; kein Bauwerk zerstören usw.
  absurd(sv, a) {
    const p = ich(sv);
    if (a.typ === 'bewegen') { const f = sv.felder[a.feld]; if (f.tier && istGross(sv, f.tier) && p.herzen <= 2) return true; }
    if (a.typ === 'craften' && ['lagerfeuer', 'shelter'].includes(a.rezept)) return true;
    if (a.typ === 'craften' && a.rezept === 'bandage' && p.herzen >= herzenMax(sv, p) - 1) return true;
    return false;
  }

  aufmerksamkeitWuerfeln(sv) {
    const k = `${sv.tag}:${sv.aktiv}`;
    if (this.blindFuer === k) return;
    this.blindFuer = k;
    this.blind = new Set();
    if (this.uebersehen <= 0) return;
    for (const f of Object.values(sv.felder)) if (f.aufgedeckt && f.inhalt !== 'leer' && this.rng.wert() < this.uebersehen) this.blind.add(f.key);
  }

  entscheidenOhneFehler(sv, aktionen) {
    if (!this.cache || this.cacheFuer !== sv) { this.cache = new Map(); this.cacheFuer = sv; }
    const z = sv.zug;
    if (z.phase === 'beute') return { typ: 'beute', wahl: this.beuteWahl(sv, aktionen) };
    const ziel = this.planen(sv);
    this.ziel = ziel;
    switch (z.phase) {
      case 'weitsicht_wuerfeln':
        if (this.hat(aktionen, { typ: 'joker', karte: 'fernglas', wahl: 'weitsicht' }) && this.kartenNutzen() && /erkunden|suchen|Vulkan/.test(ziel.text)) return { typ: 'joker', karte: 'fernglas', wahl: 'weitsicht' };
        return { typ: 'wuerfeln' };
      case 'weitsicht_waehlen': return this.aufdeckenWahl(sv, aktionen, ziel);
      case 'kampf': return this.kampfWahl(sv, aktionen, ziel);
      case 'wahl': return this.wahlTreffen(sv, aktionen);
      default: return this.zugWahl(sv, aktionen, ziel);
    }
  }

  hat(aktionen, a) { return aktionen.some((x) => gleich(x, a)); }

  // Distanzkarte einer Figur (pro Entscheid zwischengespeichert).
  dist(sv, i = sv.ich) {
    const k = `d${i}`;
    if (!this.cache.has(k)) {
      const opt = { meiden: i === sv.ich ? this.gefaehrlich(sv) : undefined };
      if (i === sv.ich && this.s.ruecksicht && ich(sv).route && sv.modus !== 'koop') opt.gegnerNaehe = gegnerVon(sv).map((g) => ({ coord: feldVon(sv, g).coord, radius: sv.cfg.duelle.radius }));
      if (i === sv.ich && this.stufe === 'sehrEinfach') opt.zufallsKosten = (x) => ((x.charCodeAt(0) * 7 + x.length * 13 + sv.tag) % 10) / 4;
      this.cache.set(k, distanzen(sv, sv.spieler[i].feld, opt));
    }
    return this.cache.get(k);
  }
  wegZu(sv, ziel, tierErlaubt = null, i = sv.ich) {
    return weg(sv, sv.spieler[i].feld, { ziel, tierErlaubt, dist: this.dist(sv, i) });
  }
  kartenNutzen() { return this.rng.wert() < this.s.kartenNutzen; }
  gruppe(sv) { return gruppe(sv, sv.ich); }
  botsDerGruppe(sv) { return this.gruppe(sv).filter((i) => sv.spieler[i].ki && !sv.spieler[i].ausgeschieden); }

  // ---------------------------------------------------------------
  // Siegweg wählen (und wechseln, wenn sich die Lage ändert)
  // ---------------------------------------------------------------
  // Aufwand je Fluchtweg in «Schritten»: fehlendes Material (je Karte rund 2 Schritte, verteilt auf die Gruppe)
  // plus Wege (Kompass holen, Feuerpositionen am Strand, Wrack suchen) plus Glück (Brennsprit).
  siegwegWaehlen(sv) {
    const fw = sv.cfg.fluchtwege;
    const g = this.gruppe(sv);
    const k = kasse(sv, g);
    const helfer = Math.max(1, g.filter((x) => !sv.spieler[x].ausgeschieden && !sv.spieler[x].liegt).length);
    const pos = g.map((x) => feldVon(sv, x).coord);
    const naechste = (c) => Math.min(...pos.map((q) => abstand(q, c)));
    const wege = [];
    const routeDa = routenBesitzer(sv, g) !== null;
    const kompassDa = this.kompassVerfuegbar(sv);
    const fremdeRoute = sv.spieler.some((p, i) => !g.includes(i) && p.route);
    if (fw.floss.aktiv) {
      const art = this.notFlossGeplant(sv) ? 'not' : 'solide';
      let w = gewichtet(fehlend(sv, flossKosten(sv, art), k)) * 2.2 / helfer;
      if (!routeDa) w += kompassDa ? naechste(MITTE) + 7 + 4 : fremdeRoute ? 12 + (1 - this.aggro) * 12 : 60;
      if (art === 'not') w *= 1.4; // Risiko des Not-Flosses
      wege.push(['floss', w]);
    }
    if (fw.feuer.aktiv) {
      const plan = this.feuerPlanC(sv, g);
      if (plan) {
        const kosten = wegKosten(sv, 'feuer');
        const strecke = plan.fehlen.reduce((a, n) => a + naechste(this.strand(sv, n).coord), 0);
        wege.push(['feuer', gewichtet(fehlend(sv, kosten, k)) * 2.2 / helfer + (strecke * 1.5) / helfer + plan.fehlen.length * 2]);
      }
    }
    if (fw.wrack.aktiv) {
      const wrack = Object.values(sv.felder).find((f) => f.aufgedeckt && f.inhalt === 'flugzeugwrack');
      const sprit = g.some((i) => (sv.spieler[i].karten ?? []).includes('brennsprit'));
      let w = gewichtet(fehlend(sv, wegKosten(sv, 'wrack'), k)) * 2.2 / helfer + (wrack ? naechste(wrack.coord) : 12);
      w += sprit || !fw.wrack.brennsprit ? 0 : 50;
      wege.push(['wrack', w]);
    }
    if (!wege.length) return null;
    for (const w of wege) if (w[0] === this.p.siegweg) w[1] -= 8;
    wege.sort((a, b) => a[1] - b[1]);
    this.wegBewertung = wege;
    const bester = wege[0][0];
    if (!this.siegweg || !this.s.siegwegWechsel) { this.siegweg ??= bester; return this.siegweg; }
    const jetzt = wege.find((w) => w[0] === this.siegweg);
    const marge = 2 + (1 - this.ungeduld) * 6;
    if (!jetzt || wege[0][1] + marge < jetzt[1]) this.siegweg = bester;
    return this.siegweg;
  }

  // Koop/Team: Wer sucht den Kompass? (jeder Bot rechnet gleich, aus offenen Infos)
  kompassSucher(sv) {
    const bots = this.botsDerGruppe(sv).filter((i) => !sv.spieler[i].liegt);
    if (!bots.length) return null;
    const mitHacke = bots.find((i) => sv.spieler[i].ausruestung.hacke);
    if (mitHacke !== undefined) return mitHacke;
    const kosten = (i) => abstand(feldVon(sv, i).coord, MITTE) + (sv.spieler[i].charakter === 'kundschafter' ? -1 : 0);
    return bots.reduce((a, b) => (kosten(b) < kosten(a) ? b : a));
  }

  // Mein Anteil am Gruppenbedarf (Bots teilen den Bedarf gleichmässig auf).
  meinAnteil(sv, bedarf) {
    const bots = this.botsDerGruppe(sv);
    const k = Math.max(0, bots.indexOf(sv.ich)), n = Math.max(1, bots.length);
    const a = {};
    for (const [r, m] of Object.entries(bedarf)) a[r] = Math.floor(m / n) + (k < m % n ? 1 : 0);
    return a;
  }

  // ---------------------------------------------------------------
  // Planen: Ziel für den Rest des Zugs
  // ---------------------------------------------------------------
  planen(sv) {
    const i = sv.ich, p = ich(sv), f = feldVon(sv, i), mods = tagesMods(sv);
    const hier = (text) => ({ text, ziel: (x) => x.key === f.key, amZiel: 'warten', fokus: f.coord });
    const g = this.gruppe(sv);
    const essbar = p.hand.nahrung > 0 && this.nahrungUebrig(sv) > 0;

    // 1. Überleben
    if (((sv.zug.schritte === 0 && p.energie <= 1) || p.energie === 0) && !essbar) {
      if (!mods.trinkenGesperrt) {
        const w = this.wegZu(sv, (x) => istWasser(x) && !this.blind.has(x.key));
        if (w && w.energie <= p.energie + this.laeuferPlus(sv)) return { text: 'Überleben: zur Wasserquelle', ziel: (x) => x.key === w.ziel, amZiel: 'trinken', fokus: sv.felder[w.ziel].coord };
        if (istWasser(f)) return { text: 'Überleben: trinken', ziel: (x) => x.key === f.key, amZiel: 'trinken', fokus: f.coord };
      }
      return hier('Überleben: rasten und Energie sammeln');
    }
    // 2. Reanimieren
    const liegen = g.filter((k) => sv.spieler[k].liegt);
    if (liegen.length && sv.modus !== 'pvp') {
      const opfer = liegen.reduce((a, b) => (abstand(feldVon(sv, a).coord, f.coord) <= abstand(feldVon(sv, b).coord, f.coord) ? a : b));
      const oc = feldVon(sv, opfer).coord;
      const helfer = this.botsDerGruppe(sv).filter((k) => !sv.spieler[k].liegt);
      const kosten = (k) => {
        const q = sv.spieler[k], b = rezeptKosten(sv, q, 'bandage');
        return Math.max(0, (b.blaetter ?? 0) - q.hand.blaetter) * 2 + Math.max(0, (b.nahrung ?? 0) - q.hand.nahrung) * 5 + abstand(sv.felder[q.feld].coord, oc);
      };
      const best = helfer.length ? helfer.reduce((a, b) => (kosten(b) < kosten(a) ? b : a)) : -1;
      if (best === i || (this.koop > 0.8 && kosten(i) < 8)) {
        const b = rezeptKosten(sv, p, 'bandage');
        if (ROHSTOFFE.every((r) => p.hand[r] >= (b[r] ?? 0))) return { text: `Reanimieren: zu ${sv.spieler[opfer].name}`, ziel: (x) => x.key === sv.spieler[opfer].feld, amZiel: 'warten', fokus: oc };
        const s = this.sammelZiel(sv, Object.fromEntries(Object.entries(b).filter(([r, n]) => p.hand[r] < n).map(([r, n]) => [r, n - p.hand[r]])), `Bandage für ${sv.spieler[opfer].name}`);
        if (s) return s;
      }
    }
    // 3. Schwer verletzt: vorsichtig sein, Bandage-Material holen
    const verletzt = p.herzen <= 1 + (this.risiko < 0.4 ? 1 : 0);
    if (verletzt) {
      const b = rezeptKosten(sv, p, 'bandage');
      const fehlt = Object.fromEntries(Object.entries(b).filter(([r, n]) => p.hand[r] < n).map(([r, n]) => [r, n - p.hand[r]]));
      if (summe(fehlt) > 0 && summe(fehlt) <= 2) { const s = this.sammelZiel(sv, fehlt, 'Heilen: Bandage', true); if (s) return s; }
    }
    // 4. Anfänger: erst einmal sammeln, was nahe liegt
    if (this.stufe === 'sehrEinfach' && sv.tag < 7) {
      const w = this.wegZu(sv, (x) => x.aufgedeckt && !x.tier && sv.cfg.zug.ertrag[x.inhalt] && !this.blind.has(x.key));
      if (w && w.pfad.length <= 4) return { text: 'Erst mal sammeln, was in der Nähe liegt', ziel: (x) => x.key === w.ziel, amZiel: 'abbauen', fokus: sv.felder[w.ziel].coord };
      return this.erkunden(sv, 'Insel anschauen', f.coord);
    }
    // 5. Gelegenheit: kleines Tier in der Nähe jagen, wenn Nahrung fehlt
    const siegweg = this.siegwegWaehlen(sv);
    const nahrungsBedarf = p.hand.nahrung === 0 || (siegweg && (fehlend(sv, wegKosten(sv, siegweg) ?? {}, kasse(sv, g)).nahrung ?? 0) > 0);
    if (nahrungsBedarf && p.energie >= 2) {
      const w = this.wegZu(sv, (x) => x.tier && !istGross(sv, x.tier) && !this.blind.has(x.key), () => true);
      if (w && w.pfad.length <= 2) return { text: 'Gelegenheit: kleines Tier jagen', ziel: (x) => x.key === w.ziel, amZiel: 'betreten', tierErlaubt: () => true, fokus: sv.felder[w.ziel].coord };
    }
    // 6. Gelegenheit: Spezialfeld direkt daneben
    if (p.energie >= 3 && p.herzen >= 4 && this.kompassSucher(sv) !== i) {
      const n = nachbarn(f.coord).map(schluessel).find((k) => sv.felder[k]?.aufgedeckt && sv.felder[k].inhalt === 'spezial' && !this.blind.has(k));
      if (n) return { text: 'Gelegenheit: Spezialfeld untersuchen', ziel: (x) => x.key === n, amZiel: 'betreten', fokus: sv.felder[n].coord };
    }
    if (!siegweg) return this.erkunden(sv, 'erkunden', MITTE);
    // 7. Floss: Routenkarte besorgen
    const routeDa = routenBesitzer(sv, g) !== null;
    if (siegweg === 'floss' && !routeDa) {
      const kompassFeld = Object.values(sv.felder).find((x) => x.aufgedeckt && x.inhalt === 'vulkanfels' && x.kompass);
      const fremd = sv.spieler.findIndex((q, k) => !g.includes(k) && q.route);
      const sucher = sv.modus === 'pvp' ? i : this.kompassSucher(sv);
      if (fremd >= 0 && sv.modus !== 'koop') {
        if (this.aggro >= 0.3 || this.stufe !== 'sehrEinfach') {
          const ziel = feldVon(sv, fremd);
          return { text: `Routenkarte zurückholen: ${sv.spieler[fremd].name} stellen`, ziel: (x) => abstand(x.coord, ziel.coord) <= sv.cfg.duelle.radius - 1 && !x.tier, amZiel: 'warten', fokus: ziel.coord };
        }
      } else if (sucher === i && this.kompassVerfuegbar(sv)) {
        if (!p.ausruestung.hacke) {
          const fehlt = fehlend(sv, rezeptKosten(sv, p, 'spitzhacke'), p.hand);
          if (summe(fehlt) > 0) { const s = this.sammelZiel(sv, fehlt, 'Spitzhacke für den Kompass'); if (s) return s; }
        } else if (kompassFeld) {
          return { text: 'Kompass unter dem Vulkanfels bergen', ziel: (x) => x.key === kompassFeld.key, amZiel: 'kompass', fokus: kompassFeld.coord };
        } else {
          return this.erkunden(sv, 'Vulkanfels suchen – Vulkan erkunden', MITTE, (x) => x.biom === 'vulkan');
        }
      }
    }
    // 8. Waffe früh bauen (vor dem grossen Tier)
    if (!p.ausruestung.waffe && sv.tag <= 8 && sv.cfg.crafting.rezepte.holzspeer.aktiv && !(siegweg === 'floss' && !routeDa && this.kompassSucher(sv) === i && !p.ausruestung.hacke)) {
      const fehlt = fehlend(sv, rezeptKosten(sv, p, 'holzspeer'), p.hand);
      if (summe(fehlt) > 0 && summe(fehlt) <= 2 && sv.tag >= 2) { const s = this.sammelZiel(sv, fehlt, 'Holzspeer'); if (s) return s; }
    }
    // 9. Siegweg verfolgen
    if (siegweg === 'feuer') return this.feuerZiel(sv) ?? this.erkunden(sv, 'Feuerkette: Strand erkunden', f.coord, (x) => x.kuestenNr !== null);
    const kosten = wegKosten(sv, siegweg, siegweg === 'floss' && this.notFlossGeplant(sv) ? 'not' : 'solide') ?? {};
    const gesamtFehlt = fehlend(sv, kosten, kasse(sv, g));
    if (summe(gesamtFehlt) > 0) {
      // Werkzeug vor dem Bedarf: Axt, wenn viel Holz fehlt
      if ((gesamtFehlt.holz ?? 0) >= 4 && !p.ausruestung.axt && sv.cfg.crafting.rezepte.steinaxt.aktiv && this.stufe !== 'sehrEinfach' && !g.some((k) => sv.spieler[k].ausruestung.axt)) {
        const fa = fehlend(sv, rezeptKosten(sv, p, 'steinaxt'), p.hand);
        if (summe(fa) <= 2 && summe(fa) > 0) { const s = this.sammelZiel(sv, fa, 'Steinaxt vor dem Holz'); if (s) return s; }
      }
      const s = this.sammelZiel(sv, gesamtFehlt, siegweg === 'floss' ? 'Floss-Material' : 'Wrack-Material', false, true);
      if (s) return s;
    }
    if (siegweg === 'wrack') {
      const w = Object.values(sv.felder).find((x) => x.aufgedeckt && x.inhalt === 'flugzeugwrack');
      if (w) return { text: 'Flugzeugwrack: hin und auf alle warten', ziel: (x) => x.key === w.key, amZiel: 'warten', fokus: w.coord };
      return this.erkunden(sv, 'Flugzeugwrack suchen', f.coord, (x) => x.biom === 'wald');
    }
    if (routeDa) {
      const ziel = this.sammelfeld(sv);
      if (ziel) return { text: `Floss: zum Strandfeld ${sv.felder[ziel].kuestenNr} und auf alle warten`, ziel: (x) => x.key === ziel, amZiel: 'warten', fokus: sv.felder[ziel].coord };
    }
    if (p.hand.nahrung < 2) { const s = this.sammelZiel(sv, { nahrung: 1 }, 'Reserve'); if (s) return s; }
    const vf = Object.values(sv.felder).some((x) => x.aufgedeckt && x.inhalt === 'vulkanfels');
    return vf ? hier('Anteil beisammen: warten') : this.erkunden(sv, 'Dem Kompass-Sucher helfen: Vulkan aufdecken', MITTE, (x) => x.biom === 'vulkan');
  }

  laeuferPlus(sv) {
    const p = ich(sv), c = sv.cfg.charaktere.laeufer;
    return p.charakter === 'laeufer' && c.aktiv ? c.zusatzfelder : 0;
  }

  erkunden(sv, text, fokus, filter = () => true) {
    return { text: `${text} – erkunden`, ziel: (x) => !x.aufgedeckt && filter(x), amZiel: 'betreten', fokus };
  }

  // Ziel zum Sammeln eines der fehlenden Rohstoffe (bekannte Quelle oder wahrscheinliches verdecktes Feld).
  // In der Gruppe übernimmt jeder Bot die Rohstoffe, für die er am nächsten an einer Quelle steht.
  sammelZiel(sv, fehlt, grund, vorsichtig = false, gruppenweit = false) {
    const arten = [...new Set(Object.keys(fehlt).filter((r) => (fehlt[r] ?? 0) > 0).map((r) => (r === 'seil' ? 'blaetter' : r)))];
    if (!arten.length) return null;
    const ertragPro = { holz: 2, stein: 2, blaetter: 2, abfall: 1, nahrung: 1 };
    const einheiten = (r) => Math.ceil(((r === 'blaetter' ? (fehlt.blaetter ?? 0) + 2 * (fehlt.seil ?? 0) : fehlt[r]) ?? 0) / (ertragPro[r] ?? 1));
    const bots = gruppenweit ? this.botsDerGruppe(sv).filter((k) => !sv.spieler[k].liegt) : [sv.ich];
    let bestes = null;
    for (const r of arten) {
      const w = this.quelleWeg(sv, r, vorsichtig, sv.ich);
      if (!w) continue;
      let rang = 0;
      if (bots.length > 1) for (const b of bots) if (b !== sv.ich) { const o = this.quelleWeg(sv, r, vorsichtig, b); if (o && (o.kosten < w.kosten || (o.kosten === w.kosten && b < sv.ich))) rang++; }
      const zustaendig = rang < einheiten(r);
      // Hysterese: am bisherigen Sammelziel festhalten, solange es nicht deutlich schlechter ist.
      const wert = w.kosten + (zustaendig ? 0 : 3) - (this.merkSammel === w.ziel ? 2.5 : 0);
      if (!bestes || wert < bestes.wert) {
        const zf = sv.felder[w.ziel];
        bestes = {
          wert, text: `${grund}: ${{ holz: 'Holz', stein: 'Stein', blaetter: 'Blätter', abfall: 'Abfall', nahrung: 'Nahrung' }[r]}${r === 'blaetter' && fehlt.seil ? ' (für Seil)' : ''} sammeln`,
          ziel: (x) => x.key === w.ziel, amZiel: zf.aufgedeckt && !zf.tier ? 'abbauen' : 'betreten', tierErlaubt: () => r === 'nahrung', fokus: zf.coord, rohstoff: r, feld: w.ziel,
        };
      }
    }
    if (bestes) this.merkSammel = bestes.feld;
    return bestes;
  }

  quelleWeg(sv, r, vorsichtig, i) {
    const k = `q${r}${vorsichtig ? 1 : 0}:${i}`;
    if (this.cache.has(k)) return this.cache.get(k);
    const quelle = this.quellenTest(sv, r, vorsichtig, i);
    const biome = { holz: ['wald'], stein: ['gebirge'], blaetter: ['wiese', 'wald'], abfall: ['strand'], nahrung: ['wald', 'wiese'] }[r] ?? [];
    const verdeckt = (x) => !x.aufgedeckt && x.ring >= 2 && biome.includes(x.biom);
    const w = weg(sv, sv.spieler[i].feld, { ziel: (x) => quelle(x) || verdeckt(x), tierErlaubt: (x) => r === 'nahrung' && quelle(x), dist: this.dist(sv, i) });
    if (w && !sv.felder[w.ziel].aufgedeckt) w.kosten += 1.5; // Unsicherheit
    this.cache.set(k, w);
    return w;
  }

  quellenTest(sv, r, vorsichtig, i = sv.ich) {
    const p = sv.spieler[i];
    const ertrag = sv.cfg.zug.ertrag;
    const gibt = (x) => !x.tier && ertrag[x.inhalt] && (ertrag[x.inhalt].basis[r] ?? 0) > 0;
    if (r === 'nahrung') {
      const bereit = waffenBonus(sv, p) >= 1 && p.herzen >= 3 && !vorsichtig;
      const chance = (t) => siegChance(tierZiel(sv, t), kampfBonus(sv, p));
      return (x) => x.aufgedeckt && !this.blind.has(x.key) && x.tier && ((!istGross(sv, x.tier) && chance(x.tier) >= 0.5) || (istGross(sv, x.tier) && (bereit || this.risiko > 0.8)));
    }
    return (x) => x.aufgedeckt && !this.blind.has(x.key) && gibt(x);
  }

  // Feuerkette: Strandnummern planen (gültiger Rundum-Abstand), Material in der Gruppe sammeln,
  // wer einen vollen Satz hat, baut auf der nächsten freien Position. Fehlt nichts mehr, bringen alle
  // ihr Material zum «Baumeister».
  feuerZiel(sv) {
    const p = ich(sv), g = this.gruppe(sv);
    const plan = this.feuerPlanC(sv, g);
    if (!plan) return null;
    const lk = sv.cfg.crafting.rezepte.lagerfeuer.kosten;
    const voll = (q) => q.hand && ROHSTOFFE.every((r) => q.hand[r] >= (lk[r] ?? 0));
    const freie = plan.fehlen.map((n) => this.strand(sv, n)).filter((x) => x && !x.tier && x.bau === null);
    if (voll(p) && freie.length) {
      // Positionen an die Bots mit vollem Satz verteilen (nächste zuerst).
      const bauer = this.botsDerGruppe(sv).filter((k) => !sv.spieler[k].liegt && voll(sv.spieler[k]));
      const rest = [...freie];
      let meine = null;
      const paare = [];
      for (const b of bauer) for (const f of rest) paare.push({ b, f, d: this.dist(sv, b).kosten.get(f.key) ?? 99 });
      paare.sort((x, y) => x.d - y.d || x.b - y.b || x.f.kuestenNr - y.f.kuestenNr);
      const vergeben = new Set(), fertig = new Set();
      for (const x of paare) {
        if (vergeben.has(x.f.key) || fertig.has(x.b)) continue;
        vergeben.add(x.f.key); fertig.add(x.b);
        if (x.b === sv.ich) meine = x.f;
      }
      const zf = meine ?? freie[0];
      return { text: `Feuerkette: Lagerfeuer auf Strandfeld ${zf.kuestenNr} (Plan ${plan.positionen.join(', ')})`, ziel: (x) => x.key === zf.key, amZiel: 'lagerfeuer', fokus: zf.coord };
    }
    const n = plan.fehlen.length;
    const bedarf = Object.fromEntries(Object.entries(lk).map(([r, k]) => [r, k * n]));
    const gruppeFehlt = fehlend(sv, bedarf, kasse(sv, g));
    if (summe(gruppeFehlt) > 0) {
      // Eigenen Satz zuerst vervollständigen, wenn nur wenig fehlt
      const eigen = fehlend(sv, lk, p.hand);
      if (summe(eigen) > 0 && summe(eigen) <= 2) { const s = this.sammelZiel(sv, eigen, 'Feuerkette: eigenes Lagerfeuer'); if (s) return s; }
      return this.sammelZiel(sv, gruppeFehlt, `Feuerkette (${n} Lagerfeuer)`, false, true);
    }
    // Material reicht in der Gruppe, liegt aber verteilt: zum Baumeister bringen.
    const bm = this.baumeister(sv);
    if (bm === sv.ich || bm === null) {
      const zf = freie.reduce((a, b) => ((this.dist(sv).kosten.get(b.key) ?? 99) < (this.dist(sv).kosten.get(a.key) ?? 99) ? b : a), freie[0]);
      if (zf) return { text: `Feuerkette: als Baumeister zu Strandfeld ${zf.kuestenNr}, Material kommt`, ziel: (x) => x.key === zf.key, amZiel: 'lagerfeuer', fokus: zf.coord };
      return null;
    }
    const bf = feldVon(sv, bm);
    return { text: `Feuerkette: Material zu ${sv.spieler[bm].name} bringen`, ziel: (x) => abstand(x.coord, bf.coord) <= Math.max(0, sv.cfg.zug.handel.radius - 1) && !x.tier, amZiel: 'warten', fokus: bf.coord };
  }

  feuerPlanC(sv, g = this.gruppe(sv)) {
    if (!this.cache.has('fp')) this.cache.set('fp', feuerPlan(sv, g));
    return this.cache.get('fp');
  }

  baumeister(sv) {
    const lk = sv.cfg.crafting.rezepte.lagerfeuer.kosten;
    const bots = this.botsDerGruppe(sv).filter((k) => !sv.spieler[k].liegt && sv.spieler[k].hand);
    if (!bots.length) return null;
    const wert = (k) => ROHSTOFFE.reduce((a, r) => a + Math.min(sv.spieler[k].hand[r], lk[r] ?? 0), 0) + (feldVon(sv, k).kuestenNr !== null ? 0.5 : 0);
    return bots.reduce((a, b) => (wert(b) > wert(a) ? b : a));
  }

  strand(sv, nr) { return strandKarte(sv).get(nr); }

  sammelfeld(sv) {
    const g = this.gruppe(sv);
    const ziele = zielStrand(sv, g).map((k) => sv.felder[k]);
    if (!ziele.length) return null;
    if (sv.modus === 'koop' && sv.sammelfeld && !sv.felder[sv.sammelfeld].tier) return sv.sammelfeld;
    const besitzer = routenBesitzer(sv, g);
    const da = g.map((k) => sv.spieler[k].feld).find((k) => ziele.some((z) => z.key === k && !z.tier) && sv.spieler[besitzer]?.feld === k);
    if (da) return da;
    const wert = (z) => g.reduce((s, k) => s + abstand(feldVon(sv, k).coord, z.coord), 0) + (z.tier ? 100 : 0) + (z.aufgedeckt ? 0 : 2);
    return ziele.reduce((a, b) => (wert(b) < wert(a) || (wert(b) === wert(a) && b.kuestenNr < a.kuestenNr) ? b : a)).key;
  }

  // ---------------------------------------------------------------
  // Taktik in den einzelnen Phasen
  // ---------------------------------------------------------------
  aufdeckenWahl(sv, aktionen, ziel) {
    let best = null, bw = Infinity;
    for (const a of aktionen) {
      if (a.typ !== 'aufdecken') continue;
      const f = sv.felder[a.feld];
      let w = abstand(f.coord, ziel.fokus) + (ziel.ziel(f) ? 0 : 3);
      if (ziel.rohstoff) {
        const passend = { holz: 'baum', stein: 'fels', blaetter: 'blaetterbusch', abfall: 'strandgut', nahrung: 'tier' }[ziel.rohstoff];
        w -= inhaltsChance(sv, this.mem, f.biom, passend) * 4;
      }
      if (w < bw) { bw = w; best = a; }
    }
    return best ?? aktionen[0];
  }

  kampfWahl(sv, aktionen, ziel) {
    const p = ich(sv), k = sv.zug.kampf;
    const gross = istGross(sv, k.tier);
    const chance = siegChance(tierZiel(sv, k.tier), kampfBonus(sv, p));
    const karten = this.kartenNutzen();
    if (gross && chance < 0.8 && karten) {
      for (const j of [{ typ: 'joker', karte: 'jagdmesser', wahl: 'kampf' }, { typ: 'joker', karte: 'schaerfstein', wahl: 'kampf' }, { typ: 'joker', karte: 'gluecksbringer', wahl: 'wurf' }]) if (this.hat(aktionen, j)) return j;
      if (p.herzen <= 1 && this.hat(aktionen, { typ: 'joker', karte: 'adrenalin', wahl: 'schutz' })) return { typ: 'joker', karte: 'adrenalin', wahl: 'schutz' };
    }
    const flucht = aktionen.filter((a) => a.typ === 'fliehen');
    if (!flucht.length || this.stufe === 'sehrEinfach') return { typ: 'kaempfen' };
    // Erwartungswert: Sieg = Nahrung; Niederlage = Schaden + Zurücksetzen + Zugende.
    const schaden = gross ? sv.cfg.tiere.schaden[k.tier] ?? 1 : 0;
    const herzWert = p.herzen <= 2 ? 4 : 1.6;
    const gewinn = (gross ? sv.cfg.tiere.nahrungGross : sv.cfg.tiere.nahrungKlein) * 1.5 + 1;
    const verlust = schaden * herzWert + 1.5 + (p.herzen <= schaden ? 30 : 0);
    const ew = chance * gewinn - (1 - chance) * verlust;
    const fluchtKosten = 1.2;
    if (ew + (this.risiko - 0.5) * 2 >= -fluchtKosten) return { typ: 'kaempfen' };
    return flucht.reduce((a, b) => (abstand(sv.felder[b.feld].coord, ziel.fokus) < abstand(sv.felder[a.feld].coord, ziel.fokus) ? b : a));
  }

  wahlTreffen(sv, aktionen) {
    const p = ich(sv), w = sv.zug.wahl;
    const g = this.gruppe(sv);
    const wert = (o) => {
      let v = 0;
      for (const e of o.effekte) {
        if (e.typ === 'herzen') v += e.wert * (p.herzen + e.wert <= 1 ? 6 : 1.5);
        if (e.typ === 'werkzeugVerlieren') {
          if (e.slot === 'hacke') v -= routenBesitzer(sv, g) === null && this.siegweg === 'floss' ? 5 : 1.5;
          else if (e.slot === 'axt') v -= 2.5;
          else v -= 1.5 * waffenBonus(sv, p) + 0.5;
        }
      }
      return v;
    };
    const optionen = w.optionen.map((o) => ({ a: { typ: 'wahl', index: o.index }, v: wert(o) }));
    optionen.sort((a, b) => b.v - a.v);
    return optionen[0]?.a ?? aktionen[0];
  }

  beuteWahl(sv, aktionen) {
    const opt = aktionen.map((a) => a.wahl);
    if (!opt.length) return 'rohstoff';
    if (this.stufe === 'sehrEinfach' && opt.includes('rohstoff') && this.rng.wert() < this.s.beuteRohstoff) return 'rohstoff';
    const g = gruppe(sv, sv.zug.beute?.sieger ?? sv.ich);
    if (opt.includes('route') && routenBesitzer(sv, g) === null) return 'route';
    const bedarf = this.siegweg ? summe(fehlend(sv, wegKosten(sv, this.siegweg) ?? {}, kasse(sv, g))) : 0;
    if (opt.includes('rohstoff') && bedarf >= 3) return 'rohstoff';
    if (opt.includes('spezial')) return 'spezial';
    return opt.includes('rohstoff') ? 'rohstoff' : opt[0];
  }

  // Bewegungs- und Aktionsphase: Reihenfolge Flucht, Hilfe, Duell, Notfall, Ziel-Aktion, Bewegung, Abbau, Crafting, Trinken, Zugende.
  zugWahl(sv, aktionen, ziel) {
    const p = ich(sv), f = feldVon(sv, sv.ich), z = sv.zug, mods = tagesMods(sv);
    const hat = (a) => this.hat(aktionen, a);
    // Flucht
    if (hat({ typ: 'wrackReparieren' })) return { typ: 'wrackReparieren' };
    if (hat({ typ: 'flossBauen', art: 'solide' })) return { typ: 'flossBauen', art: 'solide' };
    if (hat({ typ: 'flossBauen', art: 'not' }) && this.notFlossJetzt(sv)) return { typ: 'flossBauen', art: 'not' };
    // Reanimieren
    const rea = aktionen.find((a) => a.typ === 'reanimieren');
    if (rea) return rea;
    // Duelle
    const d = this.duellWahl(sv, aktionen);
    if (d) return d;
    // Koop: Sammelfeld wählen
    if (sv.modus === 'koop' && routenBesitzer(sv, this.gruppe(sv)) !== null && (!sv.sammelfeld || sv.felder[sv.sammelfeld].tier)) {
      const sf = this.sammelfeld(sv);
      if (sf && hat({ typ: 'sammelfeld', feld: sf })) return { typ: 'sammelfeld', feld: sf };
    }
    // Notfall-Karten
    const nk = this.notfallKarten(sv, aktionen);
    if (nk) return nk;
    // Essen
    const essenBei = this.spar > 0.65 ? 0 : this.spar > 0.35 ? 1 : 2;
    if (hat({ typ: 'essen' }) && p.energie <= essenBei && this.nahrungUebrig(sv) > 0) return { typ: 'essen' };
    if (hat({ typ: 'essen' }) && p.energie === 0 && this.zielWeit(sv, ziel) && (this.nahrungUebrig(sv) > 0 || p.herzen <= 1)) return { typ: 'essen' };
    // Am Ziel
    const amZiel = ziel.ziel(f) && ziel.amZiel !== 'betreten';
    if (amZiel) {
      if (ziel.amZiel === 'kompass' && hat({ typ: 'kompassBergen' })) return { typ: 'kompassBergen' };
      if (ziel.amZiel === 'lagerfeuer' && hat({ typ: 'craften', rezept: 'lagerfeuer' }) && feuerZaehlt(sv, f.key, this.gruppe(sv)) !== false) return { typ: 'craften', rezept: 'lagerfeuer' };
      if (ziel.amZiel === 'abbauen' && hat({ typ: 'abbauen' })) {
        if (hat({ typ: 'joker', karte: 'schaerfstein', wahl: 'abbau' }) && this.kartenNutzen()) return { typ: 'joker', karte: 'schaerfstein', wahl: 'abbau' };
        return { typ: 'abbauen' };
      }
    }
    // Werkzeug vor dem Bedarf craften (vor dem Abbau)
    const c = this.craftWahl(sv, aktionen, ziel);
    if (c && c.rezept !== 'lagerfeuer') return c; // Werkzeug, Waffe, Seil, Bandage sofort (kostet keine Energie)
    // Unterwegs abbauen, wenn das Ziel heute ohnehin nicht erreichbar ist (spart Wege und Energie)
    if (hat({ typ: 'abbauen' }) && !amZiel && this.stufe !== 'sehrEinfach' && this.abbauNuetzlich(sv)) {
      const w = this.wegZu(sv, ziel.ziel, ziel.tierErlaubt);
      if (!w || w.energie > p.energie || p.energie <= 1) return { typ: 'abbauen' };
    }
    // Bewegen
    if (z.phase === 'bewegung' && !amZiel) {
      const b = this.bewegungWahl(sv, aktionen, ziel);
      if (b) return b;
    }
    // Abbau, wenn nützlich
    if (hat({ typ: 'abbauen' }) && this.abbauNuetzlich(sv)) return { typ: 'abbauen' };
    // Crafting
    if (c) return c;
    // Handel / Schenken
    const h = this.handelWahl(sv);
    if (h) return h;
    // Trinken als letzte Aktion
    if (hat({ typ: 'trinken' }) && this.trinkenSinnvoll(sv, ziel)) return { typ: 'trinken' };
    if (hat({ typ: 'essen' }) && p.energie <= 1 && this.nahrungUebrig(sv) > 0 && z.schritte > 0) return { typ: 'essen' };
    return { typ: 'zugBeenden' };
  }

  zielWeit(sv, ziel) {
    const p = ich(sv);
    if (ziel.ziel(feldVon(sv, sv.ich))) return false;
    const w = this.wegZu(sv, ziel.ziel, ziel.tierErlaubt);
    return w && w.energie > p.energie;
  }

  notFlossJetzt(sv) {
    const rest = tageRest(sv);
    const nf = sv.notFloss?.[sv.modus === 'koop' ? 'alle' : sv.modus === 'team' ? `team${sv.spieler[sv.ich].team}` : sv.spieler[sv.ich].id];
    const gratis = nf && nf.feld === ich(sv).feld;
    const solideKosten = flossKosten(sv, 'solide');
    const solideFehlt = summe(fehlend(sv, solideKosten, kasse(sv, this.gruppe(sv))));
    if (gratis) return rest <= 6 + this.risiko * 6 || solideFehlt > 3;
    return this.notFlossGeplant(sv) || (solideFehlt >= 6 && rest <= 8 && this.risiko > 0.6);
  }

  notFlossGeplant(sv) {
    if (!sv.cfg.fluchtwege.floss.not.aktiv) return false;
    const rest = tageRest(sv);
    const solideFehlt = summe(fehlend(sv, flossKosten(sv, 'solide'), kasse(sv, this.gruppe(sv))));
    return rest <= 4 + Math.round(this.ungeduld * 3 + this.risiko * 2) || (rest <= 9 && solideFehlt >= 10);
  }

  // Nahrung, die ich essen darf, ohne der Gruppe Floss- oder Wrack-Nahrung wegzunehmen.
  nahrungUebrig(sv) {
    const p = ich(sv), g = this.gruppe(sv);
    if (!this.siegweg || this.siegweg === 'feuer') return p.hand.nahrung;
    const bedarf = (wegKosten(sv, this.siegweg, this.siegweg === 'floss' && this.notFlossGeplant(sv) ? 'not' : 'solide') ?? {}).nahrung ?? 0;
    const andere = kasse(sv, g).nahrung - p.hand.nahrung;
    const reserve = Math.max(0, Math.min(p.hand.nahrung, bedarf - andere));
    return p.hand.nahrung - reserve;
  }

  notfallKarten(sv, aktionen) {
    const p = ich(sv), hat = (a) => this.hat(aktionen, a);
    if (!this.kartenNutzen()) return null;
    if (p.herzen <= 2 && hat({ typ: 'joker', karte: 'proviant', wahl: 'herzen' })) return { typ: 'joker', karte: 'proviant', wahl: 'herzen' };
    if (p.energie <= (this.stufe === 'sehrEinfach' ? 3 : 1) && hat({ typ: 'joker', karte: 'proviant', wahl: 'energie' })) return { typ: 'joker', karte: 'proviant', wahl: 'energie' };
    if (p.herzen <= 1 && hat({ typ: 'joker', karte: 'adrenalin', wahl: 'schutz' })) return { typ: 'joker', karte: 'adrenalin', wahl: 'schutz' };
    return null;
  }

  abbauNuetzlich(sv) {
    const p = ich(sv), f = feldVon(sv, sv.ich);
    if (this.stufe === 'sehrEinfach') return true;
    const e = abbauErtrag(sv);
    if (!e) return false;
    const g = this.gruppe(sv);
    const bedarf = { ...(this.siegweg ? wegKosten(sv, this.siegweg) ?? {} : {}) };
    if (!p.ausruestung.waffe && sv.tag <= 8) for (const [r, n] of Object.entries(rezeptKosten(sv, p, 'holzspeer'))) bedarf[r] = (bedarf[r] ?? 0) + n;
    if (!p.ausruestung.hacke && this.siegweg === 'floss' && routenBesitzer(sv, g) === null && this.kompassVerfuegbar(sv) && this.kompassSucher(sv) === sv.ich) for (const [r, n] of Object.entries(rezeptKosten(sv, p, 'spitzhacke'))) bedarf[r] = (bedarf[r] ?? 0) + n;
    bedarf.blaetter = (bedarf.blaetter ?? 0) + 2 * (bedarf.seil ?? 0) + 2;
    const k = kasse(sv, g);
    void f;
    return Object.keys(e.ertrag).some((r) => (bedarf[r] ?? 0) > (k[r] ?? 0));
  }

  kompassVerfuegbar(sv) {
    const fels = Object.values(sv.felder).filter((f) => f.biom === 'vulkan');
    return fels.some((f) => !f.aufgedeckt || (f.inhalt === 'vulkanfels' && f.kompass));
  }

  craftWahl(sv, aktionen, ziel) {
    const p = ich(sv), hat = (r) => this.hat(aktionen, { typ: 'craften', rezept: r });
    const g = this.gruppe(sv);
    const rest = tageRest(sv);
    if (p.herzen <= 2 && hat('bandage') && !g.some((k) => sv.spieler[k].liegt)) return { typ: 'craften', rezept: 'bandage' };
    const sucher = this.kompassSucher(sv) === sv.ich && this.siegweg === 'floss' && routenBesitzer(sv, g) === null && this.kompassVerfuegbar(sv);
    if (sucher && hat('spitzhacke')) return { typ: 'craften', rezept: 'spitzhacke' };
    // Seil aus Blättern, wenn Seil gebraucht wird
    if (hat('seil')) {
      const kosten = this.siegweg ? wegKosten(sv, this.siegweg) ?? {} : {};
      const k = kasse(sv, g);
      const brauchtSeil = (kosten.seil ?? 0) > k.seil || (sucher && !p.ausruestung.hacke && p.hand.seil < 1) || (!p.ausruestung.waffe && sv.tag <= 8 && p.hand.seil < 1);
      const blattReserve = Math.max(0, (kosten.blaetter ?? 0) - (k.blaetter - p.hand.blaetter));
      if (brauchtSeil && p.hand.blaetter - 2 >= Math.min(blattReserve, p.hand.blaetter - 2)) return { typ: 'craften', rezept: 'seil' };
    }
    // Waffe früh, aber nicht auf Kosten der Spitzhacke
    if (!p.ausruestung.waffe && hat('holzspeer') && sv.tag <= 8) {
      const hacke = sucher && !p.ausruestung.hacke ? rezeptKosten(sv, p, 'spitzhacke') : {};
      const speer = rezeptKosten(sv, p, 'holzspeer');
      if (ROHSTOFFE.every((r) => p.hand[r] >= (speer[r] ?? 0) + (hacke[r] ?? 0))) return { typ: 'craften', rezept: 'holzspeer' };
    }
    // Steinaxt nur, wenn sie sich noch lohnt (genug Tage, viel Holz fehlt, noch niemand in der Gruppe hat eine)
    if (hat('steinaxt') && this.stufe !== 'sehrEinfach' && rest >= 8 && !g.some((k) => sv.spieler[k].ausruestung.axt)) {
      const holz = this.siegweg ? (fehlend(sv, wegKosten(sv, this.siegweg) ?? {}, kasse(sv, g)).holz ?? 0) : 0;
      if (holz >= 4) return { typ: 'craften', rezept: 'steinaxt' };
    }
    if (ziel.amZiel === 'lagerfeuer' && ziel.ziel(feldVon(sv, sv.ich)) && hat('lagerfeuer')) return { typ: 'craften', rezept: 'lagerfeuer' };
    if (p.herzen <= 1 && hat('lagerfeuer') && (this.siegweg !== 'feuer' || feuerZaehlt(sv, p.feld, g) === true)) return { typ: 'craften', rezept: 'lagerfeuer' };
    return null;
  }

  trinkenSinnvoll(sv, ziel) {
    const p = ich(sv);
    if (p.energie >= 5) return false;
    if (p.energie <= 2) return true;
    if (sv.zug.phase === 'bewegung' && !this.zielWeit(sv, ziel)) return false;
    if (!this.s.wasserPlanung) return p.energie <= 3;
    const amZiel = ziel.ziel(feldVon(sv, sv.ich));
    if (ziel.amZiel === 'trinken') return true;
    if (amZiel && ziel.amZiel === 'warten') return true;
    // Rasten bringt nur ohne Schritte etwas; nach Schritten ist Trinken besser.
    return sv.zug.schritte > 0 || p.energie + (sv.cfg.zug.rasten) < sv.cfg.figur.energie;
  }

  bewegungWahl(sv, aktionen, ziel) {
    const p = ich(sv), f = feldVon(sv, sv.ich), mods = tagesMods(sv);
    const w = this.wegZu(sv, ziel.ziel, ziel.tierErlaubt);
    if (!w || !w.pfad.length) return null;
    const bew = { typ: 'bewegen', feld: w.pfad[0] };
    if (!this.hat(aktionen, bew)) return null;
    // Läufer: Zusatzfeld bei 0 Energie gezielt nutzen (nur wenn es weiterbringt)
    if (p.energie === 0) return this.laeuferPlus(sv) > 0 && sv.zug.laeuferRest > 0 ? bew : null;
    if (w.energie <= p.energie) {
      if (w.pfad.length >= 4 && p.energie <= 3 && this.kartenNutzen() && this.hat(aktionen, { typ: 'joker', karte: 'adrenalin', wahl: 'schritte' })) return { typ: 'joker', karte: 'adrenalin', wahl: 'schritte' };
      return bew;
    }
    // Ziel heute nicht erreichbar: Laufstrecke an einer Wasserquelle enden lassen (Trinken = letzte Aktion).
    if (this.s.wasserPlanung && !mods.trinkenGesperrt) {
      if (istWasser(f) && p.energie <= 2 && !sv.zug.getrunken) return null; // hier trinken
      const d = this.dist(sv);
      const zielC = sv.felder[w.ziel].coord;
      const jetzt = abstand(f.coord, zielC);
      let bestW = null, bw = Infinity;
      for (const [k, e] of d.energie) {
        const q = sv.felder[k];
        // Wasser am Ende der heutigen Laufstrecke (oder bei wenig Energie irgendwo in Reichweite)
        if (k === p.feld || e > p.energie || !istWasser(q) || this.blind.has(k) || q.tier) continue;
        if (p.energie > 3 && e < p.energie - 2) continue;
        const rest = abstand(q.coord, zielC);
        if ((p.energie > 3 && rest > jetzt + 1) || rest > sv.cfg.figur.energie + 2) continue;
        const wert = rest + e * 0.3;
        if (wert < bw) { bw = wert; bestW = k; }
      }
      if (bestW) {
        const pf = pfadAus(d, bestW);
        const nb = { typ: 'bewegen', feld: pf[0] };
        if (this.hat(aktionen, nb)) return nb;
      }
    }
    // Wenig Energie, kein Wasser in Reichweite: Quelle direkt nebenan abbauen oder rasten (Rasten zählt nur ohne Schritte).
    if (this.s.wasserPlanung && sv.zug.schritte === 0 && p.energie <= 2) {
      if (ziel.rohstoff) {
        const nb = nachbarn(f.coord).map(schluessel).find((k) => { const q = sv.felder[k]; return q && q.aufgedeckt && !q.tier && !this.blind.has(k) && (sv.cfg.zug.ertrag[q.inhalt]?.basis[ziel.rohstoff] ?? 0) > 0; });
        if (nb && this.hat(aktionen, { typ: 'bewegen', feld: nb })) return { typ: 'bewegen', feld: nb };
      }
      return null;
    }
    return p.energie >= this.schrittKosten(sv, sv.felder[w.pfad[0]]) ? bew : null;
  }

  schrittKosten(sv, ziel) {
    const mods = tagesMods(sv);
    let k = sv.cfg.zug.schrittEnergie;
    for (const x of mods.schrittMin) if (!x.biom || x.biom.includes(ziel.biom)) k = Math.max(k, x.wert);
    if (sv.zug.gratisSchritte > 0) return 0;
    return k + mods.schrittPlus;
  }

  // Bekannte grosse Tiere meiden, wenn schwach.
  gefaehrlich(sv) {
    if (this.cache?.has('gef')) return this.cache.get('gef');
    const m = this.gefaehrlichNeu(sv);
    this.cache?.set('gef', m);
    return m;
  }
  gefaehrlichNeu(sv) {
    const p = ich(sv), m = new Set();
    const stark = waffenBonus(sv, p) >= 1 && p.herzen >= 3;
    for (const f of Object.values(sv.felder)) if (f.tier && istGross(sv, f.tier) && !stark) m.add(f.key);
    return m;
  }

  duellWahl(sv, aktionen) {
    if (sv.modus === 'koop') return null;
    const p = ich(sv);
    const g = this.gruppe(sv);
    if (this.stufe === 'sehrEinfach' && this.rng.wert() > this.s.angriff * 0.3) return null;
    const habenRoute = routenBesitzer(sv, g) !== null;
    let best = null, bw = 0;
    for (const a of aktionen) {
      if (a.typ !== 'angreifen' && a.typ !== 'duell') continue;
      const q = sv.spieler[a.ziel];
      const meinB = a.typ === 'duell' ? 0 : waffenBonus(sv, p) + sv.zug.kampfPlus;
      const seinB = a.typ === 'duell' ? 0 : waffenBonus(sv, q);
      let sieg = 0, nieder = 0;
      for (let x = 1; x <= 6; x++) for (let y = 1; y <= 6; y++) { if (x + meinB > y + seinB) sieg++; else if (x + meinB < y + seinB) nieder++; }
      sieg /= 36; nieder /= 36;
      const vorteil = sieg - nieder;
      let w = 0;
      if (!habenRoute && q.route) w = 10 + vorteil * 4;
      else if (sv.modus === 'pvp' && q.herzen <= sv.cfg.duelle.herzen && vorteil > 0) w = 6 + vorteil;
      else if (vorteil >= 0.3 && q.anzahlRohstoffe + q.anzahlKarten >= 3) w = 1.5 + vorteil * 2;
      w *= 0.5 + this.aggro;
      if (p.herzen <= 1 || (p.herzen <= 2 && vorteil < 0.2)) w = 0;
      if (p.route && vorteil < 0.2) w = 0; // mit der Routenkarte kein unnötiges Risiko
      const schwelle = 2.2 - this.aggro * 1.5;
      if (w > schwelle && w > bw) { bw = w; best = a; }
    }
    return best;
  }

  // Koop/Team: Material verschenken, wenn ein Mitspieler es dringender braucht. PvP: Tausch nur mit beidseitigem Nutzen.
  handelWahl(sv) {
    const p = ich(sv), z = sv.zug;
    const h = sv.cfg.zug.handel;
    if (!h.aktiv || z.handel >= h.proZug) return null;
    const schluessel = `${sv.tag}:${sv.aktiv}`;
    if (this.handelVersuch === schluessel) return null;
    const c = feldVon(sv, sv.ich).coord;
    const nah = sv.spieler.filter((q, k) => k !== sv.ich && !q.liegt && !q.ausgeschieden && abstand(sv.felder[q.feld].coord, c) <= h.radius);
    if (!nah.length) return null;
    const g = this.gruppe(sv);
    if (sv.modus === 'pvp' || this.koop < 0.3) return null;
    // Feuerkette: wer einen Satz bauen kann (Baumeister oder am Strand), bekommt das fehlende Material.
    const lk = sv.cfg.crafting.rezepte.lagerfeuer.kosten;
    const bm = this.siegweg === 'feuer' ? this.baumeister(sv) : null;
    const ichVoll = ROHSTOFFE.every((r) => p.hand[r] >= (lk[r] ?? 0));
    for (const q of nah) {
      if (!g.includes(q.index) || !q.hand) continue;
      if (this.siegweg === 'feuer' && (q.index === bm || (feldVon(sv, q.index).kuestenNr !== null && !ichVoll))) {
        const fehlt = fehlend(sv, lk, q.hand);
        const gebe = {};
        let n = 0;
        for (const [r, m] of Object.entries(fehlt)) {
          const frei = p.hand[r] - (ichVoll && sv.ich !== bm ? lk[r] ?? 0 : 0);
          const x = Math.min(m, frei, h.maxKarten - n);
          if (x > 0) { gebe[r] = x; n += x; }
        }
        if (n > 0) { this.handelVersuch = schluessel; return { typ: 'handeln', mit: q.index, gebe, erhalte: {} }; }
      }
      // Bandage-Material für einen Verletzten
      if (q.herzen <= 1 && p.hand.blaetter >= 2 && p.hand.nahrung >= 1 && p.herzen >= 4) { this.handelVersuch = schluessel; return { typ: 'handeln', mit: q.index, gebe: { blaetter: 2, nahrung: 1 }, erhalte: {} }; }
    }
    return null;
  }

  // Wird von der Spielleitung gefragt, wenn ein anderer ein Angebot macht.
  handelAnnehmen(sv, angebot, von) {
    const gruppe_ = gruppe(sv, sv.ich).includes(von);
    if (angebot.brennsprit === 'erhalte' && !gruppe_) return { angenommen: false, grund: 'den Brennsprit gebe ich nicht her' };
    if (angebot.route === 'erhalte' && !gruppe_) return { angenommen: false, grund: 'die Routenkarte gebe ich nicht her' };
    const wert = (r) => (r === 'nahrung' ? 2 : r === 'seil' ? 2 : 1);
    const geben = Object.entries(angebot.erhalte ?? {}).reduce((s, [r, n]) => s + n * wert(r), 0) + (angebot.brennsprit === 'erhalte' ? 4 : 0);
    const bekommen = Object.entries(angebot.gebe ?? {}).reduce((s, [r, n]) => s + n * wert(r), 0) + (angebot.brennsprit === 'gebe' ? 4 : 0) + (angebot.route === 'gebe' ? 8 : 0);
    if (geben === 0) return { angenommen: true, grund: gruppe_ ? 'danke, das hilft uns allen' : 'danke' };
    if (gruppe_) return bekommen + 2 * this.koop >= geben ? { angenommen: true, grund: 'gerne, das hilft uns allen' } : { angenommen: false, grund: 'das brauche ich selbst für unsere Flucht' };
    return bekommen > geben ? { angenommen: true, grund: `einverstanden (${bekommen} gegen ${geben} Punkte)` } : { angenommen: false, grund: `das lohnt sich für mich nicht (${bekommen} gegen ${geben} Punkte)` };
  }

  handelErgebnis() { /* Rückmeldung der Spielleitung (für spätere Verfeinerung) */ }
}

export { QUELLEN, STRANDRING, ketteInfo, craftGrund, klon, nachbarn, schluessel };
