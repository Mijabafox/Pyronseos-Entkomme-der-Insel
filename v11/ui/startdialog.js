// Startdialog «Neue Partie» wie in V10: über dem Spieltisch, ein Klick auf «Partie starten» genügt.
// Modus, Spielerzahl, Sitze und Seed direkt, Preset und KI-Persönlichkeit unter «Erweitert» (zugeklappt).
import { $, $$, esc } from './dom.js';
import { zusammenfuehren, unterschiede } from '../engine/config.js';
import { app, EINGEBAUT, presetLaden, sitzeAnpassen, pruefen, geaendertZahl } from './zustand.js';
import { STUFEN } from '../bots/bot.js';
import { spielerFarbe } from './bilder.js';
import { pruefHtml } from './regler.js';

const PERS = [['risiko', 'Risikobereitschaft'], ['kooperation', 'Kooperation'], ['aggression', 'Aggression'], ['ungeduld', 'Ungeduld'], ['sparsamkeit', 'Sparsamkeit']];
const SIEGWEG = { keiner: 'kein bevorzugter', floss: 'Floss', feuer: 'Küstenfeuer-Kette', wrack: 'Flugzeugwrack' };
const MODI = {
  koop: ['Koop', 'alle gegen die Insel, gewonnen ist nur gemeinsam · 2 bis 4 Sitze'],
  team: ['Team (2 gegen 2)', 'das erste Team, dessen beide Mitglieder fliehen, gewinnt · genau 4 Sitze'],
  pvp: ['PvP (jeder gegen jeden)', 'wer zuerst flieht oder als Letzter übrig bleibt, gewinnt · 2 bis 4 Sitze'],
};
// Der Freie Tisch wird erst mit ui/frei.js angeboten.
export const FREI_VERFUEGBAR = false;
const SPIELART = {
  regel: ['⚙️ Regel-Modus', 'Das Programm setzt alle Regeln durch. KI-Spieler möglich. Alles, was passiert, siehst du auf dem Tisch.'],
  frei: ['🃏 Freier Tisch', 'Wie ein echter Spieltisch für Playtests: alles frei verschiebbar, Werte von Hand, keine Regelprüfung. Nur Menschen (Hot-Seat).'],
};

// Offene Teile des Dialogs bleiben beim Neuzeichnen offen.
const offen = { erweitert: false, pers: new Set() };

export function startDialogOffen() { const d = $('#dialog'); return d.open && !!$('.start-dialog', d); }

// Der Dialog liegt nicht-modal über dem Tisch: Die Toolbar (Reiter, Regeln, Regler) bleibt bedienbar.
export function startDialogZeigen() {
  const d = $('#dialog');
  if (d.open && !startDialogOffen()) d.close();
  if (!d.open) { offen.erweitert = false; offen.pers.clear(); }
  zeichnen();
  d.classList.add('start-offen');
  document.body.classList.add('start-sichtbar');
  if (!d.open) d.show();
  d.onclose = () => { d.classList.remove('start-offen'); document.body.classList.remove('start-sichtbar'); };
  d.onkeydown = (e) => { if (e.key === 'Escape' && app.partie) { e.preventDefault(); d.close(); } };
  setTimeout(() => $('#startKnopf', d)?.focus(), 0);
}

function presetTeil(k) { return k.startsWith('e:') ? app.presets[k.slice(2)] : app.eigene[k.slice(2)]; }
function presetName(k) { return k.startsWith('e:') ? app.presets[k.slice(2)]?.meta?.name ?? k.slice(2) : k.slice(2); }

function zeichnen() {
  const d = $('#dialog');
  const cfg = app.cfg, m = cfg.match;
  const art = app.spielart ?? 'regel';
  const frei = art === 'frei';
  const v = pruefen();
  const n = geaendertZahl();
  const presets = [...EINGEBAUT.map((k) => [`e:${k}`, app.presets[k]?.meta?.name ?? k]), ...Object.keys(app.eigene).map((k) => [`u:${k}`, `★ ${k}`])];
  const aktuell = presets.find(([k]) => presetName(k) === app.presetName)?.[0];
  const unveraendert = aktuell && !unterschiede(zusammenfuehren(app.standard, presetTeil(aktuell) ?? {}), cfg).some((u) => !u.pfad.startsWith('meta'));
  const meldungen = !frei && (v.fehler.length || v.warnungen.length);
  d.innerHTML = `<form class="dialog-rahmen start-dialog" method="dialog" novalidate>
    <h2>🏝️ Insel-Survival · Version 11</h2>
    <fieldset><legend>Spielmodus</legend>
      ${Object.entries(MODI).map(([k, [name, text]]) => `<label class="wahl"><input type="radio" name="modus" value="${k}" ${m.modus === k ? 'checked' : ''}/><span><b>${name}</b><br><span class="hinweis">${text}</span></span></label>`).join('')}
    </fieldset>
    ${FREI_VERFUEGBAR ? `<fieldset><legend>Spielart</legend>
      ${Object.entries(SPIELART).map(([k, [name, text]]) => `<label class="wahl"><input type="radio" name="spielart" value="${k}" ${art === k ? 'checked' : ''}/><span><b>${name}</b><br><span class="hinweis">${text}</span></span></label>`).join('')}
    </fieldset>` : ''}
    <fieldset><legend>Spieler</legend>
      <div class="zeile">
        <label>Anzahl <select id="sdAnzahl" ${m.modus === 'team' ? 'disabled title="Team ist immer 2 gegen 2"' : ''}>${[2, 3, 4].map((k) => `<option ${k === (m.modus === 'team' ? 4 : m.spieler) ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
        ${frei ? '' : '<button type="button" id="sdAlleMensch" class="klein">Alle am Computer</button><button type="button" id="sdIchMitKI" class="klein">Ich mit KI-Mitspielern</button><button type="button" id="sdAlleKI" class="klein">Nur KI zuschauen</button>'}
      </div>
      <div class="sitze">${app.sitze.map((s, k) => sitzHtml(s, k, frei, m.modus)).join('')}</div>
    </fieldset>
    <div class="formular-zeile"><label for="sdSeed">Seed</label><span><input id="sdSeed" inputmode="numeric" placeholder="leer = zufällig" value="${m.seed ?? ''}"/> <span class="hinweis">Gleicher Seed = gleiche Insel und gleiche Stapel.</span></span></div>
    <details class="erweitert" ${offen.erweitert ? 'open' : ''}><summary>⚙️ Erweitert <span class="hinweis">Preset${frei ? '' : ', KI-Persönlichkeit'} und alle Regler</span></summary>
      <div class="formular-zeile"><label for="sdPreset">Preset</label><span><select id="sdPreset">${unveraendert ? '' : `<option value="" selected>${esc(app.presetName)} (angepasst)</option>`}${presets.map(([k, name]) => `<option value="${esc(k)}" ${unveraendert && k === aktuell ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select>
        <span class="hinweis">${n ? `${n} ${n === 1 ? 'Wert weicht' : 'Werte weichen'} vom Standard V10 ab` : 'alle Werte wie Standard V10'}</span></span></div>
      ${frei ? '' : app.sitze.map((s, k) => (s.ki ? persHtml(s, k) : '')).join('')}
      <p><a href="#" id="sdRegler">🎚️ Regler öffnen</a> <span class="hinweis">– alle Werte im Reiter «Regler» einstellen${app.partieLaeuft() ? ' (gesperrt, solange eine Partie läuft)' : ''}</span></p>
    </details>
    ${meldungen ? `<div class="start-pruefung">${pruefHtml(v)}</div>` : ''}
    <div class="dialog-knoepfe">
      ${app.partie ? '<button type="button" id="sdAbbrechen">Abbrechen</button>' : ''}
      <button type="submit" class="haupt gross" id="startKnopf" ${frei || v.ok ? '' : 'disabled title="Erst die Fehler oben beheben"'}>▶ Partie starten</button>
    </div>
  </form>`;
  verdrahten(d);
}

function sitzHtml(s, k, frei, modus) {
  const team = modus === 'team' ? `<span class="hinweis team-marke">${k % 2 === 0 ? '☀️ Sonne' : '🌙 Mond'}</span>` : '';
  return `<div class="sitz" data-sitz="${k}">
    <span class="punkt" style="background:${spielerFarbe[k]}"></span>
    <input data-f="name" maxlength="14" value="${esc(s.name)}" aria-label="Name Spieler ${k + 1}"/>
    ${frei ? '<span class="hinweis">🧑 Mensch</span><span></span>' : `<select data-f="ki" aria-label="Mensch oder KI"><option value="mensch" ${s.ki ? '' : 'selected'}>🧑 Mensch</option><option value="ki" ${s.ki ? 'selected' : ''}>🤖 KI</option></select>
    <select data-f="stufe" aria-label="KI-Stufe" ${s.ki ? '' : 'disabled'}>${Object.entries(STUFEN).map(([id, x]) => `<option value="${id}" ${s.stufe === id ? 'selected' : ''}>${s.ki ? `Stufe: ${x.name}` : '–'}</option>`).join('')}</select>`}
    ${team}
  </div>`;
}

function persHtml(s, k) {
  const p = s.persoenlichkeit ?? {};
  const pd = app.cfg.ki.persoenlichkeit;
  const w = (id) => p[id] ?? pd[id];
  return `<details class="pers-block" data-pers="${k}" ${offen.pers.has(k) ? 'open' : ''}><summary><span class="punkt" style="background:${spielerFarbe[k]}"></span>🎭 Persönlichkeit von ${esc(s.name)}</summary>
    <div class="pers-raster">
      ${PERS.map(([id, name]) => `<label for="p${k}${id}">${name}</label><input type="range" id="p${k}${id}" min="0" max="100" step="5" data-p="${id}" value="${w(id)}"/><output>${w(id)}</output>`).join('')}
      <label for="p${k}siegweg">Bevorzugter Siegweg</label><select id="p${k}siegweg" data-p="siegweg">${Object.entries(SIEGWEG).map(([id, name]) => `<option value="${id}" ${w('siegweg') === id ? 'selected' : ''}>${name}</option>`).join('')}</select><span></span>
      <label for="p${k}fehler">Fehlerquote (%)</label><input type="number" id="p${k}fehler" min="0" max="100" data-p="fehlerquote" placeholder="wie Stufe" value="${p.fehlerquote ?? ''}"/><span></span>
      <label for="p${k}aufm">Aufmerksamkeitsfehler (%)</label><input type="number" id="p${k}aufm" min="0" max="100" data-p="aufmerksamkeit" placeholder="wie Stufe" value="${p.aufmerksamkeit ?? ''}"/><span></span>
    </div>
    <button type="button" class="klein" data-pers-std="${k}">↺ Persönlichkeit zurücksetzen</button>
  </details>`;
}

function neu() { app.speichern(); zeichnen(); app.toolbar(); }

function verdrahten(d) {
  const f = $('form', d);
  $('.erweitert', d).addEventListener('toggle', (e) => { offen.erweitert = e.target.open; });
  for (const b of $$('.pers-block', d)) b.addEventListener('toggle', () => { const k = Number(b.dataset.pers); if (b.open) offen.pers.add(k); else offen.pers.delete(k); });
  for (const r of $$('input[name=modus]', d)) r.addEventListener('change', () => { app.cfg.match.modus = r.value; sitzeAnpassen(); neu(); });
  for (const r of $$('input[name=spielart]', d)) r.addEventListener('change', () => {
    app.spielart = r.value;
    if (r.value === 'frei') app.sitze.forEach((s, k) => { if (s.ki) { s.ki = false; if (/^KI \d+$/.test(s.name)) s.name = `Spieler ${k + 1}`; } });
    else if (app.sitze.every((s) => !s.ki)) app.sitze.forEach((s, k) => { s.ki = k > 0; if (s.ki && /^Spieler \d+$/.test(s.name)) s.name = `KI ${k}`; });
    neu();
  });
  $('#sdAnzahl', d).addEventListener('change', (e) => { app.cfg.match.spieler = Number(e.target.value); sitzeAnpassen(); if (app.spielart === 'frei') app.sitze.forEach((s) => { s.ki = false; }); neu(); });
  $('#sdSeed', d).addEventListener('change', (e) => { const t = e.target.value.replace(/\D/g, ''); app.cfg.match.seed = t ? Number(t) : null; e.target.value = t; app.speichern(); });
  for (const z of $$('.sitz', d)) {
    const k = Number(z.dataset.sitz), s = app.sitze[k];
    $('[data-f=name]', z).addEventListener('change', (e) => { s.name = e.target.value.trim() || `Spieler ${k + 1}`; neu(); });
    $('[data-f=ki]', z)?.addEventListener('change', (e) => {
      s.ki = e.target.value === 'ki';
      if (!s.ki && /^KI \d+$/.test(s.name)) s.name = k === 0 ? 'Du' : `Spieler ${k + 1}`;
      if (s.ki && /^(Spieler \d+|Du)$/.test(s.name)) s.name = `KI ${k}`;
      neu();
    });
    $('[data-f=stufe]', z)?.addEventListener('change', (e) => { s.stufe = e.target.value; app.speichern(); });
  }
  const alle = (ki) => { app.sitze.forEach((s, k) => { s.ki = ki(k); s.name = s.ki ? `KI ${k + (ki(0) ? 1 : 0)}` : k === 0 ? 'Du' : `Spieler ${k + 1}`; }); neu(); };
  $('#sdAlleMensch', d)?.addEventListener('click', () => alle(() => false));
  $('#sdIchMitKI', d)?.addEventListener('click', () => alle((k) => k > 0));
  $('#sdAlleKI', d)?.addEventListener('click', () => alle(() => true));
  $('#sdPreset', d).addEventListener('change', (e) => { if (e.target.value) { presetLaden(presetTeil(e.target.value), presetName(e.target.value)); neu(); } });
  for (const b of $$('.pers-block', d)) {
    const k = Number(b.dataset.pers), s = app.sitze[k];
    for (const p of $$('[data-p]', b)) p.addEventListener('input', () => {
      s.persoenlichkeit ??= {};
      const w = p.type === 'range' ? Number(p.value) : p.tagName === 'SELECT' ? p.value : p.value === '' ? null : Math.max(0, Math.min(100, Number(p.value)));
      if (w === null) delete s.persoenlichkeit[p.dataset.p]; else s.persoenlichkeit[p.dataset.p] = w;
      if (p.type === 'range') p.nextElementSibling.textContent = p.value;
      app.speichern();
    });
    $('[data-pers-std]', b).addEventListener('click', () => { s.persoenlichkeit = {}; neu(); });
  }
  $('#sdRegler', d).addEventListener('click', (e) => { e.preventDefault(); d.close(); app.reglerOeffnen(); });
  for (const a of $$('.start-pruefung a.ziel', d)) a.addEventListener('click', (e) => {
    e.preventDefault();
    const z = JSON.parse(a.dataset.ziel);
    d.close();
    if (z.reiter) app.reiter(z.reiter); else app.reglerOeffnen(z.pfad ?? null, z.bereich);
  });
  $('#sdAbbrechen', d)?.addEventListener('click', () => d.close());
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const seed = $('#sdSeed', d).value.replace(/\D/g, '');
    app.cfg.match.seed = seed ? Number(seed) : null;
    app.speichern();
    if ((app.spielart ?? 'regel') === 'regel' && !pruefen().ok) return;
    d.close();
    app.partieStarten();
  });
}
