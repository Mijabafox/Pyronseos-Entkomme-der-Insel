// Regeltests für den Regelstand V13 (11.11.2026, Dokumentation V08 und Spielanleitung v5).
// Übernommen aus V12, soweit die Regel gleich geblieben ist; neue Regeln weiter unten.
import test from 'node:test';
import assert from 'node:assert/strict';
import { standardLaden, klon } from '../engine/config.js';
import { nachbarn, schluessel, abstand, MITTE } from '../engine/hex.js';
import { ausfuehren, erlaubteAktionen, neuerZug, weitsichtZiele, flossGrund, beuteKategorien, craftGrund, kompassBesitzer, entscheider, ergebnisVon, handelPruefen, flossKosten } from '../engine/engine.js';
import { istGebirge, fliehende } from '../engine/kern.js';
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
  for (const [n, felder] of [[2, [1, 22]], [3, [1, 15, 29]], [4, [6, 17, 27, 38]]]) {
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

test('Reihenfolge: gegen den Uhrzeigersinn (Sitzreihenfolge) ab der Startperson, der Tag wechselt nach einer vollen Runde', async () => {
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

// =====================================================================
// Neue Regeln V13 (Regelstand 11.11.2026)
// =====================================================================

const leerMachen = (s, key) => { const f = s.felder[key]; f.aufgedeckt = true; f.inhalt = 'leer'; f.tier = null; return f; };

test('V13 Zugablauf: essen und bauen zwischen den Schritten, nach dem Abbau nur noch craften, dann Zugende', async () => {
  const s = partie(await standardLaden(), { seed: 60, n: 2 });
  const p = bereit(s, 0);
  p.energie = 2; p.hand.nahrung = 1; Object.assign(p.hand, { blaetter: 4, holz: 2, stein: 1, abfall: 1 });
  const a = nachbar(s, p.feld, (f) => f.kuestenNr !== null);
  leerMachen(s, a);
  ausfuehren(s, { typ: 'bewegen', feld: a });
  assert.ok(hat(s, { typ: 'essen' }), 'essen nach einem Schritt');
  ausfuehren(s, { typ: 'essen' });
  assert.equal(p.energie, 4);
  ausfuehren(s, { typ: 'craften', rezept: 'seil' });
  assert.equal(s.zug.phase, 'bewegung', 'nach dem Bauen darf man weiterlaufen');
  // Strandgut auf dem Nachbarfeld: hinlaufen, abbauen, danach nur craften (Feuer auf dem abgebauten Feld)
  const b = nachbar(s, a, (f) => f.kuestenNr !== null && f.key !== p.feld && f.key !== a);
  Object.assign(s.felder[b], { aufgedeckt: true, inhalt: 'strandgut', tier: null });
  ausfuehren(s, { typ: 'bewegen', feld: b });
  assert.equal(craftGrund(s, 'lagerfeuer') !== null, true, 'vor dem Abbau liegt noch ein Plättchen');
  ausfuehren(s, { typ: 'abbauen' });
  assert.equal(s.zug.phase, 'aktion');
  const typen = new Set(erlaubteAktionen(s).map((x) => x.typ));
  assert.deepEqual([...typen].sort(), ['craften', 'zugBeenden'], 'nach dem Abbau nur Bau-Menü und Zug beenden');
  ausfuehren(s, { typ: 'craften', rezept: 'lagerfeuer' });
  assert.equal(s.felder[b].bau?.art, 'lagerfeuer', 'Feuer auf dem gerade abgebauten Feld');
  ausfuehren(s, { typ: 'zugBeenden' });
  assert.notEqual(s.aktiv, 0);
});

test('V13 Bauen: Feuer und Shelter nur auf leeren Feldern, je 1 pro Feld, Lagerfeuer heilt nicht', async () => {
  const s = partie(await standardLaden(), { seed: 61, n: 2 });
  const p = bereit(s, 0);
  Object.assign(p.hand, { holz: 6, stein: 2, abfall: 4 });
  p.herzen = 3;
  const f = s.felder[p.feld];
  f.inhalt = 'strandgut';
  assert.match(craftGrund(s, 'lagerfeuer'), /leeren oder abgebauten/);
  assert.match(craftGrund(s, 'shelter'), /leeren oder abgebauten/);
  f.inhalt = 'leer';
  ausfuehren(s, { typ: 'craften', rezept: 'lagerfeuer' });
  assert.equal(p.herzen, 3, 'das Lagerfeuer heilt nicht');
  assert.match(craftGrund(s, 'lagerfeuer'), /schon ein Feuer/);
  assert.equal(craftGrund(s, 'shelter'), null, 'Feuer und Shelter auf demselben Feld');
  ausfuehren(s, { typ: 'craften', rezept: 'shelter' });
  assert.ok(f.shelter && f.bau.art === 'lagerfeuer');
  assert.match(craftGrund(s, 'shelter'), /schon ein Shelter/);
  const q = s.felder[nachbar(s, p.feld, (x) => x.inhalt === 'wasserquelle' || true)];
  void q;
});

test('V13 Shelter: betreten oder drin bleiben +4 Energie, Zug endet; Durchlaufen erlaubt', async () => {
  const cfg = await standardLaden();
  const s = partie(cfg, { seed: 62, n: 2 });
  const p = bereit(s, 0);
  const nb = nachbar(s, p.feld, (x) => !x.tier && x.inhalt !== 'tier' && x.inhalt !== 'spezial');
  leerMachen(s, nb).shelter = { besitzer: 's2' };
  const weiter = nachbar(s, nb, (x) => x.key !== p.feld);
  leerMachen(s, weiter);
  p.energie = 3;
  ausfuehren(s, { typ: 'bewegen', feld: nb });
  assert.ok(hat(s, { typ: 'shelterErholen' }));
  ausfuehren(s, { typ: 'bewegen', feld: weiter });
  assert.equal(s.aktiv, 0, 'durchlaufen ist erlaubt');
  // drin bleiben: Zug auf dem Shelter begonnen, nicht bewegt, Zug beenden = +4
  const t = partie(cfg, { seed: 62, n: 2 });
  const q = bereit(t, 0);
  leerMachen(t, q.feld).shelter = { besitzer: 's1' };
  q.energie = 1;
  ausfuehren(t, { typ: 'zugBeenden' });
  assert.ok(q.energie >= 5, 'im Shelter bleiben gibt +4 statt +2');
  // Betreten und hinein
  const u = partie(cfg, { seed: 62, n: 2 });
  const r = bereit(u, 0);
  const nb2 = nachbar(u, r.feld, (x) => !x.tier && x.inhalt !== 'tier' && x.inhalt !== 'spezial');
  leerMachen(u, nb2).shelter = { besitzer: 's2' };
  r.energie = 2;
  ausfuehren(u, { typ: 'bewegen', feld: nb2 });
  ausfuehren(u, { typ: 'shelterErholen' });
  assert.equal(r.energie, 5);
  assert.notEqual(u.aktiv, 0, 'der Zug endet');
});

test('V13 Werkzeuge und Waffen offen, höchstens 1 pro Sorte, nicht blind raubbar; Bandage wird direkt eingesetzt', async () => {
  const cfg = await standardLaden();
  const s = partie(cfg, { seed: 63, modus: 'pvp', n: 2 });
  const p = bereit(s, 0);
  Object.assign(p.hand, { holz: 6, stein: 6, seil: 3, blaetter: 2, nahrung: 1 });
  ausfuehren(s, { typ: 'craften', rezept: 'spitzhacke' });
  assert.match(craftGrund(s, 'spitzhacke'), /höchstens 1 pro Sorte/);
  assert.equal(sicht(s, 1).spieler[0].ausruestung.hacke, 1, 'für alle sichtbar');
  p.herzen = 2;
  ausfuehren(s, { typ: 'craften', rezept: 'bandage' });
  assert.equal(p.herzen, 4, 'Bandage direkt +2');
  assert.equal(p.ausruestung.bandage, 0, 'keine Bandage auf Vorrat');
  // Duell: Werkzeuge sind nicht blind raubbar
  const t = partie(cfg, { seed: 63, modus: 'pvp', n: 2 });
  const a = bereit(t, 0), v = t.spieler[1];
  v.feld = a.feld; v.ausruestung.axt = 1; v.route = null;
  t.testWuerfe = [6, 1];
  ausfuehren(t, { typ: 'angreifen', ziel: 1 });
  assert.deepEqual(beuteKategorien(t, 1), [], 'nur Werkzeug, keine Handkarte: keine Beute');
  assert.equal(v.ausruestung.axt, 1);
  assert.equal(v.herzen, 4);
});

test('V13 Fern-Duell: Sieger zieht nur 1 Handkarte blind, die Routenkarte ist sicher', async () => {
  const s = partie(await standardLaden(), { seed: 64, modus: 'pvp', n: 2 });
  const p = bereit(s, 0), v = s.spieler[1];
  p.karten.push('duell'); v.route = 'N'; v.hand.holz = 1;
  s.testWuerfe = [6, 1];
  ausfuehren(s, { typ: 'duell', ziel: 1 });
  assert.equal(s.zug.phase, 'beute');
  assert.deepEqual(erlaubteAktionen(s).map((a) => a.wahl), ['karte']);
});

test('V13 Spezialfeld erst beim Betreten; leere Plättchen kommen beim Aufdecken vom Brett', async () => {
  const s = partie(await standardLaden(), { seed: 65, n: 2 });
  const p = bereit(s, 0, 'weitsicht_waehlen');
  const sp = nachbar(s, p.feld, (f) => !f.aufgedeckt && f.biom !== 'vulkan');
  s.felder[sp].inhalt = 'spezial';
  s.zug.weitsichtOffen = 2;
  const stapel = s.spezialStapel.length;
  ausfuehren(s, { typ: 'aufdecken', feld: sp });
  assert.equal(s.spezialStapel.length, stapel, 'aus der Ferne keine Karte');
  assert.equal(s.felder[sp].inhalt, 'spezial');
  const leer = Object.values(s.felder).find((f) => !f.aufgedeckt && f.inhalt === 'dickicht' && weitsichtZiele(s).includes(f.key))
    ?? (() => { const k = weitsichtZiele(s)[0]; s.felder[k].inhalt = 'geroell'; return s.felder[k]; })();
  ausfuehren(s, { typ: 'aufdecken', feld: leer.key });
  assert.equal(s.felder[leer.key].inhalt, 'leer', 'leeres Plättchen vom Brett');
  // Betreten: Karte ziehen, Plättchen weg
  s.zug.phase = 'bewegung';
  p.energie = 6;
  ausfuehren(s, { typ: 'bewegen', feld: sp });
  if (s.aktiv === 0 && s.zug.phase === 'bewegung') assert.equal(s.felder[sp].inhalt, 'leer');
  assert.ok(s.spezialStapel.length < stapel, 'beim Betreten wird gezogen');
});

test('V13 Gebirge-Regel gilt auch, wenn das Plättchen weg ist', async () => {
  const s = partie(await standardLaden(), { seed: 66, n: 2 });
  const g = Object.values(s.felder).find((f) => f.biom === 'gebirge');
  g.aufgedeckt = true; g.inhalt = 'leer';
  assert.equal(istGebirge(g), true);
  const v = Object.values(s.felder).find((f) => f.biom === 'vulkan' && f.ring === 1);
  v.inhalt = 'leer';
  assert.equal(istGebirge(v), true);
});

test('V13 Kompass: nur eine Routenkarte im Spiel, Floss braucht nur die Routenkarte', async () => {
  const s = partie(await standardLaden(), { seed: 67, modus: 'pvp', n: 2 });
  const v = Object.values(s.felder).find((f) => f.inhalt === 'vulkanfels');
  v.aufgedeckt = true;
  const p = bereit(s, 0); p.feld = v.key; p.ausruestung.hacke = 1;
  ausfuehren(s, { typ: 'kompassBergen' });
  const r = p.route;
  assert.ok(r);
  assert.equal(Object.values(s.felder).filter((f) => f.kompass).length, 0, 'der Kompass ist aus dem Spiel');
  assert.equal(kompassBesitzer(s, [0]), 0);
  const strand = Object.values(s.felder).find((f) => f.richtung === r && f.kuestenNr !== null);
  bereit(s, 0); p.feld = strand.key; Object.assign(p.hand, { holz: 4, seil: 3, nahrung: 1, blaetter: 1 });
  assert.equal(flossGrund(s, 'solide'), null);
});

test('V13 Plündern im PvP: K.O.-Figur bleibt liegen, wer das Feld betritt, bekommt alles, Zug endet, Figur vom Brett', async () => {
  const s = partie(await standardLaden(), { seed: 68, modus: 'pvp', n: 3 });
  const p = bereit(s, 0), v = s.spieler[1];
  const nb = nachbar(s, p.feld, (f) => !f.tier && f.inhalt !== 'tier');
  leerMachen(s, nb);
  v.feld = nb; v.ausgeschieden = true; v.pluenderbar = true; v.herzen = 0;
  Object.assign(v.hand, { holz: 3, seil: 1 }); v.karten.push('brennsprit'); v.route = 'O'; v.ausruestung.axt = 1;
  p.ausruestung.axt = 1; p.energie = 4;
  const vorrat = s.ausrVorrat.axt;
  ausfuehren(s, { typ: 'bewegen', feld: nb });
  assert.equal(p.hand.holz, 3); assert.equal(p.hand.seil, 1);
  assert.ok(p.karten.includes('brennsprit')); assert.equal(p.route, 'O');
  assert.equal(p.ausruestung.axt, 1, 'Werkzeug-Limit: die zweite Axt geht in den Vorrat');
  assert.equal(s.ausrVorrat.axt, vorrat + 1);
  assert.equal(v.vomBrett, true);
  assert.notEqual(s.aktiv, 0, 'der Zug endet');
});

test('V13 Plündern im Team: nur gegnerische K.O.-Figuren, Teampartner nie; Koop nie', async () => {
  const cfg = await standardLaden();
  const s = partie(cfg, { seed: 69, modus: 'team' });
  const p = bereit(s, 0);
  const partner = s.spieler[2], gegner = s.spieler[1];
  const nb = nachbar(s, p.feld, (f) => !f.tier && f.inhalt !== 'tier');
  leerMachen(s, nb);
  partner.feld = nb; partner.liegt = true; partner.herzen = 0; partner.hand.holz = 2;
  ausfuehren(s, { typ: 'bewegen', feld: nb });
  assert.equal(partner.hand.holz, 2, 'den Partner plündert man nicht');
  assert.equal(s.aktiv, 0);
  gegner.feld = p.feld; gegner.liegt = true; gegner.herzen = 0; gegner.hand.stein = 2;
  const zurueck = nachbar(s, nb, (f) => f.key === p.feld) ?? p.feld;
  void zurueck;
  const anderes = nachbar(s, nb, (f) => !f.tier && f.inhalt !== 'tier' && f.key !== p.feld);
  leerMachen(s, anderes);
  gegner.feld = anderes;
  ausfuehren(s, { typ: 'bewegen', feld: anderes });
  assert.equal(p.hand.stein, 2);
  assert.equal(gegner.vomBrett, true); assert.equal(gegner.ausgeschieden, true);
  // Annahme: das verbleibende Teammitglied flieht allein (Kosten für 1 Figur)
  bereit(s, 3);
  assert.equal(fliehende(s, 3), 1);
  // Koop: nie plündern
  const k = partie(cfg, { seed: 69, modus: 'koop', n: 2 });
  const a = bereit(k, 0), b = k.spieler[1];
  const nk = nachbar(k, a.feld, (f) => !f.tier && f.inhalt !== 'tier');
  leerMachen(k, nk);
  b.feld = nk; b.liegt = true; b.herzen = 0; b.hand.holz = 2;
  ausfuehren(k, { typ: 'bewegen', feld: nk });
  assert.equal(b.hand.holz, 2); assert.equal(k.aktiv, 0);
});

test('V13 Flucht: die Runde wird zu Ende gespielt, wer in derselben Runde flieht, hat nicht verloren', async () => {
  const cfg = await cfgMit({ fluchtwege: { wrack: { brennsprit: false } } });
  const s = partie(cfg, { seed: 70, modus: 'pvp', n: 3 });
  const wrack = Object.values(s.felder).find((f) => f.inhalt === 'flugzeugwrack');
  wrack.aufgedeckt = true;
  const st = s.startSpieler, folge = [st, (st + 1) % 3, (st + 2) % 3];
  // Erste und zweite Person in Zugreihenfolge stehen am Wrack mit Material
  for (const k of [folge[0], folge[1]]) { s.spieler[k].feld = wrack.key; Object.assign(s.spieler[k].hand, { abfall: 3, seil: 1, nahrung: 1 }); }
  s.tagesKarte = 'ruhig'; s._modsFuer = null;
  s.zug = neuerZug(s); s.zug.phase = 'bewegung';
  ausfuehren(s, { typ: 'wrackReparieren' });
  assert.equal(s.ende, null, 'die Runde geht weiter');
  assert.equal(s.spieler[folge[0]].geflohen, true);
  assert.equal(s.aktiv, folge[1]);
  if (s.zug.phase === 'weitsicht_wuerfeln') ausfuehren(s, { typ: 'wuerfeln' });
  while (s.zug.phase === 'weitsicht_waehlen') ausfuehren(s, erlaubteAktionen(s).find((a) => a.typ === 'aufdecken'));
  ausfuehren(s, { typ: 'wrackReparieren' });
  assert.equal(s.ende, null);
  // Dritte Person beendet ihren Zug, dann ist die Runde vorbei
  let n = 0;
  while (!s.ende && n++ < 20) { const a = erlaubteAktionen(s); ausfuehren(s, a.find((x) => x.typ === 'zugBeenden') ?? a.find((x) => x.typ === 'wuerfeln') ?? a[0]); }
  assert.equal(s.ende.grund, 'wrack');
  assert.equal(ergebnisVon(s, folge[0]), 'gewonnen');
  assert.equal(ergebnisVon(s, folge[1]), 'nichtVerloren');
  assert.equal(ergebnisVon(s, folge[2]), 'verloren');
  assert.equal(s.tag, 1, 'kein neuer Tag mehr');
});

test('V13 Handel: Werkzeuge und Spezialkarten tauschbar, Werkzeug-Limit beim Empfänger', async () => {
  const s = partie(await standardLaden(), { seed: 71, modus: 'koop', n: 2 });
  const p = bereit(s, 0), q = s.spieler[1];
  q.feld = p.feld;
  p.ausruestung.axt = 1; p.karten.push('proviant');
  assert.equal(handelPruefen(s, { typ: 'handeln', mit: 1, gebe: {}, erhalte: {}, gebeAusr: ['axt'], gebeKarten: ['proviant'] }), null);
  q.ausruestung.axt = 1;
  assert.match(handelPruefen(s, { typ: 'handeln', mit: 1, gebe: {}, erhalte: {}, gebeAusr: ['axt'] }), /höchstens 1 pro Sorte/);
  q.ausruestung.axt = 0;
  ausfuehren(s, { typ: 'handeln', mit: 1, gebe: {}, erhalte: {}, gebeAusr: ['axt'], gebeKarten: ['proviant'] });
  assert.equal(q.ausruestung.axt, 1); assert.equal(p.ausruestung.axt, 0); assert.ok(q.karten.includes('proviant'));
});

test('V13 Test-Schalter: 4 Schalter, Standard = Regelstand, alle Varianten gültig', async () => {
  const cfg = await standardLaden();
  assert.deepEqual(SCHALTER.map((x) => x.id), ['ruhigeTage', 'tierschaden', 'energieProTag', 'spieldauer']);
  for (const x of schalterListe(cfg)) assert.equal(x.stand, 'standard', x.id);
  for (const x of SCHALTER) {
    const c = schalterSetzen(klon(cfg), x.id, true);
    assert.equal(schalterStand(c, x.id), 'alternative');
    assert.ok(validieren(c, { modus: 'koop', spieler: 3 }).ok, x.id);
  }
  assert.deepEqual(cfg.figur.startfeld.felder['4'], [6, 17, 27, 38]);
  assert.equal(cfg.crafting.lagerfeuerHerzen, 0);
  assert.equal(cfg.ausruestung.limitProTyp, true); assert.equal(cfg.ausruestung.offen, true);
  void flossKosten; void abstand; void MITTE; void entscheider;
});
