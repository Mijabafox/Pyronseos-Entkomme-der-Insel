// Kleine DOM-Hilfen für die Oberfläche.
export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
export const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function herunterladen(name, inhalt, typ = 'application/json') {
  const url = URL.createObjectURL(new Blob([typ.startsWith('text/csv') ? '﻿' + inhalt : inhalt], { type: typ }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function dateiLesen(accept = '.json') {
  return new Promise((ok, fehler) => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = accept;
    i.onchange = () => { const f = i.files[0]; if (!f) return fehler(new Error('keine Datei')); const r = new FileReader(); r.onload = () => ok({ name: f.name, text: r.result }); r.onerror = fehler; r.readAsText(f); };
    i.click();
  });
}

export const speicher = {
  lesen(k, ersatz = null) { try { const v = localStorage.getItem(k); return v === null ? ersatz : JSON.parse(v); } catch { return ersatz; } },
  schreiben(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* privat oder voll */ } },
};

export function dialog(html, { breit = false } = {}) {
  const d = $('#dialog');
  d.innerHTML = `<div class="dialog-rahmen${breit ? ' breit' : ''}">${html}</div>`;
  if (!d.open) d.showModal();
  return d;
}
export function dialogZu() { const d = $('#dialog'); if (d.open) d.close(); }

export const prozent = (x) => (x === null || x === undefined ? '–' : `${(100 * x).toFixed(1)} %`);
export const zahl = (x, n = 1) => (x === null || x === undefined || Number.isNaN(x) ? '–' : Number(x).toFixed(n));
