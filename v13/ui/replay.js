// Replay: Partie aus Seed und Zugliste Schritt für Schritt nachspielen, mit Brett und Log.
import { $, esc, dateiLesen } from './dom.js';
import { app } from './zustand.js';
import { neuePartie, ausfuehren, klonen } from '../engine/engine.js';
import { zusammenfuehren } from '../engine/config.js';
import { brettSvg } from './brett.js';
import { spielerFarbe } from './bilder.js';
import { ENDE } from '../engine/namen.js';

const ABSTAND = 40; // Zwischenstände alle 40 Züge
let r = null;

function laden(prot) {
  const cfg = prot.konfig?.meta || prot.konfig?.match ? zusammenfuehren(app.standard, prot.konfig) : app.cfg;
  const s0 = neuePartie(cfg, { seed: prot.seed, modus: prot.modus, sitze: prot.sitze, protokoll: true });
  const notizen = new Map();
  for (const n of prot.notizen ?? []) { if (!notizen.has(n.vor)) notizen.set(n.vor, []); notizen.get(n.vor).push(n.text); }
  r = { prot, cfg, notizen, punkte: new Map([[0, klonen(s0)]]), schritt: 0, s: s0, auto: null };
}

function zuSchritt(k) {
  k = Math.max(0, Math.min(r.prot.zuege.length, k));
  let basis = Math.floor(k / ABSTAND) * ABSTAND;
  while (!r.punkte.has(basis)) basis -= ABSTAND;
  const s = klonen(r.punkte.get(basis));
  for (let i = basis; i < k; i++) {
    for (const n of r.notizen.get(i) ?? []) s.log.push(n);
    ausfuehren(s, r.prot.zuege[i]);
    if ((i + 1) % ABSTAND === 0 && !r.punkte.has(i + 1)) r.punkte.set(i + 1, klonen(s));
  }
  r.s = s; r.schritt = k;
}

export function replayZeigen(el) {
  if (app.replayProtokoll) { try { laden(app.replayProtokoll); } catch (e) { alert(`Replay nicht möglich: ${e.message}`); } app.replayProtokoll = null; }
  if (!r) {
    el.innerHTML = `<div class="kasten"><h2>⏯ Replay</h2><p>Spiele eine Partie aus Seed und Zugliste Schritt für Schritt nach. Lade ein Protokoll (Export aus dem Spiel oder <code>node sim/cli.mjs --replay SEED --json datei.json</code>) oder wähle im Reiter «Simulation» eine Einzelpartie.</p><button type="button" id="laden" class="haupt">Protokoll laden …</button></div>`;
    $('#laden', el).addEventListener('click', () => dateiWahl(el));
    return;
  }
  zeichnen(el);
}

async function dateiWahl(el) {
  try { const d = await dateiLesen('.json'); laden(JSON.parse(d.text)); zeichnen(el); } catch (e) { alert(`Datei nicht lesbar: ${e.message}`); }
}

function zeichnen(el) {
  const s = r.s, n = r.prot.zuege.length, a = r.prot.zuege[r.schritt - 1];
  el.innerHTML = `<div class="kasten"><div class="zeile"><h2>⏯ Replay · Seed ${r.prot.seed} · ${esc(r.prot.modus)}</h2>
    <span class="hinweis">${s.ende ? `Ende: ${esc(ENDE[s.ende.grund] ?? s.ende.grund)}` : `Tag ${s.tag}`} · Schritt ${r.schritt} von ${n}${a ? ` · letzte Aktion: ${esc(JSON.stringify(a))}` : ''}</span></div>
    <div class="zeile"><button type="button" data-s="0">⏮</button><button type="button" data-s="-40">−40</button><button type="button" data-s="-1">−1</button>
      <button type="button" id="auto" class="haupt">${r.auto ? '⏸ Pause' : '▶ Abspielen'}</button><button type="button" data-s="1">+1</button><button type="button" data-s="40">+40</button><button type="button" data-s="${n}">⏭</button>
      <input type="range" id="regler" min="0" max="${n}" value="${r.schritt}" style="flex:1;min-width:160px"/><button type="button" id="laden">Anderes Protokoll …</button></div></div>
    <div class="replay"><div class="brett-platz">${brettSvg(s, { hervor: s.spieler[s.aktiv]?.feld })}</div>
      <div class="replay-log"><div>${s.spieler.map((p, i) => `<div><span class="punkt" style="background:${spielerFarbe[i]}"></span><b>${esc(p.name)}</b> ❤️${p.herzen} ⚡${p.energie} ${p.route ? '🧭' : ''} <span class="hinweis">${Object.entries(p.hand).filter(([, x]) => x).map(([k, x]) => `${k} ${x}`).join(', ')}</span></div>`).join('')}</div><hr/>
      <ol start="${Math.max(1, s.log.length - 199)}">${s.log.slice(-200).map((l) => `<li>${esc(l)}</li>`).join('')}</ol></div></div>`;
  const log = el.querySelector('.replay-log');
  log.scrollTop = log.scrollHeight;
  for (const b of el.querySelectorAll('[data-s]')) b.addEventListener('click', () => { const d = Number(b.dataset.s); zuSchritt(Math.abs(d) === 1 || Math.abs(d) === ABSTAND ? r.schritt + d : d); zeichnen(el); });
  $('#regler', el).addEventListener('input', (e) => { zuSchritt(Number(e.target.value)); zeichnen(el); });
  $('#laden', el).addEventListener('click', () => { stop(); dateiWahl(el); });
  $('#auto', el).addEventListener('click', () => {
    if (r.auto) { stop(); zeichnen(el); return; }
    r.auto = setInterval(() => { if (r.schritt >= n || app.aktuellerReiter() !== 'replay') { stop(); return; } zuSchritt(r.schritt + 1); zeichnen(el); }, 250);
    zeichnen(el);
  });
}
function stop() { if (r?.auto) { clearInterval(r.auto); r.auto = null; } }
