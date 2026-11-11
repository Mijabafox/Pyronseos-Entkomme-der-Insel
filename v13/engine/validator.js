// Validator: prüft eine Konfiguration vor jeder Partie.
// fehler = blockiert den Start (Partie nicht spielbar), warnungen = Hinweise (z. B. «Seil reicht nur knapp»).
import { plaettchenPruefen, STRANDRING } from './brett.js';
import { ROHSTOFFE, mal, lesen, rohstoffText } from './config.js';
import { regler, ABSOLUT_MAX_SPIELER } from './schema.js';
import { BAUSTEINE } from './effekte.js';
import { ROHSTOFF } from './namen.js';

export function personenFuer(cfg, modus = cfg.match.modus, spieler = cfg.match.spieler) {
  return modus === 'koop' ? spieler : modus === 'team' ? cfg.match.teamGroesse : 1;
}

// Höchstens erreichbare Menge je Rohstoff (Brett plus Tiere plus Seil aus Blättern), ohne Vorratsgrenze.
export function brettErtrag(cfg) {
  const pl = cfg.brett.plaettchen;
  const anzahl = (inhalt) => Object.values(pl).reduce((s, b) => s + (b[inhalt] ?? 0), 0);
  const e = Object.fromEntries(ROHSTOFFE.map((r) => [r, 0]));
  for (const [inhalt, def] of Object.entries(cfg.zug.ertrag)) {
    const n = anzahl(inhalt);
    for (const r of ROHSTOFFE) e[r] += n * ((def.basis[r] ?? 0) + (def.werkzeug ? def.bonus?.[r] ?? 0 : 0));
  }
  const tiere = cfg.tiere;
  e.nahrung += Object.values(tiere.klein).reduce((s, n) => s + n, 0) * tiere.nahrungKlein + Object.values(tiere.gross).reduce((s, n) => s + n, 0) * tiere.nahrungGross;
  const seilRezept = cfg.crafting.rezepte.seil;
  if (seilRezept?.aktiv) e.seil += Math.floor(e.blaetter / Math.max(1, seilRezept.kosten.blaetter ?? 2));
  return e;
}

export function validieren(cfg, opt = {}) {
  const fehler = [], warnungen = [];
  const F = (t) => fehler.push(t), W = (t) => warnungen.push(t);
  const modus = opt.modus ?? cfg.match.modus;
  const spieler = opt.spieler ?? cfg.match.spieler;

  // Wertebereiche aller Regler
  for (const r of regler(cfg)) {
    const v = lesen(cfg, r.pfad);
    if (r.typ === 'zahl' && v !== null && v !== undefined) {
      if (typeof v !== 'number' || Number.isNaN(v)) F(`«${r.name}» (${r.pfad}) ist keine Zahl.`);
      else if (v < r.min || v > r.max) F(`«${r.name}» (${r.pfad}) = ${v} liegt ausserhalb von ${r.min} bis ${r.max}.`);
    }
    if (r.typ === 'auswahl' && !r.optionen.includes(v)) F(`«${r.name}» (${r.pfad}) hat den unbekannten Wert ${JSON.stringify(v)}.`);
  }

  // Spielerzahl
  if (!['koop', 'team', 'pvp'].includes(modus)) F(`Unbekannter Modus «${modus}».`);
  if (spieler > ABSOLUT_MAX_SPIELER) F(`${spieler} Spieler: Das Spiel ist für höchstens ${ABSOLUT_MAX_SPIELER} Spieler ausgelegt, für 5 und 6 gibt es keine Werte.`);
  if (spieler < cfg.match.spielerMin || spieler > cfg.match.spielerMax) F(`${spieler} Spieler liegt ausserhalb von ${cfg.match.spielerMin} bis ${cfg.match.spielerMax}.`);
  if (modus === 'team' && spieler !== 2 * cfg.match.teamGroesse) F(`Team-Modus braucht genau ${2 * cfg.match.teamGroesse} Spieler (2 gegen 2).`);
  if (modus === 'pvp' && spieler < 2) F('PvP braucht mindestens 2 Spieler.');
  const aktiveChar = Object.values(cfg.charaktere).filter((c) => c.aktiv).length;
  if (aktiveChar < spieler) F(`Nur ${aktiveChar} Charaktere aktiv, es braucht ${spieler} (jeder höchstens einmal).`);

  // Brett
  for (const t of plaettchenPruefen(cfg.brett.plaettchen)) F(`Brett: ${t}`);
  const pl = cfg.brett.plaettchen;
  const zahl = (inhalt) => Object.values(pl).reduce((s, b) => s + (b[inhalt] ?? 0), 0);
  const tierFelder = zahl('tier'), spezialFelder = zahl('spezial');
  const tiere = Object.values(cfg.tiere.klein).reduce((s, n) => s + n, 0) + Object.values(cfg.tiere.gross).reduce((s, n) => s + n, 0);
  if (tiere < tierFelder) W(`Tierbeutel: ${tiere} Tiere für ${tierFelder} Tierfelder – manche Tierfelder bleiben leer.`);
  if (cfg.tiere.zielKlein > 6 + 3 || cfg.tiere.zielGross > 6 + 4) W('Tier-Zielwerte sind auch mit Waffe kaum erreichbar.');
  const quellen = zahl('wasserquelle') + zahl('bergquelle') + zahl('suesswasser');
  if (quellen === 0) W('Keine Wasserquellen auf dem Brett.');

  // Tageskarten
  const t = cfg.match.tage;
  const pool = Object.values(cfg.tageskarten.karten).filter((k) => k.aktiv).reduce((s, k) => s + (k.anzahl ?? 1), 0);
  if (t.ereignisse > pool) F(`Tageskarten: ${t.ereignisse} Ereignis-Tage, aber nur ${pool} Ereigniskarten im Pool.`);
  if (t.ruhig + t.ereignisse < 1) F('Die Partie hat keinen einzigen Tag.');
  if (!t.lava) W('Ohne Lava-Karte endet die Partie erst, wenn der Tagesstapel leer ist.');
  for (const [id, k] of Object.entries(cfg.tageskarten.karten)) effektePruefen(k.effekte ?? [], `Tageskarte «${k.name ?? id}»`, F, true);

  // Spezialkarten
  const sk = cfg.spezialkarten;
  const spool = Object.values(sk.karten).filter((k) => k.aktiv).reduce((s, k) => s + (k.anzahl ?? 0), 0);
  if (spool < sk.stapel) W(`Spezialkarten: Stapelgrösse ${sk.stapel}, aber nur ${spool} Karten aktiv – der Stapel hat nur ${spool} Karten.`);
  if (Math.min(spool, sk.stapel) < spezialFelder) W(`Spezialkarten: ${Math.min(spool, sk.stapel)} Karten für ${spezialFelder} Spezialfelder – der Stapel kann leer werden.`);
  for (const [id, k] of Object.entries(sk.karten)) {
    effektePruefen(k.effekte ?? [], `Spezialkarte «${k.name ?? id}»`, F, false);
    for (const o of k.ausspielen ?? []) effektePruefen(o.effekte ?? [], `Spezialkarte «${k.name ?? id}» (${o.wahl})`, F, false);
  }

  // Fluchtwege
  const fw = cfg.fluchtwege;
  const personen = personenFuer(cfg, modus, spieler);
  const aktiveWege = [];
  const ertrag = brettErtrag(cfg);
  const vorrat = cfg.vorrat.unbegrenzt ? null : cfg.vorrat.karten;
  const verfuegbar = (r) => Math.min(ertrag[r] + (r === 'abfall' ? 0 : 0), vorrat ? vorrat[r] ?? 0 : Infinity);
  const pruefeKosten = (name, kosten) => {
    let ok = true;
    for (const [r, n] of Object.entries(kosten)) {
      if (!n) continue;
      const v = verfuegbar(r);
      if (n > v) {
        F(`${name} ist unbezahlbar: ${n} ${ROHSTOFF[r]} nötig, ${vorrat && vorrat[r] < ertrag[r] ? `der Vorrat hat nur ${vorrat[r]}` : `auf dem Brett gibt es höchstens ${ertrag[r]}`}.`);
        ok = false;
      } else if (n >= 0.8 * v) W(`${name}: ${ROHSTOFF[r]} reicht nur knapp (${n} von ${v === Infinity ? '∞' : v}).`);
    }
    return ok;
  };
  if (fw.floss.aktiv) {
    aktiveWege.push('floss');
    if (!cfg.crafting.rezepte.spitzhacke.aktiv && !cfg.figur.startAusruestung.hacke) F('Floss: Ohne Spitzhacke kann niemand den Kompass bergen (Rezept ausgeschaltet).');
    if ((pl.vulkan.vulkanfels ?? 0) < 1) F('Floss: Kein Vulkanfels, also kein Kompass.');
    pruefeKosten(`Solides Floss (${personen} ${personen === 1 ? 'Person' : 'Personen'}: ${rohstoffText(mal(fw.floss.solide.proPerson, personen))})`, mal(fw.floss.solide.proPerson, personen));
    if (fw.floss.not.aktiv) {
      pruefeKosten('Not-Floss', mal(fw.floss.not.proPerson, personen));
      if (fw.floss.not.kentertBis > fw.floss.not.landBis) F('Not-Floss: «kentert bis» ist grösser als «zurück an Land bis».');
      if (fw.floss.not.landBis >= 6) W('Not-Floss: Mit «zurück an Land bis 6» gelingt die Flucht nie.');
    }
  }
  if (fw.feuer.aktiv) {
    aktiveWege.push('feuer');
    const zeile = fw.feuer.tabelle[String(personen)];
    if (!zeile) F(`Küstenfeuer-Kette: keine Zeile für ${personen} ${personen === 1 ? 'Person' : 'Personen'} eingetragen.`);
    else {
      if (zeile.feuer * zeile.abstand > STRANDRING) F(`Küstenfeuer-Kette: ${zeile.feuer} Feuer mal Abstand ${zeile.abstand} = ${zeile.feuer * zeile.abstand} passt nicht auf den Strandring (${STRANDRING} Felder).`);
      if (!cfg.crafting.rezepte.lagerfeuer.aktiv) F('Küstenfeuer-Kette: Das Lagerfeuer-Rezept ist ausgeschaltet.');
      else pruefeKosten(`Küstenfeuer-Kette (${zeile.feuer} Lagerfeuer)`, mal(cfg.crafting.rezepte.lagerfeuer.kosten, zeile.feuer));
    }
    for (const [n, z] of Object.entries(fw.feuer.tabelle)) if (z.feuer * z.abstand > STRANDRING) W(`Küstenfeuer-Tabelle, Zeile ${n}: ${z.feuer} × ${z.abstand} passt nicht auf den Ring.`);
  }
  if (fw.wrack.aktiv) {
    aktiveWege.push('wrack');
    if (zahl('flugzeugwrack') < 1) F('Flugzeugwrack: Es liegt kein Wrack-Plättchen auf dem Brett.');
    if (fw.wrack.brennsprit && !(sk.karten.brennsprit?.aktiv)) F('Flugzeugwrack: Der Brennsprit ist nötig, die Karte ist aber ausgeschaltet.');
    pruefeKosten('Flugzeugwrack', mal(fw.wrack.proPerson, personen));
  }
  if (aktiveWege.length === 0) F('Alle Fluchtwege sind ausgeschaltet.');

  // Sonstiges
  if (cfg.zug.wasser.auffuellen !== 'max' && cfg.zug.wasser.auffuellen > cfg.figur.energie) W('Wasser füllt über die maximale Energie auf (wird auf das Maximum begrenzt).');
  if (cfg.charaktere.ueberlebenskuenstler.aktiv && cfg.charaktere.ueberlebenskuenstler.herzen <= cfg.figur.herzen) W('Überlebenskünstler hat nicht mehr Herzen als die anderen.');
  if (cfg.browser.pauseMin > cfg.browser.pauseMax) F('Browser: Pause mindestens ist grösser als höchstens.');
  if (vorrat && vorrat.seil < (fw.floss.aktiv ? mal(fw.floss.solide.proPerson, personen).seil ?? 0 : 0) + 2) W(`Seil-Vorrat ${vorrat.seil}: Für Floss plus Werkzeuge wird es eng (offener Punkt Seil-Vorrat).`);

  return { ok: fehler.length === 0, fehler, warnungen };
}

function effektePruefen(effekte, wo, F, istTag) {
  for (const e of effekte) {
    if (!BAUSTEINE[e.typ]) { F(`${wo}: unbekannter Effekt «${e.typ}».`); continue; }
    if (istTag && e.typ === 'wahl') F(`${wo}: «Wahl» geht bei Tageskarten nicht (alle gleichzeitig).`);
    if (e.typ === 'herzen' || e.typ === 'energie') if (typeof e.wert !== 'number') F(`${wo}: «${BAUSTEINE[e.typ].name}» braucht einen Zahlenwert.`);
    if (e.typ === 'rohstoff' && !(e.arten ?? [e.art]).every((a) => ROHSTOFFE.includes(a))) F(`${wo}: unbekannter Rohstoff.`);
    for (const k of ['effekte', 'sonst', 'optionen']) if (Array.isArray(e[k])) effektePruefen(k === 'optionen' && e.typ === 'wahl' ? e[k].flatMap((o) => o.effekte ?? []) : e[k], wo, F, istTag && e.typ !== 'wahl');
    if (e.typ === 'wurfTabelle') for (const z of e.tabelle ?? []) effektePruefen(z.effekte ?? [], wo, F, istTag);
  }
}
