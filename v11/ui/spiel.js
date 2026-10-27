// Spieltisch im Browser: alle drei Modi, Menschen und Bots gemischt, Tempo bis «Sehr langsam».
import { $, $$, esc, herunterladen, dialog, dialogZu } from './dom.js';
import { app, teilKonfig } from './zustand.js';
import { klon, ROHSTOFFE, rohstoffText } from '../engine/config.js';
import {
  erlaubteAktionen, entscheider, craftGrund, flossGrund, wrackGrund, trinkenGrund, feuerZaehlt, ketteInfo, routenBesitzer,
  zielStrand, flossKosten, wrackKosten, kasseGesamt, kasseAufFeld, handelPartner, rezeptKosten, kampfBonus, tierZiel, siegChance,
  beuteKategorien, MODUS_NAME, TEAM_NAMEN,
} from '../engine/engine.js';
import { gruppe, herzenMax, fliehende, istGross } from '../engine/kern.js';
import { sicht } from '../engine/sicht.js';
import { tagesKarteDef } from '../engine/effekte.js';
import { STRANDRING } from '../engine/brett.js';
import { Spielleiter } from '../sim/spielleiter.js';
import { zusammenfassungAus } from '../sim/simulation.js';
import { brettSvg, HALB } from './brett.js';
import { bild, spielerFarbe } from './bilder.js';
import { spezialKarte, tagesKarte, rueckseite, routenKarte } from './karten.js';
import { ROHSTOFF, ROHSTOFF_SYMBOL, REZEPT, TIER, ENDE, BIOM } from '../engine/namen.js';
import { STUFEN } from '../bots/bot.js';

const TEMPO = { schnell: 60, normal: 350, langsam: 900 };
const TEAM_SYMBOL = ['☀️', '🌙'];

export function neuesSpiel() {
  app.partie?.beenden();
  app.partie = new Partie(app.cfg, app.sitze);
}

export function spielZeigen(el) {
  if (!app.partie) {
    el.innerHTML = `<div class="ansicht"><div class="kasten"><h2>Keine Partie</h2><p>Stelle im Reiter «Setup» Modus, Spieler und Regler ein und starte dann die Partie.</p><button type="button" class="haupt" id="zumSetup">Zum Setup</button></div></div>`;
    $('#zumSetup', el).addEventListener('click', () => app.reiter('setup'));
    return;
  }
  app.partie.einhaengen(el);
}

class Partie {
  constructor(cfg, sitze) {
    this.cfg = klon(cfg);
    const seed = this.cfg.match.seed ?? Math.floor(Math.random() * 1e6) + 1;
    this.cfg.match.seed = seed;
    this.sitze = sitze.map((s) => ({ name: s.name, ki: s.ki, stufe: s.stufe, persoenlichkeit: s.persoenlichkeit ?? {} }));
    this.sl = new Spielleiter(this.cfg, { seed, modus: this.cfg.match.modus, sitze: this.sitze, echtzeit: true });
    this.spur = [];
    this.gesehenEreignis = this.sl.s.ereignisse.at(-1)?.nr ?? 0;
    this.gesehenTag = null;
    this.logLaenge = 0;
    this.kamera = { x: 0, y: 0, b: 2 * HALB };
    this.warteAufWeiter = false;
    this.buehne = [];
    this.timer = null;
    this.letzterMensch = this.sitze.findIndex((s) => !s.ki);
    this.uebergabeFuer = null;
    this.endeGezeigt = false;
    this.meldung = null;
    this.handelOffen = false;
  }

  beenden() { clearTimeout(this.timer); this.beendet = true; }

  einhaengen(el) {
    this.el = el;
    el.innerHTML = `<div class="tisch">
      <div class="leiste" id="leiste"></div>
      <div class="brett-platz" id="brettPlatz"><div class="zoom"><button type="button" data-zoom="rein">＋</button><button type="button" data-zoom="raus">−</button><button type="button" data-zoom="mitte">⌖</button></div><div id="brettSvg"></div></div>
      <aside class="seite" id="seite"></aside>
      <section class="protokoll" id="protokoll" aria-label="Spielprotokoll"></section>
    </div>`;
    this.brettBedienung();
    this.render();
    this.weiter();
  }

  // Für wen wird der Tisch gezeigt? (Hot-Seat: der Mensch am Zug, sonst der letzte Mensch; nur Bots: alles offen)
  betrachter() {
    const s = this.sl.s;
    const w = entscheider(s);
    if (!this.sitze[w]?.ki) return w;
    return this.letzterMensch >= 0 ? this.letzterMensch : null;
  }
  sichtFuer(i) { return i === null ? this.sl.s : sicht(this.sl.s, i); }

  // ---------------- Ablauf ----------------
  weiter() {
    clearTimeout(this.timer);
    if (this.beendet || app.partie !== this) return;
    const s = this.sl.s;
    if (s.ende) { this.render(); if (!this.endeGezeigt) { this.endeGezeigt = true; setTimeout(() => this.endeDialog(), 500); } return; }
    if (this.buehneOffen()) return;
    if (this.sl.istBotDran()) {
      const art = app.tempo.art;
      if (art === 'weiter') { this.warteAufWeiter = true; this.renderLeiste(); return; }
      const ms = art === 'auto' ? app.tempo.pause * 1000 : TEMPO[art] ?? 350;
      this.timer = setTimeout(() => this.botSchritt(), ms);
      return;
    }
    // Mensch: bei mehreren Menschen in Team/PvP erst übergeben
    const w = entscheider(s);
    const menschen = this.sitze.filter((x) => !x.ki).length;
    if (menschen > 1 && s.modus !== 'koop' && this.uebergabeFuer !== `${s.tag}:${w}:${s.zug.phase === 'beute'}`) {
      this.uebergabeFuer = `${s.tag}:${w}:${s.zug.phase === 'beute'}`;
      this.uebergabeDialog(w);
    }
    this.letzterMensch = w;
    this.render();
  }

  botSchritt() {
    if (app.partie !== this || this.sl.s.ende) return;
    this.warteAufWeiter = false;
    const s = this.sl.s;
    const wer = entscheider(s), von = s.spieler[wer].feld;
    try { this.sl.botSchritt(); } catch (e) { console.error('KI-Fehler', e); this.sl.abbrechen(); }
    const nach = this.sl.s.spieler[wer].feld;
    if (von !== nach) this.spur = [...this.spur.filter((x) => x.spieler !== wer), { spieler: wer, von, nach }].slice(-4);
    this.nachAenderung();
    this.weiter();
  }

  mensch(a) {
    const s = this.sl.s;
    const wer = entscheider(s), von = s.spieler[wer].feld;
    if (a.typ === 'craften' && a.rezept === 'lagerfeuer' && feuerZaehlt(s, s.spieler[wer].feld) === false && !confirm('Dieses Lagerfeuer verletzt den Mindestabstand und zählt nicht zur Küstenfeuer-Kette (es wärmt und heilt aber). Trotzdem bauen?')) return;
    const f = this.sl.menschAktion(a);
    if (f) { this.meldung = f; this.render(); return; }
    this.meldung = null;
    if (s.spieler[wer].feld !== von) this.spur = this.spur.filter((x) => x.spieler !== wer);
    this.nachAenderung();
    this.weiter();
  }

  // Neue Tageskarten und Spezialkarten in der Tischmitte zeigen.
  nachAenderung() {
    const s = this.sl.s;
    const b = this.betrachter();
    const sv = b === null ? s : sicht(s, b);
    const neu = [];
    if (s.tagesKarte !== this.gesehenTag) {
      this.gesehenTag = s.tagesKarte;
      const d = tagesKarteDef(s);
      neu.push({ titel: `☀️ Tag ${s.tag}`, html: tagesKarte(this.cfg, s.tagesKarte), text: d?.text ?? '' });
    }
    for (const e of sv.ereignisse) {
      if (e.nr <= this.gesehenEreignis) continue;
      this.gesehenEreignis = e.nr;
      const name = esc(s.spieler[e.spieler].name);
      if (e.art === 'gezogen') neu.push({ titel: `🂠 ${name} zieht eine Handkarte`, html: e.karte ? spezialKarte(this.cfg, e.karte) : rueckseite('spezial'), text: e.karte ? 'auf die Hand' : 'verdeckt', farbe: spielerFarbe[e.spieler] });
      else if (e.art === 'route') neu.push({ titel: `🧭 ${name} zieht eine Routenkarte`, html: routenKarte(e.karte, !!e.karte), text: e.ergebnis, farbe: spielerFarbe[e.spieler] });
      else neu.push({ titel: e.art === 'gespielt' ? `▶ ${name} spielt eine Karte aus` : `❗ ${name} zieht eine Sofort-Karte`, html: spezialKarte(this.cfg, e.karte), text: e.ergebnis, farbe: spielerFarbe[e.spieler] });
    }
    if (neu.length) this.buehneZeigen(neu);
    this.render();
  }

  buehneOffen() { return !$('#buehne').hidden; }
  buehneZeigen(karten) {
    const el = $('#buehne');
    this.buehne = [...(el.hidden ? [] : this.buehne), ...karten].slice(-6);
    const auto = this.sl.istBotDran() && app.tempo.art !== 'weiter';
    const ms = auto ? Math.max(600, (app.tempo.art === 'auto' ? app.tempo.pause * 1000 : TEMPO[app.tempo.art] ?? 350) + 700) : null;
    el.innerHTML = `<div class="buehne-rahmen" role="dialog" aria-label="Karten in der Tischmitte"><div class="buehne-karten">${this.buehne.map((k) => `<figure class="buehne-platz" style="--farbe:${k.farbe ?? 'transparent'}"><figcaption>${k.titel}</figcaption>${k.html}<div class="buehne-text">${esc(k.text ?? '')}</div></figure>`).join('')}</div>
      <div class="buehne-fuss"><button type="button" class="haupt" id="buehneOk">OK</button><span class="hinweis">${ms ? `schliesst von selbst nach ${Math.round(ms / 1000)} s` : 'Enter oder Klick schliesst'}</span></div></div>`;
    el.hidden = false;
    const zu = () => { clearTimeout(this.buehneTimer); el.hidden = true; this.buehne = []; document.removeEventListener('keydown', taste, true); this.weiter(); };
    const taste = (e) => { if (['Enter', ' ', 'Escape'].includes(e.key)) { e.preventDefault(); zu(); } };
    $('#buehneOk').addEventListener('click', zu);
    el.onclick = (e) => { if (e.target === el) zu(); };
    document.addEventListener('keydown', taste, true);
    clearTimeout(this.buehneTimer);
    if (ms) this.buehneTimer = setTimeout(zu, ms);
  }

  uebergabeDialog(w) {
    const p = this.sl.s.spieler[w];
    const d = dialog(`<h2><span class="punkt" style="background:${spielerFarbe[w]}"></span>${esc(p.name)} ist dran</h2><p class="hinweis">Bitte das Gerät weitergeben. Deine Rohstoffe und Karten werden erst nach dem Bestätigen sichtbar.</p><div class="dialog-knoepfe"><button type="button" class="haupt" id="los">Los geht's</button></div>`);
    $('#los', d).addEventListener('click', () => { dialogZu(); this.render(); });
  }

  // ---------------- Darstellung ----------------
  render() {
    if (!this.el || app.aktuellerReiter() !== 'spiel') return;
    this.renderLeiste(); this.renderBrett(); this.renderSeite(); this.renderProtokoll();
  }

  renderLeiste() {
    const s = this.sl.s, d = tagesKarteDef(s);
    const gesamt = s.tag + s.tagesStapel.length;
    const tempo = [['schnell', 'schnell'], ['normal', 'normal'], ['langsam', 'langsam'], ['auto', 'sehr langsam – Auto (jeder Schritt)'], ['weiter', 'sehr langsam – Weiter-Knopf']];
    const wer = entscheider(s);
    const p = s.spieler[wer];
    const hinweis = s.ende ? `<b>Partie zu Ende:</b> ${esc(ENDE[s.ende.grund] ?? s.ende.grund)}` : `<span class="punkt" style="background:${spielerFarbe[wer]}"></span><b>${esc(p.name)}</b> ${this.sitze[wer].ki ? `🤖 (${STUFEN[this.sitze[wer].stufe]?.name ?? ''})` : ''} · ${phaseText(s)}${this.sl.bots[wer]?.ziel ? ` · <span class="hinweis">plant: ${esc(this.sl.bots[wer].ziel.text)}</span>` : ''}${this.meldung ? ` <span class="fehler">💡 ${esc(this.meldung)}</span>` : ''}`;
    $('#leiste', this.el).innerHTML = `<span class="tag">Tag ${s.tag} / ${gesamt}</span>
      <button type="button" class="klein" id="tagKarte" title="${esc(d?.text ?? '')}">${esc(d?.symbol ?? '')} ${esc(d?.name ?? '')}</button>
      <span class="hinweis">${esc(MODUS_NAME[s.modus])} · Seed ${s.seed}</span>
      <span class="hinweisleiste">${hinweis}</span>
      <label class="hinweis">KI-Tempo <select id="tempo">${tempo.map(([k, n]) => `<option value="${k}" ${app.tempo.art === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="hinweis" ${app.tempo.art === 'auto' ? '' : 'hidden'}>Pause <select id="pause">${[1, 2, 3, 4, 5].map((n) => `<option ${app.tempo.pause === n ? 'selected' : ''}>${n}</option>`).join('')}</select> s</label>
      ${this.warteAufWeiter ? '<button type="button" class="haupt" id="kiWeiter" title="Nächster KI-Schritt (Enter)">Weiter ▶</button>' : ''}
      <button type="button" class="klein" id="export" title="Spielprotokoll für den Abgleich mit der Simulation">⬇ Protokoll</button>
      <button type="button" class="klein" id="neu">Neue Partie …</button>`;
    $('#tempo', this.el).addEventListener('change', (e) => { app.tempo.art = e.target.value; app.tempoSpeichern(); this.warteAufWeiter = false; this.renderLeiste(); this.weiter(); });
    $('#pause', this.el)?.addEventListener('change', (e) => { app.tempo.pause = Number(e.target.value); app.tempoSpeichern(); });
    $('#kiWeiter', this.el)?.addEventListener('click', () => this.botSchritt());
    $('#tagKarte', this.el).addEventListener('click', () => this.buehneZeigen([{ titel: `☀️ Tag ${s.tag}`, html: tagesKarte(this.cfg, s.tagesKarte), text: d?.text ?? '' }]));
    $('#export', this.el).addEventListener('click', () => this.exportieren());
    $('#neu', this.el).addEventListener('click', () => app.reiter('setup'));
    if (!this.tasteWeiter) {
      this.tasteWeiter = (e) => { if (app.partie === this && this.warteAufWeiter && (e.key === 'Enter' || e.key === ' ') && !$('#dialog').open && !this.buehneOffen()) { e.preventDefault(); this.botSchritt(); } };
      document.addEventListener('keydown', this.tasteWeiter);
    }
  }

  zielFelder() {
    const s = this.sl.s;
    if (s.ende || this.sitze[entscheider(s)]?.ki) return new Map();
    const m = new Map();
    for (const a of erlaubteAktionen(s)) if (['bewegen', 'aufdecken', 'fliehen'].includes(a.typ)) m.set(a.feld, a);
    return m;
  }

  renderBrett() {
    const s = this.sl.s, b = this.betrachter(), sv = this.sichtFuer(b);
    const ziele = this.zielFelder();
    const g = b === null ? gruppe(s, s.aktiv) : gruppe(s, b);
    const info = ketteInfo(s, g);
    const nr = new Map(Object.values(s.felder).filter((f) => f.kuestenNr !== null).map((f) => [f.kuestenNr, f.key]));
    const richtungSichtbar = b === null || (sv.spieler[routenBesitzer(s, g) ?? 0]?.route ?? 'verdeckt') !== 'verdeckt';
    const svg = brettSvg(sv, {
      ziele: new Set(ziele.keys()),
      kette: { gueltig: new Set(info.kette.map((n) => nr.get(n))), ungueltig: new Set(info.ungueltig.map((n) => nr.get(n))) },
      spur: this.spur, sammelfeld: s.sammelfeld,
      zielStrand: richtungSichtbar ? new Set(zielStrand(s, g)) : new Set(),
      hervor: this.sitze[entscheider(s)]?.ki ? s.spieler[s.aktiv].feld : null,
    });
    const platz = $('#brettSvg', this.el);
    platz.innerHTML = svg;
    this.kameraSetzen();
    for (const f of $$('.feld.ziel', platz)) f.addEventListener('click', () => { const a = ziele.get(f.dataset.feld); if (a) this.mensch(a); });
  }

  kameraSetzen() {
    const svg = $('#brettSvg svg', this.el);
    if (!svg) return;
    const k = this.kamera;
    svg.setAttribute('viewBox', `${k.x - k.b / 2} ${k.y - k.b / 2} ${k.b} ${k.b}`);
  }

  brettBedienung() {
    const platz = $('#brettPlatz', this.el);
    platz.addEventListener('wheel', (e) => { e.preventDefault(); this.kamera.b = Math.max(120, Math.min(2 * HALB * 1.2, this.kamera.b * (e.deltaY > 0 ? 1.12 : 0.89))); this.kameraSetzen(); }, { passive: false });
    let zug = null;
    platz.addEventListener('pointerdown', (e) => { if (e.target.closest('.feld.ziel, button')) return; zug = { x: e.clientX, y: e.clientY, kx: this.kamera.x, ky: this.kamera.y }; platz.classList.add('zieht'); });
    window.addEventListener('pointermove', (e) => {
      if (!zug) return;
      const svg = $('#brettSvg svg', this.el); if (!svg) return;
      const f = this.kamera.b / svg.clientWidth;
      this.kamera.x = zug.kx - (e.clientX - zug.x) * f; this.kamera.y = zug.ky - (e.clientY - zug.y) * f; this.kameraSetzen();
    });
    window.addEventListener('pointerup', () => { zug = null; platz.classList.remove('zieht'); });
    for (const b of $$('[data-zoom]', platz)) b.addEventListener('click', () => {
      if (b.dataset.zoom === 'rein') this.kamera.b *= 0.8; else if (b.dataset.zoom === 'raus') this.kamera.b = Math.min(2 * HALB * 1.2, this.kamera.b * 1.25); else this.kamera = { x: 0, y: 0, b: 2 * HALB };
      this.kameraSetzen();
    });
  }

  renderSeite() {
    const s = this.sl.s, b = this.betrachter(), sv = this.sichtFuer(b);
    const wer = entscheider(s);
    const teile = [];
    if (!s.ende && !this.sitze[wer].ki) teile.push(this.aktionenHtml());
    else if (!s.ende) teile.push(`<div class="panel" style="--farbe:${spielerFarbe[wer]}"><header>🤖 ${esc(s.spieler[wer].name)} ist dran</header><div class="hinweis">${phaseText(s)}${this.sl.bots[wer]?.ziel ? `<br>plant: ${esc(this.sl.bots[wer].ziel.text)}` : ''}</div></div>`);
    teile.push(this.flossHtml(sv, b));
    teile.push(this.ketteHtml(s, b));
    sv.spieler.forEach((p, i) => teile.push(this.spielerHtml(sv, p, i, b)));
    const seite = $('#seite', this.el);
    const scroll = seite.scrollTop;
    seite.innerHTML = teile.join('');
    seite.scrollTop = scroll;
    for (const k of $$('[data-aktion]', seite)) k.addEventListener('click', () => this.mensch(JSON.parse(k.dataset.aktion)));
    $('#handelKnopf', seite)?.addEventListener('click', () => this.handelDialog());
    for (const k of $$('[data-charakter]', seite)) k.addEventListener('click', () => dialog(`<img class="charakter-bild" style="max-width:520px" src="${bild.charakter(k.dataset.charakter)}" alt=""/><div class="dialog-knoepfe"><button type="button" onclick="this.closest('dialog').close()">Schliessen</button></div>`));
  }

  aktionenHtml() {
    const s = this.sl.s, wer = entscheider(s), p = s.spieler[wer];
    const ak = erlaubteAktionen(s);
    const hat = (a) => ak.some((x) => JSON.stringify(x) === JSON.stringify(a));
    const knopf = (a, text, haupt = false, grund = null) => (hat(a) ? `<button type="button" class="${haupt ? 'haupt' : ''}" data-aktion='${esc(JSON.stringify(a))}'>${text}</button>` : grund ? `<button type="button" disabled title="${esc(grund)}">${text}</button>` : '');
    const z = s.zug, teile = [];
    switch (z.phase) {
      case 'weitsicht_wuerfeln': teile.push(`<p><b>1 · Weitsicht</b> W${s.cfg.zug.weitsicht.wuerfel} würfeln, dann Kacheln im Umkreis ${z.weitsichtRadius} aufdecken.</p>`, knopf({ typ: 'wuerfeln' }, '🎲 Würfeln', true)); break;
      case 'weitsicht_waehlen': teile.push(`<p><b>Aufdecken</b>: noch ${z.weitsichtOffen} markierte Kachel${z.weitsichtOffen === 1 ? '' : 'n'} anklicken${z.aufdeckenQuelle ? ` (${esc(z.aufdeckenQuelle)})` : ''}.</p>`); break;
      case 'kampf': {
        const k = z.kampf, chance = Math.round(100 * siegChance(tierZiel(s, k.tier), kampfBonus(s, p)));
        teile.push(`<p><img src="${bild.tier(k.tier)}" width="48" style="vertical-align:middle" alt=""/> <b>Kampf gegen ${esc(TIER[k.tier]?.name)}</b>: W6 + ${kampfBonus(s, p)} ≥ ${tierZiel(s, k.tier)} (${chance} %). Niederlage: ${istGross(s, k.tier) || k.hinterhalt ? 'Schaden, ' : 'kein Schaden, '}${k.hinterhalt || k.steht ? 'du bleibst stehen' : 'zurück aufs Herkunftsfeld'}, der Zug endet.${k.blind ? ' <b>Keine Flucht</b> (blind betreten oder Hinterhalt).' : ' Oder markiertes Feld anklicken = Flucht.'}</p>`, knopf({ typ: 'kaempfen' }, '⚔️ Kämpfen', true));
        break;
      }
      case 'wahl': teile.push(`<p><b>${esc(z.wahl.quelle)}</b>: wähle</p>`, ...z.wahl.optionen.map((o) => knopf({ typ: 'wahl', index: o.index }, esc(o.name)))); break;
      case 'beute': teile.push(`<p><b>Duell gewonnen!</b> Wähle die Beute von ${esc(s.spieler[z.beute.von].name)}:</p>`, ...beuteKategorien(s, z.beute.von).map((w) => knopf({ typ: 'beute', wahl: w }, { rohstoff: '🪵 Rohstoff (blind)', spezial: '🂠 Spezialkarte (blind)', route: '🧭 Routenkarte' }[w]))); break;
      default: {
        teile.push('<p class="hinweis">Feld anklicken = gehen. Abbau beendet die Bewegung. Trinken beendet den Zug.</p>');
        teile.push('<div class="aktionen">', knopf({ typ: 'abbauen' }, '⛏ Abbauen'), knopf({ typ: 'trinken' }, '💧 Trinken (Zugende)', false, trinkenGrund(s) === 'kein Wasserfeld' ? null : trinkenGrund(s)), knopf({ typ: 'essen' }, '🍖 Essen'), knopf({ typ: 'kompassBergen' }, '🧭 Kompass bergen'), '</div>');
        teile.push('<div class="aktionen">', ...Object.keys(s.cfg.crafting.rezepte).filter((r) => s.cfg.crafting.rezepte[r].aktiv).map((r) => knopf({ typ: 'craften', rezept: r }, `${REZEPT[r]?.symbol ?? ''} ${REZEPT[r]?.name ?? r} <span class="grund">${rohstoffText(rezeptKosten(s, p, r))}</span>`, false, craftGrund(s, r))), '</div>');
        const flucht = [knopf({ typ: 'flossBauen', art: 'solide' }, '🛶 Solides Floss', true, flossGrund(s, 'solide')), knopf({ typ: 'flossBauen', art: 'not' }, '🛶 Not-Floss (W6)', false, flossGrund(s, 'not')), knopf({ typ: 'wrackReparieren' }, '✈️ Wrack reparieren', true, wrackGrund(s))];
        teile.push('<div class="aktionen">', ...flucht, '</div>');
        const extra = ak.filter((a) => ['reanimieren', 'sammelfeld', 'angreifen', 'duell'].includes(a.typ)).map((a) => knopf(a, a.typ === 'reanimieren' ? `🩹 ${esc(s.spieler[a.ziel].name)} reanimieren` : a.typ === 'sammelfeld' ? `📍 Sammelfeld Strand ${s.felder[a.feld].kuestenNr}` : a.typ === 'angreifen' ? `⚔️ ${esc(s.spieler[a.ziel].name)} angreifen` : `⚔️ Duell-Karte gegen ${esc(s.spieler[a.ziel].name)}`));
        if (extra.length) teile.push('<div class="aktionen">', ...extra, '</div>');
        teile.push('<div class="aktionen">', handelPartner(s).length ? '<button type="button" id="handelKnopf">🤝 Handeln / Schenken</button>' : '', knopf({ typ: 'zugBeenden' }, z.schritte === 0 ? `Zug beenden (rasten)` : 'Zug beenden', true), '</div>');
      }
    }
    const joker = ak.filter((a) => a.typ === 'joker');
    if (joker.length) teile.push(`<div class="aktionen"><span class="hinweis">Handkarten:</span>${joker.map((a) => knopf(a, `${esc(s.cfg.spezialkarten.karten[a.karte]?.name)}: ${esc(s.cfg.spezialkarten.karten[a.karte]?.ausspielen.find((o) => o.wahl === a.wahl)?.name ?? a.wahl)}`)).join('')}</div>`);
    return `<div class="panel aktiv" style="--farbe:${spielerFarbe[wer]}"><header>${esc(p.name)} ist dran</header>${teile.join('')}</div>`;
  }

  spielerHtml(sv, p, i, b) {
    const s = this.sl.s;
    const team = p.team ?? null;
    const char = p.charakter ? s.cfg.charaktere[p.charakter] : null;
    const hand = p.hand ? `<div class="rohstoffe">${ROHSTOFFE.map((r) => `<span class="${p.hand[r] ? '' : 'null'}" title="${ROHSTOFF[r]}">${ROHSTOFF_SYMBOL[r]} ${p.hand[r]}</span>`).join('')}</div>` : `<div class="hinweis">🂠 ${p.anzahlRohstoffe ?? Object.values(s.spieler[i].hand).reduce((a, x) => a + x, 0)} Rohstoffe verdeckt</div>`;
    const karten = p.karten ? (p.karten.length ? `<div class="handkarten">${p.karten.map((k) => `<div class="handkarte">${spezialKarte(s.cfg, k)}</div>`).join('')}</div>` : '') : (p.anzahlKarten ? `<div class="handkarten">${Array.from({ length: p.anzahlKarten }, () => `<div class="handkarte">${rueckseite('spezial')}</div>`).join('')}</div>` : '');
    const route = p.route ? `<div class="zeile"><div class="handkarte">${routenKarte(p.route, p.route !== 'verdeckt')}</div><span>🧭 Routenkarte ${p.route === 'verdeckt' ? '(Richtung geheim)' : `– Abschnitt <b>${esc(p.route)}</b>`}</span></div>` : '';
    const werkzeug = ['axt', 'hacke'].filter((w) => p.ausruestung[w]).map((w) => `<img src="${bild.werkzeug(w)}" alt="${w}" title="${w === 'axt' ? 'Steinaxt' : 'Spitzhacke'}"/>`).join('') + (p.ausruestung.waffe ? `<img src="${bild.werkzeug(p.ausruestung.waffe)}" alt="Waffe" title="${esc(REZEPT[p.ausruestung.waffe]?.name)}"/>` : '');
    const status = p.ausgeschieden ? ' <span class="fehler">✖ ausgeschieden</span>' : p.liegt ? ' <span class="fehler">🩹 am Boden</span>' : '';
    const max = herzenMax(s, s.spieler[i]);
    return `<div class="panel${i === s.aktiv && !s.ende ? ' aktiv' : ''}" style="--farbe:${spielerFarbe[i]}">
      <header><span class="punkt" style="background:${spielerFarbe[i]}"></span>${esc(p.name)} ${this.sitze[i].ki ? '🤖' : '🧑'}${team !== null ? ` ${TEAM_SYMBOL[team]} ${TEAM_NAMEN[team]}` : ''}${status}</header>
      <div class="werte"><span><img src="${bild.herz}" alt=""/> ${p.herzen}/${max}</span><span><img src="${bild.energie}" alt=""/> ${p.energie}/${s.cfg.figur.energie}</span>${char ? `<span class="hinweis" data-charakter="${p.charakter}" style="cursor:pointer" title="Charakterkarte zeigen">${esc(char.symbol)} ${esc(char.name)}</span>` : '<span class="hinweis">Charakter verdeckt</span>'}</div>
      ${hand}${werkzeug ? `<div class="ausruestung">${werkzeug}</div>` : ''}${route}${karten}</div>`;
  }

  flossHtml(sv, b) {
    const s = this.sl.s;
    const g = gruppe(s, b ?? s.aktiv);
    if (!s.cfg.fluchtwege.floss.aktiv && !s.cfg.fluchtwege.wrack.aktiv) return '';
    const kasse = sv.spieler.every((p, k) => !g.includes(k) || p.hand) ? kasseGesamt(s, g) : null;
    const zeile = (name, kosten) => `<tr><td>${name}</td>${ROHSTOFFE.filter((r) => kosten[r]).map((r) => `<td class="${kasse && kasse[r] >= kosten[r] ? 'ok' : ''}">${ROHSTOFF_SYMBOL[r]} ${kasse ? `${Math.min(kasse[r], kosten[r])}/` : ''}${kosten[r]}</td>`).join('')}</tr>`;
    const besitzer = routenBesitzer(s, g);
    const route = besitzer === null ? 'Routenkarte fehlt (Kompass mit der Spitzhacke bergen)' : `Routenkarte bei ${esc(s.spieler[besitzer].name)}${sv.spieler[besitzer].route !== 'verdeckt' ? `: Abschnitt <b>${esc(sv.spieler[besitzer].route)}</b>` : ''}`;
    return `<div class="panel"><header>🛶 Floss und ✈️ Wrack <span class="hinweis">für ${fliehende(s)} Person${fliehende(s) === 1 ? '' : 'en'}</span></header>
      <table class="tabelle">${s.cfg.fluchtwege.floss.aktiv ? zeile('Solide', flossKosten(s, 'solide')) + (s.cfg.fluchtwege.floss.not.aktiv ? zeile('Not-Floss', flossKosten(s, 'not')) : '') : ''}${s.cfg.fluchtwege.wrack.aktiv ? zeile(`Wrack${s.cfg.fluchtwege.wrack.brennsprit ? ' + 🧪' : ''}`, wrackKosten(s)) : ''}</table>
      <ul class="haken"><li>${besitzer === null ? '○' : '✓'} ${route}</li>${s.modus === 'koop' && s.sammelfeld ? `<li>📍 Sammelfeld Strand ${s.felder[s.sammelfeld].kuestenNr}</li>` : ''}${tagesKarteDef(s)?.effekte?.some((e) => e.typ === 'flossSperre') ? '<li class="fehler">Sturm: heute keine Floss-Flucht</li>' : ''}</ul></div>`;
  }

  ketteHtml(s, b) {
    if (!s.cfg.fluchtwege.feuer.aktiv) return '';
    const gruppen = s.modus === 'koop' ? [s.spieler.map((_, k) => k)] : s.modus === 'team' ? [0, 1].map((t) => s.spieler.flatMap((p, k) => (s.teams[t].includes(p.id) ? [k] : []))) : s.spieler.flatMap((p, k) => (p.ausgeschieden ? [] : [[k]]));
    const teile = gruppen.map((g) => {
      const info = ketteInfo(s, g);
      const name = s.modus === 'koop' ? 'Gruppe' : s.modus === 'team' ? `${TEAM_SYMBOL[s.spieler[g[0]].id === s.teams[0][0] || s.teams[0].includes(s.spieler[g[0]].id) ? 0 : 1]} Team` : `<span class="punkt" style="background:${spielerFarbe[g[0]]}"></span>${esc(s.spieler[g[0]].name)}`;
      return `<div class="zeile">${ringSvg(info)}<div><b>${name}</b> <span class="hinweis">${info.feuer} Feuer, Abstand ≥ ${info.abstand}</span><div class="${info.fertig ? 'ok' : ''}">${info.kette.length} von ${info.feuer} Feuern</div><div>${info.kette.map((n) => `<span class="feuer-nr gueltig">${n}</span>`).join('')}${info.ungueltig.map((n) => `<span class="feuer-nr verletzt" title="verletzt den Abstand, zählt nicht">${n}</span>`).join('')}</div></div></div>`;
    });
    void b;
    return `<div class="panel"><header>🔥 Küstenfeuer-Kette</header><div class="hinweis">Strand 1–42 rundum (42 → 1 = 1) · ${s.modus === 'koop' ? 'alle Feuer gehören der Gruppe' : s.modus === 'team' ? 'nur Feuer des eigenen Teams' : 'nur eigene Feuer'} · Feuer bleiben stehen</div>${teile.join('')}</div>`;
  }

  renderProtokoll() {
    const s = this.sl.s;
    const el = $('#protokoll', this.el);
    const unten = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    const ab = Math.max(0, s.log.length - 400);
    el.innerHTML = `<b>📜 Spielprotokoll</b> <span class="hinweis">${s.log.length} Einträge</span><ol start="${ab + 1}">${s.log.slice(ab).map((l, k) => `<li class="${ab + k >= this.logLaenge ? 'neu' : ''}">${esc(l)}</li>`).join('')}</ol>`;
    this.logLaenge = s.log.length;
    if (unten) el.scrollTop = el.scrollHeight;
  }

  handelDialog() {
    const s = this.sl.s, ich = s.aktiv, p = s.spieler[ich];
    const partner = handelPartner(s);
    const max = s.cfg.zug.handel.maxKarten;
    const zeilen = ROHSTOFFE.map((r) => `<tr><td>${ROHSTOFF_SYMBOL[r]} ${ROHSTOFF[r]}</td><td><input type="number" min="0" max="${p.hand[r]}" value="0" data-gebe="${r}"/></td><td><input type="number" min="0" max="${max}" value="0" data-erhalte="${r}"/></td></tr>`).join('');
    const d = dialog(`<h2>🤝 Handeln oder schenken</h2><p class="hinweis">Höchstens ${max} Karten pro Seite, 1 Mal pro Zug, Umkreis ${s.cfg.zug.handel.radius}. Erhalte nichts = Geschenk.</p>
      <label>Mit <select id="mit">${partner.map((k) => `<option value="${k}">${esc(s.spieler[k].name)}</option>`).join('')}</select></label>
      <table class="tabelle"><tr><th></th><th>Ich gebe</th><th>Ich erhalte</th></tr>${zeilen}
      <tr><td>🧪 Brennsprit</td><td><input type="checkbox" id="bgebe"/></td><td><input type="checkbox" id="berhalte"/></td></tr>
      <tr><td>🧭 Routenkarte</td><td><input type="checkbox" id="rgebe"/></td><td><input type="checkbox" id="rerhalte"/></td></tr></table>
      <p id="handelMeldung" class="hinweis"></p>
      <div class="dialog-knoepfe"><button type="button" id="abbrechen">Abbrechen</button><button type="button" class="haupt" id="anbieten">Anbieten</button></div>`);
    $('#abbrechen', d).addEventListener('click', dialogZu);
    $('#anbieten', d).addEventListener('click', () => {
      const gebe = {}, erhalte = {};
      for (const i of $$('[data-gebe]', d)) if (Number(i.value) > 0) gebe[i.dataset.gebe] = Number(i.value);
      for (const i of $$('[data-erhalte]', d)) if (Number(i.value) > 0) erhalte[i.dataset.erhalte] = Number(i.value);
      const a = { typ: 'handeln', mit: Number($('#mit', d).value), gebe, erhalte };
      if ($('#bgebe', d).checked) a.brennsprit = 'gebe'; else if ($('#berhalte', d).checked) a.brennsprit = 'erhalte';
      if ($('#rgebe', d).checked) a.route = 'gebe'; else if ($('#rerhalte', d).checked) a.route = 'erhalte';
      let r = this.sl.handeln(a);
      if (r.offen) {
        const ja = confirm(`${s.spieler[a.mit].name}: Angebot von ${p.name} annehmen?\nDu gibst: ${rohstoffText(erhalte)}${a.brennsprit === 'erhalte' ? ' + Brennsprit' : ''}${a.route === 'erhalte' ? ' + Routenkarte' : ''}\nDu bekommst: ${rohstoffText(gebe)}${a.brennsprit === 'gebe' ? ' + Brennsprit' : ''}${a.route === 'gebe' ? ' + Routenkarte' : ''}`);
        r = this.sl.handeln(a, ja);
      }
      $('#handelMeldung', d).textContent = r.angenommen ? `✓ ${r.grund}` : `✗ ${r.grund}`;
      if (r.angenommen) { setTimeout(dialogZu, 700); this.nachAenderung(); }
    });
  }

  exportieren() {
    const s = this.sl.s;
    const prot = { ...this.sl.protokoll(teilKonfig(this.cfg, app.standard)), konfig: this.cfg, zusammenfassung: zusammenfassungAus(s), exportiert: new Date().toISOString() };
    herunterladen(`insel-survival-v11-partie-${s.seed}.json`, JSON.stringify(prot));
  }

  endeDialog() {
    const s = this.sl.s, e = s.ende;
    if (!e || app.partie !== this) return;
    const sieg = e.gewinner.length > 0;
    const zeilen = s.spieler.map((p, i) => `<tr><td><span class="punkt" style="background:${spielerFarbe[i]}"></span>${esc(p.name)} ${this.sitze[i].ki ? '🤖' : ''}</td><td>${esc(s.cfg.charaktere[p.charakter]?.name ?? '')}</td><td>${e.gewinner.includes(p.id) ? '🏆 gewonnen' : p.ausgeschieden ? '✖ ausgeschieden' : p.liegt ? '🩹 am Boden' : '🌋 verloren'}</td><td>${'♥'.repeat(Math.max(0, p.herzen))}</td></tr>`).join('');
    const d = dialog(`<h2>${sieg ? '🎉' : '🌋'} ${esc(ENDE[e.grund] ?? e.grund)}</h2><p class="hinweis">${esc(MODUS_NAME[s.modus])} · Tag ${e.tag} · Seed ${s.seed}</p>
      <table class="tabelle"><tr><th>Spieler</th><th>Charakter</th><th>Ergebnis</th><th>Herzen</th></tr>${zeilen}</table>
      <div class="dialog-knoepfe"><button type="button" id="dZu">Tisch ansehen</button><button type="button" id="dExport">⬇ Protokoll</button><button type="button" id="dReplay">⏯ Replay</button><button type="button" class="haupt" id="dNeu">Neue Partie …</button></div>`);
    $('#dZu', d).addEventListener('click', dialogZu);
    $('#dExport', d).addEventListener('click', () => this.exportieren());
    $('#dReplay', d).addEventListener('click', () => { dialogZu(); app.replayProtokoll = { ...this.sl.protokoll(), konfig: this.cfg }; app.reiter('replay'); });
    $('#dNeu', d).addEventListener('click', () => { dialogZu(); app.partie = null; app.reiter('setup'); });
  }
}

export function phaseText(s) {
  const z = s.zug;
  return { weitsicht_wuerfeln: 'Weitsicht würfeln', weitsicht_waehlen: 'Kacheln aufdecken', bewegung: 'Bewegung und Aktionen', aktion: 'Aktionen (nach dem Abbau)', kampf: `Kampf gegen ${TIER[z.kampf?.tier]?.name ?? 'ein Tier'}`, wahl: 'Wahl treffen', beute: 'Duell-Beute wählen' }[z.phase] ?? z.phase;
}

export function ringSvg(info) {
  const pos = (n, r = 36) => { const w = ((n - 1) / STRANDRING) * 2 * Math.PI; return { x: 48 + Math.sin(w) * r, y: 48 - Math.cos(w) * r }; };
  const boegen = info.luecken.map((l) => {
    const a = pos(l.von), c = pos(l.von + l.laenge), gross = l.laenge > STRANDRING / 2 ? 1 : 0;
    return `<path class="${l.gueltig ? 'gueltig' : 'verletzt'}" style="fill:none" d="M ${a.x.toFixed(1)} ${a.y.toFixed(1)} A 36 36 0 ${gross} 1 ${c.x.toFixed(1)} ${c.y.toFixed(1)}"><title>${l.von} → ${((l.von + l.laenge - 1) % STRANDRING) + 1}: Abstand ${l.laenge}</title></path>`;
  }).join('');
  const punkte = [...info.kette.map((n) => [n, 'gueltig']), ...info.ungueltig.map((n) => [n, 'verletzt'])].map(([n, k]) => { const p = pos(n); return `<circle class="${k}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4"><title>Feuer auf Strandfeld ${n}</title></circle>`; }).join('');
  const zahlen = [1, 11, 22, 32].map((n) => { const p = pos(n, 45); return `<text x="${p.x.toFixed(1)}" y="${(p.y + 2.5).toFixed(1)}">${n}</text>`; }).join('');
  return `<svg class="ring-leiste" viewBox="0 0 96 96" aria-hidden="true"><circle class="ring" cx="48" cy="48" r="36"/>${boegen}${punkte}${zahlen}</svg>`;
}

export { kasseAufFeld, BIOM };
