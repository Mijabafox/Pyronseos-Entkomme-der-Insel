// Effekt-Baukasten: Jede Tages- und Spezialkarte besteht aus diesen Bausteinen.
// Ein Effekt ist ein Objekt { typ, ziel?, bedingung?, ...Werte }.
//   ziel: "aktiv" (Standard bei Spezialkarten) oder "alle" (Standard bei Tageskarten)
//   bedingung: { biom: [...], nichtBei: ["feuer","shelter"], mitWaffe, ohneWaffe, hat: "axt"|"hacke"|"waffe" }
// Tages-Modifikatoren (bewegungskosten, weitsicht, trinkenSperren, rastenWert, kampfBonus, flossSperre)
// wirken den ganzen Tag, solange die Tageskarte offen liegt.
import {
  heilen, energieAendern, schaden, rohstoffGeben, log, imSpiel, feldVon, beiFeuer, imShelter,
  wurf, wurfMitGlueck, kartenEreignis, vorratZurueck, aufdecken,
} from './kern.js';
import { nachbarn, schluessel } from './hex.js';
import { tierName } from './namen.js';
import { ROHSTOFFE, rohstoffText } from './config.js';

// Beschreibung der Bausteine für Editor und Validator.
export const BAUSTEINE = {
  herzen: { name: 'Herzen ändern', felder: { wert: 'zahl' } },
  energie: { name: 'Energie ändern', felder: { wert: 'zahl' } },
  rohstoff: { name: 'Rohstoff geben oder nehmen', felder: { art: 'rohstoff', wert: 'zahl' } },
  abgabe: { name: 'Abgabe (erste bezahlbare Option, sonst Ersatz)', felder: { optionen: 'effekte', sonst: 'effekte' } },
  weitergeben: { name: 'Karte weitergeben', felder: { richtung: ['links', 'rechts'], sonstRohstoffe: 'zahl' } },
  aufdecken: { name: 'Felder aufdecken', felder: { anzahl: 'zahl', radius: 'zahl' } },
  bewegungGratis: { name: 'Bewegung gratis', felder: { schritte: 'zahl' } },
  tierKampf: { name: 'Tier ziehen und kämpfen', felder: { hinterhalt: 'bool' } },
  zugEnde: { name: 'Zug beenden', felder: {} },
  kampfBonus: { name: 'Kampfbonus', felder: { wert: 'zahl', gegen: ['tier', 'alle'], dauer: ['tag', 'naechste'] } },
  abbauFaktor: { name: 'Abbau-Bonus (Faktor)', felder: { faktor: 'zahl' } },
  wurfWiederholen: { name: 'Wurf wiederholen', felder: {} },
  weitsicht: { name: 'Weitsicht ändern', felder: { radius: 'zahl', aus: 'bool' } },
  bewegungskosten: { name: 'Bewegungskosten ändern', felder: { plus: 'zahl', mindestens: 'zahl', biom: 'biome' } },
  trinkenSperren: { name: 'Trinken sperren', felder: {} },
  rastenWert: { name: 'Rasten-Wert ändern', felder: { wert: 'zahl' } },
  flossSperre: { name: 'Floss-Flucht sperren', felder: {} },
  rettungswurf: { name: 'Würfel-Rettungswurf', felder: { wuerfel: 'zahl', erfolgAb: 'zahl', effekte: 'effekte' } },
  wurfTabelle: { name: 'Würfeltabelle', felder: { wuerfel: 'zahl', gut: 'zahl', tabelle: 'tabelle' } },
  wahl: { name: 'Wahl des Spielers', felder: { optionen: 'optionen' } },
  werkzeugVerlieren: { name: 'Werkzeug oder Waffe verlieren', felder: { slot: ['axt', 'hacke', 'waffe'] } },
  ausweichen: { name: '1 Feld ausweichen', felder: {} },
  schadenAbwehr: { name: 'Schutz vor dem nächsten Schaden', felder: {} },
  kampfSieg: { name: 'Begegnung sofort gewonnen', felder: { fuer: ['tier', 'duell'] } },
  rauch: { name: 'Rauch (0 Schaden und ausweichen)', felder: { energie: 'zahl' } },
  duellFern: { name: 'Duell auf Distanz', felder: {} },
  brennsprit: { name: 'Brennsprit (fürs Flugzeugwrack)', felder: {} },
};

export const MODIFIKATOREN = new Set(['bewegungskosten', 'weitsicht', 'trinkenSperren', 'rastenWert', 'kampfBonus', 'flossSperre']);
export const INTERAKTIV = new Set(['tierKampf', 'aufdecken', 'wahl']);

export function bedingungErfuellt(s, i, b) {
  if (!b) return true;
  const p = s.spieler[i], f = feldVon(s, i);
  if (b.biom && !b.biom.includes(f.biom)) return false;
  if (b.nichtBei) {
    if (b.nichtBei.includes('feuer') && beiFeuer(s, i)) return false;
    if (b.nichtBei.includes('shelter') && imShelter(s, i)) return false;
  }
  if (b.mitWaffe && !p.ausruestung.waffe) return false;
  if (b.ohneWaffe && p.ausruestung.waffe) return false;
  if (b.hat === 'waffe' && !p.ausruestung.waffe) return false;
  if ((b.hat === 'axt' || b.hat === 'hacke') && !p.ausruestung[b.hat]) return false;
  if (b.modus && !b.modus.includes(s.modus)) return false;
  return true;
}

// ---- Tages-Modifikatoren ----
export function tagesKarteDef(s, id = s.tagesKarte) {
  if (!id) return null;
  if (id === 'ruhig') return s.cfg.tageskarten.ruhig;
  if (id === 'lava') return s.cfg.tageskarten.lava;
  return s.cfg.tageskarten.karten[id] ?? null;
}
export function tagesMods(s) {
  if (s._modsFuer === s.tagesKarte && s._mods) return s._mods;
  const m = { schrittPlus: 0, schrittMin: [], weitsichtAus: false, weitsichtRadius: null, trinkenGesperrt: false, rastenWert: null, kampfTier: 0, kampfAlle: 0, flossGesperrt: false };
  for (const e of tagesKarteDef(s)?.effekte ?? []) {
    switch (e.typ) {
      case 'bewegungskosten':
        if (e.plus) m.schrittPlus += e.plus;
        if (e.mindestens) m.schrittMin.push({ wert: e.mindestens, biom: e.biom ?? null });
        break;
      case 'weitsicht': if (e.aus) m.weitsichtAus = true; else if (e.radius) m.weitsichtRadius = e.radius; break;
      case 'trinkenSperren': m.trinkenGesperrt = true; break;
      case 'rastenWert': m.rastenWert = e.wert; break;
      case 'kampfBonus': if (e.gegen === 'alle') m.kampfAlle += e.wert; else m.kampfTier += e.wert; break;
      case 'flossSperre': m.flossGesperrt = true; break;
    }
  }
  Object.defineProperty(s, '_mods', { value: m, writable: true, configurable: true, enumerable: false });
  Object.defineProperty(s, '_modsFuer', { value: s.tagesKarte, writable: true, configurable: true, enumerable: false });
  return m;
}

// ---- Effekte anwenden ----
// ctx: { quelle: Name der Karte, standardZiel: 'aktiv' | 'alle' }
// Gibt true zurück, wenn ein interaktiver Effekt eine Phase geöffnet hat (Rest steht in s.zug.nachher).
export function effekteAnwenden(s, i, effekte, ctx) {
  for (let k = 0; k < effekte.length; k++) {
    const e = effekte[k];
    if (MODIFIKATOREN.has(e.typ) && (e.dauer ?? 'tag') === 'tag' && ctx.standardZiel === 'alle') continue; // wirkt über tagesMods
    const ziel = e.ziel ?? ctx.standardZiel ?? 'aktiv';
    const ziele = ziel === 'alle' ? s.spieler.map((_, k2) => k2).filter((k2) => imSpiel(s.spieler[k2])) : [i];
    if (e.typ === 'weitergeben') { weitergeben(s, e, ctx); continue; }
    if (e.typ === 'aufdecken' && ziel === 'alle') continue; // Tageskarte: wird zu Zugbeginn angeboten
    for (const z of ziele) {
      if (!imSpiel(s.spieler[z])) continue;
      if (!bedingungErfuellt(s, z, e.bedingung)) continue;
      const offen = einzeln(s, z, e, ctx);
      if (offen) {
        const rest = effekte.slice(k + 1);
        if (rest.length) s.zug.nachher = [...(s.zug.nachher ?? []), { spieler: z, effekte: rest, ctx }];
        return true;
      }
    }
  }
  return false;
}

function einzeln(s, i, e, ctx) {
  const p = s.spieler[i];
  const q = ctx.quelle;
  switch (e.typ) {
    case 'herzen': {
      if (e.wert >= 0) { const n = heilen(s, i, e.wert); log(s, `${q}: +${n} Herz${n === 1 ? '' : 'en'}`, i); }
      else schaden(s, i, -e.wert, q);
      return false;
    }
    case 'energie': {
      const n = energieAendern(s, i, e.wert);
      log(s, `${q}: ${n >= 0 ? '+' : '−'}${Math.abs(n)} Energie`, i);
      return false;
    }
    case 'rohstoff': {
      const arten = e.arten ?? [e.art];
      if (e.wert >= 0) {
        for (const a of arten) { const g = rohstoffGeben(s, i, a, e.wert); log(s, `${q}: +${g} ${rohstoffText({ [a]: 1 }).slice(2)}`, i); }
      } else {
        const a = arten.find((x) => p.hand[x] >= -e.wert);
        if (a) { p.hand[a] += e.wert; vorratZurueck(s, a, -e.wert); log(s, `${q}: gibt ${rohstoffText({ [a]: -e.wert })} ab`, i); }
      }
      return false;
    }
    case 'abgabe': {
      const opt = (e.optionen ?? []).find((o) => bezahlbar(s, i, o));
      if (opt) return einzeln(s, i, opt, ctx);
      for (const x of e.sonst ?? []) einzeln(s, i, x, ctx);
      return false;
    }
    case 'zugEnde': s.zug.zugEndeNach = true; return false;
    case 'bewegungGratis': s.zug.gratisSchritte += e.schritte ?? 0; return false;
    case 'kampfBonus': s.zug.kampfPlus += e.wert ?? 0; return false;
    case 'abbauFaktor': s.zug.abbauFaktor = Math.max(s.zug.abbauFaktor, e.faktor ?? 1); return false;
    case 'wurfWiederholen': s.zug.neuWurf = true; return false;
    case 'weitsicht': if (e.radius) s.zug.weitsichtRadius = Math.max(s.zug.weitsichtRadius, e.radius); return false;
    case 'schadenAbwehr': p.schutz = true; return false;
    case 'kampfSieg':
      if (e.fuer === 'duell') s.zug.messerDuell = true;
      else s.zug.kampfSieg = true;
      return false;
    case 'werkzeugVerlieren': {
      const slot = e.slot;
      if (slot === 'waffe') p.ausruestung.waffe = null; else p.ausruestung[slot] = false;
      log(s, `${q}: ${slot === 'axt' ? 'die Steinaxt' : slot === 'hacke' ? 'die Spitzhacke' : 'die Waffe'} ist zerstört`, i);
      return false;
    }
    case 'rettungswurf': {
      const w = wurf(s, e.wuerfel ?? 6, q, i);
      if (w >= (e.erfolgAb ?? 5)) { log(s, `${q}: W${e.wuerfel ?? 6} = ${w}, Glück gehabt`, i); return false; }
      log(s, `${q}: W${e.wuerfel ?? 6} = ${w}`, i);
      for (const x of e.effekte ?? []) einzeln(s, i, x, ctx);
      return false;
    }
    case 'wurfTabelle': {
      const r = wurfMitGlueck(s, e.wuerfel ?? 6, q, (w) => w >= (e.gut ?? 99));
      const zeile = (e.tabelle ?? []).find((z) => r.wert <= z.bis);
      log(s, `${q}: W${e.wuerfel ?? 6} = ${r.wert}${r.glueck !== null ? ` (Glück: Neuwurf ${r.glueck})` : ''}`, i);
      s.zug.letztesErgebnis = `W${e.wuerfel ?? 6} = ${r.wert}`;
      if (zeile) for (const x of zeile.effekte) einzeln(s, i, x, ctx);
      return false;
    }
    case 'ausweichen': {
      const f = feldVon(s, i);
      const ziele = nachbarn(f.coord).map(schluessel).filter((k) => s.felder[k]?.aufgedeckt && !s.felder[k].tier);
      if (!ziele.length) return false;
      const w = wurf(s, 6, q, i);
      p.feld = ziele[(w - 1) % ziele.length];
      log(s, `${q}: weicht ein Feld aus`, i);
      return false;
    }
    case 'tierKampf': {
      const t = s.tierBeutel.pop();
      if (!t) { log(s, `${q}: der Tierbeutel ist leer`, i); s.zug.letztesErgebnis = 'Der Tierbeutel ist leer'; return false; }
      s.zug.phase = 'kampf';
      s.zug.kampf = { feld: p.feld, von: p.feld, tier: t, hinterhalt: !!e.hinterhalt, blind: true };
      log(s, `${q}: ${tierName(t)} greift an!`, i);
      s.zug.letztesErgebnis = 'Ein Tier greift an – Kampf ohne Flucht';
      return true;
    }
    case 'aufdecken': {
      const verdeckt = Object.values(s.felder).filter((f) => !f.aufgedeckt).length;
      const n = Math.min(e.anzahl ?? 1, verdeckt);
      if (n <= 0) return false;
      s.zug.nachAufdecken = s.zug.phase;
      s.zug.phase = 'weitsicht_waehlen';
      s.zug.weitsichtOffen = n;
      s.zug.weitsichtRadius = e.radius ?? 99;
      s.zug.aufdeckenQuelle = q;
      s.zug.letztesErgebnis = `${n} Plättchen aufdecken`;
      return true;
    }
    case 'wahl': {
      const optionen = (e.optionen ?? []).map((o, k) => ({ ...o, index: k })).filter((o) => bedingungErfuellt(s, i, o.bedingung));
      if (optionen.length === 0) return false;
      if (optionen.length === 1) { for (const x of optionen[0].effekte) einzeln(s, i, x, ctx); return false; }
      s.zug.wahl = { zurueck: s.zug.phase, optionen, quelle: q, ctx };
      s.zug.phase = 'wahl';
      s.zug.letztesErgebnis = `Wahl: ${optionen.map((o) => o.name).join(' oder ')}`;
      return true;
    }
    default:
      return false;
  }
}

function bezahlbar(s, i, o) {
  const p = s.spieler[i];
  if (o.typ === 'energie') return p.energie >= -o.wert;
  if (o.typ === 'rohstoff') return o.wert >= 0 || (o.arten ?? [o.art]).some((a) => p.hand[a] >= -o.wert);
  if (o.typ === 'herzen') return o.wert >= 0 || p.herzen > -o.wert;
  return true;
}

// Affen: alle geben gleichzeitig 1 Spezialkarte (sonst Rohstoffe) an den Nachbarn.
function weitergeben(s, e, ctx) {
  const n = s.spieler.length;
  const schritt = e.richtung === 'rechts' ? -1 : 1;
  const abgaben = s.spieler.map((p) => {
    if (!imSpiel(p)) return null;
    if (p.karten.length) return { karte: p.karten.at(-1), rohstoffe: [] };
    const h = { ...p.hand }, r = [];
    for (let k = 0; k < (e.sonstRohstoffe ?? 0); k++) {
      const a = [...ROHSTOFFE].sort((x, y) => h[y] - h[x])[0];
      if (h[a] <= 0) break;
      h[a]--; r.push(a);
    }
    return { karte: null, rohstoffe: r };
  });
  const nachbar = (k) => {
    let j = (k + schritt + n) % n;
    while (j !== k && !imSpiel(s.spieler[j])) j = (j + schritt + n) % n;
    return j;
  };
  abgaben.forEach((a, k) => {
    if (!a) return;
    const p = s.spieler[k];
    if (a.karte) p.karten.pop();
    for (const r of a.rohstoffe) p.hand[r]--;
  });
  abgaben.forEach((a, k) => {
    if (!a) return;
    const j = nachbar(k);
    if (j === k) { // niemand sonst: zurück
      if (a.karte) s.spieler[k].karten.push(a.karte);
      for (const r of a.rohstoffe) s.spieler[k].hand[r]++;
      return;
    }
    if (a.karte) { s.spieler[j].karten.push(a.karte); log(s, `${ctx.quelle}: gibt eine Spezialkarte an ${s.spieler[j].name}`, k); }
    else if (a.rohstoffe.length) {
      for (const r of a.rohstoffe) s.spieler[j].hand[r]++;
      log(s, `${ctx.quelle}: keine Spezialkarte – gibt ${a.rohstoffe.length} Rohstoff${a.rohstoffe.length === 1 ? '' : 'e'} an ${s.spieler[j].name}`, k);
    }
  });
}

// Spezialkarte für die Anzeige: Text der Wirkung.
export function kartenEreignisMelden(s, art, karte, i, ergebnis) { kartenEreignis(s, art, karte, i, ergebnis); }

// Kurzbeschreibung eines Effekts (Editor, Hilfe).
export function effektText(e) {
  const b = BAUSTEINE[e.typ]?.name ?? e.typ;
  const werte = Object.entries(e).filter(([k]) => !['typ', 'effekte', 'optionen', 'tabelle', 'sonst'].includes(k)).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ');
  return werte ? `${b} (${werte})` : b;
}

export { aufdecken };
