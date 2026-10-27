// Setup: alle Regler vor Spielbeginn, Presets, Sitze, Validator. Während der Partie gesperrt.
import { $, $$, esc, herunterladen, dateiLesen } from './dom.js';
import { app, EINGEBAUT, presetLaden, sitzeAnpassen, teilKonfig } from './zustand.js';
import { regler, BEREICHE } from '../engine/schema.js';
import { lesen, setzen, zusammenfuehren } from '../engine/config.js';
import { validieren } from '../engine/validator.js';
import { STUFEN } from '../bots/bot.js';
import { spielerFarbe } from './bilder.js';
import { neuesSpiel } from './spiel.js';

const OBEN = new Set(['match.modus', 'match.spieler', 'match.seed']);
const PERS = [['risiko', 'Risikobereitschaft'], ['kooperation', 'Kooperation'], ['aggression', 'Aggression'], ['ungeduld', 'Ungeduld'], ['sparsamkeit', 'Sparsamkeit']];

export function setupZeigen(el) {
  const gesperrt = app.partieLaeuft();
  const cfg = app.cfg;
  const v = validieren(cfg, { modus: cfg.match.modus, spieler: cfg.match.modus === 'team' ? 2 * cfg.match.teamGroesse : cfg.match.spieler });
  const presetOpt = [...EINGEBAUT.map((n) => [`e:${n}`, app.presets[n]?.meta?.name ?? n]), ...Object.keys(app.eigene).map((n) => [`u:${n}`, `★ ${n}`])]
    .map(([k, n]) => `<option value="${esc(k)}">${esc(n)}</option>`).join('');
  el.innerHTML = `
  ${gesperrt ? `<div class="gesperrt">🔒 Eine Partie läuft – alle Regler sind gesperrt. <button type="button" id="partieEnde">Partie beenden und entsperren</button> <button type="button" id="zumSpiel" class="haupt">Zum Spiel</button></div>` : ''}
  <div class="raster2">
    <div class="kasten">
      <h2>Partie</h2>
      <div class="zeile"><b>Preset</b> <select id="presetWahl">${presetOpt}</select>
        <button type="button" id="presetLaden">Laden</button>
        <button type="button" id="presetSpeichern">Speichern als …</button>
        <button type="button" id="presetLoeschen">Löschen</button></div>
      <div class="zeile" style="margin-top:6px"><button type="button" id="cfgExport">⬇ Konfiguration als Datei</button>
        <button type="button" id="cfgImport">⬆ Datei laden</button>
        <button type="button" id="cfgStandard">↺ Standard V10</button>
        <span class="hinweis">Aktuell: <b>${esc(app.presetName)}</b></span></div>
      <fieldset style="margin-top:10px"><legend>Modus</legend>
        ${['koop', 'team', 'pvp'].map((m) => `<label class="zeile"><input type="radio" name="modus" value="${m}" ${cfg.match.modus === m ? 'checked' : ''}/> <b>${{ koop: 'Koop', team: 'Team (2 gegen 2)', pvp: 'PvP (jeder gegen jeden)' }[m]}</b> <span class="hinweis">${{ koop: 'alle gegen die Insel, gewonnen ist nur gemeinsam', team: 'das erste Team, dessen beide Mitglieder fliehen, gewinnt', pvp: 'wer zuerst flieht oder als Letzter übrig bleibt' }[m]}</span></label>`).join('')}
      </fieldset>
      <div class="zeile"><label>Spielerzahl <select id="spielerzahl" ${cfg.match.modus === 'team' ? 'disabled' : ''}>${[2, 3, 4].map((n) => `<option ${n === cfg.match.spieler ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label>Seed <input id="seed" inputmode="numeric" placeholder="leer = zufällig" value="${cfg.match.seed ?? ''}" style="width:9em"/></label></div>
      <h3>Sitze</h3>
      <div id="sitze">${app.sitze.map((s, k) => sitzHtml(s, k)).join('')}</div>
      <div class="zeile"><button type="button" id="alleKI" class="klein">Alle KI</button><button type="button" id="ichMitKI" class="klein">Ich mit KI</button><button type="button" id="alleMensch" class="klein">Alle Menschen (Hot-Seat)</button></div>
    </div>
    <div class="kasten">
      <h2>Prüfung</h2>
      ${v.fehler.length ? `<p class="fehler"><b>Die Partie ist so nicht spielbar:</b></p><ul class="meldungen fehler">${v.fehler.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : '<p class="ok">✓ Die Konfiguration ist spielbar.</p>'}
      ${v.warnungen.length ? `<ul class="meldungen warn">${v.warnungen.map((f) => `<li>⚠️ ${esc(f)}</li>`).join('')}</ul>` : ''}
      <div class="zeile"><button type="button" class="haupt" id="start" ${v.ok && !gesperrt ? '' : 'disabled'}>▶ Partie starten</button>
        <span class="hinweis">${teilZahl()} Werte weichen vom Standard V10 ab.</span></div>
      <p class="hinweis">Alle Werte stehen in einer einzigen Konfiguration (config.json). Browser und Simulation nutzen dieselbe Engine. Karten bearbeitest du im Reiter «Karten».</p>
    </div>
  </div>
  <div id="reglerBereiche">${bereicheHtml(cfg)}</div>`;
  verdrahten(el, gesperrt);
  if (gesperrt) for (const i of $$('input, select, textarea, button', el)) if (!['partieEnde', 'zumSpiel'].includes(i.id)) i.disabled = true;
}

function teilZahl() { let n = 0; const z = (o) => { for (const v of Object.values(o)) { if (v && typeof v === 'object' && !Array.isArray(v)) z(v); else n++; } }; z(teilKonfig(app.cfg, app.standard)); return n; }

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

function bereicheHtml(cfg) {
  const alle = regler(cfg).filter((r) => !OBEN.has(r.pfad));
  const nachBereich = new Map();
  for (const r of alle) { if (!nachBereich.has(r.bereich)) nachBereich.set(r.bereich, []); nachBereich.get(r.bereich).push(r); }
  return [...nachBereich].map(([b, liste]) => {
    let letzte = '';
    const inhalt = liste.map((r) => {
      let kopf = '';
      if (r.gruppe !== letzte) { letzte = r.gruppe; kopf = `<div class="gruppe-titel">${esc(r.gruppe)}</div>`; }
      return kopf + reglerHtml(r, cfg);
    }).join('');
    const geaendert = liste.filter((r) => JSON.stringify(lesen(cfg, r.pfad) ?? 0) !== JSON.stringify(lesen(app.standard, r.pfad) ?? 0)).length;
    return `<details class="kasten"><summary>${esc(BEREICHE[b] ?? b)} <span class="hinweis">${liste.length} Regler${geaendert ? ` · ${geaendert} geändert` : ''}</span></summary><div class="regler-raster">${inhalt}</div></details>`;
  }).join('');
}

function reglerHtml(r, cfg) {
  const v = lesen(cfg, r.pfad), std = lesen(app.standard, r.pfad);
  const geaendert = JSON.stringify(v ?? 0) !== JSON.stringify(std ?? 0);
  const titel = `Standard: ${JSON.stringify(std ?? 0)}${r.typ === 'zahl' ? ` · Bereich ${r.min} bis ${r.max}` : ''}`;
  let feld;
  if (r.typ === 'bool') feld = `<input type="checkbox" data-pfad="${r.pfad}" ${v ? 'checked' : ''}/>`;
  else if (r.typ === 'auswahl') feld = `<select data-pfad="${r.pfad}">${r.optionen.map((o) => `<option value="${o === null ? 'null' : esc(o)}" ${o === v ? 'selected' : ''}>${o === null ? '–' : esc(o)}</option>`).join('')}</select>`;
  else feld = `<input type="number" data-pfad="${r.pfad}" min="${r.min}" max="${r.max}" step="any" value="${v ?? ''}" ${v === null ? 'placeholder="–"' : ''}/>`;
  return `<div class="regler${geaendert ? ' geaendert' : ''}" title="${esc(titel)}"><label>${esc(r.name)}<span class="pfad">${esc(r.pfad)}</span></label>${feld}</div>`;
}

function neu() { app.speichern(); setupZeigen($('#ansicht-setup')); }

function verdrahten(el, gesperrt) {
  $('#partieEnde', el)?.addEventListener('click', () => { app.partie?.beenden(); app.partie = null; neu(); });
  $('#zumSpiel', el)?.addEventListener('click', () => app.reiter('spiel'));
  if (gesperrt) return;
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
  for (const i of $$('[data-pfad]', el)) i.addEventListener('change', () => {
    const r = regler(app.cfg).find((x) => x.pfad === i.dataset.pfad);
    let w;
    if (r.typ === 'bool') w = i.checked;
    else if (r.typ === 'auswahl') w = i.value === 'null' ? null : i.value;
    else w = i.value === '' ? (lesen(app.standard, r.pfad) === null ? null : 0) : Number(i.value);
    setzen(app.cfg, r.pfad, w);
    const offen = $$('details[open] summary', el).map((s) => s.textContent);
    neu();
    for (const d of $$('details', $('#ansicht-setup'))) if (offen.includes($('summary', d).textContent)) d.open = true;
    for (const d of $$('details', $('#ansicht-setup'))) if ($(`[data-pfad="${r.pfad}"]`, d)) d.open = true;
  });
  $('#presetLaden', el).addEventListener('click', () => {
    const k = $('#presetWahl', el).value;
    const [art, name] = [k.slice(0, 1), k.slice(2)];
    if (art === 'e') presetLaden(app.presets[name], app.presets[name]?.meta?.name ?? name); else presetLaden(app.eigene[name], name);
    neu();
  });
  $('#presetSpeichern', el).addEventListener('click', () => {
    const name = prompt('Name des Presets:', app.presetName.startsWith('★') ? app.presetName : `${app.presetName} (eigen)`);
    if (!name) return;
    app.eigene[name] = { ...teilKonfig(app.cfg, app.standard), meta: { name } };
    app.eigeneSpeichern(); app.presetName = name; app.cfg.meta.name = name; neu();
  });
  $('#presetLoeschen', el).addEventListener('click', () => {
    const k = $('#presetWahl', el).value;
    if (!k.startsWith('u:')) return alert('Eingebaute Presets können nicht gelöscht werden.');
    delete app.eigene[k.slice(2)]; app.eigeneSpeichern(); neu();
  });
  $('#cfgExport', el).addEventListener('click', () => herunterladen(`insel-survival-v11-${(app.presetName || 'konfig').replace(/[^\w.-]+/g, '_')}.json`, JSON.stringify(app.cfg, null, 2)));
  $('#cfgImport', el).addEventListener('click', async () => {
    try {
      const d = await dateiLesen('.json');
      const teil = JSON.parse(d.text);
      presetLaden(teil, teil.meta?.name ?? d.name.replace(/\.json$/, ''));
      neu();
    } catch (e) { alert(`Datei nicht lesbar: ${e.message}`); }
  });
  $('#cfgStandard', el).addEventListener('click', () => { presetLaden({}, 'Standard V10'); neu(); });
  $('#start', el).addEventListener('click', () => { neuesSpiel(); app.reiter('spiel'); });
  void zusammenfuehren;
}
