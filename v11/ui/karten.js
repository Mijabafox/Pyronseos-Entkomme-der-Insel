// Darstellung von Karten (Originalbilder aus v10, eigene Karten als Text-Karte).
import { esc } from './dom.js';
import { bild } from './bilder.js';

export function spezialKarte(cfg, id, klasse = '') {
  const d = cfg.spezialkarten.karten[id];
  if (!d) return `<div class="karte-text ${klasse}">${esc(id)}</div>`;
  const src = bild.spezial(d);
  return src ? `<div class="karte ${klasse}" title="${esc(`${d.name}: ${d.text}`)}"><img src="${src}" alt="${esc(`${d.name}: ${d.text}`)}" onerror="this.parentNode.outerHTML='${esc(textKarte(d, d.art)).replace(/'/g, '&#39;')}'"/></div>` : textKarte(d, d.art, klasse);
}

export function tagesKarte(cfg, id, klasse = '') {
  const d = id === 'ruhig' ? cfg.tageskarten.ruhig : id === 'lava' ? cfg.tageskarten.lava : cfg.tageskarten.karten[id];
  if (!d) return `<div class="karte-text tag ${klasse}">${esc(id)}</div>`;
  const src = bild.tag(d);
  return src ? `<div class="karte ${klasse}" title="${esc(`${d.name}: ${d.text}`)}"><img src="${src}" alt="${esc(`${d.name}: ${d.text}`)}" onerror="this.parentNode.outerHTML='${esc(textKarte(d, 'tag')).replace(/'/g, '&#39;')}'"/></div>` : textKarte(d, 'tag', klasse);
}

export function textKarte(d, art, klasse = '') {
  return `<div class="karte-text ${art} ${klasse}"><b>${esc(d.symbol ?? '')} ${esc(d.name ?? '')}</b><br>${esc(d.text ?? '')}${d.flavor ? `<br><i>${esc(d.flavor)}</i>` : ''}</div>`;
}

export function rueckseite(art, klasse = '') {
  return `<div class="karte ${klasse}"><img src="${bild.rueckseite(art)}" alt="Rückseite ${esc(art)}"/></div>`;
}

export function routenKarte(r, offen, klasse = '') {
  return offen && r && r !== 'verdeckt' ? `<div class="karte ${klasse}"><img src="${bild.route(r)}" alt="Routenkarte ${esc(r)}"/></div>` : rueckseite('route', klasse);
}
