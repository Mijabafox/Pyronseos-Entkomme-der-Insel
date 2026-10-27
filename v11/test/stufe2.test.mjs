// Regelstand Abschnitt 1 (V10) – gezielte Regeltests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { standardLaden } from '../engine/config.js';
import { nachbarn, schluessel } from '../engine/hex.js';
import { ausfuehren, erlaubteAktionen, istErlaubt, neuerZug, ketteInfo, feuerZaehlt, flossKosten, flossGrund, entscheider } from '../engine/engine.js';
import { BAUSTEINE } from '../engine/effekte.js';
import { cfgMit, partie } from './hilfe.mjs';

// Bringt Spieler i in die Bewegungsphase (Tag 1, keine Tageskarten-Wirkung).
function bereit(s, i = 0, phase = 'bewegung') {
  s.aktiv = i; s.tagesKarte = 'ruhig'; s._modsFuer = null;
  s.zug = neuerZug(s); s.zug.phase = phase;
  return s.spieler[i];
}
const feld = (s, pred) => Object.values(s.felder).find(pred);
const nachbar = (s, key, pred = () => true) => nachbarn(s.felder[key].coord).map(schluessel).find((k) => s.felder[k] && pred(s.felder[k]));
const hat = (s, a) => erlaubteAktionen(s).some((x) => JSON.stringify(x) === JSON.stringify(a));

test('1.10 Ereignis-Pool 19 Karten, kein Gewitter, 10 ruhige + 9 Ereignisse + Lava = 20 Karten', async () => {
  const s = partie(await standardLaden(), { seed: 11 });
  const alle = [...s.tagesStapel, s.tagesKarte];
  assert.equal(alle.length, 20);
  assert.equal(alle.filter((k) => k === 'ruhig').length, 10);
  assert.equal(alle[0], 'lava');
  assert.equal(new Set(alle.filter((k) => k !== 'ruhig' && k !== 'lava')).size, 9);
  assert.ok(!alle.includes('gewitter'));
});

test('1.6 Wasser: Durchlaufen erlaubt, Trinken freiwillig, Energie voll und Zugende, Dürre sperrt', async () => {
  const s = partie(await standardLaden(), { seed: 2 });
  const q = feld(s, (f) => f.inhalt === 'wasserquelle');
  q.aufgedeckt = true;
  const von = nachbar(s, q.key, (f) => !f.tier && f.inhalt !== 'spezial');
  s.felder[von].aufgedeckt = true; s.felder[von].inhalt = 'leer';
  const p = bereit(s, 0); p.feld = von; p.energie = 3;
  ausfuehren(s, { typ: 'bewegen', feld: q.key });
  assert.equal(s.zug.phase, 'bewegung', 'Durchlaufen bleibt möglich');
  assert.ok(hat(s, { typ: 'trinken' }));
  assert.ok(erlaubteAktionen(s).some((a) => a.typ === 'bewegen'), 'Weiterlaufen ohne Trinken erlaubt');
  ausfuehren(s, { typ: 'trinken' });
  assert.equal(s.spieler[0].energie, 6);
  assert.notEqual(s.aktiv, 0, 'Zug endet sofort');
  // Dürre
  const p2 = bereit(s, 0); p2.feld = q.key; p2.energie = 2;
  s.tagesKarte = 'trockenperiode'; s._modsFuer = null;
  assert.ok(!hat(s, { typ: 'trinken' }));
});

test('1.7 Niederlage im Tierkampf: Schaden, zurück aufs Herkunftsfeld, Zugende, Tier bleibt', async () => {
  const s = partie(await standardLaden(), { seed: 3 });
  const t = feld(s, (f) => f.inhalt === 'tier' && f.ring > 1 && f.ring < 7);
  t.aufgedeckt = true; t.tier = 'baer';
  const von = nachbar(s, t.key, (f) => !f.tier);
  s.felder[von].aufgedeckt = true; s.felder[von].inhalt = 'leer';
  const p = bereit(s, 0); p.feld = von; p.herzen = 5; p.energie = 6;
  ausfuehren(s, { typ: 'bewegen', feld: t.key });
  assert.equal(s.zug.phase, 'kampf');
  s.testWuerfe = [1];
  ausfuehren(s, { typ: 'kaempfen' });
  assert.equal(s.spieler[0].herzen, 4);
  assert.equal(s.spieler[0].feld, von);
  assert.equal(s.felder[t.key].tier, 'baer');
  assert.notEqual(s.aktiv, 0);
  assert.equal(s.statistik.zurueckgesetzt, 1);
});

test('1.7 Kleines Tier: kein Schaden, aber Zurücksetzen und Zugende', async () => {
  const s = partie(await standardLaden(), { seed: 3 });
  const t = feld(s, (f) => f.inhalt === 'tier' && f.ring > 1 && f.ring < 7);
  t.aufgedeckt = true; t.tier = 'hase';
  const von = nachbar(s, t.key, (f) => !f.tier);
  s.felder[von].aufgedeckt = true; s.felder[von].inhalt = 'leer';
  const p = bereit(s, 0); p.feld = von; p.herzen = 5;
  ausfuehren(s, { typ: 'bewegen', feld: t.key });
  s.testWuerfe = [1];
  ausfuehren(s, { typ: 'kaempfen' });
  assert.equal(s.spieler[0].herzen, 5);
  assert.equal(s.spieler[0].feld, von);
  assert.notEqual(s.aktiv, 0);
});

test('1.3a Hinterhalt: Figur bleibt auf dem Feld, kleines Tier kostet 1 Herz (Schalter)', async () => {
  const s = partie(await standardLaden(), { seed: 4 });
  const sp = feld(s, (f) => f.inhalt === 'spezial' && f.ring > 1 && f.ring < 7);
  sp.aufgedeckt = true;
  const von = nachbar(s, sp.key, (f) => !f.tier);
  s.felder[von].aufgedeckt = true; s.felder[von].inhalt = 'leer';
  const p = bereit(s, 0); p.feld = von; p.herzen = 5;
  s.spezialStapel.push('hinterhalt');
  s.tierBeutel.push('hase');
  ausfuehren(s, { typ: 'bewegen', feld: sp.key });
  assert.equal(s.zug.phase, 'kampf');
  assert.ok(!erlaubteAktionen(s).some((a) => a.typ === 'fliehen'), 'keine Flucht');
  s.testWuerfe = [1];
  ausfuehren(s, { typ: 'kaempfen' });
  assert.equal(s.spieler[0].feld, sp.key, 'kein Zurücksetzen beim Hinterhalt');
  assert.equal(s.spieler[0].herzen, 4);
  assert.notEqual(s.aktiv, 0);
});

test('1.8 Kompass mit Spitzhacke bergen: Routenkarte auf die Hand, Zug endet', async () => {
  const s = partie(await standardLaden(), { seed: 5 });
  const v = feld(s, (f) => f.inhalt === 'vulkanfels');
  v.aufgedeckt = true;
  const p = bereit(s, 0); p.feld = v.key; p.ausruestung.hacke = true; p.energie = 3;
  assert.ok(hat(s, { typ: 'kompassBergen' }));
  ausfuehren(s, { typ: 'kompassBergen' });
  assert.ok(s.spieler[0].route);
  assert.equal(s.felder[v.key].kompass, false);
  assert.notEqual(s.aktiv, 0);
});

test('1.5 + 1.8 Floss nur mit Routenkarte am Zielstrand, Kosten pro Person × Personen', async () => {
  const cfg = await standardLaden();
  const s = partie(cfg, { seed: 6, n: 3 });
  assert.deepEqual(flossKosten(s, 'solide'), { holz: 12, seil: 9, nahrung: 3, blaetter: 3 });
  assert.deepEqual(flossKosten(s, 'not'), { holz: 6, seil: 3, nahrung: 3 });
  const p = bereit(s, 0);
  p.route = 'N';
  const ziel = feld(s, (f) => f.richtung === 'N' && f.kuestenNr !== null);
  const falsch = feld(s, (f) => f.richtung === 'S' && f.kuestenNr !== null);
  for (const x of s.spieler) { x.feld = falsch.key; Object.assign(x.hand, { holz: 4, seil: 3, nahrung: 1, blaetter: 1 }); }
  assert.match(flossGrund(s, 'solide'), /nur im Strandabschnitt N/);
  for (const x of s.spieler) x.feld = ziel.key;
  s.spieler[0].route = null; s.spieler[1].route = 'N';
  s.spieler[1].feld = falsch.key;
  assert.match(flossGrund(s, 'solide'), /alle fliehenden Figuren/);
  s.spieler[1].feld = ziel.key;
  assert.equal(flossGrund(s, 'solide'), null);
  ausfuehren(s, { typ: 'flossBauen', art: 'solide' });
  assert.equal(s.ende.grund, 'floss');
  assert.equal(s.spieler[1].route, null, 'Routenkarte abgegeben');
});

test('1.5 Not-Floss: 1–2 kentert, 3–4 zurück an Land (Karte zurück, nächster Versuch gratis ab morgen), 5–6 Flucht', async () => {
  const cfg = await standardLaden();
  for (const modus of ['koop', 'team', 'pvp']) {
    const s = partie(cfg, { seed: 8, modus, n: 2 });
    const p = bereit(s, 0);
    p.route = 'O';
    const ziel = feld(s, (f) => f.richtung === 'O' && f.kuestenNr !== null);
    const mit = modus === 'koop' ? [0, 1] : modus === 'team' ? [0, 2] : [0];
    for (const k of mit) { s.spieler[k].feld = ziel.key; Object.assign(s.spieler[k].hand, { holz: 2, seil: 1, nahrung: 1 }); }
    s.testWuerfe = [3];
    ausfuehren(s, { typ: 'flossBauen', art: 'not' });
    assert.equal(s.ende, null);
    assert.equal(s.spieler[0].route, 'O', `${modus}: Routenkarte bleibt bei der Figur`);
    assert.equal(s.spieler[0].hand.holz, 0, 'Material wurde bezahlt');
    // gleicher Tag: kein neuer Versuch
    bereit(s, 0); s.spieler[0].feld = ziel.key;
    assert.match(flossGrund(s, 'not'), /morgen/);
    // nächster Tag: gratis
    s.tag += 1;
    assert.equal(flossGrund(s, 'not'), null, `${modus}: nächster Versuch gratis`);
    s.testWuerfe = [6];
    ausfuehren(s, { typ: 'flossBauen', art: 'not' });
    assert.equal(s.ende.grund, 'notfloss');
  }
  // Kentern im Koop: alle −2 Herzen
  const s = partie(cfg, { seed: 9, n: 2 });
  const p = bereit(s, 0); p.route = 'W';
  const ziel = feld(s, (f) => f.richtung === 'W' && f.kuestenNr !== null);
  for (const k of [0, 1]) { s.spieler[k].feld = ziel.key; Object.assign(s.spieler[k].hand, { holz: 2, seil: 1, nahrung: 1 }); }
  const h = s.spieler.map((x) => x.herzen);
  s.testWuerfe = [2];
  ausfuehren(s, { typ: 'flossBauen', art: 'not' });
  assert.deepEqual(s.spieler.map((x) => x.herzen), h.map((x) => x - 2));
  assert.equal(s.spieler[0].route, 'W');
});

test('1.5 Schalter: Material verloren statt gratis (wie v10 Team/PvP)', async () => {
  const cfg = await cfgMit({ fluchtwege: { floss: { not: { nachLandGratis: false } } } });
  const s = partie(cfg, { seed: 8, modus: 'pvp', n: 2 });
  const p = bereit(s, 0); p.route = 'O';
  const ziel = feld(s, (f) => f.richtung === 'O' && f.kuestenNr !== null);
  p.feld = ziel.key; Object.assign(p.hand, { holz: 2, seil: 1, nahrung: 1 });
  s.testWuerfe = [4];
  ausfuehren(s, { typ: 'flossBauen', art: 'not' });
  bereit(s, 0); s.tag += 1; s.spieler[0].feld = ziel.key;
  assert.match(flossGrund(s, 'not'), /brauchst/);
});

test('1.4 Feuerkette: Koop zählt alle Feuer der Gruppe, Sieg sofort, ungültiges Feuer zählt nicht', async () => {
  const s = partie(await standardLaden(), { seed: 10, n: 2 }); // Koop 2 → 4 Feuer, Abstand 9
  const strand = (n) => feld(s, (f) => f.kuestenNr === n);
  for (const [n, wer] of [[1, 's1'], [10, 's2'], [19, 's1']]) strand(n).bau = { art: 'lagerfeuer', besitzer: wer, brennt: true };
  let info = ketteInfo(s);
  assert.equal(info.kette.length, 3);
  assert.equal(info.feuer, 4); assert.equal(info.abstand, 9);
  const p = bereit(s, 1);
  p.feld = strand(25).key; s.felder[p.feld].inhalt = 'leer'; Object.assign(p.hand, { holz: 2, stein: 1, abfall: 1 });
  assert.equal(feuerZaehlt(s, p.feld), false, 'Abstand 6 zu klein → Warnung');
  ausfuehren(s, { typ: 'craften', rezept: 'lagerfeuer' });
  assert.equal(s.ende, null, 'zu kleiner Abstand: gebaut, zählt aber nicht');
  info = ketteInfo(s);
  assert.ok(info.ungueltig.includes(25));
  const q = bereit(s, 0);
  q.feld = strand(30).key; s.felder[q.feld].inhalt = 'leer'; Object.assign(q.hand, { holz: 2, stein: 1, abfall: 1 });
  ausfuehren(s, { typ: 'craften', rezept: 'lagerfeuer' });
  assert.equal(s.ende?.grund, 'signalfeuer', '1, 10, 19, 30: Abstände 9, 9, 11, rundum 13');
});

test('1.4 Feuerkette: PvP nur eigene Feuer, fremde blockieren nicht; Team nur eigenes Team', async () => {
  const cfg = await standardLaden();
  const s = partie(cfg, { seed: 12, modus: 'pvp', n: 2 }); // 3 Feuer, Abstand 13
  const strand = (n) => feld(s, (f) => f.kuestenNr === n);
  strand(1).bau = { art: 'lagerfeuer', besitzer: 's1', brennt: true };
  strand(14).bau = { art: 'lagerfeuer', besitzer: 's1', brennt: true };
  strand(20).bau = { art: 'lagerfeuer', besitzer: 's2', brennt: true };
  bereit(s, 0);
  assert.deepEqual(ketteInfo(s).alle, [1, 14]);
  bereit(s, 1);
  assert.deepEqual(ketteInfo(s).alle, [20]);
  const t = partie(cfg, { seed: 12, modus: 'team' });
  bereit(t, 0);
  const st = (n) => feld(t, (f) => f.kuestenNr === n);
  st(5).bau = { art: 'lagerfeuer', besitzer: 's3', brennt: true }; // Teampartner
  st(9).bau = { art: 'lagerfeuer', besitzer: 's2', brennt: true }; // Gegner
  const i = ketteInfo(t);
  assert.deepEqual(i.alle, [5]);
  assert.equal(i.feuer, 4); assert.equal(i.abstand, 9);
});

test('1.9 Läufer: kein Gratis-Schritt, bei 0 Energie einmal pro Zug 1 Zusatzfeld', async () => {
  const s = partie(await standardLaden(), { seed: 13 });
  const p = bereit(s, 0); p.charakter = 'laeufer'; p.energie = 1;
  const w1 = nachbar(s, p.feld, (f) => !f.tier && f.inhalt !== 'spezial');
  s.felder[w1].aufgedeckt = true; s.felder[w1].inhalt = 'leer';
  ausfuehren(s, { typ: 'bewegen', feld: w1 });
  assert.equal(s.spieler[0].energie, 0, 'erster Schritt kostet normal');
  const w2 = nachbar(s, w1, (f) => !f.tier && f.inhalt !== 'spezial' && f.key !== p.feld);
  s.felder[w2].aufgedeckt = true; s.felder[w2].inhalt = 'leer';
  ausfuehren(s, { typ: 'bewegen', feld: w2 });
  assert.equal(s.zug.laeuferRest, 0);
  assert.ok(!erlaubteAktionen(s).some((a) => a.typ === 'bewegen'), 'nur einmal pro Zug');
});

test('1.2 Duell-Beute: nur vorhandene Kategorien, Routenkarte direkt, Rohstoff blind; Werkzeuge nicht klaubar', async () => {
  const s = partie(await standardLaden(), { seed: 14, modus: 'pvp', n: 2 });
  const p = bereit(s, 0);
  s.spieler[1].feld = p.feld;
  s.spieler[1].route = 'SW'; s.spieler[1].ausruestung.axt = true; s.spieler[1].hand.holz = 0;
  assert.ok(hat(s, { typ: 'angreifen', ziel: 1 }));
  s.testWuerfe = [6, 1];
  ausfuehren(s, { typ: 'angreifen', ziel: 1 });
  assert.equal(s.zug.phase, 'beute');
  assert.deepEqual(erlaubteAktionen(s).map((a) => a.wahl), ['route']);
  assert.equal(entscheider(s), 0);
  ausfuehren(s, { typ: 'beute', wahl: 'route' });
  assert.equal(s.spieler[0].route, 'SW');
  assert.equal(s.spieler[1].route, null);
  assert.equal(s.spieler[1].ausruestung.axt, true, 'Werkzeug bleibt');
  assert.equal(s.spieler[1].herzen, 4);
});

test('1.1 Werkzeug- und Waffennutzung erscheint im Log', async () => {
  const s = partie(await standardLaden(), { seed: 15 });
  const b = feld(s, (f) => f.inhalt === 'baum');
  b.aufgedeckt = true;
  const p = bereit(s, 0); p.feld = b.key; p.ausruestung.axt = true;
  ausfuehren(s, { typ: 'abbauen' });
  assert.match(s.log.at(-1), /mit Steinaxt/);
  assert.equal(s.spieler[0].hand.holz, 3);
});

test('Materialvorrat: leerer Stapel gibt keinen Ertrag, unbegrenzt als Schalter', async () => {
  for (const unbegrenzt of [false, true]) {
    const s = partie(await cfgMit({ vorrat: { unbegrenzt } }), { seed: 16 });
    const b = feld(s, (f) => f.inhalt === 'fels');
    b.aufgedeckt = true;
    const p = bereit(s, 0); p.feld = b.key;
    if (s.vorrat) s.vorrat.stein = 1;
    ausfuehren(s, { typ: 'abbauen' });
    assert.equal(s.spieler[0].hand.stein, unbegrenzt ? 2 : 1);
  }
});

test('Seil über Blätter: Rezept als Schalter', async () => {
  for (const aktiv of [true, false]) {
    const s = partie(await cfgMit({ crafting: { rezepte: { seil: { aktiv } } } }), { seed: 17 });
    const p = bereit(s, 0); p.hand.blaetter = 2;
    assert.equal(hat(s, { typ: 'craften', rezept: 'seil' }), aktiv);
  }
});

test('1.3 Spezialkarten: Sofort-Karten und Handkarten werden als Ereignis gemeldet', async () => {
  const s = partie(await standardLaden(), { seed: 18 });
  const sp = feld(s, (f) => f.inhalt === 'spezial' && f.ring > 1 && f.ring < 7);
  sp.aufgedeckt = true;
  const von = nachbar(s, sp.key, (f) => !f.tier);
  s.felder[von].aufgedeckt = true; s.felder[von].inhalt = 'leer';
  const p = bereit(s, 0); p.feld = von;
  s.spezialStapel.push('heilkraeuter');
  ausfuehren(s, { typ: 'bewegen', feld: sp.key });
  assert.equal(s.ereignisse.at(-1).art, 'sofort');
  const sp2 = feld(s, (f) => f.inhalt === 'spezial' && f.ring > 1 && f.ring < 7 && f.key !== sp.key);
  sp2.aufgedeckt = true;
  const von2 = nachbar(s, sp2.key, (f) => !f.tier);
  s.felder[von2].aufgedeckt = true; s.felder[von2].inhalt = 'leer';
  bereit(s, 0); s.spieler[0].feld = von2;
  s.spezialStapel.push('proviant');
  ausfuehren(s, { typ: 'bewegen', feld: sp2.key });
  assert.equal(s.ereignisse.at(-1).art, 'gezogen');
  assert.ok(s.spieler[0].karten.includes('proviant'));
});

test('Effekt-Baukasten: alle verlangten Bausteine sind vorhanden, alle Karten bestehen daraus', async () => {
  for (const b of ['herzen', 'energie', 'rohstoff', 'weitergeben', 'aufdecken', 'bewegungGratis', 'tierKampf', 'zugEnde', 'kampfBonus', 'abbauFaktor', 'wurfWiederholen', 'weitsicht', 'bewegungskosten', 'trinkenSperren', 'rettungswurf']) assert.ok(BAUSTEINE[b], b);
  const cfg = await standardLaden();
  const pruefe = (liste) => { for (const e of liste) { assert.ok(BAUSTEINE[e.typ], e.typ); for (const k of ['effekte', 'sonst', 'optionen']) if (Array.isArray(e[k])) pruefe(e.typ === 'wahl' && k === 'optionen' ? e[k].flatMap((o) => o.effekte) : e[k]); } };
  for (const k of Object.values(cfg.tageskarten.karten)) pruefe(k.effekte);
  for (const k of Object.values(cfg.spezialkarten.karten)) { pruefe(k.effekte ?? []); for (const o of k.ausspielen ?? []) pruefe(o.effekte); }
});

test('Neue Kartenvariante aus Bausteinen wirkt (eigene Tageskarte)', async () => {
  const cfg = await cfgMit({ tageskarten: { karten: { kokos: { aktiv: true, anzahl: 1, name: 'Kokosregen', art: 'gut', text: 'Alle +1 Nahrung', effekte: [{ typ: 'rohstoff', ziel: 'alle', art: 'nahrung', wert: 1 }] } } } });
  const s = partie(cfg, { seed: 19 });
  s.tagesStapel.push('kokos');
  const vorher = s.spieler.map((p) => p.hand.nahrung);
  // Tag beenden
  for (let k = 0; k < 3 && s.tagesKarte !== 'kokos'; k++) { bereit(s, s.aktiv); ausfuehren(s, { typ: 'zugBeenden' }); }
  assert.equal(s.tagesKarte, 'kokos');
  assert.deepEqual(s.spieler.map((p) => p.hand.nahrung), vorher.map((n) => n + 1));
});

test('Spezialkarte Felsrutsch: Wahl Werkzeug abwerfen oder −2 Herzen', async () => {
  const s = partie(await standardLaden(), { seed: 20 });
  const sp = feld(s, (f) => f.inhalt === 'spezial' && f.ring > 1 && f.ring < 7);
  sp.aufgedeckt = true;
  const von = nachbar(s, sp.key, (f) => !f.tier);
  s.felder[von].aufgedeckt = true; s.felder[von].inhalt = 'leer';
  const p = bereit(s, 0); p.feld = von; p.ausruestung.axt = true;
  s.spezialStapel.push('felsrutsch');
  ausfuehren(s, { typ: 'bewegen', feld: sp.key });
  assert.equal(s.zug.phase, 'wahl');
  const opt = erlaubteAktionen(s);
  assert.equal(opt.length, 2);
  ausfuehren(s, opt[0]);
  assert.equal(s.spieler[0].ausruestung.axt, false);
  assert.equal(s.zug.phase, 'bewegung');
});

test('Jede Tageskarte und jede Spezialkarte lässt sich ohne Fehler ausspielen', async () => {
  const cfg = await standardLaden();
  for (const modus of ['koop', 'pvp']) {
    for (const id of Object.keys(cfg.tageskarten.karten)) {
      const s = partie(cfg, { seed: 21, modus, n: 3 });
      for (const p of s.spieler) Object.assign(p.hand, { holz: 1, blaetter: 1, nahrung: 1, abfall: 1 });
      s.tagesStapel.push(id);
      for (let k = 0; k < 4 && s.tagesKarte !== id; k++) { bereit(s, s.aktiv); ausfuehren(s, { typ: 'zugBeenden' }); }
      assert.equal(s.tagesKarte, id);
      // ein paar Zufallsaktionen am neuen Tag
      for (let k = 0; k < 30 && !s.ende; k++) { const a = erlaubteAktionen(s); ausfuehren(s, a[k % a.length]); }
    }
    for (const id of Object.keys(cfg.spezialkarten.karten)) {
      const s = partie(cfg, { seed: 22, modus, n: 3 });
      const sp = feld(s, (f) => f.inhalt === 'spezial' && f.ring > 1 && f.ring < 7);
      sp.aufgedeckt = true;
      const von = nachbar(s, sp.key, (f) => !f.tier);
      s.felder[von].aufgedeckt = true; s.felder[von].inhalt = 'leer';
      const p = bereit(s, 0); p.feld = von;
      s.spezialStapel.push(id);
      ausfuehren(s, { typ: 'bewegen', feld: sp.key });
      for (let k = 0; k < 40 && !s.ende; k++) {
        const a = erlaubteAktionen(s);
        const j = a.find((x) => x.typ === 'joker');
        ausfuehren(s, j ?? a[k % a.length]);
      }
    }
  }
});
