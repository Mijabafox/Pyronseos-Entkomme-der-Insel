// Karten-Reiter: zwei Tabs (Tageskarten, Spezialkarten), Raster aus grossen Kartenbildern.
// Ein Klick auf eine Karte öffnet den Editor im Dialog: an/aus, Anzahl, Name, Art, Text und Effekte aus dem Baukasten.
import { $, $$, esc, dialog, dialogZu } from './dom.js';
import { app, pruefen } from './zustand.js';
import { klon } from '../engine/config.js';
import { BAUSTEINE } from '../engine/effekte.js';
import { spezialKarte, tagesKarte } from './karten.js';
import { BIOM, ROHSTOFF } from '../engine/namen.js';

const ARTEN = {
  tag: { schlecht: 'schlecht (Gefahr)', gut: 'gut (Glück)', neutral: 'neutral' },
  spezial: { joker: 'Handkarte (Joker)', gefahr: 'Gefahr (sofort)', gluecksfund: 'Glücksfund (sofort)' },
};
const ZIEL = { '': 'Standard', aktiv: 'nur die aktive Figur', alle: 'alle Figuren' };
const FELD_NAME = { wert: 'Wert', art: 'Rohstoff', richtung: 'Richtung', sonstRohstoffe: 'sonst Rohstoffe', anzahl: 'Anzahl', radius: 'Radius', schritte: 'Schritte', hinterhalt: 'Hinterhalt', gegen: 'gegen', dauer: 'Dauer', faktor: 'Faktor', aus: 'aus', plus: 'plus', mindestens: 'mindestens', wuerfel: 'Würfel (Seiten)', erfolgAb: 'Erfolg ab', gut: 'gut ab', slot: 'Platz', fuer: 'für', energie: 'Energie' };
const VORLAGE = { herzen: { wert: -1 }, energie: { wert: -1 }, rohstoff: { art: 'nahrung', wert: 1 }, aufdecken: { anzahl: 1, radius: 3 }, bewegungGratis: { schritte: 2 }, kampfBonus: { wert: 1 }, abbauFaktor: { faktor: 2 }, weitsicht: { radius: 3 }, bewegungskosten: { plus: 1 }, rastenWert: { wert: 3 }, rettungswurf: { wuerfel: 6, erfolgAb: 5, effekte: [{ typ: 'herzen', wert: -1 }] }, weitergeben: { richtung: 'links', sonstRohstoffe: 1 }, tierKampf: { hinterhalt: true }, rauch: { energie: 1 } };

let tab = 'tag';
let suche = '';

const stapelVon = (art) => (art === 'tag' ? app.cfg.tageskarten.karten : app.cfg.spezialkarten.karten);
const pool = (k) => Object.values(k).filter((x) => x.aktiv).reduce((s, x) => s + (x.anzahl ?? 1), 0);

export function kartenZeigen(el) {
  const gesperrt = app.partieLaeuft();
  const c = app.cfg;
  const v = pruefen();
  const kartenFehler = v.fehler.filter((f) => /karte/i.test(f));
  const karten = Object.entries(stapelVon(tab)).filter(([, k]) => !suche || `${k.name} ${k.text}`.toLowerCase().includes(suche.toLowerCase()));
  el.innerHTML = `<div class="karten-ansicht">
    ${gesperrt ? '<div class="gesperrt">🔒 Eine Partie läuft – die Karten sind gesperrt. Du kannst sie ansehen, aber erst nach der Partie ändern.</div>' : ''}
    <div class="karten-kopf">
      <div class="tabs" role="tablist">
        <button type="button" role="tab" data-tab="tag" class="${tab === 'tag' ? 'an' : ''}" aria-selected="${tab === 'tag'}">☀️ Tageskarten <span class="zahl-marke">${Object.keys(c.tageskarten.karten).length}</span></button>
        <button type="button" role="tab" data-tab="spezial" class="${tab === 'spezial' ? 'an' : ''}" aria-selected="${tab === 'spezial'}">❗ Spezialkarten <span class="zahl-marke">${Object.keys(c.spezialkarten.karten).length}</span></button>
      </div>
      <div class="karten-werkzeuge">
        <input type="search" id="kartenSuche" placeholder="🔎 Karte suchen …" value="${esc(suche)}" aria-label="Karte suchen"/>
        ${tab === 'tag'
          ? `<span><b>${pool(c.tageskarten.karten)}</b> Karten im Pool · <b>${c.match.tage.ereignisse}</b> Ereignisse pro Partie</span>`
          : `<span><b>${pool(c.spezialkarten.karten)}</b> Karten aktiv</span><label class="inline-feld">Stapelgrösse <input type="number" id="stapel" min="1" max="80" value="${c.spezialkarten.stapel}"/></label>`}
        <button type="button" class="haupt" id="neueKarte">＋ Neue ${tab === 'tag' ? 'Tageskarte' : 'Spezialkarte'}</button>
      </div>
      ${kartenFehler.length ? `<ul class="meldungen fehler">${kartenFehler.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
    </div>
    <p class="hinweis">Klick auf eine Karte öffnet den Editor. Jede Karte besteht aus Bausteinen (Effekt, Ziel, Bedingung, Wert). Änderungen gelten für das Spiel und die Simulation.</p>
    <div class="karten-raster">${karten.map(([id, k]) => kachel(id, k)).join('') || '<p class="hinweis">Keine Karte passt zur Suche.</p>'}</div>
  </div>`;
  for (const b of $$('[data-tab]', el)) b.addEventListener('click', () => { tab = b.dataset.tab; kartenZeigen(el); });
  $('#kartenSuche', el).addEventListener('input', (e) => { suche = e.target.value; const pos = e.target.selectionStart; kartenZeigen(el); const i = $('#kartenSuche', el); i.focus(); i.setSelectionRange(pos, pos); });
  for (const k of $$('[data-karte]', el)) k.addEventListener('click', () => editorOeffnen(tab, k.dataset.karte));
  if (gesperrt) { for (const i of $$('#stapel, #neueKarte', el)) i.disabled = true; return; }
  $('#stapel', el)?.addEventListener('change', (e) => { app.cfg.spezialkarten.stapel = Math.max(1, Number(e.target.value) || 1); speichern(); });
  $('#neueKarte', el).addEventListener('click', () => {
    const id = `eigen_${Date.now().toString(36)}`;
    stapelVon(tab)[id] = tab === 'tag'
      ? { aktiv: true, anzahl: 1, name: 'Neue Tageskarte', symbol: '⭐', art: 'gut', text: 'Alle erhalten 1 Nahrung.', effekte: [{ typ: 'rohstoff', ziel: 'alle', art: 'nahrung', wert: 1 }] }
      : { aktiv: true, anzahl: 1, name: 'Neue Spezialkarte', symbol: '⭐', art: 'gluecksfund', text: 'Sofort +1 Herz.', effekte: [{ typ: 'herzen', wert: 1 }] };
    speichern();
    editorOeffnen(tab, id);
  });
}

function kachel(id, k) {
  const bildHtml = tab === 'tag' ? tagesKarte(app.cfg, id, 'kachel') : spezialKarte(app.cfg, id, 'kachel');
  const art = ARTEN[tab][k.art] ?? k.art;
  return `<button type="button" class="karten-kachel${k.aktiv ? '' : ' aus'}" data-karte="${esc(id)}" title="${esc(`${k.name}: ${k.text ?? ''}`)}">
    ${bildHtml}
    <span class="kachel-name">${esc(k.symbol ?? '')} ${esc(k.name)}</span>
    <span class="kachel-info"><span class="art-marke art-${esc(k.art)}">${esc(art)}</span> <span>${k.aktiv ? `${k.anzahl ?? 1}×` : 'aus'}</span></span>
  </button>`;
}

function speichern() { app.speichern(); const el = $('#ansicht-karten'); if (!el.hidden) kartenZeigen(el); }

// ---------------- Editor im Dialog ----------------
function editorOeffnen(art, id) {
  const k = stapelVon(art)[id];
  if (!k) return;
  const gesperrt = app.partieLaeuft();
  const d = dialog(editorHtml(art, id, k, gesperrt), { breit: true });
  d.querySelector('.dialog-rahmen').classList.add('karten-editor');
  if (gesperrt) { for (const i of $$('input, select, textarea, button:not(#keZu)', d)) i.disabled = true; $('#keZu', d).addEventListener('click', dialogZu); return; }
  verdrahten(d, art, id, k);
}

function editorHtml(art, id, k, gesperrt) {
  const bildHtml = art === 'tag' ? tagesKarte(app.cfg, id, 'gross') : spezialKarte(app.cfg, id, 'gross');
  const effekte = (k.effekte ?? []).map((e, n) => effektHtml(e, `effekte.${n}`)).join('') || '<p class="hinweis">Keine Effekte.</p>';
  const ausspielen = (k.ausspielen ?? []).map((o, n) => `<div class="effekt-gruppe"><h4>Ausspielen «${esc(o.name ?? o.wahl)}» <span class="hinweis">in Phasen: ${esc((o.phasen ?? []).join(', ') || 'alle')}</span></h4>${(o.effekte ?? []).map((e, m) => effektHtml(e, `ausspielen.${n}.effekte.${m}`)).join('')}</div>`).join('');
  return `<h2>${art === 'tag' ? '☀️ Tageskarte' : '❗ Spezialkarte'} bearbeiten: ${esc(k.name)}</h2>
  ${gesperrt ? '<div class="gesperrt">🔒 Eine Partie läuft – nur Ansicht.</div>' : ''}
  <div class="editor-spalten">
    <div class="editor-bild">${bildHtml}<p class="hinweis">${k.bild ? 'Originalbild aus V10' : 'Eigene Karte (Textkarte)'}</p></div>
    <div class="editor-felder">
      <div class="formular-zeile"><label for="keAktiv">Im Spiel</label><span><label class="schalter-gross"><input type="checkbox" id="keAktiv" data-k="aktiv" ${k.aktiv ? 'checked' : ''}/> Karte ist aktiv</label></span></div>
      <div class="formular-zeile"><label for="keAnzahl">Anzahl</label><span><input type="number" id="keAnzahl" min="0" max="20" data-k="anzahl" value="${k.anzahl ?? 1}"/></span></div>
      <div class="formular-zeile"><label for="keName">Name</label><span><input id="keName" data-k="name" value="${esc(k.name)}"/></span></div>
      <div class="formular-zeile"><label for="keSymbol">Symbol</label><span><input id="keSymbol" data-k="symbol" value="${esc(k.symbol ?? '')}" maxlength="4" class="kurz"/></span></div>
      <div class="formular-zeile"><label for="keArt">Art</label><span><select id="keArt" data-k="art">${Object.entries(ARTEN[art]).map(([a, n]) => `<option value="${a}" ${a === k.art ? 'selected' : ''}>${n}</option>`).join('')}</select></span></div>
      <div class="formular-zeile oben"><label for="keText">Text</label><span><textarea id="keText" data-k="text" rows="3">${esc(k.text ?? '')}</textarea></span></div>
      <div class="formular-zeile oben"><label for="keFlavor">Stimmungstext</label><span><textarea id="keFlavor" data-k="flavor" rows="2">${esc(k.flavor ?? '')}</textarea></span></div>
      <h3>Effekte</h3>
      <div class="effekt-liste">${effekte}${ausspielen}</div>
      <div class="effekt-neu"><label for="keNeuEffekt">Neuer Effekt</label><select id="keNeuEffekt">${Object.entries(BAUSTEINE).map(([b, x]) => `<option value="${b}">${esc(x.name)}</option>`).join('')}</select><button type="button" id="keEffektDazu">＋ Effekt hinzufügen</button></div>
      <details class="json-bereich"><summary>Für Fortgeschrittene: alle Effekte als JSON</summary><textarea id="keJson" rows="6" spellcheck="false">${esc(JSON.stringify(k.effekte ?? [], null, 1))}</textarea><p class="hinweis">Verschachtelte Effekte (Wahl, Würfeltabelle, Rettungswurf) bearbeitest du hier. Änderung wird beim Verlassen des Feldes übernommen.</p></details>
      <p id="keMeldung" class="hinweis" aria-live="polite"></p>
    </div>
  </div>
  <div class="dialog-knoepfe">
    <button type="button" id="keVariante">⧉ Als Variante kopieren</button>
    ${id.startsWith('eigen_') ? '<button type="button" id="keLoeschen" class="warnung">🗑 Karte löschen</button>' : ''}
    <span class="abstand"></span>
    <button type="button" class="haupt" id="keZu">Fertig</button>
  </div>`;
}

function effektHtml(e, pfad) {
  const b = BAUSTEINE[e.typ];
  const felder = Object.entries(b?.felder ?? {}).map(([f, typ]) => {
    const v = e[f];
    const name = FELD_NAME[f] ?? f;
    if (typ === 'zahl') return `<label>${esc(name)} <input type="number" step="any" data-e="${pfad}.${f}" value="${v ?? ''}"/></label>`;
    if (typ === 'bool') return `<label class="haken-feld"><input type="checkbox" data-e="${pfad}.${f}" ${v ? 'checked' : ''}/> ${esc(name)}</label>`;
    if (typ === 'rohstoff') return `<label>${esc(name)} <select data-e="${pfad}.${f}">${Object.entries(ROHSTOFF).map(([r, n]) => `<option value="${r}" ${r === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`;
    if (Array.isArray(typ)) return `<label>${esc(name)} <select data-e="${pfad}.${f}"><option value="">–</option>${typ.map((o) => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select></label>`;
    return '';
  }).join('');
  const bed = e.bedingung ? `<span class="hinweis">Bedingung: ${esc(Object.entries(e.bedingung).map(([k, v]) => `${k} ${Array.isArray(v) ? v.map((x) => BIOM[x] ?? x).join('/') : v}`).join(', '))}</span>` : '';
  const innen = [...(e.effekte ?? []), ...(e.sonst ?? []), ...(e.optionen ?? []).flatMap((o) => o.effekte ?? [o]), ...(e.tabelle ?? []).flatMap((t) => t.effekte ?? [])];
  return `<div class="effekt">
    <div class="effekt-kopf"><b>${esc(b?.name ?? e.typ)}</b><button type="button" class="klein" data-effekt-weg="${pfad}" title="Effekt entfernen">✕ entfernen</button></div>
    <div class="effekt-felder"><label>Ziel <select data-e="${pfad}.ziel">${Object.entries(ZIEL).map(([z, n]) => `<option value="${z}" ${(e.ziel ?? '') === z ? 'selected' : ''}>${n}</option>`).join('')}</select></label>${felder}</div>
    ${bed}${innen.length ? `<div class="hinweis">enthält: ${innen.map((x) => esc(BAUSTEINE[x.typ]?.name ?? x.typ) + (x.wert !== undefined ? ` ${x.wert}` : '')).join(' · ')} (im JSON bearbeitbar)</div>` : ''}
  </div>`;
}

function setzeTief(obj, pfad, wert) {
  const t = pfad.split('.');
  let o = obj;
  for (let i = 0; i < t.length - 1; i++) o = o[/^\d+$/.test(t[i]) ? Number(t[i]) : t[i]];
  const letzter = t.at(-1);
  if (wert === undefined) delete o[letzter]; else o[letzter] = wert;
}

function verdrahten(d, art, id, k) {
  const neuZeichnen = () => {
    speichern();
    const scroll = $('.dialog-rahmen', d).scrollTop;
    const offenJson = $('.json-bereich', d)?.open;
    $('.dialog-rahmen', d).innerHTML = editorHtml(art, id, k, false);
    $('.dialog-rahmen', d).scrollTop = scroll;
    if (offenJson) $('.json-bereich', d).open = true;
    verdrahten(d, art, id, k);
  };
  for (const i of $$('[data-k]', d)) i.addEventListener('change', () => {
    const f = i.dataset.k;
    k[f] = i.type === 'checkbox' ? i.checked : i.type === 'number' ? Math.max(0, Number(i.value) || 0) : i.value;
    if (f === 'flavor' && !k.flavor) delete k.flavor;
    neuZeichnen();
  });
  for (const i of $$('[data-e]', d)) i.addEventListener('change', () => {
    const p = i.dataset.e;
    let w = i.type === 'checkbox' ? i.checked : i.type === 'number' ? Number(i.value) : i.value;
    if (i.tagName === 'SELECT' && w === '') w = undefined;
    setzeTief(k, p, w);
    neuZeichnen();
  });
  for (const b of $$('[data-effekt-weg]', d)) b.addEventListener('click', () => {
    const t = b.dataset.effektWeg.split('.');
    const liste = t.slice(0, -1).reduce((o, x) => o[/^\d+$/.test(x) ? Number(x) : x], k);
    liste.splice(Number(t.at(-1)), 1);
    neuZeichnen();
  });
  $('#keEffektDazu', d).addEventListener('click', () => {
    const typ = $('#keNeuEffekt', d).value;
    k.effekte = [...(k.effekte ?? []), { typ, ...(art === 'tag' ? { ziel: 'alle' } : {}), ...klon(VORLAGE[typ] ?? {}) }];
    neuZeichnen();
  });
  $('#keJson', d).addEventListener('change', (e) => {
    try { k.effekte = JSON.parse(e.target.value); neuZeichnen(); } catch (f) { $('#keMeldung', d).textContent = `JSON nicht lesbar: ${f.message}`; $('#keMeldung', d).className = 'fehler'; }
  });
  $('#keVariante', d).addEventListener('click', () => {
    const nid = `eigen_${id.replace(/^eigen_/, '')}_${Date.now().toString(36)}`;
    stapelVon(art)[nid] = { ...klon(k), name: `${k.name} (Variante)` };
    speichern();
    editorOeffnen(art, nid);
  });
  $('#keLoeschen', d)?.addEventListener('click', () => {
    if (!confirm(`Karte «${k.name}» löschen?`)) return;
    delete stapelVon(art)[id];
    dialogZu();
    speichern();
  });
  $('#keZu', d).addEventListener('click', dialogZu);
}
