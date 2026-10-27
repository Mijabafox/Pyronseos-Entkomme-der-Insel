// Karteneditor: jede Karte an/aus, Anzahl, Effektwerte, neue Varianten aus dem Effekt-Baukasten.
import { $, $$, esc } from './dom.js';
import { app } from './zustand.js';
import { klon } from '../engine/config.js';
import { BAUSTEINE } from '../engine/effekte.js';
import { validieren } from '../engine/validator.js';
import { spezialKarte, tagesKarte } from './karten.js';
import { BIOM, ROHSTOFF } from '../engine/namen.js';

const ARTEN_SPEZIAL = ['joker', 'gefahr', 'gluecksfund'];
const ARTEN_TAG = ['schlecht', 'gut', 'neutral'];
let filter = 'alle';

export function kartenZeigen(el) {
  const gesperrt = app.partieLaeuft();
  const c = app.cfg;
  const v = validieren(c, { modus: c.match.modus, spieler: c.match.modus === 'team' ? 4 : c.match.spieler });
  const pool = (k) => Object.values(k).filter((x) => x.aktiv).reduce((s, x) => s + (x.anzahl ?? 1), 0);
  el.innerHTML = `
  ${gesperrt ? '<div class="gesperrt">🔒 Eine Partie läuft – der Karteneditor ist gesperrt.</div>' : ''}
  <div class="kasten"><h2>🃏 Karten</h2>
    <p class="hinweis">Jede Karte besteht aus Bausteinen (Effekt, Zielgruppe, Bedingung, Wert). Änderungen gelten für Browser und Simulation. Neue Grundmechaniken brauchen weiterhin Code.</p>
    <div class="zeile"><b>Tageskarten:</b> ${pool(c.tageskarten.karten)} im Pool · ${c.match.tage.ereignisse} Ereignisse pro Partie
      <b style="margin-left:14px">Spezialkarten:</b> ${pool(c.spezialkarten.karten)} aktiv · Stapelgrösse <input type="number" id="stapel" min="1" max="80" value="${c.spezialkarten.stapel}"/>
      <select id="filter">${[['alle', 'alle'], ['tag', 'nur Tageskarten'], ['spezial', 'nur Spezialkarten']].map(([k, n]) => `<option value="${k}" ${filter === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <button type="button" id="neuTag">＋ Neue Tageskarte</button><button type="button" id="neuSpezial">＋ Neue Spezialkarte</button></div>
    ${v.fehler.length ? `<ul class="fehler">${v.fehler.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : '<p class="ok">✓ Karten und Konfiguration sind gültig.</p>'}
  </div>
  ${filter !== 'spezial' ? `<h3>☀️ Tageskarten</h3><div class="karten-liste">${Object.entries(c.tageskarten.karten).map(([id, k]) => eintrag('tag', id, k)).join('')}</div>` : ''}
  ${filter !== 'tag' ? `<h3>❗ Spezialkarten</h3><div class="karten-liste">${Object.entries(c.spezialkarten.karten).map(([id, k]) => eintrag('spezial', id, k)).join('')}</div>` : ''}`;
  if (gesperrt) { for (const i of $$('input, select, textarea, button', el)) i.disabled = true; return; }
  verdrahten(el);
}

function eintrag(art, id, k) {
  const bildHtml = art === 'tag' ? tagesKarte(app.cfg, id) : spezialKarte(app.cfg, id);
  const arten = art === 'tag' ? ARTEN_TAG : ARTEN_SPEZIAL;
  const effekte = (k.effekte ?? []).map((e, n) => effektHtml(e, `effekte.${n}`)).join('');
  const ausspielen = (k.ausspielen ?? []).map((o, n) => `<div class="effekt"><b>Ausspielen «${esc(o.name ?? o.wahl)}»</b> <span class="hinweis">in Phasen: ${esc((o.phasen ?? []).join(', '))}</span>${(o.effekte ?? []).map((e, m) => effektHtml(e, `ausspielen.${n}.effekte.${m}`)).join('')}</div>`).join('');
  return `<div class="kasten karten-eintrag ${k.aktiv ? '' : 'aus'}" data-art="${art}" data-id="${esc(id)}">
    <div>${bildHtml}</div>
    <div>
      <div class="zeile"><label><input type="checkbox" data-k="aktiv" ${k.aktiv ? 'checked' : ''}/> <b>${esc(k.symbol ?? '')} ${esc(k.name)}</b></label>
        <label>Anzahl <input type="number" min="0" max="20" data-k="anzahl" value="${k.anzahl ?? 1}"/></label></div>
      <div class="zeile"><label>Name <input data-k="name" value="${esc(k.name)}" style="width:9em"/></label>
        <label>Art <select data-k="art">${arten.map((a) => `<option ${a === k.art ? 'selected' : ''}>${a}</option>`).join('')}</select></label></div>
      <label class="hinweis" style="display:block">Text <input data-k="text" value="${esc(k.text ?? '')}" style="width:100%"/></label>
      <details><summary class="hinweis">Effekte (${(k.effekte ?? []).length}${k.ausspielen?.length ? ` + ${k.ausspielen.length} Ausspiel-Varianten` : ''})</summary>
        ${effekte}${ausspielen}
        <div class="zeile"><select data-neu-effekt>${Object.entries(BAUSTEINE).map(([b, x]) => `<option value="${b}">${esc(x.name)}</option>`).join('')}</select><button type="button" class="klein" data-effekt-dazu>＋ Effekt</button>
          <button type="button" class="klein" data-variante>⧉ Variante anlegen</button>${id.startsWith('eigen_') ? '<button type="button" class="klein" data-loeschen>🗑 Löschen</button>' : ''}</div>
        <label class="hinweis">Alle Effekte als JSON <textarea rows="3" data-json>${esc(JSON.stringify(k.effekte ?? []))}</textarea></label>
      </details>
    </div></div>`;
}

function effektHtml(e, pfad) {
  const b = BAUSTEINE[e.typ];
  const felder = Object.entries(e).filter(([k]) => !['typ', 'bedingung', 'effekte', 'optionen', 'sonst', 'tabelle', 'ziel'].includes(k)).map(([k, v]) => {
    if (typeof v === 'number') return `<label>${esc(k)} <input type="number" step="any" data-e="${pfad}.${k}" value="${v}"/></label>`;
    if (typeof v === 'boolean') return `<label><input type="checkbox" data-e="${pfad}.${k}" ${v ? 'checked' : ''}/> ${esc(k)}</label>`;
    if (k === 'art') return `<label>${esc(k)} <select data-e="${pfad}.${k}">${Object.keys(ROHSTOFF).map((r) => `<option ${r === v ? 'selected' : ''}>${r}</option>`).join('')}</select></label>`;
    return `<label>${esc(k)} <input data-e="${pfad}.${k}" value="${esc(Array.isArray(v) ? v.join(',') : v)}" style="width:7em"/></label>`;
  }).join('');
  const bed = e.bedingung ? `<span class="hinweis">Bedingung: ${esc(Object.entries(e.bedingung).map(([k, v]) => `${k} ${Array.isArray(v) ? v.map((x) => BIOM[x] ?? x).join('/') : v}`).join(', '))}</span>` : '';
  const ziel = `<label>Ziel <select data-e="${pfad}.ziel"><option value="">Standard</option><option ${e.ziel === 'aktiv' ? 'selected' : ''}>aktiv</option><option ${e.ziel === 'alle' ? 'selected' : ''}>alle</option></select></label>`;
  const innen = [...(e.effekte ?? []), ...(e.sonst ?? []), ...(e.optionen ?? []).flatMap((o) => o.effekte ?? [o]), ...(e.tabelle ?? []).flatMap((t) => t.effekte)];
  return `<div class="effekt"><div class="zeile"><b>${esc(b?.name ?? e.typ)}</b> ${ziel} ${felder} ${bed} <button type="button" class="klein" data-effekt-weg="${pfad}" title="Effekt entfernen">✕</button></div>${innen.length ? `<div class="hinweis">enthält: ${innen.map((x) => esc(BAUSTEINE[x.typ]?.name ?? x.typ) + (x.wert !== undefined ? ` ${x.wert}` : '')).join(' · ')} (im JSON bearbeitbar)</div>` : ''}</div>`;
}

function karteVon(art, id) { return art === 'tag' ? app.cfg.tageskarten.karten[id] : app.cfg.spezialkarten.karten[id]; }
function neu() { app.speichern(); kartenZeigen($('#ansicht-karten')); }

function setzeTief(obj, pfad, wert) {
  const t = pfad.split('.');
  let o = obj;
  for (let i = 0; i < t.length - 1; i++) o = o[/^\d+$/.test(t[i]) ? Number(t[i]) : t[i]];
  const letzter = t.at(-1);
  if (wert === undefined) delete o[letzter]; else o[letzter] = wert;
}

function verdrahten(el) {
  $('#stapel', el).addEventListener('change', (e) => { app.cfg.spezialkarten.stapel = Number(e.target.value); neu(); });
  $('#filter', el).addEventListener('change', (e) => { filter = e.target.value; neu(); });
  const neueKarte = (art) => {
    const id = `eigen_${Date.now().toString(36)}`;
    const k = art === 'tag'
      ? { aktiv: true, anzahl: 1, name: 'Neue Tageskarte', symbol: '⭐', art: 'gut', text: 'Alle erhalten 1 Nahrung.', effekte: [{ typ: 'rohstoff', ziel: 'alle', art: 'nahrung', wert: 1 }] }
      : { aktiv: true, anzahl: 1, name: 'Neue Spezialkarte', symbol: '⭐', art: 'gluecksfund', text: 'Sofort +1 Herz.', effekte: [{ typ: 'herzen', wert: 1 }] };
    (art === 'tag' ? app.cfg.tageskarten.karten : app.cfg.spezialkarten.karten)[id] = k;
    neu();
  };
  $('#neuTag', el).addEventListener('click', () => neueKarte('tag'));
  $('#neuSpezial', el).addEventListener('click', () => neueKarte('spezial'));
  for (const box of $$('.karten-eintrag', el)) {
    const art = box.dataset.art, id = box.dataset.id, k = karteVon(art, id);
    for (const i of $$('[data-k]', box)) i.addEventListener('change', () => {
      const f = i.dataset.k;
      k[f] = i.type === 'checkbox' ? i.checked : i.type === 'number' ? Number(i.value) : i.value;
      neu();
    });
    for (const i of $$('[data-e]', box)) i.addEventListener('change', () => {
      const p = i.dataset.e;
      const alt = p.split('.').reduce((o, x) => o?.[/^\d+$/.test(x) ? Number(x) : x], k);
      let w = i.type === 'checkbox' ? i.checked : i.type === 'number' ? Number(i.value) : i.value;
      if (p.endsWith('.ziel') && w === '') w = undefined;
      if (Array.isArray(alt)) w = String(w).split(',').map((x) => x.trim()).filter(Boolean);
      setzeTief(k, p, w);
      neu();
    });
    for (const b of $$('[data-effekt-weg]', box)) b.addEventListener('click', () => {
      const t = b.dataset.effektWeg.split('.');
      const liste = t.slice(0, -1).reduce((o, x) => o[/^\d+$/.test(x) ? Number(x) : x], k);
      liste.splice(Number(t.at(-1)), 1);
      neu();
    });
    $('[data-effekt-dazu]', box).addEventListener('click', () => {
      const typ = $('[data-neu-effekt]', box).value;
      const vorlage = { herzen: { wert: -1 }, energie: { wert: -1 }, rohstoff: { art: 'nahrung', wert: 1 }, aufdecken: { anzahl: 1, radius: 3 }, bewegungGratis: { schritte: 2 }, kampfBonus: { wert: 1 }, abbauFaktor: { faktor: 2 }, weitsicht: { radius: 3 }, bewegungskosten: { plus: 1 }, rastenWert: { wert: 3 }, rettungswurf: { wuerfel: 6, erfolgAb: 5, effekte: [{ typ: 'herzen', wert: -1 }] }, weitergeben: { richtung: 'links', sonstRohstoffe: 1 }, tierKampf: { hinterhalt: true }, rauch: { energie: 1 } }[typ] ?? {};
      k.effekte = [...(k.effekte ?? []), { typ, ...(art === 'tag' ? { ziel: 'alle' } : {}), ...klon(vorlage) }];
      neu();
    });
    $('[data-variante]', box).addEventListener('click', () => {
      const nid = `eigen_${id}_${Date.now().toString(36)}`;
      (art === 'tag' ? app.cfg.tageskarten.karten : app.cfg.spezialkarten.karten)[nid] = { ...klon(k), name: `${k.name} (Variante)` };
      neu();
    });
    $('[data-loeschen]', box)?.addEventListener('click', () => { delete (art === 'tag' ? app.cfg.tageskarten.karten : app.cfg.spezialkarten.karten)[id]; neu(); });
    $('[data-json]', box).addEventListener('change', (e) => {
      try { k.effekte = JSON.parse(e.target.value); neu(); } catch (f) { alert(`JSON nicht lesbar: ${f.message}`); }
    });
  }
}
