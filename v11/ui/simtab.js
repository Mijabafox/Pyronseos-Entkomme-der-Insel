// Simulation im Browser: Serie, Parameter-Sweep (Heatmap), A/B-Vergleich, Abgleich mit echten Partien.
import { $, $$, esc, herunterladen, prozent, zahl } from './dom.js';
import { app, EINGEBAUT } from './zustand.js';
import { zusammenfuehren, klon, lesen } from '../engine/config.js';
import { validieren } from '../engine/validator.js';
import { regler } from '../engine/schema.js';
import { STUFEN } from '../bots/bot.js';
import { csvPartien, csvAuswertung, sweepCsv, hinweise, partieSimulieren } from '../sim/simulation.js';
import { ENDE_KURZ, WEG_NAME, CHARAKTER_NAME, MODUS_KURZ } from '../engine/namen.js';

const ein = { art: 'serie', partien: 50, seed: 1, bots: 'normal', pfadA: 'fluchtwege.floss.solide.proPerson.seil', werteA: '1:4', pfadB: 'match.spieler', werteB: '2:4', kennzahl: 'siegquote', presetB: 'e:hart' };
let worker = null, ergebnis = null, protokolle = [];

export function simZeigen(el) {
  const c = app.cfg;
  const presetOpt = [...EINGEBAUT.map((n) => [`e:${n}`, app.presets[n]?.meta?.name ?? n]), ...Object.keys(app.eigene).map((n) => [`u:${n}`, `★ ${n}`])].map(([k, n]) => `<option value="${k}" ${ein.presetB === k ? 'selected' : ''}>${esc(n)}</option>`).join('');
  const pfade = regler(c).filter((r) => r.typ !== 'auswahl' || r.pfad === 'match.modus').map((r) => `<option value="${r.pfad}">${esc(r.name)}</option>`).join('');
  el.innerHTML = `<div class="kasten"><h2>📊 Simulation</h2>
    <p class="hinweis">Nutzt die aktuelle Konfiguration «${esc(app.presetName)}» aus dem Setup und dieselbe Engine wie das Spiel. Jede Partie hat einen eigenen Seed (Start-Seed, +1, +2 …): gleiche Einstellungen ergeben exakt dieselben Zahlen. Über die Kommandozeile: <code>node sim/cli.mjs --hilfe</code>.</p>
    <div class="zeile"><label>Art <select id="art">${[['serie', 'Serie (Auswertung)'], ['sweep', 'Parameter-Sweep'], ['ab', 'A/B-Vergleich'], ['import', 'Abgleich mit echten Partien']].map(([k, n]) => `<option value="${k}" ${ein.art === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label>Partien <input type="number" id="partien" min="1" max="5000" value="${ein.partien}"/></label>
      <label>Start-Seed <input type="number" id="seed" min="0" value="${ein.seed}"/></label>
      <span class="hinweis">Modus ${esc(c.match.modus)} · ${c.match.modus === 'team' ? 4 : c.match.spieler} Spieler (im Setup änderbar)</span></div>
    <div class="zeile" style="margin-top:6px"><label>Bot-Zusammensetzung <input id="bots" value="${esc(ein.bots)}" style="width:18em" title="Stufe je Sitz, durch Komma getrennt"/></label>
      <span class="hinweis">Stufen: ${Object.entries(STUFEN).map(([k, x]) => `${k} (${x.name})`).join(', ')} · Persönlichkeit aus den Sitzen im Setup: <label><input type="checkbox" id="sitzeNutzen" ${ein.sitzeNutzen ? 'checked' : ''}/> verwenden</label></span></div>
    <div id="sweepFelder" class="zeile" style="margin-top:6px" ${ein.art === 'sweep' ? '' : 'hidden'}>
      <datalist id="pfade">${pfade}<option value="match.spieler">Spielerzahl</option></datalist>
      <label>Parameter A <input id="pfadA" list="pfade" value="${esc(ein.pfadA)}" style="width:22em"/></label><label>Werte <input id="werteA" value="${esc(ein.werteA)}" style="width:6em" title="1:4 oder 1:4:1 oder 1,2,3"/></label>
      <label>Parameter B <input id="pfadB" list="pfade" value="${esc(ein.pfadB)}" style="width:16em" placeholder="leer = nur A"/></label><label>Werte <input id="werteB" value="${esc(ein.werteB)}" style="width:6em"/></label>
      <label>Kennzahl <select id="kennzahl">${['siegquote', 'proWeg.floss', 'proWeg.feuer', 'proWeg.wrack', 'proGrund.lava', 'tageImSchnitt', 'wasserZugende', 'kompassGefunden'].map((k) => `<option ${ein.kennzahl === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label></div>
    <div id="abFelder" class="zeile" style="margin-top:6px" ${ein.art === 'ab' ? '' : 'hidden'}><span>A = aktuelle Konfiguration.</span><label>B = Preset <select id="presetB">${presetOpt}</select></label></div>
    <div id="importFelder" class="zeile" style="margin-top:6px" ${ein.art === 'import' ? '' : 'hidden'}><label>Protokolle echter Partien (JSON, Export aus dem Spiel) <input type="file" id="importDateien" accept=".json" multiple/></label><span class="hinweis">${protokolle.length} geladen</span></div>
    <div class="zeile" style="margin-top:8px"><button type="button" class="haupt" id="starten">▶ Starten</button><button type="button" id="abbrechen" disabled>Abbrechen</button><span id="status" class="hinweis"></span></div>
    <div style="height:6px;background:#e4dccb;border-radius:3px;margin-top:6px"><div id="balken" style="height:6px;width:0;background:var(--primaer);border-radius:3px"></div></div>
  </div><div id="simAusgabe">${ergebnis ? ausgabeHtml(ergebnis) : ''}</div>`;
  verdrahten(el);
}

function verdrahten(el) {
  const merken = () => {
    ein.art = $('#art', el).value; ein.partien = Number($('#partien', el).value); ein.seed = Number($('#seed', el).value); ein.bots = $('#bots', el).value;
    ein.pfadA = $('#pfadA', el).value; ein.werteA = $('#werteA', el).value; ein.pfadB = $('#pfadB', el).value; ein.werteB = $('#werteB', el).value; ein.kennzahl = $('#kennzahl', el).value; ein.presetB = $('#presetB', el).value; ein.sitzeNutzen = $('#sitzeNutzen', el).checked;
  };
  $('#art', el).addEventListener('change', () => { merken(); simZeigen(el); });
  $('#importDateien', el).addEventListener('change', async (e) => {
    protokolle = [];
    for (const f of e.target.files) { try { const d = JSON.parse(await f.text()); protokolle.push(...(Array.isArray(d) ? d : d.partien ?? [d])); } catch { alert(`${f.name} ist kein gültiges Protokoll.`); } }
    merken(); simZeigen(el);
  });
  $('#starten', el).addEventListener('click', () => { merken(); starten(el); });
  $('#abbrechen', el).addEventListener('click', () => { worker?.terminate(); worker = null; $('#status', el).textContent = 'abgebrochen'; $('#abbrechen', el).disabled = true; });
  ausgabeVerdrahten(el);
}

function bots() {
  if (ein.sitzeNutzen) return app.sitze.map((s) => ({ stufe: s.ki ? s.stufe : 'normal', persoenlichkeit: s.persoenlichkeit ?? {} }));
  return ein.bots;
}

function starten(el) {
  const c = app.cfg;
  const modus = c.match.modus, spieler = modus === 'team' ? 4 : c.match.spieler;
  const v = validieren(c, { modus, spieler });
  if (!v.ok) { $('#status', el).innerHTML = `<span class="fehler">Konfiguration nicht spielbar: ${esc(v.fehler[0])}</span>`; return; }
  const opt = { partien: ein.partien, seed: ein.seed, modus, spieler, bots: bots() };
  const msg = { art: ein.art, cfg: klon(c), opt };
  if (ein.art === 'sweep') msg.sweep = { pfadA: ein.pfadA, werteA: ein.werteA, pfadB: ein.pfadB || null, werteB: ein.pfadB ? ein.werteB : [null] };
  if (ein.art === 'ab') {
    const [a, n] = [ein.presetB.slice(0, 1), ein.presetB.slice(2)];
    msg.cfgB = zusammenfuehren(app.standard, a === 'e' ? app.presets[n] : app.eigene[n]);
    const vb = validieren(msg.cfgB, { modus, spieler });
    if (!vb.ok) { $('#status', el).innerHTML = `<span class="fehler">Konfiguration B nicht spielbar: ${esc(vb.fehler[0])}</span>`; return; }
  }
  if (ein.art === 'import') { if (!protokolle.length) { $('#status', el).textContent = 'Bitte zuerst Protokolle laden.'; return; } msg.protokolle = protokolle; }
  worker?.terminate();
  worker = new Worker(new URL('../sim/worker.js', import.meta.url), { type: 'module' });
  const t0 = performance.now();
  $('#abbrechen', el).disabled = false;
  $('#status', el).textContent = 'läuft …';
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.art === 'fortschritt') { $('#balken', el).style.width = `${(100 * m.i) / m.n}%`; $('#status', el).textContent = `${m.i} / ${m.n} …`; return; }
    worker.terminate(); worker = null; $('#abbrechen', el).disabled = true;
    if (m.art === 'fehler') { $('#status', el).innerHTML = `<span class="fehler">Fehler: ${esc(m.text)}</span>`; return; }
    ergebnis = { art: ein.art, daten: m.ergebnis, opt, cfg: msg.cfg, kennzahl: ein.kennzahl };
    $('#status', el).textContent = `fertig in ${((performance.now() - t0) / 1000).toFixed(1)} s`;
    $('#simAusgabe', el).innerHTML = ausgabeHtml(ergebnis);
    ausgabeVerdrahten(el);
  };
  worker.onerror = (e) => { $('#status', el).innerHTML = `<span class="fehler">Worker-Fehler: ${esc(e.message)}</span>`; };
  worker.postMessage(msg);
}

const balken = (x) => `<span class="balken" style="width:${Math.round(Math.min(1, x ?? 0) * 120)}px"></span> ${prozent(x)}`;

function ausgabeHtml(e) {
  if (e.art === 'serie') return serieHtml(e.daten.auswertung, e.daten.partien);
  if (e.art === 'sweep') return sweepHtml(e.daten, e.kennzahl);
  if (e.art === 'ab') return abHtml(e.daten);
  return importHtml(e.daten);
}

function serieHtml(a, partien) {
  const namen = { ...ENDE_KURZ, ...WEG_NAME, ...CHARAKTER_NAME, ...MODUS_KURZ, ...Object.fromEntries(Object.entries(STUFEN).map(([k, x]) => [k, x.name])) };
  const tab = (titel, obj, f = (v) => balken(v)) => `<h3>${titel}</h3><table class="tabelle">${Object.entries(obj).map(([k, v]) => `<tr><td>${esc(namen[k] ?? (/^\d+$/.test(k) ? `${k} Spieler` : k))}</td><td>${f(v)}</td></tr>`).join('')}</table>`;
  const karten = (obj) => `<table class="tabelle"><tr><th>Karte</th><th class="zahl">in Partien</th><th class="zahl">Sieg mit</th><th class="zahl">Sieg ohne</th><th class="zahl">Differenz</th></tr>${Object.entries(obj).sort((x, y) => Math.abs(y[1].differenz) - Math.abs(x[1].differenz)).map(([k, v]) => `<tr><td>${esc(app.cfg.tageskarten.karten[k]?.name ?? app.cfg.spezialkarten.karten[k]?.name ?? k)}</td><td class="zahl">${v.mit}</td><td class="zahl">${prozent(v.siegMit)}</td><td class="zahl">${prozent(v.siegOhne)}</td><td class="zahl ${v.differenz > 0 ? 'ok' : 'fehler'}">${(100 * v.differenz).toFixed(1)} Pp</td></tr>`).join('')}</table>`;
  return `<div class="kasten"><div class="zeile"><h2>Ergebnis: ${a.partien} Partien · Siegquote ${prozent(a.siegquote)}</h2>
      <button type="button" id="csvPartien">⬇ CSV Partien</button><button type="button" id="csvSumme">⬇ CSV Auswertung</button></div>
    ${hinweise(a).map((h) => `<p class="warn">⚠️ ${esc(h)}</p>`).join('')}
    <p>Ø Tag des Siegs ${zahl(a.tageBisSieg)} · Ø Tage ${zahl(a.tageImSchnitt)} · Niederlage durch Lava ${prozent(a.niederlageLava)} · durch Tod ${prozent(a.niederlageTod)} · Kompass gefunden ${prozent(a.kompassGefunden)} (Ø Tag ${zahl(a.kompassTag)})</p>
    <p>Pro Partie: Duelle ${zahl(a.duelle)} · Raube ${zahl(a.raube)} (Routenkarte ${zahl(a.raubRoute, 2)}) · Zurücksetzungen nach Tierkampf ${zahl(a.zurueckgesetzt)} · Wasser-Zugenden ${zahl(a.wasserZugende)} · Kämpfe ${zahl(a.kaempfe)} · Feuer gebaut ${zahl(a.feuerGebaut)} (ungültig ${zahl(a.feuerUngueltig)})</p>
    <p>Materialknappheit: leere Stapel Holz ${zahl(a.knappheit.holz, 2)}, Seil ${zahl(a.knappheit.seil, 2)} pro Partie · am Ende fehlte im Schnitt Holz ${zahl(a.knappheit.fehltHolz)}, Seil ${zahl(a.knappheit.fehltSeil)}</p>
    <div class="raster2">
      <div>${tab('Siegquote pro Fluchtweg', a.proWeg)}${tab('Anteil gewählter Fluchtweg (an den Fluchten)', a.wegAnteil)}${tab('Endgründe', Object.fromEntries(Object.entries(a.proGrund).filter(([, v]) => v > 0)))}</div>
      <div>${tab('Pro Modus', a.proModus, (v) => balken(v.siegquote))}${tab('Pro Spielerzahl', a.proSpielerzahl, (v) => balken(v.siegquote))}${tab('Pro Charakter', a.charakter, (v) => `${balken(v.siegquote)} <span class="hinweis">(${v.partien})</span>`)}${tab('Pro Bot-Stufe (Sitze)', a.stufe, (v) => `${balken(v.siegquote)} <span class="hinweis">(${v.sitze})</span>`)}</div>
    </div>
    <details><summary>Einfluss der Tageskarten auf den Sieg</summary>${karten(a.tageskarten)}</details>
    <details><summary>Einfluss der Spezialkarten auf den Sieg</summary>${karten(a.spezialkarten)}</details>
    <details><summary>Einzelpartien (Replay)</summary><div class="zeile">${partien.map((p) => `<button type="button" class="klein ${p.sieg ? 'ok' : ''}" data-replay="${p.seed}" title="${esc(p.grund)} · Tag ${p.tag}">${p.seed}${p.sieg ? ' 🏆' : ''}</button>`).join('')}</div></details>
  </div>`;
}

function sweepHtml(sw, kennzahl) {
  const farbe = (v) => `background: rgba(46, 74, 86, ${Math.min(1, v ?? 0) * 0.85 + 0.05}); color: ${(v ?? 0) > 0.5 ? '#fff' : '#222'}`;
  const zelle = (a, b) => {
    const z = sw.zellen.find((x) => x.a === a && x.b === b);
    if (!z.gueltig) return `<td title="${esc(z.fehler.join(' | '))}" class="fehler">✕</td>`;
    const v = lesen(z.auswertung, kennzahl);
    const istQuote = !/tage|wasser/i.test(kennzahl);
    return `<td style="${istQuote ? farbe(v) : ''}">${istQuote ? prozent(v) : zahl(v)}</td>`;
  };
  return `<div class="kasten"><div class="zeile"><h2>Sweep: ${esc(sw.pfadA)}${sw.pfadB ? ` × ${esc(sw.pfadB)}` : ''} · ${esc(kennzahl)}</h2><button type="button" id="csvSweep">⬇ CSV</button></div>
    <table class="tabelle heatmap"><tr><th>${esc(sw.pfadB ?? '')} \\ ${esc(sw.pfadA)}</th>${sw.werteA.map((a) => `<th>${esc(a)}</th>`).join('')}</tr>
    ${sw.werteB.map((b) => `<tr><th>${b === null ? '' : esc(b)}</th>${sw.werteA.map((a) => zelle(a, b)).join('')}</tr>`).join('')}</table>
    <p class="hinweis">✕ = diese Kombination ist laut Validator nicht spielbar (Maus darüber zeigt den Grund).</p></div>`;
}

function abHtml(r) {
  return `<div class="kasten"><h2>A/B-Vergleich (gleiche Seeds, je ${r.partien} Partien)</h2>
    <p class="hinweis">Unterschiede in der Konfiguration: ${r.unterschiede.slice(0, 20).map((u) => `${esc(u.pfad)}: ${esc(JSON.stringify(u.a))} → ${esc(JSON.stringify(u.b))}`).join(' · ') || 'keine'}</p>
    <table class="tabelle"><tr><th>Kennzahl</th><th class="zahl">A</th><th class="zahl">B</th><th class="zahl">Differenz A − B</th><th>Signifikanz</th></tr>
    ${r.zeilen.map((z) => `<tr><td>${esc(z.name)}</td><td class="zahl">${z.art === 'quote' ? prozent(z.a) : zahl(z.a, 2)}</td><td class="zahl">${z.art === 'quote' ? prozent(z.b) : zahl(z.b, 2)}</td><td class="zahl">${z.art === 'quote' ? `${(100 * z.differenz).toFixed(1)} Pp` : zahl(z.differenz, 2)}</td><td>${esc(z.signifikanz)}</td></tr>`).join('')}</table></div>`;
}

function importHtml(r) {
  return `<div class="kasten"><h2>Abgleich: ${r.echte} echte Partien gegen ${r.bots} Bot-Partien</h2>
    <table class="tabelle"><tr><th>Kennzahl</th><th class="zahl">Menschen</th><th class="zahl">Bots</th><th></th></tr>${r.zeilen.map((z) => `<tr><td>${esc(z.name)}</td><td class="zahl">${z.art === 'quote' ? prozent(z.mensch) : zahl(z.mensch)}</td><td class="zahl">${z.art === 'quote' ? prozent(z.bots) : zahl(z.bots)}</td><td>${z.auffaellig ? '<span class="warn">⚠️ deutlich anders</span>' : ''}</td></tr>`).join('')}</table>
    ${r.befunde.map((b) => `<p class="warn">⚠️ ${esc(b)}</p>`).join('')}<p><b>${esc(r.hinweis)}</b></p></div>`;
}

function ausgabeVerdrahten(el) {
  if (!ergebnis) return;
  $('#csvPartien', el)?.addEventListener('click', () => herunterladen('simulation-partien.csv', csvPartien(ergebnis.daten.partien), 'text/csv;charset=utf-8'));
  $('#csvSumme', el)?.addEventListener('click', () => herunterladen('simulation-auswertung.csv', csvAuswertung(ergebnis.daten.auswertung), 'text/csv;charset=utf-8'));
  $('#csvSweep', el)?.addEventListener('click', () => herunterladen('sweep.csv', sweepCsv(ergebnis.daten, ergebnis.kennzahl), 'text/csv;charset=utf-8'));
  for (const b of $$('[data-replay]', el)) b.addEventListener('click', () => {
    const r = partieSimulieren(ergebnis.cfg, { ...ergebnis.opt, seed: Number(b.dataset.replay), protokoll: true, mitZuegen: true });
    app.replayProtokoll = { ...r.protokoll, konfig: ergebnis.cfg };
    app.reiter('replay');
  });
}
