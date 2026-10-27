#!/usr/bin/env node
// Simulation über die Kommandozeile.
//   node sim/cli.mjs --partien 200 --modus koop --spieler 3 --bots normal,normal,gut
//   node sim/cli.mjs --preset hart --csv ergebnis.csv
//   node sim/cli.mjs --config meine.json --set fluchtwege.floss.solide.proPerson.seil=2
//   node sim/cli.mjs --sweep fluchtwege.floss.solide.proPerson.seil=1:4 --sweep2 match.spieler=2:4 --partien 50
//   node sim/cli.mjs --ab presets/hart.json --partien 300
//   node sim/cli.mjs --import echte-partien.json
//   node sim/cli.mjs --replay 17 --modus pvp --spieler 3   (Protokoll einer Partie als JSON)
//   node sim/cli.mjs --validieren
import fs from 'node:fs';
import path from 'node:path';
import { standardLaden, zusammenfuehren, setzen } from '../engine/config.js';
import { validieren } from '../engine/validator.js';
import { ENDE_KURZ, WEG_NAME, CHARAKTER_NAME } from '../engine/namen.js';
import { serie, auswerten, hinweise, csvPartien, csvAuswertung, sweep, sweepCsv, heatmapText, abVergleich, abgleich, protokollKennzahlen, partieSimulieren, werteListe } from './simulation.js';

const hilfe = `Insel-Survival V11 – Simulation
  --partien N        Anzahl Partien (Standard 100)
  --seed S           erster Seed (Standard 1), dann S+1, S+2 ...
  --modus M          koop | team | pvp (Standard aus der Konfiguration)
  --spieler N        Spielerzahl 2–4 (Team: 4)
  --bots LISTE       Bot-Stufen je Sitz, z. B. normal,gut,sehrEinfach oder zufall
  --persoenlichkeit JSON   z. B. '{"aggression":80}' (für alle Bots)
  --config DATEI     Konfigurationsdatei (Teil- oder Vollkonfiguration)
  --preset NAME      Preset aus config/presets (standard, einfach, hart)
  --set PFAD=WERT    einzelnen Wert setzen (mehrfach möglich)
  --csv DATEI        Partien als CSV speichern (Zusammenfassung: DATEI mit -summe)
  --json DATEI       Auswertung als JSON speichern
  --sweep PFAD=BEREICH   Parameter-Sweep, Bereich 1:4 oder 1:4:1 oder Liste 1,2,3
  --sweep2 PFAD=BEREICH  zweiter Parameter (Heatmap)
  --kennzahl K       Kennzahl für Sweep (Standard siegquote, z. B. proWeg.feuer)
  --ab DATEI         A/B-Vergleich: Konfiguration A (aktuelle) gegen Datei B, gleiche Seeds
  --import DATEI     echte Partien (Browser-Export) mit Bot-Partien vergleichen
  --replay SEED      eine Partie simulieren und das Protokoll (Seed + Zugliste) ausgeben
  --validieren       nur die Konfiguration prüfen
  --hilfe`;

function args(argv) {
  const a = { set: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) continue;
    const name = k.slice(2);
    const wert = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    if (name === 'set') a.set.push(wert); else a[name] = wert;
  }
  return a;
}

const lesenJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const prozent = (x) => (x === null || x === undefined ? '–' : `${(100 * x).toFixed(1)} %`);
const zahl = (x, n = 1) => (x === null || x === undefined ? '–' : x.toFixed(n));

async function konfig(a) {
  let cfg = await standardLaden();
  if (a.preset) {
    const f = new URL(`../config/presets/${a.preset}.json`, import.meta.url);
    cfg = zusammenfuehren(cfg, JSON.parse(fs.readFileSync(f, 'utf8')));
  }
  if (a.config) cfg = zusammenfuehren(cfg, lesenJson(a.config));
  for (const s of a.set) {
    const [p, w] = String(s).split('=');
    setzen(cfg, p, werteListe(w)[0]);
  }
  return cfg;
}

function bericht(a, titel) {
  const z = [];
  z.push(`\n=== ${titel} ===`);
  z.push(`${a.partien} Partien · Siegquote ${prozent(a.siegquote)} · Ø Tag des Siegs ${zahl(a.tageBisSieg)} · Ø Tage ${zahl(a.tageImSchnitt)}`);
  z.push(`Endgründe: ${Object.entries(a.proGrund).filter(([, v]) => v > 0).map(([k, v]) => `${ENDE_KURZ[k] ?? k} ${prozent(v)}`).join(' · ')}`);
  z.push(`Sieg pro Fluchtweg: ${Object.entries(a.proWeg).map(([k, v]) => `${WEG_NAME[k] ?? k} ${prozent(v)}`).join(' · ')}`);
  z.push(`Anteil gewählter Fluchtweg (an den Fluchten): ${Object.entries(a.wegAnteil).map(([k, v]) => `${WEG_NAME[k] ?? k} ${prozent(v)}`).join(' · ')}`);
  z.push(`Pro Modus: ${Object.entries(a.proModus).map(([k, v]) => `${k} ${prozent(v.siegquote)}`).join(' · ')} · pro Spielerzahl: ${Object.entries(a.proSpielerzahl).map(([k, v]) => `${k} ${prozent(v.siegquote)}`).join(' · ')}`);
  z.push(`Pro Charakter: ${Object.entries(a.charakter).map(([k, v]) => `${CHARAKTER_NAME[k] ?? k} ${prozent(v.siegquote)} (${v.partien})`).join(' · ')}`);
  z.push(`Pro Bot-Stufe: ${Object.entries(a.stufe).map(([k, v]) => `${k} ${prozent(v.siegquote)}`).join(' · ')}`);
  z.push(`Niederlage Lava ${prozent(a.niederlageLava)} · Tod ${prozent(a.niederlageTod)} · Kompass gefunden ${prozent(a.kompassGefunden)} (Ø Tag ${zahl(a.kompassTag)})`);
  z.push(`Material: leere Stapel Holz ${zahl(a.knappheit.holz, 2)}, Seil ${zahl(a.knappheit.seil, 2)} · am Ende fehlte Holz ${zahl(a.knappheit.fehltHolz)}, Seil ${zahl(a.knappheit.fehltSeil)}`);
  z.push(`Pro Partie: Duelle ${zahl(a.duelle)} · Raube ${zahl(a.raube)} (Routenkarte ${zahl(a.raubRoute, 2)}) · Zurücksetzungen ${zahl(a.zurueckgesetzt)} · Wasser-Zugenden ${zahl(a.wasserZugende)} · Kämpfe ${zahl(a.kaempfe)} · Feuer ${zahl(a.feuerGebaut)} (davon ungültig ${zahl(a.feuerUngueltig)})`);
  const karten = (e) => Object.entries(e).sort((x, y) => Math.abs(y[1].differenz) - Math.abs(x[1].differenz)).slice(0, 6).map(([k, v]) => `${k} ${v.differenz >= 0 ? '+' : ''}${(100 * v.differenz).toFixed(1)} Pp`).join(' · ');
  z.push(`Einfluss Tageskarten (Siegquote mit − ohne): ${karten(a.tageskarten)}`);
  z.push(`Einfluss Spezialkarten: ${karten(a.spezialkarten)}`);
  for (const h of hinweise(a)) z.push(`⚠️ ${h}`);
  return z.join('\n');
}

async function main() {
  const a = args(process.argv.slice(2));
  if (a.hilfe || a.help) { console.log(hilfe); return; }
  const cfg = await konfig(a);
  const modus = a.modus ?? cfg.match.modus;
  const spieler = Number(a.spieler ?? (modus === 'team' ? 4 : cfg.match.spieler));
  const opt = { partien: Number(a.partien ?? 100), seed: Number(a.seed ?? 1), modus, spieler, bots: a.bots ?? cfg.ki.standardStufe };
  if (a.persoenlichkeit) { const p = JSON.parse(a.persoenlichkeit); opt.bots = String(opt.bots).split(',').map((stufe) => ({ stufe, persoenlichkeit: p })); }
  const v = validieren(cfg, { modus, spieler });
  for (const w of v.warnungen) console.error(`Warnung: ${w}`);
  if (!v.ok) { for (const f of v.fehler) console.error(`Fehler: ${f}`); console.error('Die Konfiguration ist nicht spielbar.'); process.exitCode = 2; return; }
  if (a.validieren) { console.log('Konfiguration gültig.'); return; }
  const fortschritt = process.stderr.isTTY ? (i, n) => process.stderr.write(`\r${i}/${n}`) : null;
  const t0 = Date.now();

  if (a.replay) {
    const r = partieSimulieren(cfg, { ...opt, seed: Number(a.replay), protokoll: true, mitZuegen: true });
    const ziel = a.json ?? null;
    const text = JSON.stringify(r.protokoll, null, 1);
    if (ziel) fs.writeFileSync(ziel, text); else console.log(text);
    return;
  }
  if (a.sweep) {
    const [pfadA, werteA] = String(a.sweep).split('=');
    const [pfadB, werteB] = a.sweep2 ? String(a.sweep2).split('=') : [null, [null]];
    const sw = sweep(cfg, opt, { pfadA, werteA, pfadB, werteB }, fortschritt);
    const k = a.kennzahl ?? 'siegquote';
    console.log(`\nSweep ${pfadA}${pfadB ? ` × ${pfadB}` : ''} · ${opt.partien} Partien pro Zelle · Kennzahl ${k}`);
    console.log(heatmapText(sw, k));
    for (const z of sw.zellen) if (!z.gueltig) console.log(`✕ ${z.a}${z.b !== null ? `/${z.b}` : ''}: ${z.fehler[0]}`);
    if (a.csv) { fs.writeFileSync(a.csv, sweepCsv(sw, k)); console.log(`CSV: ${a.csv}`); }
    if (a.json) fs.writeFileSync(a.json, JSON.stringify(sw, null, 1));
  } else if (a.ab) {
    const cfgB = zusammenfuehren(await standardLaden(), lesenJson(a.ab));
    const vb = validieren(cfgB, { modus, spieler });
    if (!vb.ok) { console.error(`Konfiguration B: ${vb.fehler.join(' | ')}`); process.exitCode = 2; return; }
    const r = abVergleich(cfg, cfgB, opt, fortschritt);
    console.log(`\nA/B-Vergleich · gleiche Seeds · je ${r.partien} Partien`);
    console.log(`Unterschiede: ${r.unterschiede.slice(0, 12).map((u) => `${u.pfad}: ${JSON.stringify(u.a)} → ${JSON.stringify(u.b)}`).join(' · ') || 'keine'}`);
    for (const z of r.zeilen) console.log(`${z.name.padEnd(22)} A ${z.art === 'quote' ? prozent(z.a) : zahl(z.a, 2)}  B ${z.art === 'quote' ? prozent(z.b) : zahl(z.b, 2)}  Δ ${z.art === 'quote' ? `${(100 * z.differenz).toFixed(1)} Pp` : zahl(z.differenz, 2)}  (${z.signifikanz})`);
    if (a.json) fs.writeFileSync(a.json, JSON.stringify(r, null, 1));
  } else if (a.import) {
    const daten = lesenJson(a.import);
    const liste = Array.isArray(daten) ? daten : daten.partien ?? [daten];
    const echte = liste.map((p) => protokollKennzahlen(p, cfg));
    const m = echte[0]?.modus ?? modus, n = echte[0]?.spieler ?? spieler;
    const bots = serie(cfg, { ...opt, modus: m, spieler: n }, fortschritt);
    const r = abgleich(echte, bots);
    console.log(`\nAbgleich: ${r.echte} echte Partien gegen ${r.bots} Bot-Partien (${m}, ${n} Spieler)`);
    for (const z of r.zeilen) console.log(`${z.name.padEnd(26)} Menschen ${z.art === 'quote' ? prozent(z.mensch) : zahl(z.mensch)}  Bots ${z.art === 'quote' ? prozent(z.bots) : zahl(z.bots)}${z.auffaellig ? '  ⚠️ deutlich anders' : ''}`);
    for (const b of r.befunde) console.log(`⚠️ ${b}`);
    console.log(r.hinweis);
  } else {
    const partien = serie(cfg, opt, fortschritt);
    const aw = auswerten(partien);
    console.log(bericht(aw, `${cfg.meta?.name ?? 'Konfiguration'} · ${modus} · ${spieler} Spieler · Bots ${opt.bots}`));
    if (a.csv) {
      fs.writeFileSync(a.csv, csvPartien(partien));
      const summe = a.csv.replace(/(\.csv)?$/, '-summe.csv');
      fs.writeFileSync(summe, csvAuswertung(aw));
      console.log(`CSV: ${a.csv} und ${summe}`);
    }
    if (a.json) fs.writeFileSync(a.json, JSON.stringify(aw, null, 1));
  }
  console.error(`\n(${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
void path;
