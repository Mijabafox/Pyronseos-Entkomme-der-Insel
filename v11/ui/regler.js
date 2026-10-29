// Reiter «Regler»: alle Werte der Konfiguration nach Bereichen, mit Suche, Presets, Export/Import und Prüfergebnis.
// Die Regler kommen aus engine/schema.js; hier wird nur gruppiert und angezeigt. Während einer Partie gesperrt.
import { $, $$, esc, herunterladen, dateiLesen } from './dom.js';
import { app, EINGEBAUT, presetLaden, sitzeAnpassen, teilKonfig, pruefen, geaendertZahl, partieBeenden } from './zustand.js';
import { regler } from '../engine/schema.js';
import { lesen, setzen } from '../engine/config.js';

// Feste Bereichsliste links. Jeder Regler gehört zu genau einem Bereich.
export const REGLER_BEREICHE = [
  ['match', 'Match', (p) => p.startsWith('match.') && !p.startsWith('match.tage.')],
  ['figur', 'Figur', (p) => p.startsWith('figur.')],
  ['charaktere', 'Charaktere', (p) => p.startsWith('charaktere.')],
  ['zug', 'Zug', (p) => p.startsWith('zug.')],
  ['tiere', 'Tiere', (p) => p.startsWith('tiere.')],
  ['crafting', 'Crafting', (p) => p.startsWith('crafting.')],
  ['brett', 'Brett', (p) => p.startsWith('brett.')],
  ['fluchtwege', 'Fluchtwege', (p) => p.startsWith('fluchtwege.') || p.startsWith('routen.')],
  ['vorrat', 'Materialvorrat', (p) => p.startsWith('vorrat.')],
  ['duelle', 'Duelle', (p) => p.startsWith('duelle.')],
  ['sichtbarkeit', 'Sichtbarkeit', (p) => p.startsWith('sichtbarkeit.')],
  ['ki', 'KI', (p) => p.startsWith('ki.') || p.startsWith('browser.')],
  ['tageskarten', 'Tageskarten', (p) => p.startsWith('match.tage.')],
  ['spezialkarten', 'Spezialkarten', (p) => p.startsWith('spezialkarten.')],
];
const ZUSATZ = {
  tageskarten: 'Welche Ereigniskarten im Pool liegen und was sie bewirken, stellst du im Reiter «Karten» ein.',
  spezialkarten: 'Die einzelnen Spezialkarten (Anzahl, Effekte) stellst du im Reiter «Karten» ein.',
};

export const bereichVon = (pfad) => REGLER_BEREICHE.find(([, , t]) => t(pfad))?.[0] ?? 'match';

// Zu welchem Regler (oder Bereich) gehört eine Meldung des Validators?
export function meldungZiel(text, liste = regler(app.cfg)) {
  const m = text.match(/\(([a-zA-Z][\w.]*\.[\w.]+)\)/);
  if (m && liste.some((r) => r.pfad === m[1])) return { pfad: m[1] };
  const regeln = [
    [/^Brett|Wasserquellen/, { bereich: 'brett' }],
    [/^Tageskarten|keinen einzigen Tag/, { pfad: 'match.tage.ereignisse' }],
    [/^Ohne Lava/, { pfad: 'match.tage.lava' }],
    [/^Tageskarte «/, { reiter: 'karten' }],
    [/^Spezialkarte «/, { reiter: 'karten' }],
    [/^Spezialkarten/, { pfad: 'spezialkarten.stapel' }],
    [/^Not-Floss: «kentert/, { pfad: 'fluchtwege.floss.not.kentertBis' }],
    [/^Not-Floss/, { pfad: 'fluchtwege.floss.not.landBis' }],
    [/^Floss: Ohne Spitzhacke/, { pfad: 'crafting.rezepte.spitzhacke.aktiv' }],
    [/^Floss: Kein Vulkanfels/, { bereich: 'brett' }],
    [/^Küstenfeuer-Kette: Das Lagerfeuer/, { pfad: 'crafting.rezepte.lagerfeuer.aktiv' }],
    [/^Flugzeugwrack: Der Brennsprit/, { pfad: 'fluchtwege.wrack.brennsprit' }],
    [/^Flugzeugwrack: Es liegt/, { bereich: 'brett' }],
    [/Floss|Küstenfeuer|Flugzeugwrack|Fluchtwege/, { bereich: 'fluchtwege' }],
    [/^Browser/, { pfad: 'browser.pauseMin' }],
    [/^Seil-Vorrat/, { pfad: 'vorrat.karten.seil' }],
    [/Charaktere aktiv|Überlebenskünstler/, { bereich: 'charaktere' }],
    [/^Tier/, { bereich: 'tiere' }],
    [/^Wasser füllt/, { pfad: 'zug.wasser.auffuellen' }],
    [/Spieler|Team-Modus|PvP|Modus/, { pfad: 'match.spieler' }],
  ];
  const t = regeln.find(([re]) => re.test(text));
  return t ? t[1] : null;
}

// Prüfergebnis als Liste; Meldungen mit Ziel werden zu Links.
export function pruefHtml(v) {
  const liste = regler(app.cfg);
  const zeile = (t, warn) => {
    const z = meldungZiel(t, liste);
    const a = z ? ` data-ziel="${esc(JSON.stringify(z))}" title="Zum betroffenen Regler"` : '';
    return `<li>${warn ? '⚠️ ' : ''}${z ? `<a href="#" class="ziel"${a}>${esc(t)}</a>` : esc(t)}</li>`;
  };
  return `<div class="pruefung">
    ${v.fehler.length ? `<p class="fehler"><b>✗ ${v.fehler.length} Fehler – so nicht spielbar:</b></p><ul class="meldungen fehler">${v.fehler.map((t) => zeile(t, false)).join('')}</ul>` : '<p class="ok">✓ Die Konfiguration ist spielbar.</p>'}
    ${v.warnungen.length ? `<details class="warnungen"${v.fehler.length ? '' : ' open'}><summary>${v.warnungen.length} ${v.warnungen.length === 1 ? 'Warnung' : 'Warnungen'}</summary><ul class="meldungen warn">${v.warnungen.map((t) => zeile(t, true)).join('')}</ul></details>` : ''}
  </div>`;
}

// Klicks auf Meldungs-Links: zum Regler (oder Reiter) springen.
export function zielLinks(el) {
  for (const a of $$('a.ziel', el)) a.addEventListener('click', (e) => {
    e.preventDefault();
    const z = JSON.parse(a.dataset.ziel);
    if (z.reiter) app.reiter(z.reiter); else reglerOeffnen(z.pfad ?? null, z.bereich);
  });
}

const ansicht = { bereich: 'match', suche: '', fokus: null };

export function reglerOeffnen(pfad = null, bereich = null) {
  ansicht.bereich = bereich ?? (pfad ? bereichVon(pfad) : ansicht.bereich);
  ansicht.suche = '';
  ansicht.fokus = pfad;
  app.reiter('regler');
}
app.reglerOeffnen = reglerOeffnen;

const istGeaendert = (pfad) => JSON.stringify(lesen(app.cfg, pfad) ?? null) !== JSON.stringify(lesen(app.standard, pfad) ?? null);
const wertText = (v) => (v === null || v === undefined ? '–' : typeof v === 'boolean' ? (v ? 'an' : 'aus') : String(v));

export function reglerZeigen(el) {
  const gesperrt = app.partieLaeuft();
  const presetOpt = [...EINGEBAUT.map((n) => [`e:${n}`, app.presets[n]?.meta?.name ?? n]), ...Object.keys(app.eigene).map((n) => [`u:${n}`, `★ ${n}`])]
    .map(([k, n]) => `<option value="${esc(k)}" ${presetName(k) === app.presetName ? 'selected' : ''}>${esc(n)}</option>`).join('');
  el.innerHTML = `
  <div class="regler-ansicht${gesperrt ? ' gesperrt-an' : ''}">
    ${gesperrt ? `<div class="gesperrt">🔒 Eine Partie läuft – alle Regler sind gesperrt. <button type="button" id="partieEnde">Partie beenden und entsperren</button> <button type="button" id="zumSpiel" class="haupt">Zum Spiel</button></div>` : ''}
    <div class="regler-kopf">
      <div class="zeile">
        <input type="search" id="reglerSuche" placeholder="🔎 Regler suchen (Name oder Pfad) …" value="${esc(ansicht.suche)}" aria-label="Regler suchen"/>
        <span class="trenner"></span>
        <label>Preset <select id="presetWahl">${presetOpt}</select></label>
        <button type="button" id="presetLaden">Laden</button>
        <button type="button" id="presetSpeichern">Speichern als …</button>
        <button type="button" id="presetLoeschen">Löschen</button>
        <span class="trenner"></span>
        <button type="button" id="cfgExport" title="Ganze Konfiguration als JSON-Datei speichern">⬇ Export</button>
        <button type="button" id="cfgImport" title="Konfiguration oder Preset aus Datei laden">⬆ Import</button>
        <button type="button" id="cfgStandard">↺ Standard V10</button>
        <span class="zaehler" id="zaehler"></span>
      </div>
      <div id="pruefBox"></div>
    </div>
    <div class="regler-spalten">
      <nav class="bereich-liste" id="bereichListe" aria-label="Bereiche"></nav>
      <div class="regler-liste" id="reglerListe"></div>
    </div>
  </div>`;
  kopfAktualisieren(el);
  listeZeichnen(el);
  verdrahten(el, gesperrt);
  if (gesperrt) for (const i of $$('input, select, button', el)) if (!['partieEnde', 'zumSpiel', 'reglerSuche'].includes(i.id) && !i.dataset.bereich) i.disabled = true;
  if (ansicht.fokus) {
    const z = $(`.regler[data-r="${CSS.escape(ansicht.fokus)}"]`, el);
    if (z) { z.scrollIntoView({ block: 'center' }); z.classList.add('blinkt'); $('input, select', z)?.focus({ preventScroll: true }); }
    ansicht.fokus = null;
  }
}

function presetName(k) {
  const [art, name] = [k.slice(0, 1), k.slice(2)];
  return art === 'e' ? app.presets[name]?.meta?.name ?? name : name;
}

function kopfAktualisieren(el) {
  const n = geaendertZahl();
  $('#zaehler', el).innerHTML = n ? `<b>${n}</b> ${n === 1 ? 'Wert weicht' : 'Werte weichen'} vom Standard V10 ab` : 'Alles auf Standard V10';
  $('#pruefBox', el).innerHTML = pruefHtml(pruefen());
  zielLinks($('#pruefBox', el));
  const alle = regler(app.cfg);
  $('#bereichListe', el).innerHTML = REGLER_BEREICHE.map(([id, name, test]) => {
    const l = alle.filter((r) => test(r.pfad));
    const g = l.filter((r) => istGeaendert(r.pfad)).length;
    return `<button type="button" data-bereich="${id}" class="${!ansicht.suche && ansicht.bereich === id ? 'an' : ''}"><span>${esc(name)}</span><span class="anzahl">${g ? `<b class="geaendert-zahl" title="${g} geändert">${g}</b> ` : ''}${l.length}</span></button>`;
  }).join('');
  for (const b of $$('[data-bereich]', el)) b.addEventListener('click', () => { ansicht.bereich = b.dataset.bereich; ansicht.suche = ''; $('#reglerSuche', el).value = ''; kopfAktualisieren(el); listeZeichnen(el); $('#reglerListe', el).scrollTop = 0; });
}

function listeZeichnen(el) {
  const alle = regler(app.cfg);
  const q = ansicht.suche.trim().toLowerCase();
  let html;
  if (q) {
    const treffer = alle.filter((r) => r.name.toLowerCase().includes(q) || r.pfad.toLowerCase().includes(q));
    html = `<h2>Suche «${esc(ansicht.suche)}» · ${treffer.length} Treffer</h2>` + REGLER_BEREICHE.map(([id, name, test]) => {
      const l = treffer.filter((r) => test(r.pfad));
      return l.length ? `<h3 class="gruppe-titel gross">${esc(name)}</h3>${gruppiert(l)}` : '';
    }).join('') + (treffer.length ? '' : '<p class="hinweis">Kein Regler passt.</p>');
  } else {
    const [, name, test] = REGLER_BEREICHE.find(([id]) => id === ansicht.bereich);
    const l = alle.filter((r) => test(r.pfad));
    html = `<h2>${esc(name)} <span class="hinweis">${l.length} Regler</span></h2>${ZUSATZ[ansicht.bereich] ? `<p class="hinweis">${esc(ZUSATZ[ansicht.bereich])} <a href="#" id="zuKarten">Zu den Karten</a></p>` : ''}${gruppiert(l)}`;
  }
  const liste = $('#reglerListe', el);
  liste.innerHTML = html;
  $('#zuKarten', liste)?.addEventListener('click', (e) => { e.preventDefault(); app.reiter('karten'); });
  const gesperrt = app.partieLaeuft();
  for (const z of $$('.regler', liste)) {
    const r = alle.find((x) => x.pfad === z.dataset.r);
    const i = $('[data-pfad]', z);
    if (gesperrt) { i.disabled = true; $('.std', z).disabled = true; continue; }
    i.addEventListener('change', () => { setzen(app.cfg, r.pfad, eingabeWert(r, i)); geaendert(el, z, r); });
    $('.std', z).addEventListener('click', () => { setzen(app.cfg, r.pfad, structuredClone(lesen(app.standard, r.pfad) ?? null)); geaendert(el, z, r, true); });
  }
}

function gruppiert(liste) {
  let letzte = '';
  return liste.map((r) => {
    let kopf = '';
    if (r.gruppe !== letzte) { letzte = r.gruppe; kopf = `<div class="gruppe-titel">${esc(r.gruppe)}</div>`; }
    return kopf + zeileHtml(r);
  }).join('');
}

function zeileHtml(r) {
  const v = lesen(app.cfg, r.pfad), std = lesen(app.standard, r.pfad);
  const g = istGeaendert(r.pfad);
  let feld;
  if (r.typ === 'bool') feld = `<input type="checkbox" data-pfad="${r.pfad}" ${v ? 'checked' : ''} aria-label="${esc(r.name)}"/>`;
  else if (r.typ === 'auswahl') feld = `<select data-pfad="${r.pfad}" aria-label="${esc(r.name)}">${r.optionen.map((o) => `<option value="${o === null ? 'null' : esc(o)}" ${o === v ? 'selected' : ''}>${o === null ? '–' : esc(o)}</option>`).join('')}</select>`;
  else feld = `<input type="number" data-pfad="${r.pfad}" min="${r.min}" max="${r.max}" step="any" value="${v ?? ''}" ${v === null ? 'placeholder="–"' : ''} aria-label="${esc(r.name)}"/>`;
  const hinweis = `Standard ${esc(wertText(std))}${r.typ === 'zahl' ? ` · ${r.min} bis ${r.max}` : ''}`;
  return `<div class="regler${g ? ' geaendert' : ''}" data-r="${esc(r.pfad)}">
    <label class="regler-name">${esc(r.name)}<span class="pfad">${esc(r.pfad)}</span></label>
    <span class="regler-feld">${feld}</span>
    <span class="regler-hinweis">${hinweis}</span>
    <button type="button" class="std klein" ${g ? '' : 'disabled'} title="Nur diesen Regler auf den Standard V10 zurücksetzen">↺ Standard</button>
  </div>`;
}

function eingabeWert(r, i) {
  if (r.typ === 'bool') return i.checked;
  if (r.typ === 'auswahl') return i.value === 'null' ? null : i.value;
  return i.value === '' ? (lesen(app.standard, r.pfad) === null ? null : 0) : Number(i.value);
}

// Nach einer Änderung nur die betroffene Zeile, den Kopf und die Bereichsliste neu zeichnen.
function geaendert(el, z, r, zurueck = false) {
  if (r.pfad === 'match.modus' || r.pfad === 'match.spieler' || r.pfad === 'match.teamGroesse') sitzeAnpassen();
  app.speichern();
  const neu = document.createElement('div');
  neu.innerHTML = zeileHtml(r);
  const ersatz = neu.firstElementChild;
  z.replaceWith(ersatz);
  const i = $('[data-pfad]', ersatz);
  i.addEventListener('change', () => { setzen(app.cfg, r.pfad, eingabeWert(r, i)); geaendert(el, ersatz, r); });
  $('.std', ersatz).addEventListener('click', () => { setzen(app.cfg, r.pfad, structuredClone(lesen(app.standard, r.pfad) ?? null)); geaendert(el, ersatz, r, true); });
  if (zurueck) i.focus();
  kopfAktualisieren(el);
}

function verdrahten(el, gesperrt) {
  $('#partieEnde', el)?.addEventListener('click', () => { partieBeenden(); reglerZeigen(el); });
  $('#zumSpiel', el)?.addEventListener('click', () => app.reiter('spiel'));
  const suche = $('#reglerSuche', el);
  suche.addEventListener('input', () => { ansicht.suche = suche.value; kopfAktualisieren(el); listeZeichnen(el); });
  if (gesperrt) return;
  const neu = () => reglerZeigen(el);
  $('#presetLaden', el).addEventListener('click', () => {
    const k = $('#presetWahl', el).value;
    const [art, name] = [k.slice(0, 1), k.slice(2)];
    if (art === 'e') presetLaden(app.presets[name], presetName(k)); else presetLaden(app.eigene[name], name);
    neu();
  });
  $('#presetSpeichern', el).addEventListener('click', () => {
    const name = prompt('Name des Presets:', app.presetName.startsWith('★') ? app.presetName : `${app.presetName} (eigen)`);
    if (!name) return;
    app.eigene[name] = { ...teilKonfig(app.cfg, app.standard), meta: { name } };
    app.eigeneSpeichern(); app.presetName = name; app.cfg.meta.name = name; app.speichern(); neu();
  });
  $('#presetLoeschen', el).addEventListener('click', () => {
    const k = $('#presetWahl', el).value;
    if (!k.startsWith('u:')) return alert('Eingebaute Presets können nicht gelöscht werden.');
    if (!confirm(`Preset «${k.slice(2)}» löschen?`)) return;
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
  $('#cfgStandard', el).addEventListener('click', () => {
    if (geaendertZahl() && !confirm('Alle Regler auf Standard V10 zurücksetzen?')) return;
    presetLaden({}, 'Standard V10'); neu();
  });
}
