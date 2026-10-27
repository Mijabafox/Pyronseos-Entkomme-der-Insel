// Simulation: Auswertung, Sweep, A/B, Replay, Import echter Protokolle, Reproduzierbarkeit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { standardLaden, zusammenfuehren } from '../engine/config.js';
import { klonen } from '../engine/engine.js';
import { Spielleiter, nachspielen } from '../sim/spielleiter.js';
import { serie, auswerten, sweep, abVergleich, abgleich, protokollKennzahlen, zusammenfassungAus, csvPartien, csvAuswertung, sweepCsv, werteListe } from '../sim/simulation.js';

const opt = { partien: 4, seed: 1, modus: 'koop', spieler: 3, bots: 'normal' };

test('Serie und Auswertung liefern alle verlangten Kennzahlen', async () => {
  const cfg = await standardLaden();
  const p = serie(cfg, opt);
  const a = auswerten(p);
  for (const k of ['siegquote', 'proWeg', 'proModus', 'charakter', 'proSpielerzahl', 'stufe', 'tageBisSieg', 'niederlageLava', 'niederlageTod', 'wegAnteil', 'knappheit', 'tageskarten', 'spezialkarten', 'duelle', 'raube', 'zurueckgesetzt', 'wasserZugende']) assert.ok(k in a, k);
  assert.equal(a.partien, 4);
  assert.match(csvPartien(p), /^seed;modus/);
  assert.match(csvAuswertung(a), /Siegquote/);
});

test('Simulation ist reproduzierbar: gleiche Konfiguration plus Seed = gleiche Ergebnisse', async () => {
  const cfg = await standardLaden();
  assert.deepEqual(serie(cfg, opt), serie(cfg, opt));
});

test('Parameter-Sweep über zwei Parameter, ungültige Zellen werden markiert', async () => {
  const cfg = await standardLaden();
  const sw = sweep(cfg, { ...opt, partien: 2 }, { pfadA: 'fluchtwege.floss.solide.proPerson.seil', werteA: '1:2', pfadB: 'match.spieler', werteB: '2,3' });
  assert.equal(sw.zellen.length, 4);
  assert.ok(sw.zellen.every((z) => z.gueltig && z.auswertung));
  const sw2 = sweep(cfg, { ...opt, partien: 1 }, { pfadA: 'fluchtwege.feuer.tabelle.3.abstand', werteA: '7,9' });
  assert.equal(sw2.zellen[1].gueltig, false, '5 Feuer × 9 > 42');
  assert.match(sweepCsv(sw), /match\.spieler/);
  assert.deepEqual(werteListe('1:4'), [1, 2, 3, 4]);
  assert.deepEqual(werteListe('0.5:1.5:0.5'), [0.5, 1, 1.5]);
});

test('A/B-Vergleich mit gleichen Seeds und Signifikanzangabe', async () => {
  const a = await standardLaden();
  const b = zusammenfuehren(a, { zug: { wasser: { zugende: false } } });
  const r = abVergleich(a, b, { ...opt, partien: 3 });
  assert.ok(r.zeilen.find((z) => z.name === 'Siegquote'));
  assert.ok(r.zeilen.every((z) => typeof z.signifikanz === 'string'));
  assert.ok(r.unterschiede.some((u) => u.pfad === 'zug.wasser.zugende'));
});

test('Replay: Seed plus Zugliste ergibt exakt dieselbe Partie', async () => {
  const cfg = await standardLaden();
  for (const modus of ['koop', 'team', 'pvp']) {
    const sl = new Spielleiter(cfg, { seed: 21, modus, sitze: Array.from({ length: modus === 'team' ? 4 : 3 }, (_, k) => ({ name: `B${k}`, ki: true })) });
    sl.laufen();
    const prot = JSON.parse(JSON.stringify(sl.protokoll()));
    const { s, staende } = nachspielen(cfg, prot, { zwischen: true });
    assert.equal(JSON.stringify(klonen(s)), JSON.stringify(klonen(sl.s)), modus);
    assert.equal(staende.length, prot.zuege.length + 1);
  }
});

test('Import echter Protokolle und Abgleich mit Bot-Partien (inkl. Hinweis auf echte Playtests)', async () => {
  const cfg = await standardLaden();
  const echte = [];
  for (const seed of [31, 32]) {
    const sl = new Spielleiter(cfg, { seed, modus: 'koop', sitze: [{ name: 'Mensch', ki: false }, { name: 'B', ki: true }, { name: 'C', ki: true }] });
    // Den «Menschen» spielt hier ein Zufallsbot über die Mensch-Schnittstelle
    let n = 0;
    while (!sl.s.ende && n++ < 20000) {
      if (sl.istBotDran()) { sl.botSchritt(); continue; }
      const { erlaubteAktionen } = await import('../engine/engine.js');
      const ak = erlaubteAktionen(sl.s);
      sl.menschAktion(ak.find((a) => a.typ === 'zugBeenden') ?? ak[0]);
    }
    const export_ = { ...sl.protokoll(), konfig: cfg, zusammenfassung: zusammenfassungAus(sl.s) };
    echte.push(protokollKennzahlen(JSON.parse(JSON.stringify(export_)), cfg));
    // Ohne Zusammenfassung: aus der Zugliste nachgespielt
    const ohne = { ...export_ }; delete ohne.zusammenfassung;
    assert.deepEqual(protokollKennzahlen(JSON.parse(JSON.stringify(ohne)), cfg).tag, echte.at(-1).tag);
  }
  const r = abgleich(echte, serie(cfg, opt));
  assert.equal(r.echte, 2);
  assert.ok(r.zeilen.length >= 6);
  assert.match(r.hinweis, /Echte Playtests bleiben der Massstab/);
});

test('Kommandozeile: Serie mit CSV, Validierung blockiert, Hilfe', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v11-'));
  const cli = new URL('../sim/cli.mjs', import.meta.url).pathname;
  const out = execFileSync('node', [cli, '--partien', '2', '--modus', 'pvp', '--spieler', '2', '--csv', path.join(dir, 'a.csv')], { encoding: 'utf8' });
  assert.match(out, /Siegquote/);
  assert.ok(fs.existsSync(path.join(dir, 'a.csv')) && fs.existsSync(path.join(dir, 'a-summe.csv')));
  let fehler = null;
  try { execFileSync('node', [cli, '--set', 'fluchtwege.feuer.tabelle.3.feuer=9', '--validieren'], { encoding: 'utf8', stdio: 'pipe' }); } catch (e) { fehler = e; }
  assert.ok(fehler && fehler.status === 2);
  assert.match(execFileSync('node', [cli, '--hilfe'], { encoding: 'utf8' }), /--sweep/);
});
