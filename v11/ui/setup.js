// Setup: nur was für den Start nötig ist (Preset, Modus, Spielerzahl, Seed, Sitze, Prüfung). Alle Regler im Reiter «Regler».
import { $, $$, esc } from './dom.js';
import { zusammenfuehren, unterschiede } from '../engine/config.js';
import { app, EINGEBAUT, presetLaden, sitzeAnpassen, pruefen, geaendertZahl, partieBeenden } from './zustand.js';
import { STUFEN } from '../bots/bot.js';
import { spielerFarbe } from './bilder.js';
import { neuesSpiel } from './spiel.js';
import { pruefHtml, zielLinks } from './regler.js';

const PERS = [['risiko', 'Risikobereitschaft'], ['kooperation', 'Kooperation'], ['aggression', 'Aggression'], ['ungeduld', 'Ungeduld'], ['sparsamkeit', 'Sparsamkeit']];
const MODI = {
  koop: ['Koop', 'alle gegen die Insel, gewonnen ist nur gemeinsam'],
  team: ['Team (2 gegen 2)', 'das erste Team, dessen beide Mitglieder fliehen, gewinnt'],
  pvp: ['PvP (jeder gegen jeden)', 'wer zuerst flieht oder als Letzter übrig bleibt'],
};

export function setupZeigen(el) {
  const gesperrt = app.partieLaeuft();
  const cfg = app.cfg;
  const v = pruefen();
  const n = geaendertZahl();
  const presets = [...EINGEBAUT.map((k) => [`e:${k}`, app.presets[k]?.meta?.name ?? k]), ...Object.keys(app.eigene).map((k) => [`u:${k}`, `★ ${k}`])];
  const aktuell = presets.find(([k]) => presetName(k) === app.presetName)?.[0];
  const bekannt = aktuell && !unterschiede(zusammenfuehren(app.standard, presetTeil(aktuell) ?? {}), cfg).some((u) => !u.pfad.startsWith('meta'));
  el.innerHTML = `
  <div class="setup">
  ${gesperrt ? `<div class="gesperrt">🔒 Eine Partie läuft – Setup und Regler sind gesperrt. <button type="button" id="partieEnde">Partie beenden und entsperren</button> <button type="button" id="zumSpiel" class="haupt">Zum Spiel</button></div>` : ''}
    <div class="kasten">
      <h2>Neue Partie</h2>
      <div class="formular-raster">
        <label>Preset <select id="setupPreset">${bekannt ? '' : `<option value="" selected>${esc(app.presetName)} (angepasst)</option>`}${presets.map(([k, name]) => `<option value="${esc(k)}" ${bekannt && k === aktuell ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select></label>
        <label>Spielerzahl <select id="spielerzahl" ${cfg.match.modus === 'team' ? 'disabled' : ''}>${[2, 3, 4].map((k) => `<option ${k === cfg.match.spieler ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
        <label>Seed <input id="seed" inputmode="numeric" placeholder="leer = zufällig" value="${cfg.match.seed ?? ''}"/></label>
      </div>
      <fieldset><legend>Modus</legend>
        ${Object.entries(MODI).map(([m, [name, text]]) => `<label class="wahl"><input type="radio" name="modus" value="${m}" ${cfg.match.modus === m ? 'checked' : ''}/> <b>${name}</b> <span class="hinweis">${text}</span></label>`).join('')}
      </fieldset>
      <h3>Sitze</h3>
      <div id="sitze">${app.sitze.map((s, k) => sitzHtml(s, k)).join('')}</div>
      <div class="zeile"><button type="button" id="alleKI" class="klein">Alle KI</button><button type="button" id="ichMitKI" class="klein">Ich mit KI</button><button type="button" id="alleMensch" class="klein">Alle Menschen (Hot-Seat)</button></div>
    </div>
    <div class="kasten">
      <h2>Prüfung</h2>
      <div id="setupPruefung">${pruefHtml(v)}</div>
      <div class="start-zeile">
        <button type="button" class="haupt gross" id="start" ${v.ok && !gesperrt ? '' : 'disabled'}>▶ Partie starten</button>
        <span class="hinweis">${n ? `<b>${n}</b> ${n === 1 ? 'Wert weicht' : 'Werte weichen'} vom Standard V10 ab` : 'Alle Regler auf Standard V10'} · <a href="#" id="zuReglern">Regler anpassen</a></span>
      </div>
    </div>
  </div>`;
  verdrahten(el, gesperrt);
  zielLinks($('#setupPruefung', el));
  if (gesperrt) for (const i of $$('input, select, textarea, button', el)) if (!['partieEnde', 'zumSpiel'].includes(i.id)) i.disabled = true;
}

function presetTeil(k) { return k.startsWith('e:') ? app.presets[k.slice(2)] : app.eigene[k.slice(2)]; }

function presetName(k) {
  const [art, name] = [k.slice(0, 1), k.slice(2)];
  return art === 'e' ? app.presets[name]?.meta?.name ?? name : name;
}

function sitzHtml(s, k) {
  const p = s.persoenlichkeit ?? {};
  const pd = app.cfg.ki.persoenlichkeit;
  return `<div class="sitz-block" data-sitz="${k}">
    <div class="sitz"><span class="punkt" style="background:${spielerFarbe[k]}"></span>
      <input data-f="name" maxlength="14" value="${esc(s.name)}" aria-label="Name"/>
      <select data-f="ki"><option value="mensch" ${s.ki ? '' : 'selected'}>🧑 Mensch</option><option value="ki" ${s.ki ? 'selected' : ''}>🤖 KI</option></select>
      <select data-f="stufe" ${s.ki ? '' : 'disabled'}>${Object.entries(STUFEN).map(([id, x]) => `<option value="${id}" ${s.stufe === id ? 'selected' : ''}>${x.name}</option>`).join('')}</select>
      <button type="button" class="klein" data-f="pers" ${s.ki ? '' : 'disabled'} title="Persönlichkeit">🎭</button></div>
    <div class="persoenlichkeit" ${s.zeigePers ? '' : 'hidden'}>
      ${PERS.map(([id, n]) => `<label>${n} <input type="range" min="0" max="100" step="5" data-p="${id}" value="${p[id] ?? pd[id]}"/><span>${p[id] ?? pd[id]}</span></label>`).join('')}
      <label>Siegweg <select data-p="siegweg">${['keiner', 'floss', 'feuer', 'wrack'].map((w) => `<option ${(p.siegweg ?? pd.siegweg) === w ? 'selected' : ''}>${w}</option>`).join('')}</select></label>
      <label>Fehlerquote % <input type="number" min="0" max="100" data-p="fehlerquote" placeholder="Stufe" value="${p.fehlerquote ?? ''}"/></label>
      <label>Aufmerksamkeitsfehler % <input type="number" min="0" max="100" data-p="aufmerksamkeit" placeholder="Stufe" value="${p.aufmerksamkeit ?? ''}"/></label>
    </div></div>`;
}

function neu() { app.speichern(); setupZeigen($('#ansicht-setup')); app.toolbar(); }

function verdrahten(el, gesperrt) {
  $('#partieEnde', el)?.addEventListener('click', () => { partieBeenden(); neu(); });
  $('#zumSpiel', el)?.addEventListener('click', () => app.reiter('spiel'));
  $('#zuReglern', el).addEventListener('click', (e) => { e.preventDefault(); app.reglerOeffnen(); });
  if (gesperrt) return;
  $('#setupPreset', el).addEventListener('change', (e) => {
    const k = e.target.value;
    if (!k) return;
    presetLaden(presetTeil(k), presetName(k));
    neu();
  });
  for (const r of $$('input[name=modus]', el)) r.addEventListener('change', () => { app.cfg.match.modus = r.value; sitzeAnpassen(); neu(); });
  $('#spielerzahl', el).addEventListener('change', (e) => { app.cfg.match.spieler = Number(e.target.value); sitzeAnpassen(); neu(); });
  $('#seed', el).addEventListener('change', (e) => { const t = e.target.value.replace(/\D/g, ''); app.cfg.match.seed = t ? Number(t) : null; neu(); });
  for (const b of $$('.sitz-block', el)) {
    const k = Number(b.dataset.sitz), s = app.sitze[k];
    $('[data-f=name]', b).addEventListener('change', (e) => { s.name = e.target.value.trim() || `Spieler ${k + 1}`; app.speichern(); });
    $('[data-f=ki]', b).addEventListener('change', (e) => { s.ki = e.target.value === 'ki'; if (!s.ki && /^KI \d+$/.test(s.name)) s.name = `Spieler ${k + 1}`; if (s.ki && /^Spieler \d+$/.test(s.name)) s.name = `KI ${k + 1}`; neu(); });
    $('[data-f=stufe]', b).addEventListener('change', (e) => { s.stufe = e.target.value; app.speichern(); });
    $('[data-f=pers]', b).addEventListener('click', () => { s.zeigePers = !s.zeigePers; neu(); });
    for (const p of $$('[data-p]', b)) p.addEventListener('input', () => {
      s.persoenlichkeit ??= {};
      const w = p.type === 'range' ? Number(p.value) : p.tagName === 'SELECT' ? p.value : p.value === '' ? null : Number(p.value);
      if (w === null) delete s.persoenlichkeit[p.dataset.p]; else s.persoenlichkeit[p.dataset.p] = w;
      if (p.type === 'range') p.nextElementSibling.textContent = p.value;
      app.speichern();
    });
  }
  const alle = (ki) => { app.sitze.forEach((s, k) => { s.ki = ki(k); s.name = s.ki ? `KI ${k + 1}` : k === 0 ? 'Du' : `Spieler ${k + 1}`; }); neu(); };
  $('#alleKI', el).addEventListener('click', () => alle(() => true));
  $('#ichMitKI', el).addEventListener('click', () => alle((k) => k > 0));
  $('#alleMensch', el).addEventListener('click', () => alle(() => false));
  $('#start', el).addEventListener('click', () => { neuesSpiel(); app.reiter('spiel'); });
}
