// Gemeinsamer Zustand der Oberfläche: aktuelle Konfiguration, Sitze, laufende Partie, Presets.
import { standardLaden, zusammenfuehren, klon, unterschiede, setzen } from '../engine/config.js';
import { speicher } from './dom.js';

export const EINGEBAUT = ['standard', 'einfach', 'hart'];
const SCHLUESSEL = { cfg: 'v11-konfig', sitze: 'v11-sitze', presets: 'v11-presets', tempo: 'v11-tempo' };

export const app = {
  standard: null, cfg: null, sitze: [], partie: null, presets: {}, eigene: {}, presetName: 'Standard V10',
  hoerer: new Set(),
  melden(was) { for (const h of this.hoerer) h(was); },
  partieLaeuft() { return !!(this.partie && !this.partie.sl.s.ende); },
  speichern() { speicher.schreiben(SCHLUESSEL.cfg, teilKonfig(this.cfg, this.standard)); speicher.schreiben(SCHLUESSEL.sitze, this.sitze); },
  tempo: speicher.lesen(SCHLUESSEL.tempo, { art: 'normal', pause: 2 }),
  tempoSpeichern() { speicher.schreiben(SCHLUESSEL.tempo, this.tempo); },
  eigeneSpeichern() { speicher.schreiben(SCHLUESSEL.presets, this.eigene); },
};

// Nur die Abweichungen vom Standard (für Presets und Speicher).
export function teilKonfig(cfg, standard) {
  const t = {};
  for (const u of unterschiede(standard, cfg)) setzen(t, u.pfad, klon(u.b));
  return t;
}

export function sitzeAnpassen() {
  const n = app.cfg.match.modus === 'team' ? 2 * app.cfg.match.teamGroesse : app.cfg.match.spieler;
  while (app.sitze.length < n) { const k = app.sitze.length; app.sitze.push({ name: k === 0 ? 'Du' : `KI ${k}`, ki: k > 0, stufe: app.cfg.ki.standardStufe, persoenlichkeit: {} }); }
  app.sitze.length = n;
}

export async function startZustand() {
  app.standard = await standardLaden();
  for (const n of EINGEBAUT) {
    try { app.presets[n] = await (await fetch(new URL(`../config/presets/${n}.json`, import.meta.url))).json(); } catch { app.presets[n] = {}; }
  }
  app.eigene = speicher.lesen(SCHLUESSEL.presets, {});
  app.cfg = zusammenfuehren(app.standard, speicher.lesen(SCHLUESSEL.cfg, {}));
  app.presetName = app.cfg.meta?.name ?? 'Standard V10';
  app.sitze = speicher.lesen(SCHLUESSEL.sitze, []);
  sitzeAnpassen();
}

export function presetLaden(teil, name) {
  app.cfg = zusammenfuehren(app.standard, teil ?? {});
  if (name) { app.cfg.meta = { ...app.cfg.meta, name }; app.presetName = name; }
  sitzeAnpassen();
  app.speichern();
  app.melden('konfig');
}
