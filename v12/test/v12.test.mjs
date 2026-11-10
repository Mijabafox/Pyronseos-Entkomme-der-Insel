// Regeltests für den Regelstand V12 (05.11.2026 mit Team-Notizen N1 bis N6).
import test from 'node:test';
import assert from 'node:assert/strict';
import { standardLaden, klon } from '../engine/config.js';
import { nachbarn, schluessel, abstand, MITTE } from '../engine/hex.js';
import { ausfuehren, erlaubteAktionen, neuerZug, weitsichtZiele, flossGrund, beuteKategorien, craftGrund, kompassBesitzer, entscheider } from '../engine/engine.js';
import { validieren } from '../engine/validator.js';
import { sicht } from '../engine/sicht.js';
import { SCHALTER, schalterSetzen, schalterStand, schalterListe } from '../engine/schalter.js';
import { serie, auswerten } from '../sim/simulation.js';
import { cfgMit, partie } from './hilfe.mjs';

function bereit(s, i = 0, phase = 'bewegung') {
  s.aktiv = i; s.tagesKarte = 'ruhig'; s._modsFuer = null; s.startSpieler = 0;
  // Feste Charaktere ohne Sonderwirkung auf Herzen, Schritte und Abbau (Jäger nur im Tierkampf).
  s.spieler.forEach((p, k) => { if (k !== i || ['ueberlebenskuenstler', 'laeufer', 'sammlerin'].includes(p.charakter)) { p.charakter = k === i ? 'sanitaeter' : 'kundschafter'; p.herzen = 5; } });
  s.zug = neuerZug(s); s.zug.phase = phase;
  return s.spieler[i];
}
const feld = (s, pred) => Object.values(s.felder).find(pred);
const nachbar = (s, key, pred = () => true) => nachbarn(s.felder[key].coord).map(schluessel).find((k) => s.felder[k] && pred(s.felder[k]));
const hat = (s, a) => erlaubteAktionen(s).some((x) => JSON.stringify(x) === JSON.stringify(a));
// Runde zu Ende spielen: alle beenden ihren Zug, bis der Tag wechselt.
function tagBeenden(s) {
  const tag = s.tag;
  let k = 0;
  while (!s.ende && s.tag === tag && k++ < 200) {
    const a = erlaubteAktionen(s);
    ausfuehren(s, a.find((x) => x.typ === 'zugBeenden') ?? a.find((x) => x.typ === 'wuerfeln') ?? a[0]);
  }
}

test('Aufbau: Krater offen in der Mitte, 6 verdeckte Vulkanfelsen, genau einer mit Kompass', async () => {
  const cfg = await standardLaden();
  for (const seed of [1, 2, 3, 77]) {
    const s = partie(cfg, { seed });
    const mitte = s.felder[schluessel(MITTE)];
    assert.equal(mitte.inhalt, 'krater'); assert.equal(mitte.aufgedeckt, true); assert.equal(mitte.kompass, false);
    const felsen = Object.values(s.felder).filter((f) => f.ring === 1);
    assert.equal(felsen.length, 6);
    assert.ok(felsen.every((f) => f.biom === 'vulkan' && !f.aufgedeckt));
    assert.equal(felsen.filter((f) => f.kompass).length, 1);
  }
});

test('Aufbau: Plättchen-Aufteilung, 47 Strandplättchen, Tierbeutel 25, Vorrat begrenzt, Pool 36 Spezialkarten', async () => {
  const c = await standardLaden();
  const sum = (o) => Object.values(o).reduce((a, n) => a + n, 0);
  const pl = c.brett.plaettchen;
  assert.deepEqual([sum(pl.wald), sum(pl.wiese), sum(pl.gebirge), sum(pl.strand)], [53, 27, 35, 47]);
  const zahl = (x) => sum(Object.fromEntries(Object.entries(pl).map(([b, o]) => [b, o[x] ?? 0])));
  assert.equal(zahl('spezial'), 20); assert.equal(zahl('tier'), 23);
  assert.equal(zahl('wasserquelle') + zahl('bergquelle') + zahl('suesswasser'), 6);
  assert.equal(sum(c.tiere.klein), 15); assert.equal(sum(c.tiere.gross), 10);
  assert.deepEqual(c.vorrat.karten, { holz: 30, stein: 20, blaetter: 25, seil: 12, abfall: 20, nahrung: 15 });
  assert.deepEqual(c.vorrat.ausruestung, { axt: 4, hacke: 4, holzspeer: 4, steinmachete: 4, bandage: 6 });
  assert.deepEqual(c.vorrat.marker, { lagerfeuer: 10, shelter: 4, floss: 4 });
  const k = c.spezialkarten.karten;
  assert.equal(sum(Object.fromEntries(Object.entries(k).map(([id, x]) => [id, x.anzahl]))), 36);
  assert.equal(Object.values(k).filter((x) => x.art === 'joker').reduce((a, x) => a + x.anzahl, 0), 17);
  assert.equal(Object.values(k).filter((x) => x.art === 'gluecksfund').reduce((a, x) => a + x.anzahl, 0), 7);
  assert.equal(Object.values(k).filter((x) => x.art === 'gefahr').reduce((a, x) => a + x.anzahl, 0), 12);
  assert.deepEqual(c.crafting.rezepte.shelter.kosten, { holz: 1, abfall: 1 });
  for (const [modus, n] of [['koop', 2], ['koop', 3], ['koop', 4], ['team', 4], ['pvp', 2], ['pvp', 3], ['pvp', 4]]) assert.ok(validieren(c, { modus, spieler: n }).ok, `${modus} ${n}`);
});

test('Aufbau: Biome zufällig gemischt, Buchten fest, Strandabschnitte N 41–3 bis NW 36–40', async () => {
  const cfg = await standardLaden();
  const a = partie(cfg, { seed: 1 }), b = partie(cfg, { seed: 2 });
  const biome = (s) => Object.values(s.felder).filter((f) => f.ring >= 2 && f.ring <= 6).sort((x, y) => (x.key < y.key ? -1 : 1)).map((f) => f.biom).join(' ');
  assert.notEqual(biome(a), biome(b), 'jede Partie eine andere Insel');
  const buchten = (s) => Object.values(s.felder).filter((f) => f.duene).map((f) => f.key).sort().join(' ');
  assert.equal(buchten(a), buchten(b));
  assert.equal(Object.values(a.felder).filter((f) => f.duene).length, 5);
  const abschnitt = {};
  for (const f of Object.values(a.felder)) if (f.kuestenNr !== null) (abschnitt[f.richtung] ??= []).push(f.kuestenNr);
  const sortiert = (r) => abschnitt[r].sort((x, y) => x - y);
  assert.deepEqual(sortiert('N'), [1, 2, 3, 41, 42]);
  assert.deepEqual(sortiert('NO'), [4, 5, 6, 7, 8]);
  assert.deepEqual(sortiert('O'), [9, 10, 11, 12, 13, 14]);
  assert.deepEqual(sortiert('SO'), [15, 16, 17, 18, 19]);
  assert.deepEqual(sortiert('S'), [20, 21, 22, 23, 24]);
  assert.deepEqual(sortiert('SW'), [25, 26, 27, 28, 29]);
  assert.deepEqual(sortiert('W'), [30, 31, 32, 33, 34, 35]);
  assert.deepEqual(sortiert('NW'), [36, 37, 38, 39, 40]);
});

test('Aufbau: Brennsprit liegt immer unter den ersten 10 Karten des 20er-Stapels', async () => {
  const cfg = await standardLaden();
  for (let seed = 1; seed <= 60; seed++) {
    const s = partie(cfg, { seed });
    assert.equal(s.spezialStapel.length, 20);
    const oben = s.spezialStapel.slice(-10); // gezogen wird vom Ende
    assert.ok(oben.includes('brennsprit'), `Seed ${seed}`);
    assert.equal(s.spezialStapel.filter((k) => k === 'brennsprit').length, 1);
  }
});

test('Aufbau: feste Startfelder, W6 für Reihenfolge und Schritte gegen den Uhrzeigersinn, Startplättchen entfernt', async () => {
  const cfg = await standardLaden();
  for (const [n, felder] of [[2, [1, 22]], [3, [1, 15, 29]], [4, [1, 12, 23, 34]]]) {
    for (let seed = 1; seed <= 25; seed++) {
      const s = partie(cfg, { seed, modus: 'pvp', n });
      assert.deepEqual([...s.start.wahl].sort((a, b) => a - b), felder, 'jedes Startfeld genau einmal');
      s.spieler.forEach((p, k) => {
        const w = s.start.wurf[k];
        assert.ok(w >= 1 && w <= 6);
        const erwartet = ((((s.start.wahl[k] - w - 1) % 42) + 42) % 42) + 1;
        const f = s.felder[p.feld];
        assert.equal(f.kuestenNr, erwartet, 'gegen den Uhrzeigersinn = kleinere Nummer');
        assert.equal(f.aufgedeckt, true); assert.equal(f.inhalt, 'leer'); assert.equal(f.tier, null);
      });
      assert.equal(s.start.wurf[s.startSpieler], Math.max(...s.start.wurf), 'höchster Wurf beginnt');
      assert.equal(s.aktiv, s.startSpieler);
    }
  }
});

test('Reihenfolge: im Uhrzeigersinn ab der Startperson, der Tag wechselt nach einer vollen Runde', async () => {
  const cfg = await standardLaden();
  const s = partie(cfg, { seed: 5, n: 4, modus: 'pvp' });
  const st = s.startSpieler, folge = [];
  let k = 0;
  while (s.tag === 1 && k++ < 100) {
    if (folge.at(-1) !== s.aktiv) folge.push(s.aktiv);
    const a = erlaubteAktionen(s);
    ausfuehren(s, a.find((x) => x.typ === 'zugBeenden') ?? a.find((x) => x.typ === 'wuerfeln') ?? a[0]);
  }
  assert.deepEqual(folge, [0, 1, 2, 3].map((d) => (st + d) % 4));
  assert.equal(s.tag, 2);
  assert.equal(s.aktiv, st, 'der neue Tag beginnt wieder bei der Startperson');
});

test('N1: +1 Energie pro Tag vor der Tageskarte, höchstens 6, nicht für K.O.-Figuren, als Schalter abstellbar', async () => {
  const cfg = await standardLaden();
  const s = partie(cfg, { seed: 3, n: 3 });
  s.tagesStapel.push('ruhig'); // nächste Tageskarte ohne Wirkung
  s.spieler.forEach((p) => { p.energie = 2; });
  s.spieler[1].liegt = true; s.spieler[1].herzen = 0;
  tagBeenden(s);
  assert.equal(s.tag, 2);
  // Rasten (+2) plus neuer Tag (+1) = 5; K.O.-Figur unverändert
  assert.deepEqual(s.spieler.map((p) => p.energie), [5, 2, 5]);
  const iEnergie = s.log.findIndex((z) => z.includes('Tag 2') && z.includes('Neuer Tag'));
  const iKarte = s.log.findIndex((z) => z.includes('Tag 2') && z.includes('Tageskarte'));
  assert.ok(iEnergie >= 0 && iEnergie < iKarte, 'Energie kommt vor der Tageskarte');
  // Maximum 6
  const m = partie(cfg, { seed: 3, n: 2 });
  m.tagesStapel.push('ruhig');
  tagBeenden(m);
  assert.ok(m.spieler.every((p) => p.energie === 6));
  // Schalter aus
  const aus = partie(schalterSetzen(klon(cfg), 'energieProTag', true), { seed: 3, n: 3 });
  aus.tagesStapel.push('ruhig');
  aus.spieler.forEach((p) => { p.energie = 2; });
  tagBeenden(aus);
  assert.deepEqual(aus.spieler.map((p) => p.energie), [4, 4, 4], 'nur Rasten');
});

test('N2: Kompass bergen kostet 0 Energie, braucht die Spitzhacke und beendet nur die Bewegung', async () => {
  const s = partie(await standardLaden(), { seed: 5 });
  const v = feld(s, (f) => f.inhalt === 'vulkanfels');
  v.aufgedeckt = true;
  const p = bereit(s, 0); p.feld = v.key; p.energie = 0;
  assert.ok(!hat(s, { typ: 'kompassBergen' }), 'ohne Spitzhacke nicht');
  p.ausruestung.hacke = 1;
  assert.ok(hat(s, { typ: 'kompassBergen' }), 'auch mit 0 Energie');
  ausfuehren(s, { typ: 'kompassBergen' });
  assert.equal(p.kompass, true); assert.equal(p.energie, 0);
  assert.equal(s.aktiv, 0); assert.equal(s.zug.phase, 'aktion');
  assert.ok(!erlaubteAktionen(s).some((a) => a.typ === 'bewegen'), 'keine Bewegung mehr');
  assert.ok(hat(s, { typ: 'zugBeenden' }));
});

test('N3: Vulkanfelsen sind bei Weitsicht, Fernglas, Aussichtsfelsen und Vollmond ausgenommen, Betreten deckt auf', async () => {
  const cfg = await standardLaden();
  const s = partie(cfg, { seed: 6 });
  const fels = feld(s, (f) => f.ring === 1);
  const neben = nachbar(s, fels.key, (f) => f.ring === 2);
  s.felder[neben].aufgedeckt = true; s.felder[neben].inhalt = 'leer'; s.felder[neben].tier = null;
  const p = bereit(s, 0, 'weitsicht_waehlen'); p.feld = neben;
  for (const radius of [2, 3, 99]) {
    s.zug.weitsichtRadius = radius; s.zug.weitsichtOffen = 3;
    const ziele = weitsichtZiele(s);
    assert.ok(ziele.length > 0);
    assert.ok(ziele.every((k) => s.felder[k].biom !== 'vulkan'), `Umkreis ${radius}`);
  }
  // Vollmond zu Zugbeginn
  const m = partie(cfg, { seed: 6, tagesKarten: undefined });
  m.spieler[m.aktiv].feld = neben; m.felder[neben].aufgedeckt = true; m.felder[neben].inhalt = 'leer';
  m.tagesKarte = 'sterne'; m._modsFuer = null;
  ausfuehren(m, erlaubteAktionen(m).find((a) => a.typ === 'wuerfeln') ?? erlaubteAktionen(m)[0]);
  assert.ok(erlaubteAktionen(m).filter((a) => a.typ === 'aufdecken').every((a) => m.felder[a.feld].biom !== 'vulkan'));
  // Betreten deckt auf
  bereit(s, 0); p.feld = neben; p.energie = 6;
  ausfuehren(s, { typ: 'bewegen', feld: fels.key });
  assert.equal(s.felder[fels.key].aufgedeckt, true);
});

test('N4 + N5: Kompass für beide Flösse nötig; Kompasskarte für alle sichtbar, im normalen Duell raubbar, im Fern-Duell nicht', async () => {
  const cfg = await standardLaden();
  const s = partie(cfg, { seed: 14, modus: 'pvp', n: 2 });
  const p = bereit(s, 0);
  const q = s.spieler[1];
  q.feld = p.feld; q.kompass = true; q.route = 'SW'; q.hand.holz = 2;
  // sichtbar für alle, Routenkarte verdeckt
  const sv = sicht(s, 0);
  assert.equal(sv.spieler[1].kompass, true);
  assert.equal(sv.spieler[1].route, 'verdeckt');
  assert.equal(kompassBesitzer(s, [1]), 1);
  // Beute-Möglichkeiten
  assert.deepEqual(beuteKategorien(s, 1, false), ['karte', 'kompass']);
  assert.deepEqual(beuteKategorien(s, 1, true), ['karte'], 'Fern-Duell: Kompass sicher');
  // Fern-Duell über die Karte
  p.karten.push('duell');
  s.testWuerfe = [6, 1];
  ausfuehren(s, { typ: 'duell', ziel: 1 });
  assert.equal(s.zug.phase, 'beute');
  assert.deepEqual(erlaubteAktionen(s).map((a) => a.wahl), ['karte']);
  ausfuehren(s, { typ: 'beute', wahl: 'karte' });
  assert.equal(q.kompass, true, 'Kompass bleibt beim Verlierer');
  assert.equal(q.herzen, 4);
  // Kompass für beide Flösse
  const f = partie(cfg, { seed: 15, modus: 'pvp', n: 2 });
  const a = bereit(f, 0); a.route = 'N';
  a.feld = feld(f, (x) => x.richtung === 'N' && x.kuestenNr !== null).key;
  Object.assign(a.hand, { holz: 4, seil: 3, nahrung: 1, blaetter: 1 });
  assert.match(flossGrund(f, 'solide'), /Kompass/);
  assert.match(flossGrund(f, 'not'), /Kompass/);
  a.kompass = true;
  assert.equal(flossGrund(f, 'solide'), null);
  assert.equal(flossGrund(f, 'not'), null);
});

test('Kompass: wer ihn hat, aber keine Routenkarte mehr, zieht zu Zugbeginn eine neue; Ausscheiden legt ihn zurück', async () => {
  const cfg = await standardLaden();
  const s = partie(cfg, { seed: 21, modus: 'pvp', n: 3 });
  const naechster = (s.aktiv + 1) % 3;
  s.spieler[naechster].kompass = true; s.spieler[naechster].route = null;
  ausfuehren(s, { typ: 'wuerfeln' });
  while (s.aktiv !== naechster) { const a = erlaubteAktionen(s); ausfuehren(s, a.find((x) => x.typ === 'zugBeenden') ?? a[0]); }
  assert.ok(s.spieler[naechster].route, 'neue Routenkarte gezogen');
  // Ausscheiden im PvP: Kompass zurück unter den Vulkanfelsen
  const fels = feld(s, (f) => f.inhalt === 'vulkanfels');
  fels.kompass = false;
  bereit(s, naechster);
  const sp = feld(s, (f) => f.inhalt === 'spezial' && f.ring > 1 && f.ring < 7);
  const von = nachbar(s, sp.key, (f) => !f.tier);
  s.felder[von].aufgedeckt = true; s.felder[von].inhalt = 'leer';
  s.spieler[naechster].feld = von; s.spieler[naechster].herzen = 1; s.spieler[naechster].energie = 6;
  s.spezialStapel.push('fallgrube');
  ausfuehren(s, { typ: 'bewegen', feld: sp.key });
  assert.equal(s.spieler[naechster].ausgeschieden, true);
  assert.equal(s.spieler[naechster].kompass, false);
  assert.equal(fels.kompass, true);
});

test('Ausrüstung: Karten auf der Hand, kein Limit bis der Vorrat leer ist, beste Waffe zählt; Schalter «max. 1 pro Typ»', async () => {
  const cfg = await standardLaden();
  const s = partie(cfg, { seed: 30, modus: 'pvp', n: 2 });
  const p = bereit(s, 0);
  Object.assign(p.hand, { holz: 20, stein: 20, seil: 10, abfall: 5 });
  ausfuehren(s, { typ: 'craften', rezept: 'holzspeer' });
  assert.equal(p.ausruestung.waffe, 'holzspeer');
  ausfuehren(s, { typ: 'craften', rezept: 'steinmachete' });
  assert.equal(p.ausruestung.waffe, 'steinmachete', 'nur die beste Waffe zählt');
  assert.equal(p.ausruestung.holzspeer, 1); assert.equal(p.ausruestung.steinmachete, 1);
  for (let k = 0; k < 4; k++) ausfuehren(s, { typ: 'craften', rezept: 'steinaxt' });
  assert.equal(p.ausruestung.axt, 4);
  assert.match(craftGrund(s, 'steinaxt'), /Vorrat/, 'nur 4 Steinäxte im Spiel');
  // Schalter
  const t = partie(schalterSetzen(klon(cfg), 'werkzeuglimit', true), { seed: 30, modus: 'pvp', n: 2 });
  const q = bereit(t, 0);
  Object.assign(q.hand, { holz: 20, stein: 20, seil: 10 });
  ausfuehren(t, { typ: 'craften', rezept: 'steinaxt' });
  assert.match(craftGrund(t, 'steinaxt'), /höchstens 1/);
});

test('Duell: blind gezogene Handkarte kann Werkzeug sein; Schalter «Werkzeuge offen» schützt und zeigt sie', async () => {
  const cfg = await standardLaden();
  const s = partie(cfg, { seed: 31, modus: 'pvp', n: 2 });
  const p = bereit(s, 0), q = s.spieler[1];
  q.feld = p.feld; q.ausruestung.hacke = 1;
  assert.equal(sicht(s, 0).spieler[1].ausruestung.hacke, 0, 'verdeckt auf der Hand');
  assert.equal(sicht(s, 0).spieler[1].anzahlRohstoffe, 1, 'aber als Handkarte gezählt');
  s.testWuerfe = [6, 1];
  ausfuehren(s, { typ: 'angreifen', ziel: 1 });
  ausfuehren(s, { typ: 'beute', wahl: 'karte' });
  assert.equal(q.ausruestung.hacke, 0); assert.equal(p.ausruestung.hacke, 1);
  const o = partie(schalterSetzen(klon(cfg), 'werkzeugeOffen', true), { seed: 31, modus: 'pvp', n: 2 });
  const a = bereit(o, 0), b = o.spieler[1];
  b.feld = a.feld; b.ausruestung.hacke = 1;
  assert.equal(sicht(o, 0).spieler[1].ausruestung.hacke, 1, 'offen sichtbar');
  assert.deepEqual(beuteKategorien(o, 1, false), [], 'offene Werkzeuge sind nicht raubbar');
});

test('Pflanzenbandage: Karte craften, später benutzen (+2 Herzen); Wiederbeleben auf dem Nachbarfeld mit 2 Herzen', async () => {
  const cfg = await standardLaden();
  const s = partie(cfg, { seed: 32, n: 2 });
  const p = bereit(s, 0);
  p.herzen = 2; Object.assign(p.hand, { blaetter: 4, nahrung: 2 });
  ausfuehren(s, { typ: 'craften', rezept: 'bandage' });
  assert.equal(p.ausruestung.bandage, 1); assert.equal(p.herzen, 2, 'Craften heilt noch nicht');
  ausfuehren(s, { typ: 'bandage' });
  assert.equal(p.herzen, 4); assert.equal(p.ausruestung.bandage, 0);
  // Wiederbeleben vom Nachbarfeld
  const q = s.spieler[1];
  q.feld = nachbar(s, p.feld); q.liegt = true; q.herzen = 0;
  assert.ok(hat(s, { typ: 'reanimieren', ziel: 1 }), 'Nachbarfeld reicht');
  ausfuehren(s, { typ: 'reanimieren', ziel: 1 });
  assert.equal(q.liegt, false); assert.equal(q.herzen, 2);
  // zwei Felder entfernt: nicht möglich
  q.liegt = true; Object.assign(p.hand, { blaetter: 4, nahrung: 2 });
  const weit = Object.values(s.felder).find((f) => abstand(f.coord, s.felder[p.feld].coord) === 2);
  q.feld = weit.key;
  assert.ok(!hat(s, { typ: 'reanimieren', ziel: 1 }));
});

test('Rasten nur ohne Bewegung und ohne Abbau; Tierkampf ohne Flucht, mit Schalter Flucht für 1 Energie', async () => {
  const cfg = await standardLaden();
  const s = partie(cfg, { seed: 33, n: 2 });
  const p = bereit(s, 0);
  const baum = feld(s, (f) => f.inhalt === 'baum');
  baum.aufgedeckt = true; p.feld = baum.key; p.energie = 2;
  ausfuehren(s, { typ: 'abbauen' });
  ausfuehren(s, { typ: 'zugBeenden' });
  assert.ok(!s.log.some((z) => z.includes('rastet')), 'nach dem Abbau kein Rasten');
  assert.ok(p.energie <= 3, 'höchstens +1 Energie durch den neuen Tag');
  // Tierkampf
  for (const flucht of [false, true]) {
    const t = partie(flucht ? schalterSetzen(klon(cfg), 'fluchtVorTier', true) : cfg, { seed: 34, n: 2 });
    const tier = feld(t, (f) => f.inhalt === 'tier' && f.ring > 1 && f.ring < 7);
    const von = nachbar(t, tier.key, (f) => !f.tier && f.inhalt !== 'tier');
    t.felder[von].aufgedeckt = true; t.felder[von].inhalt = 'leer';
    const q = bereit(t, 0); q.feld = von; q.energie = 6;
    t.tierBeutel.push('baer');
    ausfuehren(t, { typ: 'bewegen', feld: tier.key });
    assert.equal(t.zug.phase, 'kampf');
    assert.equal(erlaubteAktionen(t).some((a) => a.typ === 'fliehen'), flucht, flucht ? 'Schalter: Flucht möglich' : 'Pflichtkampf');
  }
});

test('Spezialfeld aus der Ferne aufgedeckt: sofort Karte ziehen; Koop: Fern-Duell-Karte wird abgelegt und neu gezogen', async () => {
  const cfg = await standardLaden();
  const s = partie(cfg, { seed: 35, n: 2 });
  const p = bereit(s, 0, 'weitsicht_waehlen');
  const sp = feld(s, (f) => f.inhalt === 'spezial' && !f.aufgedeckt && f.ring > 1 && f.ring < 7);
  const von = nachbar(s, sp.key, (f) => f.inhalt !== 'tier' && f.inhalt !== 'spezial');
  s.felder[von].aufgedeckt = true; p.feld = von; p.herzen = 3;
  s.zug.weitsichtOffen = 1; s.zug.nachAufdecken = 'bewegung';
  s.spezialStapel.push('heilkraeuter', 'duell'); // oben liegt «duell» (im Koop nicht spielbar)
  ausfuehren(s, { typ: 'aufdecken', feld: sp.key });
  assert.equal(p.herzen, 5, 'Kräuter wirken sofort, obwohl die Figur nicht auf dem Feld steht');
  assert.equal(p.feld, von);
  assert.equal(s.felder[sp.key].inhalt, 'leer');
  assert.ok(s.spezialAblage.includes('duell'), 'Fern-Duell im Koop abgelegt');
  assert.ok(!p.karten.includes('duell'));
  assert.equal(s.zug.phase, 'bewegung');
});

test('Gebirge für Tageskarten: nur solange das graue Plättchen liegt; Wald merkt sich das Biom nach dem Abbau', async () => {
  const cfg = await standardLaden();
  const s = partie(cfg, { seed: 36, n: 2, tagesKarten: undefined });
  const fels = feld(s, (f) => f.biom === 'gebirge' && f.inhalt === 'fels');
  fels.aufgedeckt = true;
  s.spieler[0].feld = fels.key; s.spieler[1].feld = fels.key;
  s.spieler.forEach((p) => { p.herzen = 5; });
  // Erdbeben mit Plättchen: Wurf 1 = −1 Herz
  s.tagesStapel.push('erdbeben'); s.testWuerfe = [1, 1];
  tagBeenden(s);
  assert.equal(s.tagesKarte, 'erdbeben');
  assert.ok(s.spieler.every((p) => p.herzen === 4));
  // Plättchen abgebaut: kein Gebirge mehr
  fels.inhalt = 'leer';
  s.tagesStapel.push('erdbeben'); s.testWuerfe = [1, 1];
  tagBeenden(s);
  assert.ok(s.spieler.every((p) => p.herzen === 4), 'ohne Plättchen kein Gebirge');
  s.testWuerfe = [];
  // Wald bleibt Wald (Wild: ausweichen)
  const wald = feld(s, (f) => f.biom === 'wald' && f.ring > 1);
  wald.aufgedeckt = true; wald.inhalt = 'leer'; wald.tier = null;
  for (const k of nachbarn(wald.coord).map(schluessel)) if (s.felder[k]) { s.felder[k].aufgedeckt = true; s.felder[k].tier = null; if (s.felder[k].inhalt === 'tier') s.felder[k].inhalt = 'leer'; }
  s.spieler[0].feld = wald.key; s.spieler[1].feld = wald.key;
  s.tagesStapel.push('wildwechsel');
  tagBeenden(s);
  assert.ok(s.spieler.every((p) => p.feld !== wald.key), 'abgeräumter Wald zählt weiter als Wald');
});

test('Test-Schalter: 9 Schalter, einzeln umstellbar, Standard = Regelstand, alle Varianten sind gültig', async () => {
  const cfg = await standardLaden();
  assert.equal(SCHALTER.length, 9);
  assert.ok(schalterListe(cfg).every((x) => x.stand === 'standard'));
  for (const sch of SCHALTER) {
    const c = schalterSetzen(klon(cfg), sch.id, true);
    assert.equal(schalterStand(c, sch.id), 'alternative', sch.id);
    for (const andere of SCHALTER) if (andere.id !== sch.id && !(sch.id === 'spieldauer' && andere.id === 'ruhigeTage')) assert.equal(schalterStand(c, andere.id), 'standard', `${sch.id} lässt ${andere.id} in Ruhe`);
    for (const [modus, n] of [['koop', 3], ['team', 4], ['pvp', 2]]) assert.ok(validieren(c, { modus, spieler: n }).ok, `${sch.id} ${modus}`);
    schalterSetzen(c, sch.id, false);
    assert.ok(schalterListe(c).every((x) => x.stand === 'standard'), `${sch.id} zurück auf Standard`);
  }
  const lang = partie(schalterSetzen(klon(cfg), 'spieldauer', true), { seed: 1 });
  assert.equal(lang.tagesStapel.length + 1, 30, '30 Tage = 10 Ruhige + 19 Ereignisse + Lava');
  const feuer = schalterSetzen(klon(cfg), 'feuerabstaende', true);
  assert.deepEqual([1, 2, 3, 4].map((n) => feuer.fluchtwege.feuer.tabelle[n].abstand), [13, 9, 7, 6]);
  const tier = schalterSetzen(klon(cfg), 'tierschaden', true);
  assert.equal(tier.tiere.schaden.hase, 0); assert.equal(tier.tiere.schaden.baer, 1);
  assert.deepEqual(schalterSetzen(klon(cfg), 'shelterPreis', true).crafting.rezepte.shelter.kosten, { holz: 3, seil: 2 });
});

test('Simulation: alle Modi und Spielerzahlen laufen ohne Abbruch, mit K.O.- und Kompass-Kennzahlen', async () => {
  const cfg = await standardLaden();
  for (const [modus, spieler] of [['koop', 2], ['koop', 3], ['koop', 4], ['team', 4], ['pvp', 2], ['pvp', 3], ['pvp', 4]]) {
    const a = auswerten(serie(cfg, { partien: 6, seed: 100, modus, spieler, bots: 'normal' }));
    assert.equal(a.abbrueche, 0, `${modus} ${spieler}: keine Partie bleibt hängen`);
    assert.equal(typeof a.ko, 'number');
    assert.ok('kompassTag' in a && 'tageBisSieg' in a && 'proWeg' in a);
  }
});

test('Simulation: jeder der drei Fluchtwege ist erreichbar (die anderen beiden ausgeschaltet)', async () => {
  for (const weg of ['floss', 'feuer', 'wrack']) {
    const aus = Object.fromEntries(['floss', 'feuer', 'wrack'].filter((w) => w !== weg).map((w) => [w, { aktiv: false }]));
    const cfg = await cfgMit({ fluchtwege: aus });
    const a = auswerten(serie(cfg, { partien: 30, seed: 1, modus: 'koop', spieler: 2, bots: 'normal' }));
    assert.ok(a.proWeg[weg] > 0, `${weg}: mindestens ein Sieg in 30 Partien`);
    assert.equal(a.abbrueche, 0);
  }
});

// ---- Regeländerungen vom 10.11.2026 ----

test('Shelter wie die Wasserquelle: auch nach der Bewegung +4 Energie (höchstens 6), danach endet der Zug; Rasten ohne Shelter +2', async () => {
  const s = partie(await standardLaden(), { seed: 40, n: 2 });
  const p = bereit(s, 0);
  const f = s.felder[p.feld];
  const nb = nachbar(s, p.feld, (x) => !x.tier && x.inhalt !== 'tier' && x.inhalt !== 'spezial');
  s.felder[nb].aufgedeckt = true; s.felder[nb].inhalt = 'leer';
  s.felder[nb].bau = { art: 'shelter', besitzer: 's1', brennt: false };
  p.energie = 2;
  assert.ok(!hat(s, { typ: 'shelterErholen' }), 'nicht ohne Shelter');
  ausfuehren(s, { typ: 'bewegen', feld: nb });
  assert.ok(hat(s, { typ: 'shelterErholen' }), 'auch nach der Bewegung');
  ausfuehren(s, { typ: 'shelterErholen' });
  assert.equal(p.energie, 5, '1 + 4');
  assert.notEqual(s.aktiv, 0, 'der Zug endet');
  // höchstens 6
  const t = partie(await standardLaden(), { seed: 40, n: 2 });
  const q = bereit(t, 0);
  t.felder[q.feld].bau = { art: 'shelter', besitzer: 's1', brennt: false };
  q.energie = 4;
  ausfuehren(t, { typ: 'shelterErholen' });
  assert.equal(q.energie, 6);
  // Rasten im Shelter ohne Erholen-Aktion gibt nur +2
  const u = partie(await standardLaden(), { seed: 40, n: 2 });
  const r = bereit(u, 0);
  u.felder[r.feld].bau = { art: 'shelter', besitzer: 's1', brennt: false };
  r.energie = 1;
  ausfuehren(u, { typ: 'zugBeenden' });
  assert.ok(r.energie <= 4, 'Rasten +2 (plus höchstens 1 für den neuen Tag)');
  void f;
});

test('Nach einem Duell endet der Zug: normales Duell, Fern-Duell und Gleichstand', async () => {
  const cfg = await standardLaden();
  for (const [art, wuerfe] of [['angreifen', [6, 1]], ['angreifen', [3, 3]], ['duell', [6, 1]], ['angreifen', [1, 6]]]) {
    const s = partie(cfg, { seed: 41, modus: 'pvp', n: 2 });
    const p = bereit(s, 0), q = s.spieler[1];
    q.feld = p.feld; q.hand.holz = 2; p.hand.holz = 2;
    if (art === 'duell') p.karten.push('duell');
    s.testWuerfe = [...wuerfe];
    ausfuehren(s, { typ: art, ziel: 1 });
    if (s.zug.phase === 'beute') ausfuehren(s, erlaubteAktionen(s)[0]);
    assert.notEqual(s.aktiv, 0, `${art} ${wuerfe.join(':')}: der Zug ist zu Ende`);
  }
});

test('Grosses Tier: bei Niederlage zurück aufs vorherige Feld, das Tier bleibt, Zug endet; Sieg: Tier zurück in den Beutel', async () => {
  const cfg = await standardLaden();
  const s = partie(cfg, { seed: 42, n: 2 });
  const t = feld(s, (f) => f.inhalt === 'tier' && f.ring > 1 && f.ring < 7);
  t.aufgedeckt = true; t.tier = 'tiger';
  const von = nachbar(s, t.key, (f) => !f.tier && f.inhalt !== 'tier' && f.inhalt !== 'spezial');
  s.felder[von].aufgedeckt = true; s.felder[von].inhalt = 'leer';
  const p = bereit(s, 0); p.feld = von; p.energie = 6;
  ausfuehren(s, { typ: 'bewegen', feld: t.key });
  s.testWuerfe = [1];
  ausfuehren(s, { typ: 'kaempfen' });
  assert.equal(p.feld, von); assert.equal(s.felder[t.key].tier, 'tiger'); assert.equal(p.herzen, 3); assert.notEqual(s.aktiv, 0);
  // Sieg
  const v = partie(cfg, { seed: 42, n: 2 });
  const tv = feld(v, (f) => f.inhalt === 'tier' && f.ring > 1 && f.ring < 7);
  tv.aufgedeckt = true; tv.tier = 'tiger';
  const vv = nachbar(v, tv.key, (f) => !f.tier && f.inhalt !== 'tier' && f.inhalt !== 'spezial');
  v.felder[vv].aufgedeckt = true; v.felder[vv].inhalt = 'leer';
  const q = bereit(v, 0); q.feld = vv;
  const vorher = v.tierBeutel.length;
  ausfuehren(v, { typ: 'bewegen', feld: tv.key });
  v.testWuerfe = [6];
  ausfuehren(v, { typ: 'kaempfen' });
  assert.equal(v.felder[tv.key].tier, null);
  assert.equal(v.tierBeutel.length, vorher + 1, 'Tier zurück in den Beutel');
});

test('Rauchbombe: bei Niederlage gefragt, Feld frei wählbar, 0 Schaden, 1 Energie, nach dem Tierkampf geht der Zug weiter', async () => {
  const cfg = await standardLaden();
  const s = partie(cfg, { seed: 43, n: 2 });
  const t = feld(s, (f) => f.inhalt === 'tier' && f.ring > 1 && f.ring < 7);
  t.aufgedeckt = true; t.tier = 'baer';
  for (const k of nachbarn(t.coord).map(schluessel)) if (s.felder[k]) { s.felder[k].aufgedeckt = true; s.felder[k].tier = null; s.felder[k].inhalt = 'leer'; }
  const von = nachbar(s, t.key);
  const p = bereit(s, 0); p.feld = von; p.energie = 6; p.karten.push('rauchbombe');
  ausfuehren(s, { typ: 'bewegen', feld: t.key });
  s.testWuerfe = [1];
  ausfuehren(s, { typ: 'kaempfen' });
  assert.equal(s.zug.phase, 'rauch');
  const wahl = erlaubteAktionen(s).filter((a) => a.feld);
  assert.ok(wahl.length >= 2, 'mehrere Felder zur Wahl');
  assert.ok(hat(s, { typ: 'rauch', feld: null }), 'man kann auch verzichten');
  const ziel = wahl.find((a) => a.feld !== von).feld;
  ausfuehren(s, { typ: 'rauch', feld: ziel });
  assert.equal(p.feld, ziel, 'gewähltes Feld');
  assert.equal(p.herzen, 5, '0 Schaden'); assert.equal(p.energie, 4, '−1 Schritt, −1 Rauch');
  assert.equal(s.aktiv, 0, 'der Zug geht weiter'); assert.equal(s.zug.phase, 'bewegung');
  assert.ok(!p.karten.includes('rauchbombe'));
  assert.equal(s.felder[t.key].tier, 'baer', 'das Tier bleibt liegen');
  // Verzicht: normale Niederlage
  const u = partie(cfg, { seed: 43, n: 2 });
  const tu = feld(u, (f) => f.inhalt === 'tier' && f.ring > 1 && f.ring < 7);
  tu.aufgedeckt = true; tu.tier = 'baer';
  for (const k of nachbarn(tu.coord).map(schluessel)) if (u.felder[k]) { u.felder[k].aufgedeckt = true; u.felder[k].tier = null; u.felder[k].inhalt = 'leer'; }
  const q = bereit(u, 0); q.feld = nachbar(u, tu.key); q.karten.push('rauchbombe');
  ausfuehren(u, { typ: 'bewegen', feld: tu.key });
  u.testWuerfe = [1];
  ausfuehren(u, { typ: 'kaempfen' });
  ausfuehren(u, { typ: 'rauch', feld: null });
  assert.equal(q.herzen, 3); assert.ok(q.karten.includes('rauchbombe')); assert.notEqual(u.aktiv, 0);
});

test('Rauchbombe im Duell: die verlierende Person entscheidet, 0 Schaden, keine Beute, der Zug des Angreifers endet', async () => {
  const s = partie(await standardLaden(), { seed: 44, modus: 'pvp', n: 2 });
  const p = bereit(s, 0), q = s.spieler[1];
  q.feld = p.feld; q.kompass = true; q.karten.push('rauchbombe'); q.energie = 3;
  for (const k of nachbarn(s.felder[p.feld].coord).map(schluessel)) if (s.felder[k]) { s.felder[k].aufgedeckt = true; s.felder[k].tier = null; s.felder[k].inhalt = 'leer'; }
  s.testWuerfe = [6, 1];
  ausfuehren(s, { typ: 'angreifen', ziel: 1 });
  assert.equal(s.zug.phase, 'rauch');
  assert.equal(entscheider(s), 1, 'die Verteidigerin entscheidet');
  const f = erlaubteAktionen(s).find((a) => a.feld).feld;
  ausfuehren(s, { typ: 'rauch', feld: f });
  assert.equal(q.feld, f); assert.equal(q.herzen, 5); assert.equal(q.kompass, true, 'keine Beute');
  assert.equal(q.energie, 2);
  assert.notEqual(s.aktiv, 0, 'Zug des Angreifers zu Ende');
});
