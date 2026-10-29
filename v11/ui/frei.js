// Freier Tisch (wie V10): echter Spieltisch für Playtests. Keine Regelprüfung, keine Bots.
// Figuren, offene Karten, Panels, Marker und Plättchen-Inhalte lassen sich frei ziehen, Felder auf- und zudecken,
// Werte mit +/−. Werkzeuge: Auswahl, Hand, Pinsel (Edit), Nebel, Marker. Rückgängig mit Strg+Z.
import { $, $$, esc, dialog, dialogZu, herunterladen, speicher } from './dom.js';
import { app } from './zustand.js';
import { klon, ROHSTOFFE, rohstoffText, mal } from '../engine/config.js';
import { pixel } from '../engine/hex.js';
import { TIER, ROHSTOFF, INHALT, BIOM } from '../engine/namen.js';
import { STRANDRING } from '../engine/brett.js';
import { brettSvg, HALB, SE, RAHMEN } from './brett.js';
import { bild, spielerFarbe, chipOrt } from './bilder.js';
import { spezialKarte, tagesKarte, routenKarte, rueckseite, textKarte } from './karten.js';
import { charakterText, rezeptName, rezeptSymbol, rezeptWirkung } from './texte.js';
import { TischAnsicht } from './tisch.js';
import * as F from './frei-tisch.js';

const B = HALB;
const WELT = { x: -1210, y: -500, w: 2420, h: 1010 };
const STAPEL_IM_RAHMEN = { tag: 'oben_rechts', spezial: 'unten_rechts', route: 'unten_links' };
const SPEICHER = 'v11-frei';
const SZENARIEN = 'v11-frei-szenarien';
const WERKZEUGE = [['auswahl', '↖', 'Auswählen und ziehen'], ['hand', '✋', 'Hand: Tisch verschieben'], ['pinsel', '🖌', 'Pinsel: Biom ändern (nur im Edit-Modus)'], ['nebel', '🌫', 'Nebel: Feld aufdecken oder verdecken'], ['marker', '📍', 'Marker: Notiz-Pin setzen']];

export const freierTischGespeichert = () => !!speicher.lesen(SPEICHER, null)?.tisch;

export class FreierTisch extends TischAnsicht {
  constructor(t, cfg) {
    super(WELT);
    this.t = t;
    this.cfg = cfg;
    this.werkzeug = 'auswahl';
    this.edit = false;
    this.pinselBiom = 'wald';
    this.verlauf = [];
    this.figurGewaehlt = null;
  }

  static neu(cfg, namen, seed) { const c = klon(cfg); return new FreierTisch(F.tischNeu(c, namen, seed), c); }
  static laden() { const d = speicher.lesen(SPEICHER, null); return d?.tisch ? new FreierTisch(d.tisch, d.cfg) : null; }

  speichern() { speicher.schreiben(SPEICHER, { tisch: this.t, cfg: this.cfg }); }
  beenden() { this.beendet = true; document.removeEventListener('keydown', this.tasten); this.menueZu(); }

  // Jede Änderung: Rückgängig-Schritt merken, ausführen, speichern, neu zeichnen.
  aendern(fn) {
    this.verlauf.push(JSON.stringify(this.t));
    if (this.verlauf.length > 80) this.verlauf.shift();
    const r = fn();
    this.speichern();
    this.render();
    return r;
  }

  rueckgaengig() {
    const v = this.verlauf.pop();
    if (!v) return;
    this.t = JSON.parse(v);
    this.speichern();
    this.render();
  }

  einhaengen(el) {
    this.el = el;
    el.innerHTML = this.geruestHtml();
    this.tischBedienung();
    this.verdrahten();
    if (!this.kamera) requestAnimationFrame(() => { this.zentrieren(); });
    this.render();
  }

  render() {
    if (!this.el || app.aktuellerReiter() !== 'spiel' || app.frei !== this) return;
    app.toolbar('spiel');
    this.renderHinweis();
    this.renderTisch();
    this.minimapZeichnen();
  }

  // ---------------- Toolbar und Hinweisleiste ----------------
  toolbar(teil) {
    const t = this.t;
    const tag = $('#tbTag');
    tag.hidden = false;
    tag.innerHTML = `<button type="button" data-fw="tagMinus" title="Tag zurück">−</button><span class="tag-anzeige">Tag <b>${t.tag}</b></span><button type="button" data-fw="tagPlus" title="Tag vor">+</button>
      <span class="wetter" title="Zuletzt gezogene Tageskarte">${esc(t.wetter)}</span>
      <span class="tb-seed" title="Seed: dieselbe Zahl ergibt dieselbe Insel und dieselben Stapel">🌱<span class="tb-text"> Seed</span> <b>${t.seed}</b></span>`;
    $('#tbTempo').innerHTML = `${WERKZEUGE.map(([id, sym, titel]) => `<button type="button" class="werkzeug${this.werkzeug === id ? ' an' : ''}" data-werkzeug="${id}" title="${titel}" ${id === 'pinsel' && !this.edit ? 'disabled' : ''}>${sym}</button>`).join('')}
      <label class="schalter" title="Edit-Modus: Brett bearbeiten (Pinsel)"><input type="checkbox" id="tbEdit" ${this.edit ? 'checked' : ''}/><span>Edit</span></label>
      ${this.edit ? `<select id="tbPinsel" aria-label="Biom für den Pinsel">${Object.entries(BIOM).map(([b, n]) => `<option value="${b}" ${this.pinselBiom === b ? 'selected' : ''}>${n}</option>`).join('')}</select>` : ''}`;
    const knopf = (id, sym, text, titel) => `<button type="button" data-fw="${id}" title="${titel}"><span class="tb-symbol">${sym}</span><span class="tb-text">${text}</span></button>`;
    $('#tbKnoepfe').innerHTML = [
      knopf('rezepte', '📜', 'Rezepte', 'Rezepte und Kosten'), knopf('fluchtwege', '🚩', 'Fluchtwege', 'Fluchtwege und Kosten'),
      knopf('tierjagd', '🐾', 'Tierjagd', 'Tierjagd: Tier ziehen und kämpfen'), knopf('wuerfeln', '🎲', 'Würfeln', 'Würfeln (W3, W6, W42)'),
      knopf('karte', '＋🃏', 'Karte', 'Eigene Karte auf einen Stapel legen'), knopf('spieler', '＋🧍', 'Spieler', `Spieler dazu (höchstens ${F.MAX_SPIELER})`),
      knopf('szenarien', '💾', 'Szenarien', 'Tisch speichern und laden'), knopf('protokoll', '📋', 'Protokoll', 'Playtest-Protokoll'),
      `<button type="button" data-fw="zurueck" title="Rückgängig (Strg+Z)" ${this.verlauf.length ? '' : 'disabled'}>↶</button>`,
    ].join('');
    if (teil !== 'spiel' || !$('#tbFreiRechts')) {
      $('#tbRechts').innerHTML = `<span id="tbFreiRechts"></span><button type="button" id="tbZentrieren" title="Ansicht zentrieren">⌖</button>
        <button type="button" class="haupt" id="tbNeu" title="Neue Partie">＋<span class="tb-text"> Neue Partie</span></button>`;
      $('#tbZentrieren').addEventListener('click', () => this.zentrieren());
      $('#tbNeu').addEventListener('click', () => app.neuePartieDialog());
    }
  }

  // Klicks in der Toolbar (einmal verdrahtet in verdrahten()).
  toolbarKlick(e) {
    const w = e.target.closest('[data-werkzeug]');
    if (w) { this.werkzeug = w.dataset.werkzeug; this.figurGewaehlt = null; $('#tisch', this.el).dataset.werkzeug = this.werkzeug; this.render(); return; }
    const b = e.target.closest('[data-fw]');
    if (!b) return;
    switch (b.dataset.fw) {
      case 'tagMinus': this.aendern(() => F.tagAendern(this.t, -1)); break;
      case 'tagPlus': this.aendern(() => F.tagAendern(this.t, 1)); break;
      case 'rezepte': this.rezepteDialog(); break;
      case 'fluchtwege': this.fluchtDialog(); break;
      case 'tierjagd': this.tierjagdDialog(); break;
      case 'wuerfeln': this.wuerfelDialog(); break;
      case 'karte': this.karteDialog(); break;
      case 'spieler': if (!this.aendern(() => F.spielerDazu(this.t, this.cfg))) dialog(`<h2>＋🧍 Spieler</h2><p>Am Tisch sitzen schon ${F.MAX_SPIELER} Spieler.</p><div class="dialog-knoepfe"><button type="button" class="haupt" onclick="this.closest('dialog').close()">OK</button></div>`); break;
      case 'szenarien': this.szenarienDialog(); break;
      case 'protokoll': this.protokollDialog(); break;
      case 'zurueck': this.rueckgaengig(); break;
      default:
    }
  }

  renderHinweis() {
    const t = this.t, p = t.spieler[t.aktiv];
    const werkzeugText = { auswahl: 'Figur auf ein Feld ziehen · verdecktes Feld anklicken = aufdecken · Symbol vom Feld wegziehen = entfernen · Rechtsklick auf ein Feld = Menü · Karten: Klick auf Stapel · Werte mit +/−', hand: 'Hand: Tisch mit der Maus verschieben', pinsel: `Pinsel: Felder anklicken, um das Biom auf ${BIOM[this.pinselBiom]} zu setzen`, nebel: 'Nebel: Feld anklicken = aufdecken oder verdecken', marker: 'Marker: auf den Tisch klicken, um einen Notiz-Pin zu setzen' }[this.werkzeug];
    $('#hinweisleiste').innerHTML = `<span class="was-jetzt"><span class="punkt" style="background:${spielerFarbe[t.aktiv]}"></span><b>${esc(p?.name ?? '')}</b> ist am Tisch dran · Freier Tisch: ${werkzeugText}${this.figurGewaehlt !== null ? ` · <b>${esc(t.spieler[this.figurGewaehlt].name)}</b> ausgewählt – jetzt ein Feld anklicken` : ''}.</span>
      <button type="button" id="hlNaechster">Nächster Spieler ▶</button>
      <button type="button" class="haupt" id="hlTageskarte">☀️ Tageskarte ziehen</button>`;
    $('#hlNaechster').addEventListener('click', () => this.aendern(() => F.naechster(this.t)));
    $('#hlTageskarte').addEventListener('click', () => this.aendern(() => F.ziehen(this.t, this.cfg, 'tag')));
  }

  // ---------------- Tisch ----------------
  kartenHtml(k, klasse = '') {
    switch (k.typ) {
      case 'tag': return tagesKarte(this.cfg, k.ref, klasse);
      case 'spezial': return spezialKarte(this.cfg, k.ref, klasse);
      case 'route': return routenKarte(k.ref, true, klasse);
      case 'rohstoff': return `<div class="karte ${klasse}" title="${esc(ROHSTOFF[k.ref])}"><img src="${bild.rohstoff(k.ref)}" alt="${esc(ROHSTOFF[k.ref])}" draggable="false"/></div>`;
      case 'tier': return `<div class="karte tier-karte ${klasse}" title="${esc(TIER[k.ref]?.name ?? k.ref)}"><img src="${bild.tier(k.ref)}" alt="" draggable="false"/><b>${esc(TIER[k.ref]?.name ?? k.ref)}</b><span>${k.ref in this.cfg.tiere.gross ? `gross · Ziel ${this.cfg.tiere.zielGross}` : `klein · Ziel ${this.cfg.tiere.zielKlein}`}</span></div>`;
      default: return textKarte({ name: k.titel, text: k.text, symbol: k.symbol }, 'eigen', klasse);
    }
  }

  stapelHtml() {
    const t = this.t;
    const knoepfe = (id) => `<div class="stapel-knoepfe"><button type="button" data-stapel-aktion="ziehen" data-stapel="${id}" title="Oberste Karte ziehen">⬆</button><button type="button" data-stapel-aktion="mischen" data-stapel="${id}" title="Mischen">🔀</button><button type="button" data-stapel-aktion="ablage" data-stapel="${id}" title="Ablage ansehen">👁</button><button type="button" data-stapel-aktion="zurueck" data-stapel="${id}" title="Ablage zurückmischen">♻</button><button type="button" data-stapel-aktion="karte" data-stapel="${id}" title="Eigene Karte erstellen">＋</button><button type="button" data-stapel-aktion="reset" data-stapel="${id}" title="Stapel zurücksetzen">⟲</button></div>`;
    const zahl = (n) => `${n} Karte${n === 1 ? '' : 'n'}`;
    const imRahmen = (id) => {
      const r = RAHMEN[STAPEL_IM_RAHMEN[id]], st = t.stapel[id];
      return `<div class="stapel auf-brett" style="left:${r.x.toFixed(1)}px;top:${r.y.toFixed(1)}px;width:${r.breite.toFixed(1)}px;height:${r.hoehe.toFixed(1)}px">
        <div class="stapel-karten" data-stapel-aktion="ziehen" data-stapel="${id}" title="Klick: oberste Karte ziehen">${rueckseite(id, `brett-stapel${st.karten.length ? '' : ' leer'}`)}</div>
        <div class="stapel-info"><div class="stapel-name">${F.STAPEL[id].name}</div><div class="stapel-zahl">${zahl(st.karten.length)} · Ablage ${st.ablage.length}</div>${knoepfe(id)}</div></div>`;
    };
    const links = (id, x, y, inhalt) => `<div class="stapel frei-stapel" style="left:${x}px;top:${y}px">
      <div class="stapel-karten" data-stapel-aktion="ziehen" data-stapel="${id}" title="Klick: oberste Karte ziehen">${inhalt}</div>
      <div class="stapel-name">${F.STAPEL[id].name}</div><div class="stapel-zahl">${zahl(t.stapel[id].karten.length)} · Ablage ${t.stapel[id].ablage.length}</div>${knoepfe(id)}</div>`;
    const wuerfe = t.wuerfel.slice(-6), letzter = wuerfe.at(-1);
    return [
      imRahmen('tag'), imRahmen('spezial'), imRahmen('route'),
      links('rohstoff', -1190, -470, `<div class="karte rueckseite-css${t.stapel.rohstoff.karten.length ? '' : ' leer'}"><span class="rs-motiv">🪵</span><span class="rs-name">Rohstoffkarten</span></div>`),
      links('tier', -1015, -470, `<div class="beutel${t.stapel.tier.karten.length ? '' : ' leer'}"><div class="beutel-knoten"></div><div class="beutel-motiv">🐾</div><div class="beutel-name">${t.stapel.tier.karten.length}</div></div>`),
      `<div class="wuerfelschale" style="left:-1190px;top:290px"><div class="schale-titel">🎲 Würfelschale <span class="schale-knoepfe"><button type="button" data-w="W3">W3</button><button type="button" data-w="W6">W6</button><button type="button" data-w="W42">W42</button></span></div>
        <div class="schale-boden">${wuerfe.length ? wuerfe.map((w) => `<div class="wuerfel w-${w.wuerfel}" style="--farbe:${spielerFarbe[w.spieler] ?? 'var(--primaer)'}"><span class="w-art">${w.wuerfel}</span><span class="w-wert">${w.wert}</span></div>`).join('') : '<span class="leer-hinweis">leer</span>'}</div>
        <div class="schale-zweck">${letzter ? `zuletzt ${letzter.wuerfel}: ${letzter.wert}` : 'Noch nicht gewürfelt'}</div></div>`,
    ].join('');
  }

  offenHtml() {
    return this.t.offen.map((o, i) => `<div class="offen-karte" data-offen="${i}" style="left:${o.x}px;top:${o.y}px">${this.kartenHtml(o.karte, 'mini')}
      <div class="offen-knoepfe"><button type="button" data-offen-aktion="hand" data-i="${i}" title="Auf die Hand von ${esc(this.t.spieler[this.t.aktiv]?.name ?? '')}">✋</button><button type="button" data-offen-aktion="gross" data-i="${i}" title="Gross ansehen">🔍</button><button type="button" data-offen-aktion="ablage" data-i="${i}" title="Auf die Ablage">🗑</button></div></div>`).join('');
  }

  markerHtml() {
    return this.t.marker.map((m) => `<div class="marker" data-marker="${m.id}" style="left:${m.x}px;top:${m.y}px"><div class="marker-nadel">📍</div><div class="marker-text" contenteditable="true" spellcheck="false" data-marker-text="${m.id}">${esc(m.text)}</div><button type="button" class="marker-weg" data-marker-weg="${m.id}" title="Marker entfernen">×</button></div>`).join('');
  }

  panelHtml(p, i) {
    const t = this.t, cfg = this.cfg;
    const aktiv = i === t.aktiv;
    const max = F.herzenMax(cfg, p.charakter), emax = F.energieMax(cfg);
    const summe = ROHSTOFFE.reduce((s, r) => s + (p.rohstoffe[r] ?? 0), 0);
    const char = cfg.charaktere[p.charakter];
    const kopf = `<header class="panel-kopf" data-panel-zieh="${i}" title="Panel verschieben: hier ziehen"><span class="punkt" style="background:${spielerFarbe[i]}"></span><b class="panel-name">${esc(p.name)}</b>${aktiv ? ' <span class="am-zug">am Zug</span>' : ''}
      <span class="panel-kurz">❤️${p.herzen} ⚡${p.energie} · 📦${summe} · ${esc(char?.symbol ?? '')}</span><button type="button" class="panel-klapp" data-panel-klapp="${i}" title="${p.panel.offen ? 'Einklappen' : 'Aufklappen'}">${p.panel.offen ? '▾' : '▸'}</button></header>`;
    if (!p.panel.offen) return `<section class="spieler-panel frei zu${aktiv ? ' ist-aktiv' : ''}" data-panel="${i}" style="left:${p.panel.x}px;top:${p.panel.y}px;--farbe:${spielerFarbe[i]}">${kopf}</section>`;
    const leiste = (sym, art, wert, mx) => `<div class="wert-leiste"><span class="leiste-symbol">${sym}</span><span class="kaestchen">${Array.from({ length: mx }, (_, k) => `<span class="${k < wert ? 'voll' : ''}"></span>`).join('')}</span><span class="leiste-zahl">${wert}/${mx}</span><button type="button" data-f-wert="${art}" data-s="${i}" data-d="-1" aria-label="${art} weniger">−</button><button type="button" data-f-wert="${art}" data-s="${i}" data-d="1" aria-label="${art} mehr">+</button></div>`;
    const platz = (slot, id, name, hat) => `<button type="button" class="ausruestung-karte${hat ? '' : ' leer'}" data-f-aus="${slot}" data-s="${i}" title="${esc(name)}: Klick = ${slot === 'waffe' ? 'Waffe wechseln' : hat ? 'weglegen' : 'dazunehmen'}">${hat && bild.werkzeug(id) ? `<img src="${bild.werkzeug(id)}" alt="${esc(name)}" draggable="false"/>` : `<span>${esc(name)}</span>`}</button>`;
    const w = p.ausruestung.waffe;
    const hand = p.hand.length ? p.hand.map((k, n) => { const info = F.kartenInfo(cfg, k); return `<li class="hand-karte typ-${k.typ}"><span>${esc(info.symbol)} ${esc(info.titel)}</span><span><button type="button" data-f-hand="zeigen" data-s="${i}" data-n="${n}" title="Gross ansehen">👁</button><button type="button" data-f-hand="spielen" data-s="${i}" data-n="${n}">Ausspielen</button><button type="button" data-f-hand="ablage" data-s="${i}" data-n="${n}" title="Auf die Ablage">🗑</button></span></li>`; }).join('') : '<li class="hinweis">Karten hierher ziehen</li>';
    return `<section class="spieler-panel frei${aktiv ? ' ist-aktiv' : ''}" data-panel="${i}" style="left:${p.panel.x}px;top:${p.panel.y}px;--farbe:${spielerFarbe[i]}">${kopf}
      <div class="panel-inhalt">
        <label class="panel-zeile">Name <input data-f-name="${i}" value="${esc(p.name)}" maxlength="16"/></label>
        <label class="panel-zeile">Rolle <select data-f-rolle="${i}">${Object.entries(cfg.charaktere).filter(([, c]) => c.aktiv).map(([id, c]) => `<option value="${id}" ${id === p.charakter ? 'selected' : ''}>${esc(c.symbol)} ${esc(c.name)}</option>`).join('')}</select></label>
        <div class="bonus">${esc(charakterText(cfg, p.charakter))}</div>
        <div class="karten-reihe"><div class="spielerkarte"><img src="${bild.charakter(p.charakter)}" alt="Spielerkarte ${esc(char?.name ?? '')}" draggable="false"/>
          <img class="chip" src="${bild.herz}" alt="Herzen ${p.herzen}" style="${chipOrt(p.herzen, 'herz')}" draggable="false"/><img class="chip" src="${bild.energie}" alt="Energie ${p.energie}" style="${chipOrt(p.energie, 'energie')}" draggable="false"/></div>
          <div class="ausruestung-karten">${platz('axt', 'axt', 'Steinaxt', p.ausruestung.axt)}${platz('hacke', 'hacke', 'Spitzhacke', p.ausruestung.hacke)}${platz('waffe', w, w ? rezeptName(w) : 'Waffe', !!w)}</div></div>
        ${leiste('❤️', 'herzen', p.herzen, max)}${leiste('⚡', 'energie', p.energie, emax)}
        ${F.amWasser(t, i) ? `<button type="button" class="trinken" data-f-trinken="${i}" ${p.energie >= emax ? 'disabled title="Energie ist schon voll"' : ''}>💧 Trinken – Energie auffüllen</button>` : ''}
        <div class="panel-zeile"><b>Rohstoffe</b> <span class="hinweis">Rohstoffkarte aufs Panel ziehen = +1</span></div>
        <div class="frei-rohstoffe">${ROHSTOFFE.map((r) => `<div class="frei-rohstoff" title="${ROHSTOFF[r]}"><img src="${bild.rohstoff(r)}" alt="${ROHSTOFF[r]}" draggable="false"/><button type="button" data-f-roh="${r}" data-s="${i}" data-d="-1" aria-label="${ROHSTOFF[r]} weniger">−</button><b class="${p.rohstoffe[r] ? '' : 'null'}">${p.rohstoffe[r] ?? 0}</b><button type="button" data-f-roh="${r}" data-s="${i}" data-d="1" aria-label="${ROHSTOFF[r]} mehr">+</button></div>`).join('')}</div>
        <div class="hinweis">${p.feld ? 'Figur bewegen: auf ein Feld ziehen – oder Figur anklicken, dann Feld anklicken.' : 'Zuerst «W42-Wurf»: dann steht die Figur am Strand.'}</div>
        <div class="panel-zeile">Startfeld <b>${p.startNr ?? '—'}</b><button type="button" data-f-w42="${i}">🎲 W42-Wurf</button><button type="button" data-f-zeigen="${i}" ${p.feld ? '' : 'disabled'}>Figur zeigen</button></div>
        <div class="panel-zeile"><b>Handkarten (${p.hand.length})</b>${aktiv ? '<span class="am-zug">am Zug</span>' : `<button type="button" data-f-amzug="${i}">Am Zug</button>`}</div>
        <ul class="hand-liste" data-hand="${i}">${hand}</ul>
      </div></section>`;
  }

  renderTisch() {
    const t = this.t;
    const ansicht = { felder: t.felder, spieler: t.spieler.map((p) => ({ ...p, liegt: false, ausgeschieden: !p.feld })), aktiv: t.aktiv, ende: null, notFloss: {} };
    const svg = brettSvg(ansicht, { figurenZiehbar: true, figurGewaehlt: this.figurGewaehlt });
    const inhalt = $('.welt-inhalt', this.el);
    const scroll = new Map($$('.spieler-panel', inhalt).map((p) => [p.dataset.panel, $('.panel-inhalt', p)?.scrollTop ?? 0]));
    const fokus = document.activeElement?.closest?.('.welt-inhalt') ? document.activeElement : null;
    const fokusSel = fokus?.dataset.fName ? `[data-f-name="${fokus.dataset.fName}"]` : null;
    inhalt.innerHTML = `<div class="brett-platz" style="left:${-B}px;top:${-B}px;width:${2 * B}px;height:${2 * B}px">${svg}</div>
      ${this.stapelHtml()}${t.spieler.map((p, i) => this.panelHtml(p, i)).join('')}${this.offenHtml()}${this.markerHtml()}`;
    for (const p of $$('.spieler-panel', inhalt)) { const i = $('.panel-inhalt', p); if (i) i.scrollTop = scroll.get(p.dataset.panel) ?? 0; }
    if (fokusSel) $(fokusSel, inhalt)?.focus();
    $('#tisch', this.el).dataset.werkzeug = this.werkzeug;
    this.kameraSetzen();
  }

  minimapZeichnen() {
    const el = $('#minimap', this.el);
    if (!el) return;
    const t = this.t;
    const figuren = t.spieler.map((p, i) => { const f = t.felder[p.feld]; if (!f) return ''; const c = pixel(f.coord, SE); return `<circle cx="${c.x.toFixed(0)}" cy="${c.y.toFixed(0)}" r="${SE}" fill="${spielerFarbe[i]}" stroke="#fff" stroke-width="10"/>`; }).join('');
    const panels = t.spieler.map((p, i) => `<rect x="${p.panel.x}" y="${p.panel.y}" width="320" height="${p.panel.offen ? 460 : 40}" rx="12" fill="${spielerFarbe[i]}" opacity="0.35"/>`).join('');
    const offen = t.offen.map((o) => `<rect x="${o.x}" y="${o.y}" width="110" height="167" rx="8" fill="#c9bfa9"/>`).join('');
    el.innerHTML = `<svg viewBox="${WELT.x} ${WELT.y} ${WELT.w} ${WELT.h}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <rect x="${WELT.x}" y="${WELT.y}" width="${WELT.w}" height="${WELT.h}" fill="#f3efe6"/>
      <rect x="-1190" y="-470" width="330" height="300" rx="12" fill="#e2dbcc"/><rect x="-1190" y="290" width="330" height="150" rx="40" fill="#e2dbcc"/>
      <image href="${bild.brett}" x="${-B}" y="${-B}" width="${2 * B}" height="${2 * B}" preserveAspectRatio="none"/>
      ${offen}${panels}${figuren}<rect class="sicht" x="0" y="0" width="0" height="0"/></svg>`;
    this.minimapSicht();
  }

  // ---------------- Bedienung ----------------
  verdrahten() {
    const inhalt = $('.welt-inhalt', this.el);
    const tisch = $('#tisch', this.el);
    if (!this.toolbarHoerer) {
      this.toolbarHoerer = (e) => { if (app.frei === this && app.aktuellerReiter() === 'spiel') this.toolbarKlick(e); };
      $('#toolbar').addEventListener('click', this.toolbarHoerer);
      $('#toolbar').addEventListener('change', (e) => {
        if (app.frei !== this) return;
        if (e.target.id === 'tbEdit') { this.edit = e.target.checked; if (!this.edit && this.werkzeug === 'pinsel') this.werkzeug = 'auswahl'; this.render(); }
        if (e.target.id === 'tbPinsel') { this.pinselBiom = e.target.value; this.renderHinweis(); }
      });
    }
    this.tasten = (e) => {
      if (app.frei !== this || app.aktuellerReiter() !== 'spiel' || $('#dialog').open) return;
      if (e.target.closest?.('input, select, textarea, [contenteditable]')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); this.rueckgaengig(); }
      if (e.key === 'Escape') { this.figurGewaehlt = null; this.menueZu(); this.render(); }
    };
    document.addEventListener('keydown', this.tasten);

    inhalt.addEventListener('click', (e) => {
      if (this.gezogen) return;
      const el = e.target;
      const d = (sel) => el.closest(sel);
      let x;
      if ((x = d('[data-stapel-aktion]'))) return this.stapelAktion(x.dataset.stapelAktion, x.dataset.stapel);
      if ((x = d('[data-offen-aktion]'))) return this.offenAktion(x.dataset.offenAktion, Number(x.dataset.i));
      if ((x = d('[data-f-wert]'))) return this.aendern(() => F.wertAendern(this.t, this.cfg, Number(x.dataset.s), x.dataset.fWert, Number(x.dataset.d)));
      if ((x = d('[data-f-roh]'))) return this.aendern(() => F.rohstoffAendern(this.t, Number(x.dataset.s), x.dataset.fRoh, Number(x.dataset.d)));
      if ((x = d('[data-f-aus]'))) return this.aendern(() => F.ausruestungUmschalten(this.t, Number(x.dataset.s), x.dataset.fAus));
      if ((x = d('[data-f-trinken]'))) return this.aendern(() => F.trinken(this.t, this.cfg, Number(x.dataset.fTrinken)));
      if ((x = d('[data-f-w42]'))) return this.aendern(() => F.startWurf(this.t, Number(x.dataset.fW42)));
      if ((x = d('[data-f-zeigen]'))) { const f = this.t.felder[this.t.spieler[Number(x.dataset.fZeigen)].feld]; if (f) { const c = pixel(f.coord, SE); this.zeigeWelt(c.x, c.y, 1); } return; }
      if ((x = d('[data-f-amzug]'))) return this.aendern(() => F.amZug(this.t, Number(x.dataset.fAmzug)));
      if ((x = d('[data-f-hand]'))) return this.handAktion(x.dataset.fHand, Number(x.dataset.s), Number(x.dataset.n));
      if ((x = d('[data-panel-klapp]'))) { const p = this.t.spieler[Number(x.dataset.panelKlapp)]; return this.aendern(() => { p.panel.offen = !p.panel.offen; }); }
      if ((x = d('[data-marker-weg]'))) return this.aendern(() => F.markerWeg(this.t, x.dataset.markerWeg));
      if ((x = d('[data-w]'))) return this.aendern(() => F.wuerfeln(this.t, x.dataset.w));
      if ((x = d('.figur[data-figur]'))) { const i = Number(x.dataset.figur); this.figurGewaehlt = this.figurGewaehlt === i ? null : i; this.render(); return; }
      if ((x = d('.feld[data-feld]'))) return this.feldKlick(x.dataset.feld);
      if (this.werkzeug === 'marker' && !d('.spieler-panel, .stapel, .offen-karte, .marker, .wuerfelschale')) { const w = this.weltPunkt(e.clientX, e.clientY); this.aendern(() => F.markerDazu(this.t, Math.round(w.x), Math.round(w.y))); }
    });
    // Klick auf leere Tischfläche (ausserhalb der Welt-Inhalte) setzt ebenfalls Marker.
    tisch.addEventListener('click', (e) => {
      if (this.gezogen || this.werkzeug !== 'marker' || e.target.closest('.welt-inhalt > *')) return;
      const w = this.weltPunkt(e.clientX, e.clientY);
      this.aendern(() => F.markerDazu(this.t, Math.round(w.x), Math.round(w.y)));
    });
    inhalt.addEventListener('change', (e) => {
      const el = e.target;
      if (el.dataset.fName !== undefined) this.aendern(() => F.nameSetzen(this.t, Number(el.dataset.fName), el.value));
      if (el.dataset.fRolle !== undefined) this.aendern(() => F.charakterSetzen(this.t, this.cfg, Number(el.dataset.fRolle), el.value));
    });
    inhalt.addEventListener('focusout', (e) => {
      const el = e.target;
      if (el.dataset?.markerText) { F.markerText(this.t, el.dataset.markerText, el.innerText.trim() || 'Notiz'); this.speichern(); }
    });
    tisch.addEventListener('contextmenu', (e) => {
      // Rechtsklick auf ein Feld oder auf eine Figur (dann deren Feld) öffnet das Feld-Menü.
      const figur = e.target.closest('.figur[data-figur]');
      const key = figur ? this.t.spieler[Number(figur.dataset.figur)]?.feld : e.target.closest('.feld[data-feld]')?.dataset.feld;
      if (!key) return;
      e.preventDefault();
      this.feldMenue(e.clientX, e.clientY, key);
    });
  }

  feldKlick(key) {
    const f = this.t.felder[key];
    if (!f) return;
    if (this.werkzeug === 'pinsel' && this.edit) return this.aendern(() => F.biomSetzen(this.t, key, this.pinselBiom, this.cfg.brett.plaettchen));
    if (this.werkzeug === 'nebel') return this.aendern(() => (f.aufgedeckt ? F.verdecken(this.t, key) : F.aufdecken(this.t, this.cfg, key)));
    if (this.werkzeug !== 'auswahl') return;
    if (this.figurGewaehlt !== null) { const s = this.figurGewaehlt; this.figurGewaehlt = null; return this.aendern(() => F.figurBewegen(this.t, this.cfg, s, key)); }
    if (!f.aufgedeckt) this.aendern(() => F.aufdecken(this.t, this.cfg, key));
  }

  stapelAktion(art, id) {
    switch (art) {
      case 'ziehen': this.aendern(() => F.ziehen(this.t, this.cfg, id)); break;
      case 'mischen': this.aendern(() => F.mischen(this.t, id)); break;
      case 'zurueck': this.aendern(() => F.ablageZurueck(this.t, id)); break;
      case 'reset': if (confirm(`${F.STAPEL[id].name} zurücksetzen? Alle Karten dieses Stapels (Tisch, Hände, Ablage) kommen zurück und werden gemischt.`)) this.aendern(() => F.stapelZuruecksetzen(this.t, id)); break;
      case 'karte': this.karteDialog(id); break;
      case 'ablage': this.ablageDialog(id); break;
      default:
    }
  }

  offenAktion(art, i) {
    const o = this.t.offen[i];
    if (!o) return;
    if (art === 'hand') this.aendern(() => F.offenZuHand(this.t, this.cfg, i, this.t.aktiv));
    else if (art === 'ablage') this.aendern(() => F.offenAblage(this.t, this.cfg, i));
    else this.grossZeigen(o.karte);
  }

  handAktion(art, s, n) {
    const k = this.t.spieler[s]?.hand[n];
    if (!k) return;
    if (art === 'zeigen') this.grossZeigen(k);
    else if (art === 'spielen') this.aendern(() => F.handAusspielen(this.t, this.cfg, s, n));
    else this.aendern(() => F.handAblage(this.t, this.cfg, s, n));
  }

  grossZeigen(k) {
    const info = F.kartenInfo(this.cfg, k);
    dialog(`<h2>${esc(info.symbol)} ${esc(info.titel)}</h2><div class="gross-bild">${this.kartenHtml(k, 'gross')}</div>${info.text ? `<p class="buehne-text breit">${esc(info.text)}</p>` : ''}<div class="dialog-knoepfe"><button type="button" class="haupt" onclick="this.closest('dialog').close()">Schliessen</button></div>`);
  }

  // Ziehen: Figuren, offene Karten, Panels, Marker und Plättchen-Inhalte.
  zugBeginnen(e) {
    if (this.werkzeug === 'hand') return null;
    const el = e.target;
    if (el.closest('button, input, select, textarea, [contenteditable], .panel-inhalt, .stapel-knoepfe, .offen-knoepfe')) return null;
    const inhalt = $('.welt-inhalt', this.el);
    const figur = el.closest('.figur[data-figur]');
    if (figur && this.werkzeug === 'auswahl') return this.geistZiehen(Number(figur.dataset.figur), 'figur', e);
    const karte = el.closest('.offen-karte');
    if (karte) {
      const i = Number(karte.dataset.offen), o = this.t.offen[i];
      karte.classList.add('wird-gezogen');
      return {
        bewegen: (ev, dx, dy) => { karte.style.left = `${o.x + dx}px`; karte.style.top = `${o.y + dy}px`; },
        ende: (ev, bewegt) => {
          karte.classList.remove('wird-gezogen');
          if (!bewegt) return;
          karte.style.pointerEvents = 'none';
          const ziel = document.elementFromPoint(ev.clientX, ev.clientY);
          const panel = ziel?.closest('.spieler-panel');
          const stapel = ziel?.closest('[data-stapel]');
          if (panel) this.aendern(() => F.offenZuHand(this.t, this.cfg, i, Number(panel.dataset.panel)));
          else if (stapel && stapel.dataset.stapel === F.stapelVon(o.karte)) this.aendern(() => F.offenAblage(this.t, this.cfg, i));
          else this.aendern(() => F.offenVerschieben(this.t, i, Math.round(o.x + (ev.clientX - e.clientX) / this.kamera.z), Math.round(o.y + (ev.clientY - e.clientY) / this.kamera.z)));
        },
      };
    }
    const kopf = el.closest('[data-panel-zieh]');
    if (kopf) {
      const s = Number(kopf.dataset.panelZieh), p = this.t.spieler[s], panel = kopf.closest('.spieler-panel');
      panel.classList.add('wird-gezogen');
      return {
        bewegen: (ev, dx, dy) => { panel.style.left = `${p.panel.x + dx}px`; panel.style.top = `${p.panel.y + dy}px`; },
        ende: (ev, bewegt) => { panel.classList.remove('wird-gezogen'); if (bewegt) this.aendern(() => { p.panel.x = Math.round(parseFloat(panel.style.left)); p.panel.y = Math.round(parseFloat(panel.style.top)); }); },
      };
    }
    const marker = el.closest('.marker');
    if (marker) {
      const m = this.t.marker.find((x) => x.id === marker.dataset.marker);
      return {
        bewegen: (ev, dx, dy) => { marker.style.left = `${m.x + dx}px`; marker.style.top = `${m.y + dy}px`; },
        ende: (ev, bewegt) => { if (bewegt) this.aendern(() => { m.x = Math.round(parseFloat(marker.style.left)); m.y = Math.round(parseFloat(marker.style.top)); }); },
      };
    }
    const feld = el.closest('.feld[data-feld]');
    if (feld && this.werkzeug === 'auswahl') {
      const f = this.t.felder[feld.dataset.feld];
      if (f?.aufgedeckt && (f.tier || f.bau || (f.inhalt && f.inhalt !== 'leer' && f.biom !== 'vulkan'))) return this.geistZiehen(f.key, 'inhalt', e);
    }
    void inhalt;
    return null;
  }

  // Ein «Geist» folgt der Maus; beim Loslassen zählt das Feld darunter.
  geistZiehen(was, art, e) {
    const inhalt = $('.welt-inhalt', this.el);
    const start = this.weltPunkt(e.clientX, e.clientY);
    let geist = null;
    return {
      bewegen: (ev, dx, dy) => {
        if (!geist) {
          geist = document.createElement('div');
          geist.className = 'zieh-geist';
          if (art === 'figur') geist.innerHTML = `<span class="geist-figur" style="background:${spielerFarbe[was]}">${esc((this.t.spieler[was].name.match(/(\d+)$/)?.[1]) ?? this.t.spieler[was].name.slice(0, 2))}</span>`;
          else { const f = this.t.felder[was]; const src = f.tier ? bild.tier(f.tier) : f.bau ? bild.marker(f.bau.art) : bild.vorne(f); geist.innerHTML = src ? `<img src="${src}" alt=""/>` : '❔'; }
          inhalt.appendChild(geist);
        }
        geist.style.left = `${start.x + dx}px`; geist.style.top = `${start.y + dy}px`;
      },
      ende: (ev, bewegt) => {
        geist?.remove();
        if (!bewegt) return;
        const ziel = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.feld[data-feld]');
        if (art === 'figur') { if (ziel) this.aendern(() => F.figurBewegen(this.t, this.cfg, was, ziel.dataset.feld)); return; }
        if (ziel && ziel.dataset.feld !== was) this.aendern(() => F.inhaltVerschieben(this.t, was, ziel.dataset.feld));
        else if (!ziel) this.aendern(() => F.inhaltEntfernen(this.t, was));
      },
    };
  }

  // ---------------- Kontextmenü auf Feldern ----------------
  menueZu() { this.menue?.remove(); this.menue = null; }

  feldMenue(x, y, key) {
    this.menueZu();
    const f = this.t.felder[key];
    const m = document.createElement('div');
    m.className = 'kontext-menue';
    m.setAttribute('role', 'menu');
    const name = f.aufgedeckt ? (f.tier ? TIER[f.tier]?.name : INHALT[f.inhalt] ?? f.inhalt) : 'verdecktes Feld';
    const titel = `${f.kuestenNr !== null ? `Strandfeld ${f.kuestenNr}` : `Feld ${key}`} · ${BIOM[f.biom]} · ${name}`;
    const haupt = () => {
      m.classList.remove('breit');
      m.innerHTML = `<div class="km-titel">${esc(titel)}</div>
        ${f.aufgedeckt ? '<button type="button" data-km="verdecken">🌫 Verdecken</button>' : '<button type="button" data-km="aufdecken">👁 Aufdecken</button>'}
        <button type="button" data-km="entfernen">🧹 Inhalt entfernen</button>
        <button type="button" data-km="aendern">✏️ Inhalt ändern …</button>
        <button type="button" data-km="lagerfeuer">🔥 Lagerfeuer setzen</button>
        <button type="button" data-km="shelter">⛺ Shelter setzen</button>
        ${f.bau ? '<button type="button" data-km="bauweg">✖ Bau entfernen</button>' : ''}
        ${this.figurGewaehlt !== null ? `<button type="button" data-km="figur">🧍 ${esc(this.t.spieler[this.figurGewaehlt].name)} hierher</button>` : ''}`;
    };
    const aendern = () => {
      m.classList.add('breit');
      const inhalte = Object.keys(this.cfg.brett.plaettchen[f.biom] ?? {}).filter((i) => i !== 'tier');
      const tiere = [...Object.keys(this.cfg.tiere.klein), ...Object.keys(this.cfg.tiere.gross)];
      m.innerHTML = `<div class="km-titel"><button type="button" class="km-zurueck" data-km="zurueck" title="Zurück">←</button> Inhalt von ${esc(f.kuestenNr !== null ? `Strandfeld ${f.kuestenNr}` : `Feld ${key}`)}</div>
        <div class="km-raster"><div class="km-gruppe"><b>${esc(BIOM[f.biom])}</b>${inhalte.map((i) => `<button type="button" data-inhalt="${i}">${esc(INHALT[i] ?? i)}${i === 'vulkanfels' ? ' (mit Kompass)' : ''}</button>`).join('')}<button type="button" data-inhalt="tier">Tierfeld (Tier beim Aufdecken)</button></div>
        <div class="km-gruppe"><b>Tier direkt</b>${tiere.map((x) => `<button type="button" data-tier="${x}"><img src="${bild.tier(x)}" alt="" width="18" height="18"/> ${esc(TIER[x]?.name ?? x)}</button>`).join('')}</div></div>`;
    };
    const platzieren = () => {
      const r = m.getBoundingClientRect();
      m.style.left = `${Math.max(8, Math.min(x, innerWidth - r.width - 8))}px`;
      m.style.top = `${Math.max(8, Math.min(y, innerHeight - r.height - 8))}px`;
    };
    haupt();
    m.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      e.stopPropagation();
      const km = b.dataset.km;
      if (km === 'aendern') { aendern(); platzieren(); return; }
      if (km === 'zurueck') { haupt(); platzieren(); return; }
      this.menueZu();
      if (km === 'aufdecken') this.aendern(() => F.aufdecken(this.t, this.cfg, key));
      else if (km === 'verdecken') this.aendern(() => F.verdecken(this.t, key));
      else if (km === 'entfernen') this.aendern(() => F.inhaltEntfernen(this.t, key));
      else if (km === 'lagerfeuer' || km === 'shelter') this.aendern(() => F.bauSetzen(this.t, key, km));
      else if (km === 'bauweg') this.aendern(() => F.bauSetzen(this.t, key, null));
      else if (km === 'figur') { const s = this.figurGewaehlt; this.figurGewaehlt = null; this.aendern(() => F.figurBewegen(this.t, this.cfg, s, key)); }
      else if (b.dataset.inhalt) this.aendern(() => (b.dataset.inhalt === 'tier' ? Object.assign(f, { inhalt: 'tier', tier: null, aufgedeckt: false }) && F.log(this.t, `setzt Feld ${key} auf ein verdecktes Tierfeld`) : F.inhaltSetzen(this.t, key, b.dataset.inhalt)));
      else if (b.dataset.tier) this.aendern(() => F.inhaltSetzen(this.t, key, 'tier', b.dataset.tier));
    });
    document.body.appendChild(m);
    platzieren();
    this.menue = m;
    $('button', m)?.focus();
    const zu = (e) => { if (!m.contains(e.target)) { this.menueZu(); document.removeEventListener('pointerdown', zu, true); } };
    setTimeout(() => document.addEventListener('pointerdown', zu, true), 0);
  }

  // ---------------- Dialoge ----------------
  ablageDialog(id) {
    const st = this.t.stapel[id];
    const d = dialog(`<h2>${F.STAPEL[id].symbol} Ablage: ${F.STAPEL[id].name} <span class="hinweis">${st.ablage.length} Karten</span></h2>
      ${st.ablage.length ? `<div class="ablage-raster">${st.ablage.map((k, n) => `<figure>${this.kartenHtml(k, 'mini')}<button type="button" data-zurueck-tisch="${n}">Auf den Tisch</button></figure>`).join('')}</div>` : '<p class="hinweis">Die Ablage ist leer.</p>'}
      <div class="dialog-knoepfe"><button type="button" class="haupt" id="abZu">Schliessen</button></div>`, { breit: true });
    $('#abZu', d).addEventListener('click', dialogZu);
    for (const b of $$('[data-zurueck-tisch]', d)) b.addEventListener('click', () => {
      const n = Number(b.dataset.zurueckTisch);
      this.aendern(() => { const [k] = st.ablage.splice(n, 1); this.t.offen.push({ karte: k, x: -830 + (this.t.offen.length % 3) * 126, y: -470 }); F.log(this.t, `holt «${F.kartenInfo(this.cfg, k).titel}» von der Ablage`); });
      dialogZu();
    });
  }

  karteDialog(stapel = 'spezial') {
    const d = dialog(`<h2>＋🃏 Eigene Karte</h2>
      <form class="formular-dialog" id="karteForm" novalidate>
        <div class="formular-zeile"><label for="kfStapel">Stapel</label><span><select id="kfStapel">${Object.entries(F.STAPEL).filter(([id]) => id !== 'tier' && id !== 'rohstoff').map(([id, s]) => `<option value="${id}" ${id === stapel ? 'selected' : ''}>${s.symbol} ${s.name}</option>`).join('')}</select></span></div>
        <div class="formular-zeile"><label for="kfSymbol">Symbol</label><span><input id="kfSymbol" maxlength="4" value="⭐" class="kurz"/></span></div>
        <div class="formular-zeile"><label for="kfTitel">Titel</label><span><input id="kfTitel" maxlength="40" required placeholder="z. B. Kokosnuss"/></span></div>
        <div class="formular-zeile oben"><label for="kfText">Text</label><span><textarea id="kfText" rows="3" maxlength="200" placeholder="Was passiert?"></textarea></span></div>
        <p id="kfMeldung" class="fehler" aria-live="polite"></p>
        <div class="dialog-knoepfe"><button type="button" onclick="this.closest('dialog').close()">Abbrechen</button><button type="submit" class="haupt">Karte auf den Stapel legen</button></div>
      </form>`);
    $('#kfTitel', d).focus();
    $('#karteForm', d).addEventListener('submit', (e) => {
      e.preventDefault();
      const titel = $('#kfTitel', d).value.trim();
      if (!titel) { $('#kfMeldung', d).textContent = 'Bitte einen Titel eingeben.'; $('#kfTitel', d).focus(); return; }
      this.aendern(() => F.eigeneKarte(this.t, $('#kfStapel', d).value, { titel, text: $('#kfText', d).value.trim(), symbol: $('#kfSymbol', d).value.trim() }));
      dialogZu();
    });
  }

  wuerfelDialog() {
    const d = dialog(`<h2>🎲 Würfelschale</h2><div class="wuerfel-wahl"><button type="button" data-dw="W3" class="haupt">W3</button><button type="button" data-dw="W6" class="haupt">W6</button><button type="button" data-dw="W42" class="haupt">W42</button></div><div class="wuerfel-ergebnis" id="wErgebnis">Wähle einen Würfel.</div><div class="dialog-knoepfe"><button type="button" onclick="this.closest('dialog').close()">Schliessen</button></div>`);
    for (const b of $$('[data-dw]', d)) b.addEventListener('click', () => {
      const art = b.dataset.dw;
      const wert = this.aendern(() => F.wuerfeln(this.t, art));
      $('#wErgebnis', d).innerHTML = `<div class="wuerfel gross w-${art}"><span class="w-art">${art}</span><span class="w-wert">${wert}</span></div>`;
    });
  }

  tierjagdDialog() {
    const d = dialog(`<h2>🐾 Tierjagd</h2><p>Zieht ein Tier aus dem Beutel und würfelt W6 + Bonus (Waffe, Jäger, Karten).</p>
      <div class="formular-zeile"><label for="jagdBonus">Bonus</label><span><select id="jagdBonus">${[0, 1, 2, 3, 4].map((n) => `<option value="${n}">+${n}</option>`).join('')}</select> <span class="hinweis">Tiere im Beutel: <b id="jagdRest">${this.t.stapel.tier.karten.length}</b></span></span></div>
      <div id="jagdErgebnis"></div>
      <div class="dialog-knoepfe"><button type="button" onclick="this.closest('dialog').close()">Schliessen</button><button type="button" class="haupt" id="jagdLos">Tier ziehen und kämpfen</button></div>`);
    $('#jagdLos', d).addEventListener('click', () => {
      const r = this.aendern(() => F.tierjagd(this.t, this.cfg, Number($('#jagdBonus', d).value)));
      const bonus = Number($('#jagdBonus', d).value);
      $('#jagdRest', d).textContent = this.t.stapel.tier.karten.length;
      $('#jagdErgebnis', d).innerHTML = r ? `<div class="jagd-zeile"><img class="jagd-tier" src="${bild.tier(r.tier)}" alt=""/><div><div class="wuerfel gross w-W6"><span class="w-art">W6</span><span class="w-wert">${r.wurf}</span></div>
        <p><b>${esc(TIER[r.tier]?.name ?? r.tier)}: ${r.wurf} + ${bonus} = ${r.wurf + bonus}</b> (nötig ${r.ziel}) → ${r.sieg ? `✅ Sieg: ${r.nahrung} Nahrung` : `❌ Niederlage${r.schaden ? `: −${r.schaden} Herz` : ', kein Schaden'}`}</p></div></div>` : '<p class="hinweis">Der Tierbeutel ist leer.</p>';
    });
  }

  rezepteDialog() {
    const c = this.cfg;
    dialog(`<h2>📜 Rezepte</h2><table class="tabelle"><thead><tr><th>Gegenstand</th><th>Kosten</th><th>Wirkung</th></tr></thead><tbody>${Object.entries(c.crafting.rezepte).filter(([, r]) => r.aktiv).map(([id, r]) => `<tr><td>${rezeptSymbol(id)} <b>${rezeptName(id)}</b></td><td>${rohstoffText(r.kosten)}</td><td>${esc(rezeptWirkung(c, id))}</td></tr>`).join('')}</tbody></table>
      <div class="dialog-knoepfe"><button type="button" class="haupt" onclick="this.closest('dialog').close()">Schliessen</button></div>`, { breit: true });
  }

  fluchtDialog() {
    const c = this.cfg, fw = c.fluchtwege;
    const zeilen = [1, 2, 3, 4].map((n) => { const f = fw.feuer.tabelle[n]; return `<tr><td><b>${n}</b> ${n === 1 ? 'Figur' : 'Figuren'}</td><td>${rohstoffText(mal(fw.floss.solide.proPerson, n))}</td><td>${rohstoffText(mal(fw.floss.not.proPerson, n))}</td><td>${f ? `${f.feuer} Feuer, Abstand ≥ ${f.abstand}` : '–'}</td><td>${fw.wrack.brennsprit ? 'Brennsprit + ' : ''}${rohstoffText(mal(fw.wrack.proPerson, n))}</td></tr>`; }).join('');
    dialog(`<h2>🚩 Fluchtwege</h2><p>Kosten pro fliehende Figur mal Anzahl fliehender Figuren (Koop = alle, Team = 2, PvP = 1). Küstenfeuer auf den Strandfeldern 1–${STRANDRING}, Abstand rundum gezählt.</p>
      <table class="tabelle"><thead><tr><th>Fliehende</th><th>🛶 Solides Floss</th><th>🛶 Not-Floss</th><th>🔥 Küstenfeuer-Kette</th><th>✈️ Flugzeugwrack</th></tr></thead><tbody>${zeilen}</tbody></table>
      <div class="dialog-knoepfe"><button type="button" class="haupt" onclick="this.closest('dialog').close()">Schliessen</button></div>`, { breit: true });
  }

  szenarienDialog() {
    const liste = speicher.lesen(SZENARIEN, []);
    const d = dialog(`<h2>💾 Szenarien</h2>
      <div class="zeile"><input id="szName" maxlength="40" placeholder="Name, z. B. Playtest Runde 2" style="flex:1"/><button type="button" class="haupt" id="szSpeichern">Tisch speichern</button></div>
      <table class="tabelle"><tbody>${liste.length ? liste.map((s) => `<tr><td><b>${esc(s.name)}</b></td><td class="hinweis">${esc(s.datum)}</td><td><button type="button" data-sz-laden="${esc(s.name)}">Laden</button> <button type="button" data-sz-weg="${esc(s.name)}">Löschen</button></td></tr>`).join('') : '<tr><td class="hinweis">Noch keine Szenarien gespeichert.</td></tr>'}</tbody></table>
      <p class="hinweis">Szenarien werden in diesem Browser gespeichert. Für andere Geräte: <button type="button" id="szExport" class="klein">⬇ als Datei speichern</button></p>
      <div class="dialog-knoepfe"><button type="button" onclick="this.closest('dialog').close()">Schliessen</button></div>`, { breit: true });
    $('#szSpeichern', d).addEventListener('click', () => {
      const name = $('#szName', d).value.trim() || `Szenario ${liste.length + 1}`;
      speicher.schreiben(SZENARIEN, [...liste.filter((s) => s.name !== name), { name, datum: new Date().toLocaleString('de-CH'), daten: { tisch: this.t, cfg: this.cfg } }]);
      F.log(this.t, `speichert das Szenario «${name}»`); this.speichern();
      this.szenarienDialog();
    });
    for (const b of $$('[data-sz-laden]', d)) b.addEventListener('click', () => {
      const s = liste.find((x) => x.name === b.dataset.szLaden);
      if (!s) return;
      this.aendern(() => { this.t = klon(s.daten.tisch); this.cfg = klon(s.daten.cfg); F.log(this.t, `lädt das Szenario «${s.name}»`); });
      dialogZu();
    });
    for (const b of $$('[data-sz-weg]', d)) b.addEventListener('click', () => { speicher.schreiben(SZENARIEN, liste.filter((x) => x.name !== b.dataset.szWeg)); this.szenarienDialog(); });
    $('#szExport', d).addEventListener('click', () => herunterladen(`insel-survival-v11-tisch-${this.t.seed}.json`, JSON.stringify({ tisch: this.t, cfg: this.cfg })));
  }

  protokollDialog() {
    const p = this.t.protokoll;
    const d = dialog(`<h2>📋 Playtest-Protokoll <span class="hinweis">${p.length} Einträge</span></h2>
      <p class="hinweis">Hält fest, was am Tisch passiert: gezogene Karten, Würfe, geänderte Werte, Bewegungen. Neueste oben.</p>
      <div class="zeile"><button type="button" id="prKopieren">Als Text kopieren</button><button type="button" id="prCsv">Als CSV speichern</button><button type="button" id="prLeeren">Leeren</button><span id="prMeldung" class="hinweis" aria-live="polite"></span></div>
      <div class="protokoll-rahmen"><table class="tabelle"><thead><tr><th>Nr.</th><th>Zeit</th><th>Tag</th><th>Am Zug</th><th>Ereignis</th></tr></thead><tbody>${p.length ? [...p].reverse().map((e) => `<tr><td>${e.nr}</td><td>${e.zeit}</td><td>${e.tag}</td><td>${esc(e.spieler)}</td><td>${esc(e.text)}</td></tr>`).join('') : '<tr><td colspan="5" class="hinweis">Noch nichts protokolliert.</td></tr>'}</tbody></table></div>
      <div class="dialog-knoepfe"><button type="button" class="haupt" onclick="this.closest('dialog').close()">Schliessen</button></div>`, { breit: true });
    const meldung = (t) => { $('#prMeldung', d).textContent = t; };
    $('#prKopieren', d).addEventListener('click', () => {
      const text = p.map((e) => `${e.nr}. ${e.zeit} · Tag ${e.tag} · ${e.spieler}: ${e.text}`).join('\n');
      (navigator.clipboard?.writeText(text) ?? Promise.reject()).then(() => meldung('Kopiert.'), () => meldung('Kopieren nicht erlaubt – bitte die Tabelle markieren und kopieren.'));
    });
    $('#prCsv', d).addEventListener('click', () => { herunterladen(`insel-survival-v11-playtest-${new Date().toISOString().slice(0, 10)}.csv`, F.protokollCsv(this.t), 'text/csv;charset=utf-8'); meldung('CSV gespeichert (Download-Ordner).'); });
    $('#prLeeren', d).addEventListener('click', () => { if (confirm('Protokoll wirklich leeren?')) { this.aendern(() => { this.t.protokoll = []; }); this.protokollDialog(); } });
  }
}
