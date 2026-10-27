// Bots: Informationsgrenze, Verhalten, Stufen, Reproduzierbarkeit.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { standardLaden } from '../engine/config.js';
import { erlaubteAktionen, ausfuehren, neuerZug, klonen, entscheider } from '../engine/engine.js';
import { sicht } from '../engine/sicht.js';
import { Zufall } from '../engine/rng.js';
import { Bot, ZufallsBot, botErzeugen, STUFEN } from '../bots/bot.js';
import { feuerPlan } from '../bots/wissen.js';
import { ketteFertig } from '../engine/feuer.js';
import { nachbarn, schluessel } from '../engine/hex.js';
import { Spielleiter } from '../sim/spielleiter.js';
import { partie } from './hilfe.mjs';

// Verdeckte Informationen im Zustand verändern (darf den Bot nicht beeinflussen).
function verdecktesAendern(s, ich, z) {
  const verdeckt = Object.values(s.felder).filter((f) => !f.aufgedeckt);
  const inhalte = z.mischen(verdeckt.map((f) => f.inhalt));
  verdeckt.forEach((f, k) => { f.inhalt = inhalte[k]; f.kompass = f.inhalt === 'vulkanfels'; });
  s.tierBeutel = z.mischen(s.tierBeutel).reverse();
  s.spezialStapel = z.mischen(s.spezialStapel);
  s.tagesStapel = [s.tagesStapel[0], ...z.mischen(s.tagesStapel.slice(1))];
  s.routenStapel = z.mischen(s.routenStapel);
  for (const q of Object.keys(s.rng)) s.rng[q] = (s.rng[q] ^ 0x1234567) | 0;
  // fremde verdeckte Hände (nur was der Bot nicht sehen darf)
  const regel = s.cfg.sichtbarkeit[s.modus];
  s.spieler.forEach((p, k) => {
    if (k === ich) return;
    const sichtbar = (art) => regel[art] === 'alle' || (regel[art] === 'team' && (s.modus === 'koop' || (s.teams && s.teams.some((t) => t.includes(p.id) && t.includes(s.spieler[ich].id)))));
    if (!sichtbar('rohstoffe')) {
      const n = Object.values(p.hand).reduce((a, x) => a + x, 0);
      for (const r of Object.keys(p.hand)) p.hand[r] = 0;
      for (let i = 0; i < n; i++) p.hand[z.wahl(Object.keys(p.hand))]++;
    }
    if (!sichtbar('spezialkarten')) p.karten = p.karten.map(() => z.wahl(['proviant', 'fernglas', 'rauchbombe', 'jagdmesser']));
    if (!sichtbar('routeRichtung') && p.route) p.route = z.wahl(['N', 'S', 'O', 'W', 'NO', 'SW']);
    if (!sichtbar('charakter')) p.charakter = z.wahl(['jaeger', 'laeufer', 'sammlerin']);
  });
}

test('Informationsgrenze: Snapshot und Bot-Entscheid ändern sich nicht, wenn Verdecktes verändert wird', async () => {
  const cfg = await standardLaden();
  let geprueft = 0;
  for (const modus of ['koop', 'team', 'pvp']) for (const stufe of ['sehrEinfach', 'normal', 'gut']) for (let seed = 1; seed <= 3; seed++) {
    const sl = new Spielleiter(cfg, { seed, modus, sitze: Array.from({ length: modus === 'team' ? 4 : 3 }, (_, k) => ({ name: `B${k}`, ki: true, stufe })), protokoll: false });
    const z = new Zufall(seed * 77);
    let schritt = 0;
    while (sl.istBotDran() && schritt++ < 900) {
      if (schritt % 23 === 0) {
        const i = entscheider(sl.s);
        const a = sl.s, b = klonen(a);
        verdecktesAendern(b, i, z);
        const sa = sicht(a, i), sb = sicht(b, i);
        assert.equal(JSON.stringify(sa), JSON.stringify(sb), `${modus} ${seed}: Snapshot verrät Verdecktes`);
        const botA = botErzeugen({ index: i, stufe, seed: 99, cfg }), botB = botErzeugen({ index: i, stufe, seed: 99, cfg });
        const da = botA.entscheiden(sa, erlaubteAktionen(a)), db = botB.entscheiden(sb, erlaubteAktionen(b));
        assert.deepEqual(da, db, `${modus} ${stufe} ${seed}: Entscheid hängt von Verdecktem ab`);
        geprueft++;
      }
      sl.botSchritt();
    }
  }
  assert.ok(geprueft > 100, `nur ${geprueft} Stichproben`);
});

test('Bots haben technisch keinen Zugriff auf den Spielzustand (nur Snapshot, keine Engine-Zustandsfelder)', async () => {
  const cfg = await standardLaden();
  const s = partie(cfg, { seed: 3, modus: 'pvp', n: 3 });
  const sv = sicht(s, 0);
  for (const k of ['tierBeutel', 'spezialStapel', 'tagesStapel', 'routenStapel', 'rng', 'log', 'statistik']) assert.ok(sv[k] === null || (Array.isArray(sv[k]) && sv[k].length === 0), k);
  for (const f of Object.values(sv.felder)) if (!f.aufgedeckt) assert.equal(f.inhalt, null);
  assert.equal(sv.spieler[1].hand, null);
  assert.equal(sv.spieler[1].karten, null);
  assert.ok(sv.spieler[0].hand);
  // Der Bot-Code importiert keinen Spielzustand: kein Zugriff auf Spielleiter.s
  for (const f of ['bot.js', 'wissen.js', 'gedaechtnis.js', 'vorausschau.js']) {
    const code = fs.readFileSync(new URL(`../bots/${f}`, import.meta.url), 'utf8');
    assert.doesNotMatch(code, /spielleiter|\.zustand\b|sl\.s\b/i, f);
  }
});

test('Koop-Snapshot: Rohstoffe, Charakter und Ausrüstung offen, Spezialkarten verdeckt; PvP verdeckt, Werkzeug offen', async () => {
  const cfg = await standardLaden();
  const k = partie(cfg, { seed: 4, modus: 'koop', n: 3 });
  const sk = sicht(k, 0);
  assert.ok(sk.spieler[1].hand && sk.spieler[1].charakter);
  assert.equal(sk.spieler[1].karten, null);
  const p = partie(cfg, { seed: 4, modus: 'pvp', n: 3 });
  p.spieler[1].ausruestung.axt = true; p.spieler[1].route = 'N';
  const sp = sicht(p, 0);
  assert.equal(sp.spieler[1].hand, null);
  assert.equal(sp.spieler[1].charakter, null);
  assert.equal(sp.spieler[1].ausruestung.axt, true);
  assert.equal(sp.spieler[1].route, 'verdeckt', 'alle sehen, wer eine Routenkarte hat, die Richtung bleibt geheim');
  const t = partie(cfg, { seed: 4, modus: 'team' });
  const st = sicht(t, 0);
  assert.ok(st.spieler[2].hand, 'Teampartner offen');
  assert.equal(st.spieler[1].hand, null, 'Gegner verdeckt');
});

function bereit(s, i = 0) { s.aktiv = i; s.tagesKarte = 'ruhig'; s._modsFuer = null; s.zug = neuerZug(s); s.zug.phase = 'bewegung'; return s.spieler[i]; }

test('Bot trinkt als letzte Aktion an der Wasserquelle, wenn die Energie knapp ist', async () => {
  const cfg = await standardLaden();
  const s = partie(cfg, { seed: 5, n: 2 });
  const q = Object.values(s.felder).find((f) => f.inhalt === 'wasserquelle');
  q.aufgedeckt = true;
  const p = bereit(s, 0); p.feld = q.key; p.energie = 1; p.hand.nahrung = 0;
  const bot = new Bot({ index: 0, stufe: 'normal', seed: 1, cfg });
  const a = bot.entscheiden(sicht(s, 0), erlaubteAktionen(s));
  assert.equal(a.typ, 'trinken');
});

test('Bot trinkt nicht bei Dürre und isst bei leerer Energie, wenn Nahrung übrig ist', async () => {
  const cfg = await standardLaden();
  const s = partie(cfg, { seed: 6, n: 2 });
  const q = Object.values(s.felder).find((f) => f.inhalt === 'wasserquelle');
  q.aufgedeckt = true;
  const p = bereit(s, 0); p.feld = q.key; p.energie = 0; p.hand.nahrung = 3;
  s.tagesKarte = 'trockenperiode'; s._modsFuer = null;
  const bot = new Bot({ index: 0, stufe: 'normal', seed: 1, cfg });
  const ak = erlaubteAktionen(s);
  assert.ok(!ak.some((a) => a.typ === 'trinken'));
  const a = bot.entscheiden(sicht(s, 0), ak);
  assert.equal(a.typ, 'essen');
});

test('Kompass-Sucher baut die Spitzhacke vor dem Kompass, Waffe vor dem grossen Tier', async () => {
  const cfg = await standardLaden();
  const s = partie(cfg, { seed: 7, modus: 'pvp', n: 2 });
  const p = bereit(s, 0); Object.assign(p.hand, { holz: 1, stein: 2, seil: 1 });
  const bot = new Bot({ index: 0, stufe: 'normal', seed: 1, cfg, persoenlichkeit: { siegweg: 'floss' } });
  bot.siegweg = 'floss';
  const a = bot.entscheiden(sicht(s, 0), erlaubteAktionen(s));
  assert.deepEqual(a, { typ: 'craften', rezept: 'spitzhacke' });
});

test('Feuerkette: der Bot plant Strandnummern mit gültigem Rundum-Abstand (alle Modi und Grössen)', async () => {
  const cfg = await standardLaden();
  for (const [modus, n] of [['koop', 2], ['koop', 3], ['koop', 4], ['team', 4], ['pvp', 2]]) {
    const s = partie(cfg, { seed: 8, modus, n });
    const sv = sicht(s, 0);
    const plan = feuerPlan(sv);
    assert.ok(ketteFertig(plan.positionen, plan.feuer, plan.abstand, 42), `${modus} ${n}: ${plan.positionen}`);
  }
});

test('PvP: Bot ohne Routenkarte greift den Routenkarten-Besitzer in Reichweite an', async () => {
  const cfg = await standardLaden();
  const s = partie(cfg, { seed: 9, modus: 'pvp', n: 2 });
  const p = bereit(s, 0); p.ausruestung.waffe = 'steinmachete';
  s.spieler[1].feld = p.feld; s.spieler[1].route = 'S';
  const bot = new Bot({ index: 0, stufe: 'normal', seed: 1, cfg });
  const a = bot.entscheiden(sicht(s, 0), erlaubteAktionen(s));
  assert.deepEqual(a, { typ: 'angreifen', ziel: 1 });
});

test('Duell-Beute: Bot ohne Routenkarte wählt die Routenkarte', async () => {
  const cfg = await standardLaden();
  const s = partie(cfg, { seed: 10, modus: 'pvp', n: 2 });
  const p = bereit(s, 0);
  s.spieler[1].feld = p.feld; s.spieler[1].route = 'S'; s.spieler[1].hand.holz = 3;
  s.testWuerfe = [6, 1];
  ausfuehren(s, { typ: 'angreifen', ziel: 1 });
  const bot = new Bot({ index: 0, stufe: 'normal', seed: 1, cfg });
  const a = bot.entscheiden(sicht(s, 0), erlaubteAktionen(s));
  assert.deepEqual(a, { typ: 'beute', wahl: 'route' });
});

test('Alle Stufen und der Zufalls-Bot spielen ganze Partien nur mit gültigen Zügen', async () => {
  const cfg = await standardLaden();
  for (const stufe of Object.keys(STUFEN)) for (const modus of ['koop', 'team', 'pvp']) {
    const sl = new Spielleiter(cfg, { seed: 11, modus, sitze: Array.from({ length: modus === 'team' ? 4 : 3 }, (_, k) => ({ name: `B${k}`, ki: true, stufe })), protokoll: false });
    sl.laufen();
    assert.ok(sl.s.ende, `${stufe} ${modus}`);
    assert.notEqual(sl.s.ende.grund, 'abbruch', `${stufe} ${modus}: Zuglimit`);
  }
});

test('Persönlichkeit: aggressive Bots greifen öfter an als friedliche', async () => {
  const cfg = await standardLaden();
  const zaehle = (aggression) => {
    let n = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const sl = new Spielleiter(cfg, { seed, modus: 'pvp', sitze: Array.from({ length: 3 }, (_, k) => ({ name: `B${k}`, ki: true, persoenlichkeit: { aggression } })), protokoll: false });
      sl.laufen(); n += sl.s.statistik.duelle;
    }
    return n;
  };
  assert.ok(zaehle(100) > zaehle(0));
});

test('Reproduzierbarkeit mit Bots: gleiche Konfiguration plus Seed = gleiche Partie (alle Stufen)', async () => {
  const cfg = await standardLaden();
  for (const stufe of ['sehrEinfach', 'normal', 'gut', 'zufall']) {
    const lauf = () => { const sl = new Spielleiter(cfg, { seed: 12, modus: 'koop', sitze: Array.from({ length: 3 }, (_, k) => ({ name: `B${k}`, ki: true, stufe })) }); sl.laufen(); return sl; };
    const a = lauf(), b = lauf();
    assert.deepEqual(a.zuege, b.zuege, stufe);
    assert.deepEqual(a.s.log, b.s.log, stufe);
  }
});

test('Siegweg: Bot wechselt, wenn sich die Lage ändert (Kompass weg, Routenkarte beim Gegner)', async () => {
  const cfg = await standardLaden();
  const s = partie(cfg, { seed: 13, modus: 'pvp', n: 2 });
  bereit(s, 0);
  const bot = new Bot({ index: 0, stufe: 'normal', seed: 1, cfg, persoenlichkeit: { aggression: 0, ungeduld: 100 } });
  bot.cache = new Map();
  assert.equal(bot.siegwegWaehlen(sicht(s, 0)), 'floss');
  // Kompass geborgen vom Gegner: Vulkanfels aufgedeckt ohne Kompass, Gegner hat die Routenkarte
  for (const f of Object.values(s.felder)) if (f.biom === 'vulkan') { f.aufgedeckt = true; if (f.inhalt === 'vulkanfels') f.kompass = false; }
  s.spieler[1].route = 'N';
  bot.cache = new Map();
  assert.notEqual(bot.siegwegWaehlen(sicht(s, 0)), 'floss');
});

test('Koop: Bot schenkt dem Baumeister am Strand Material für das nächste Lagerfeuer', async () => {
  const cfg = await standardLaden();
  const s = partie(cfg, { seed: 14, modus: 'koop', n: 2 });
  const p = bereit(s, 0);
  const strand = Object.values(s.felder).find((f) => f.kuestenNr === 5);
  s.spieler[1].feld = strand.key; p.feld = strand.key;
  Object.assign(s.spieler[1].hand, { holz: 2, stein: 1, abfall: 0 });
  Object.assign(p.hand, { abfall: 2 });
  const bot = new Bot({ index: 0, stufe: 'normal', seed: 1, cfg, persoenlichkeit: { kooperation: 90 } });
  bot.siegweg = 'feuer'; bot.cache = new Map();
  const h = bot.handelWahl(sicht(s, 0));
  assert.ok(h && h.typ === 'handeln' && h.mit === 1 && h.gebe.abfall >= 1, JSON.stringify(h));
});
