// Freier Tisch (wie V10): Tischzustand und Aktionen ohne Regelprüfung und ohne Bots.
// Das Brett, die Charaktere und die Stapel kommen einmalig aus der Engine (gleicher Seed = gleiche Insel),
// danach ändert nur noch der Tisch selbst seinen Zustand. Jede Aktion steht im Playtest-Protokoll.
import { neuePartie } from '../engine/engine.js';
import { ableiten, ganz, mischen as mischenListe } from '../engine/rng.js';
import { klon, ROHSTOFFE } from '../engine/config.js';
import { QUELLEN as WASSER, STRANDRING } from '../engine/brett.js';
import { TIER, ROHSTOFF, INHALT } from '../engine/namen.js';
import { rezeptName } from './texte.js';

export const MAX_SPIELER = 4;
export const STAPEL = {
  tag: { name: 'Tageskarten', symbol: '☀️' },
  spezial: { name: 'Spezialkarten', symbol: '❗' },
  route: { name: 'Routenkarten', symbol: '🧭' },
  rohstoff: { name: 'Rohstoffkarten', symbol: '🪵' },
  tier: { name: 'Tier-Zugbeutel', symbol: '🐾' },
};
export const PANEL_ORT = [[520, -470], [860, -470], [520, 0], [860, 0]];
export const STANDARD_INHALT = { wald: 'dickicht', wiese: 'lichtung', gebirge: 'geroell', strand: 'sandbank', vulkan: 'leer' };
const WAFFEN = [null, 'holzspeer', 'steinmachete'];

let zaehler = 0;
const uid = (p) => `${p}-${Date.now().toString(36)}-${(zaehler++).toString(36)}`;
const karte = (typ, ref, extra = {}) => ({ uid: uid('k'), typ, ref, ...extra });

export const herzenMax = (cfg, charakter) => (charakter === 'ueberlebenskuenstler' && cfg.charaktere.ueberlebenskuenstler?.aktiv ? cfg.charaktere.ueberlebenskuenstler.herzen : cfg.figur.herzen);
export const energieMax = (cfg) => cfg.figur.energie;

// Titel und Text einer Karte für Protokoll, Tooltips und Hand-Liste.
export function kartenInfo(cfg, k) {
  switch (k.typ) {
    case 'tag': { const d = k.ref === 'ruhig' ? cfg.tageskarten.ruhig : k.ref === 'lava' ? cfg.tageskarten.lava : cfg.tageskarten.karten[k.ref]; return { titel: d?.name ?? k.ref, text: d?.text ?? '', symbol: d?.symbol ?? '☀️' }; }
    case 'spezial': { const d = cfg.spezialkarten.karten[k.ref]; return { titel: d?.name ?? k.ref, text: d?.text ?? '', symbol: d?.symbol ?? '❗' }; }
    case 'route': return { titel: `Routenkarte ${k.ref}`, text: `Floss-Abschnitt ${k.ref}`, symbol: '🧭' };
    case 'tier': return { titel: TIER[k.ref]?.name ?? k.ref, text: k.ref in cfg.tiere.gross ? `Grosses Tier (Ziel ${cfg.tiere.zielGross})` : `Kleines Tier (Ziel ${cfg.tiere.zielKlein})`, symbol: TIER[k.ref]?.symbol ?? '🐾' };
    case 'rohstoff': return { titel: ROHSTOFF[k.ref] ?? k.ref, text: 'Rohstoffkarte', symbol: '🪵' };
    default: return { titel: k.titel ?? 'Eigene Karte', text: k.text ?? '', symbol: k.symbol ?? '⭐' };
  }
}

export function log(t, text) {
  t.protokoll.push({ nr: t.protokoll.length + 1, zeit: new Date().toTimeString().slice(0, 8), tag: t.tag, spieler: t.spieler[t.aktiv]?.name ?? '', text });
  if (t.protokoll.length > 2000) t.protokoll.splice(0, t.protokoll.length - 2000);
}

// Neuer Tisch aus Konfiguration, Namen und Seed.
export function tischNeu(cfg, namen, seed) {
  const s = neuePartie(klon(cfg), { seed, modus: 'koop', sitze: namen.map((name) => ({ name, ki: false })), protokoll: false });
  const felder = {};
  for (const f of Object.values(s.felder)) {
    felder[f.key] = { key: f.key, coord: { ...f.coord }, ring: f.ring, biom: f.biom, duene: f.duene, kuestenNr: f.kuestenNr, richtung: f.richtung, inhalt: f.inhalt, kompass: !!f.kompass, aufgedeckt: false, tier: null, bau: null };
  }
  const rng = { frei: ableiten(seed, 'frei-tisch') };
  const roh = [];
  for (const r of ROHSTOFFE) for (let k = 0; k < (cfg.vorrat.unbegrenzt ? 20 : cfg.vorrat.karten[r] ?? 0); k++) roh.push(r);
  const t = {
    format: 'insel-survival-v11-frei', version: 1, seed, rng,
    stapel: {
      tag: { karten: [...s.tagesStapel, s.tagesKarte].filter(Boolean).map((id) => karte('tag', id)), ablage: [] },
      spezial: { karten: s.spezialStapel.map((id) => karte('spezial', id)), ablage: [] },
      route: { karten: s.routenStapel.map((r) => karte('route', r)), ablage: [] },
      rohstoff: { karten: [], ablage: [] },
      tier: { karten: s.tierBeutel.map((x) => karte('tier', x)), ablage: [] },
    },
    offen: [], marker: [], felder,
    spieler: s.spieler.map((p, i) => ({
      name: p.name, charakter: p.charakter, herzen: p.herzen, energie: p.energie,
      ausruestung: { axt: !!p.ausruestung.axt, hacke: !!p.ausruestung.hacke, waffe: p.ausruestung.waffe ?? null },
      rohstoffe: { ...p.hand }, hand: [], feld: p.feld, startNr: felder[p.feld]?.kuestenNr ?? null,
      panel: { x: PANEL_ORT[i]?.[0] ?? 520, y: PANEL_ORT[i]?.[1] ?? -470, offen: true },
    })),
    aktiv: 0, tag: 1, wetter: '—', wuerfel: [], protokoll: [],
  };
  t.stapel.rohstoff.karten = mischenListe(t, 'frei', roh).map((r) => karte('rohstoff', r));
  for (const p of t.spieler) if (p.feld) t.felder[p.feld].aufgedeckt = true;
  log(t, `Freier Tisch mit Seed ${seed}, ${t.spieler.length} Spieler: ${t.spieler.map((p) => `${p.name} (${cfg.charaktere[p.charakter]?.name ?? p.charakter}, Strand ${p.startNr})`).join(', ')}.`);
  return t;
}

// Wo landet eine gezogene Karte? In der Auslage zwischen Stapeln und Brett.
function auslageOrt(t) {
  const n = t.offen.length;
  return { x: -830 + (n % 3) * 126, y: -470 + (Math.floor(n / 3) % 5) * 186 };
}

export function ziehen(t, cfg, id) {
  const st = t.stapel[id];
  const k = st.karten.pop();
  if (!k) { log(t, `${STAPEL[id].name}: Stapel leer`); return null; }
  if (id === 'tag') {
    if (t.offen.some((o) => o.karte.typ === 'tag')) t.tag += 1;
    const info = kartenInfo(cfg, k);
    t.wetter = `${info.symbol} ${info.titel}`;
  }
  t.offen.push({ karte: k, ...auslageOrt(t) });
  log(t, `zieht ${STAPEL[id].name}: ${kartenInfo(cfg, k).titel}`);
  return k;
}

export function mischen(t, id) {
  t.stapel[id].karten = mischenListe(t, 'frei', t.stapel[id].karten);
  log(t, `mischt ${STAPEL[id].name}`);
}

export function ablageZurueck(t, id) {
  const st = t.stapel[id];
  st.karten.push(...st.ablage); st.ablage = [];
  st.karten = mischenListe(t, 'frei', st.karten);
  log(t, `mischt die Ablage in ${STAPEL[id].name} zurück`);
}

export function stapelZuruecksetzen(t, id) {
  const st = t.stapel[id];
  const vomTisch = t.offen.filter((o) => o.karte.typ === id || (id === 'spezial' && o.karte.typ === 'eigen' && o.karte.stapel === id)).map((o) => o.karte);
  t.offen = t.offen.filter((o) => !vomTisch.includes(o.karte));
  const vonHand = [];
  for (const p of t.spieler) { vonHand.push(...p.hand.filter((k) => stapelVon(k) === id)); p.hand = p.hand.filter((k) => stapelVon(k) !== id); }
  st.karten.push(...st.ablage, ...vomTisch, ...vonHand); st.ablage = [];
  st.karten = mischenListe(t, 'frei', st.karten);
  log(t, `setzt ${STAPEL[id].name} zurück`);
}

export const stapelVon = (k) => (k.typ === 'eigen' ? k.stapel ?? 'spezial' : k.typ);

export function eigeneKarte(t, id, daten) {
  t.stapel[id].karten.push(karte('eigen', null, { stapel: id, titel: daten.titel, text: daten.text, symbol: daten.symbol || '⭐' }));
  log(t, `erstellt die eigene Karte «${daten.titel}» (${STAPEL[id].name})`);
}

export function offenAblage(t, cfg, i) {
  const o = t.offen[i];
  if (!o) return;
  t.offen.splice(i, 1);
  t.stapel[stapelVon(o.karte)].ablage.push(o.karte);
  log(t, `legt «${kartenInfo(cfg, o.karte).titel}» auf die Ablage`);
}

export function offenZuHand(t, cfg, i, s) {
  const o = t.offen[i], p = t.spieler[s];
  if (!o || !p) return;
  t.offen.splice(i, 1);
  if (o.karte.typ === 'rohstoff') {
    p.rohstoffe[o.karte.ref] = (p.rohstoffe[o.karte.ref] ?? 0) + 1;
    t.stapel.rohstoff.ablage.push(o.karte);
    log(t, `${p.name}: ${ROHSTOFF[o.karte.ref]} +1 → ${p.rohstoffe[o.karte.ref]}`);
    return;
  }
  p.hand.push(o.karte);
  log(t, `«${kartenInfo(cfg, o.karte).titel}» auf die Hand von ${p.name}`);
}

export function offenVerschieben(t, i, x, y) {
  const [o] = t.offen.splice(i, 1);
  if (!o) return;
  t.offen.push({ ...o, x, y }); // nach oben legen
}

export function handAusspielen(t, cfg, s, i) {
  const p = t.spieler[s], k = p?.hand[i];
  if (!k) return;
  p.hand.splice(i, 1);
  t.offen.push({ karte: k, x: p.panel.x - 140, y: p.panel.y + 20 + (t.offen.length % 4) * 24 });
  log(t, `${p.name} spielt «${kartenInfo(cfg, k).titel}» aus`);
}

export function handAblage(t, cfg, s, i) {
  const p = t.spieler[s], k = p?.hand[i];
  if (!k) return;
  p.hand.splice(i, 1);
  t.stapel[stapelVon(k)].ablage.push(k);
  log(t, `${p.name} legt «${kartenInfo(cfg, k).titel}» auf die Ablage`);
}

export function wertAendern(t, cfg, s, art, d) {
  const p = t.spieler[s];
  const max = art === 'herzen' ? herzenMax(cfg, p.charakter) : energieMax(cfg);
  const neu = Math.max(0, Math.min(max, p[art] + d));
  if (neu === p[art]) return false;
  p[art] = neu;
  log(t, `${p.name}: ${art === 'herzen' ? 'Herzen' : 'Energie'} ${d > 0 ? '+' : ''}${d} → ${neu}`);
  return true;
}

export function rohstoffAendern(t, s, r, d) {
  const p = t.spieler[s];
  const neu = Math.max(0, (p.rohstoffe[r] ?? 0) + d);
  if (neu === (p.rohstoffe[r] ?? 0)) return false;
  p.rohstoffe[r] = neu;
  log(t, `${p.name}: ${ROHSTOFF[r]} ${d > 0 ? '+' : ''}${d} → ${neu}`);
  return true;
}

export function ausruestungUmschalten(t, s, slot) {
  const p = t.spieler[s], a = p.ausruestung;
  if (slot === 'waffe') {
    a.waffe = WAFFEN[(WAFFEN.indexOf(a.waffe) + 1) % WAFFEN.length];
    log(t, `${p.name}: Waffe ${a.waffe ? rezeptName(a.waffe) : 'keine'}`);
  } else {
    a[slot] = !a[slot];
    log(t, `${p.name}: ${slot === 'axt' ? 'Steinaxt' : 'Spitzhacke'} ${a[slot] ? 'dazu' : 'weg'}`);
  }
}

export function charakterSetzen(t, cfg, s, c) {
  const p = t.spieler[s];
  p.charakter = c;
  p.herzen = Math.min(p.herzen, herzenMax(cfg, c));
  log(t, `${p.name} wählt die Rolle ${cfg.charaktere[c]?.name ?? c}`);
}

export function nameSetzen(t, s, name) {
  const p = t.spieler[s], alt = p.name;
  p.name = name.trim().slice(0, 16) || alt;
  if (p.name !== alt) log(t, `${alt} heisst jetzt ${p.name}`);
}

export const amWasser = (t, s) => { const f = t.felder[t.spieler[s]?.feld]; return !!(f && f.aufgedeckt && WASSER.includes(f.inhalt)); };

export function trinken(t, cfg, s) {
  if (!amWasser(t, s)) return;
  const p = t.spieler[s], alt = p.energie;
  const ziel = cfg.zug.wasser.auffuellen === 'max' ? energieMax(cfg) : Math.min(energieMax(cfg), cfg.zug.wasser.auffuellen);
  p.energie = Math.max(p.energie, ziel);
  log(t, `${p.name} trinkt: Energie ${alt} → ${p.energie}`);
}

export function wuerfeln(t, art) {
  const seiten = art === 'W3' ? 3 : art === 'W6' ? 6 : STRANDRING;
  const wert = ganz(t, 'frei', 1, seiten);
  t.wuerfel = [...t.wuerfel, { wuerfel: art, wert, spieler: t.aktiv }].slice(-12);
  log(t, `würfelt ${art}: ${wert}`);
  return wert;
}

// W42-Wurf: Startfeld am Strand (nicht auf einem schon belegten Startfeld).
export function startWurf(t, s) {
  const belegt = new Set(t.spieler.filter((_, k) => k !== s).map((p) => p.startNr));
  let nr = 1;
  for (let v = 0; v < 50; v++) {
    nr = ganz(t, 'frei', 1, STRANDRING);
    t.wuerfel = [...t.wuerfel, { wuerfel: 'W42', wert: nr, spieler: s }].slice(-12);
    if (!belegt.has(nr)) break;
  }
  const f = Object.values(t.felder).find((x) => x.kuestenNr === nr);
  f.aufgedeckt = true;
  const p = t.spieler[s];
  p.startNr = nr; p.feld = f.key;
  log(t, `${p.name}: W42-Wurf → Startfeld ${nr}`);
}

export function spielerDazu(t, cfg) {
  if (t.spieler.length >= MAX_SPIELER) return false;
  const n = t.spieler.length;
  const frei = Object.keys(cfg.charaktere).filter((c) => cfg.charaktere[c].aktiv && !t.spieler.some((p) => p.charakter === c));
  const c = frei[0] ?? 'jaeger';
  t.spieler.push({
    name: `Spieler ${n + 1}`, charakter: c, herzen: herzenMax(cfg, c), energie: energieMax(cfg),
    ausruestung: { axt: false, hacke: false, waffe: null }, rohstoffe: Object.fromEntries(ROHSTOFFE.map((r) => [r, 0])), hand: [], feld: null, startNr: null,
    panel: { x: PANEL_ORT[n]?.[0] ?? 520, y: PANEL_ORT[n]?.[1] ?? 0, offen: true },
  });
  log(t, `Spieler ${n + 1} kommt dazu (${cfg.charaktere[c]?.name ?? c})`);
  return true;
}

export function amZug(t, s) { t.aktiv = s; log(t, `${t.spieler[s].name} ist am Zug`); }
export function naechster(t) { t.aktiv = (t.aktiv + 1) % t.spieler.length; log(t, `${t.spieler[t.aktiv].name} ist am Zug`); }

export function tagAendern(t, d) {
  const neu = Math.max(1, Math.min(60, t.tag + d));
  if (neu !== t.tag) { t.tag = neu; log(t, `Tag ${neu}`); }
}

// ---------------- Felder ----------------
export function aufdecken(t, cfg, key) {
  const f = t.felder[key];
  if (!f || f.aufgedeckt) return;
  f.aufgedeckt = true;
  if (f.inhalt === 'tier' && !f.tier) {
    const k = t.stapel.tier.karten.pop();
    f.tier = k?.ref ?? null;
    if (!f.tier) f.inhalt = 'leer';
    log(t, f.tier ? `deckt Feld ${key} auf: ${TIER[f.tier]?.name} aus dem Beutel` : `deckt Feld ${key} auf: Tierbeutel leer`);
    return;
  }
  log(t, `deckt auf: ${f.kuestenNr !== null ? `Strandfeld ${f.kuestenNr}` : `Feld ${key}`} (${INHALT[f.inhalt] ?? f.inhalt})`);
  void cfg;
}

export function verdecken(t, key) {
  const f = t.felder[key];
  if (!f || !f.aufgedeckt) return;
  f.aufgedeckt = false;
  log(t, `verdeckt: ${f.kuestenNr !== null ? `Strandfeld ${f.kuestenNr}` : `Feld ${key}`}`);
}

export function inhaltEntfernen(t, key) {
  const f = t.felder[key];
  if (!f) return;
  if (f.tier) t.stapel.tier.ablage.push(karte('tier', f.tier));
  Object.assign(f, { aufgedeckt: true, inhalt: 'leer', tier: null, bau: null, kompass: false });
  log(t, `entfernt den Inhalt von Feld ${key}`);
}

export function inhaltSetzen(t, key, inhalt, tier = null) {
  const f = t.felder[key];
  if (!f) return;
  Object.assign(f, { aufgedeckt: true, inhalt: tier ? 'tier' : inhalt, tier, kompass: inhalt === 'vulkanfels' });
  log(t, `setzt Feld ${key} auf ${tier ? TIER[tier]?.name : INHALT[inhalt] ?? inhalt}`);
}

export function bauSetzen(t, key, art) {
  const f = t.felder[key];
  if (!f) return;
  f.bau = art ? { art } : null;
  f.aufgedeckt = true;
  log(t, art ? `baut ${art === 'lagerfeuer' ? 'ein Lagerfeuer' : 'einen Shelter'} auf Feld ${key}` : `entfernt den Bau auf Feld ${key}`);
}

// Inhalt (Plättchen, Tier, Bau) von einem Feld auf ein anderes verschieben.
export function inhaltVerschieben(t, von, nach) {
  const a = t.felder[von], b = t.felder[nach];
  if (!a || !b || von === nach) return;
  const teil = { inhalt: a.inhalt, tier: a.tier, bau: a.bau, kompass: a.kompass };
  Object.assign(b, { ...teil, aufgedeckt: true });
  Object.assign(a, { inhalt: 'leer', tier: null, bau: null, kompass: false });
  log(t, `verschiebt den Inhalt von Feld ${von} nach Feld ${nach}`);
}

export function biomSetzen(t, key, biom, plaettchen) {
  const f = t.felder[key];
  if (!f || f.biom === biom) return;
  f.biom = biom;
  if (!(f.inhalt in (plaettchen[biom] ?? {})) && f.inhalt !== 'tier') f.inhalt = STANDARD_INHALT[biom];
  log(t, `Pinsel: Feld ${key} wird ${biom}`);
}

export function figurBewegen(t, cfg, s, key) {
  const p = t.spieler[s], f = t.felder[key];
  if (!p || !f) return;
  if (!f.aufgedeckt) aufdecken(t, cfg, key);
  p.feld = key;
  log(t, `${p.name} zieht auf ${f.kuestenNr !== null ? `Strandfeld ${f.kuestenNr}` : `Feld ${key}`}`);
}

// ---------------- Marker ----------------
export function markerDazu(t, x, y) { t.marker.push({ id: uid('m'), text: 'Notiz', x, y }); log(t, 'setzt einen Marker'); }
export function markerText(t, id, text) { const m = t.marker.find((x) => x.id === id); if (m) m.text = text.slice(0, 120); }
export function markerWeg(t, id) { t.marker = t.marker.filter((x) => x.id !== id); log(t, 'entfernt einen Marker'); }

// ---------------- Tierjagd ----------------
export function tierjagd(t, cfg, bonus) {
  const k = t.stapel.tier.karten.at(-1);
  if (!k) return null;
  const wurf = ganz(t, 'frei', 1, 6);
  t.wuerfel = [...t.wuerfel, { wuerfel: 'W6', wert: wurf, spieler: t.aktiv }].slice(-12);
  const gross = k.ref in cfg.tiere.gross;
  const ziel = gross ? cfg.tiere.zielGross : cfg.tiere.zielKlein;
  const sieg = wurf + bonus >= ziel;
  ziehen(t, cfg, 'tier');
  log(t, `Tierjagd: ${TIER[k.ref]?.name}, W6 ${wurf} + ${bonus} (nötig ${ziel}) → ${sieg ? 'Sieg' : 'Niederlage'}`);
  return { tier: k.ref, wurf, ziel, sieg, nahrung: gross ? cfg.tiere.nahrungGross : cfg.tiere.nahrungKlein, schaden: cfg.tiere.schaden?.[k.ref] ?? (gross ? 1 : 0) };
}

export function protokollCsv(t) {
  const q = (v) => `"${String(v).split('"').join('""')}"`;
  return ['Nr;Zeit;Tag;Am Zug;Ereignis', ...t.protokoll.map((e) => [e.nr, e.zeit, e.tag, e.spieler, e.text].map(q).join(';'))].join('\n');
}
