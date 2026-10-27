import test from 'node:test';
import assert from 'node:assert/strict';
import { standardLaden, zusammenfuehren, lesen, setzen } from '../engine/config.js';
import { validieren } from '../engine/validator.js';
import { regler } from '../engine/schema.js';
import { zonen, plaettchenPruefen, STRANDRING, anzahlFelder } from '../engine/brett.js';
import { ketteFertig, besteTeilkette } from '../engine/feuer.js';
import { neuePartie, klonen } from '../engine/engine.js';
import { cfgMit, partie, zufallsPartie, sitze } from './hilfe.mjs';
import fs from 'node:fs';

test('config.json lädt und Standard ist gültig in allen Modi', async () => {
  const cfg = await standardLaden();
  for (const [modus, spieler] of [['koop', 2], ['koop', 3], ['koop', 4], ['team', 4], ['pvp', 2], ['pvp', 3], ['pvp', 4]]) {
    const v = validieren(cfg, { modus, spieler });
    assert.equal(v.ok, true, `${modus} ${spieler}: ${v.fehler.join(' | ')}`);
  }
});

test('Presets sind gültig', async () => {
  for (const f of fs.readdirSync(new URL('../config/presets/', import.meta.url))) {
    const teil = JSON.parse(fs.readFileSync(new URL(`../config/presets/${f}`, import.meta.url), 'utf8'));
    const cfg = await cfgMit(teil);
    const v = validieren(cfg, { modus: 'koop', spieler: 3 });
    assert.equal(v.ok, true, `${f}: ${v.fehler.join(' | ')}`);
  }
});

test('Regelstand-Standardwerte (Abschnitt 1) stehen in der Konfiguration', async () => {
  const c = await standardLaden();
  assert.deepEqual(c.fluchtwege.feuer.tabelle, { 1: { feuer: 3, abstand: 13 }, 2: { feuer: 4, abstand: 9 }, 3: { feuer: 5, abstand: 7 }, 4: { feuer: 6, abstand: 6 } });
  assert.deepEqual(c.crafting.rezepte.lagerfeuer.kosten, { holz: 2, stein: 1, abfall: 1 });
  assert.deepEqual(c.fluchtwege.floss.solide.proPerson, { holz: 4, seil: 3, nahrung: 1, blaetter: 1 });
  assert.deepEqual(c.fluchtwege.floss.not.proPerson, { holz: 2, seil: 1, nahrung: 1 });
  assert.equal(c.fluchtwege.floss.not.kentertBis, 2);
  assert.equal(c.fluchtwege.floss.not.landBis, 4);
  assert.equal(Object.keys(c.tageskarten.karten).length, 19);
  assert.equal(c.tageskarten.karten.gewitter, undefined);
  assert.equal(c.match.tage.ruhig, 10);
  assert.equal(c.match.tage.ereignisse, 9);
  assert.equal(c.zug.wasser.zugende, true);
  assert.equal(c.vorrat.karten.seil, 12);
  assert.equal(c.vorrat.unbegrenzt, false);
});

test('Keine Spielwerte fest im Engine-Code (Stichprobe: bekannte Zahlen nur in config.json)', () => {
  const code = ['engine.js', 'effekte.js', 'kern.js'].map((f) => fs.readFileSync(new URL(`../engine/${f}`, import.meta.url), 'utf8')).join('\n');
  for (const muster of [/NOT_LAND_BIS/, /ZIEL_GROSS\s*[:=]\s*\d/, /RASTEN\s*[:=]\s*\d/, /abstand:\s*13/, /seil:\s*12/]) assert.doesNotMatch(code, muster);
});

test('Brett: 169 Felder, Strand 1–42 eindeutig, Biome passen zu den Plättchen', async () => {
  const cfg = await standardLaden();
  for (const seed of [1, 2, 99, 12345]) {
    const z = zonen(cfg, seed);
    assert.equal(z.length, anzahlFelder());
    const nr = z.filter((f) => f.kuestenNr !== null).map((f) => f.kuestenNr).sort((a, b) => a - b);
    assert.deepEqual(nr, Array.from({ length: STRANDRING }, (_, k) => k + 1));
    const zahl = (b) => z.filter((f) => f.biom === b).length;
    const pl = cfg.brett.plaettchen;
    for (const b of ['wald', 'wiese', 'gebirge', 'strand', 'vulkan']) assert.equal(zahl(b), Object.values(pl[b]).reduce((s, n) => s + n, 0), b);
  }
  assert.deepEqual(plaettchenPruefen(cfg.brett.plaettchen), []);
});

test('Validator blockiert unmögliche Konfigurationen mit Klartext', async () => {
  const faelle = [
    [{ fluchtwege: { floss: { aktiv: false }, feuer: { aktiv: false }, wrack: { aktiv: false } } }, /Alle Fluchtwege/],
    [{ fluchtwege: { feuer: { tabelle: { 3: { feuer: 8, abstand: 7 } } } } }, /passt nicht auf den Strandring/],
    [{ fluchtwege: { floss: { solide: { proPerson: { seil: 5 } } } } }, /unbezahlbar/],
    [{ match: { tage: { ereignisse: 25 } } }, /Ereigniskarten im Pool/],
    [{ brett: { plaettchen: { wald: { baum: 30 } } } }, /Inneres Brett/],
    [{ charaktere: { jaeger: { aktiv: false }, laeufer: { aktiv: false }, sammlerin: { aktiv: false }, sanitaeter: { aktiv: false } } }, /Charaktere aktiv/],
    [{ fluchtwege: { feuer: { tabelle: { 3: null } } } }, /keine Zeile für 3 Personen/],
    [{ zug: { weitsicht: { radius: 99 } } }, /ausserhalb/],
  ];
  for (const [teil, muster] of faelle) {
    const cfg = await cfgMit(teil);
    if (teil.fluchtwege?.feuer?.tabelle?.[3] === null) delete cfg.fluchtwege.feuer.tabelle[3];
    const v = validieren(cfg, { modus: 'koop', spieler: 3 });
    assert.equal(v.ok, false, JSON.stringify(teil));
    assert.ok(v.fehler.some((f) => muster.test(f)), `${muster}: ${v.fehler.join(' | ')}`);
  }
  const v5 = validieren(await standardLaden(), { modus: 'koop', spieler: 5 });
  assert.ok(v5.fehler.some((f) => /höchstens 4 Spieler/.test(f)));
  const vt = validieren(await standardLaden(), { modus: 'team', spieler: 3 });
  assert.ok(vt.fehler.some((f) => /2 gegen 2/.test(f)));
});

test('Validator warnt bei knappem Material', async () => {
  const v = validieren(await standardLaden(), { modus: 'koop', spieler: 4 });
  assert.equal(v.ok, true);
  assert.ok(v.warnungen.some((w) => /Seil reicht nur knapp/.test(w)));
});

test('Jeder Regler hat Name und Bereich, und der Standard liegt im Bereich', async () => {
  const cfg = await standardLaden();
  const r = regler(cfg);
  assert.ok(r.length > 200);
  for (const x of r) {
    assert.ok(x.name && x.pfad);
    if (x.typ === 'zahl') { const v = lesen(cfg, x.pfad) ?? 0; if (v !== null) assert.ok(v >= x.min && v <= x.max, `${x.pfad}=${v}`); }
  }
});

test('Feuerkette: Rundum-Abstand korrekt', () => {
  assert.deepEqual(ketteFertig([1, 7, 13, 19, 25, 31], 6, 6, 42), [1, 7, 13, 19, 25, 31]);
  assert.equal(ketteFertig([1, 7, 13, 19, 25, 30], 6, 6, 42), null);
  assert.deepEqual(ketteFertig([40, 4, 10, 16, 22, 28, 34], 6, 6, 42), [4, 10, 16, 22, 28, 34]);
  assert.deepEqual(ketteFertig([30, 2, 16], 3, 13, 42), [2, 16, 30]);
  assert.deepEqual(ketteFertig([1, 14, 30], 3, 13, 42), [1, 14, 30]);
  assert.equal(ketteFertig([1, 13, 30], 3, 13, 42), null);
});

test('Reproduzierbarkeit: gleiche Konfiguration plus Seed ergibt exakt dieselbe Partie', async () => {
  const cfg = await standardLaden();
  for (const modus of ['koop', 'team', 'pvp']) for (const seed of [3, 17, 42]) {
    const a = partie(cfg, { seed, modus, n: 3 }); const za = zufallsPartie(a, seed);
    const b = partie(cfg, { seed, modus, n: 3 }); const zb = zufallsPartie(b, seed);
    assert.deepEqual(za, zb);
    assert.equal(JSON.stringify(klonen(a)), JSON.stringify(klonen(b)));
    assert.deepEqual(a.log, b.log);
  }
  const c = partie(cfg, { seed: 3 }); const d = partie(cfg, { seed: 4 });
  assert.notEqual(JSON.stringify(c.felder), JSON.stringify(d.felder));
});

test('Zufallsquellen sind getrennt: anderer Würfelverlauf ändert das Brett nicht', async () => {
  const cfg = await standardLaden();
  const a = neuePartie(cfg, { seed: 5, sitze: sitze(3) });
  const b = neuePartie(cfg, { seed: 5, sitze: sitze(3) });
  b.rng.wuerfel ^= 12345;
  assert.equal(JSON.stringify(a.felder), JSON.stringify(b.felder));
  assert.deepEqual(a.tagesStapel, b.tagesStapel);
  assert.deepEqual(a.spezialStapel, b.spezialStapel);
});

test('Viele Zufallspartien laufen ohne Fehler in allen Modi', async () => {
  const cfg = await standardLaden();
  for (const modus of ['koop', 'team', 'pvp']) for (let seed = 1; seed <= 40; seed++) {
    const s = partie(cfg, { seed, modus, n: 2 + (seed % 3), protokoll: false });
    zufallsPartie(s, seed);
    assert.ok(s.ende, `${modus} ${seed} ohne Ende`);
  }
});
