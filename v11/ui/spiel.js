// Spieltisch im Browser wie in V10: Tisch mit Zoom und Verschieben (die Seite scrollt nicht), Brett in der Mitte,
// Stapel links, Spieler-Panels rechts, Seitenleiste mit Floss-Tableau und Gruppe, Protokoll-Box, Zoomleiste und Minimap.
// Alle drei Modi, Menschen und Bots gemischt, Tempo bis «Sehr langsam».
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
import { pixel } from '../engine/hex.js';
import { Spielleiter } from '../sim/spielleiter.js';
import { zusammenfassungAus } from '../sim/simulation.js';
import { brettSvg, HALB, SE } from './brett.js';
import { bild, spielerFarbe } from './bilder.js';
import { spezialKarte, tagesKarte, rueckseite, routenKarte } from './karten.js';
import { ROHSTOFF, ROHSTOFF_SYMBOL, REZEPT, TIER, ENDE, BIOM } from '../engine/namen.js';
import { STUFEN } from '../bots/bot.js';

const TEMPO = { schnell: 60, normal: 350, langsam: 900 };
const TEAM_SYMBOL = ['☀️', '🌙'];

// Welt-Koordinaten in Pixeln, Brettmitte = (0, 0).
const B = 420; // halbe Brettgrösse (Brett etwa 2,6 Panels breit wie in V10)
const WELT = { x: -800, y: -470, w: 1960, h: 1260 }; // alles, was auf dem Tisch liegt
const PANEL_ORT = [[460, -420], [800, -420], [460, 200], [800, 200]];
const ZOOM = { min: 0.12, max: 2.5 };
// Lage der Zahlenreihe auf der Spielerkarte (Originalbild 1752 × 1068), wie V10.
const KARTE = { breite: 1752, hoehe: 1068, zahl0: 0.121, zahl6: 0.491, herzY: 0.66, energieY: 0.861, chip: 0.056 };

export function neuesSpiel() {
  app.partie?.beenden();
  app.partie = new Partie(app.cfg, app.sitze);
}

export function spielZeigen(el) {
  if (!app.partie) {
    el.innerHTML = `<div class="tisch leer"><div class="leer-tisch"><img class="vorschau-brett" src="${bild.brett}" alt="" draggable="false"/><button type="button" class="haupt gross" id="zumStart">＋ Neue Partie</button></div></div>`;
    $('#zumStart', el).addEventListener('click', () => app.neuePartieDialog());
    $('#hinweisleiste').innerHTML = '<span class="was-jetzt">Noch keine Partie – im Dialog «Neue Partie» Modus und Spieler wählen und auf «Partie starten» klicken.</span>';
    return;
  }
  app.partie.einhaengen(el);
}

// Charakter-Fähigkeit in einem Satz, aus der Konfiguration.
function charakterText(cfg, id) {
  const c = cfg.charaktere[id];
  if (!c) return '';
  switch (id) {
    case 'ueberlebenskuenstler': return `${c.herzen} Herzen statt ${cfg.figur.herzen}`;
    case 'jaeger': return `+${c.kampf} im Tierkampf`;
    case 'kundschafter': return `+${c.kacheln} Kachel bei der Weitsicht`;
    case 'laeufer': return `bei 0 Energie noch ${c.zusatzfelder} Zusatzfeld (1× pro Zug)`;
    case 'sanitaeter': return `Bandage kostet nur ${rohstoffText(c.bandageKosten)}`;
    case 'sammlerin': return `beim Abbau W${c.wuerfel}: ab ${c.schwelle} +${c.bonus} Rohstoff`;
    default: return '';
  }
}

const teamIndex = (s, i) => (s.teams ? (s.teams[0].includes(s.spieler[i].id) ? 0 : 1) : null);

// Chip auf der Zahlenreihe der Spielerkarte (0 bis 6), Lage in Prozent wie V10.
function chipOrt(wert, art) {
  const x = (KARTE.zahl0 + ((KARTE.zahl6 - KARTE.zahl0) * Math.max(0, Math.min(6, wert))) / 6) * 100;
  const y = (art === 'herz' ? KARTE.herzY : KARTE.energieY) * 100;
  const w = KARTE.chip * 100, h = ((KARTE.chip * KARTE.breite) / KARTE.hoehe) * 100;
  return `left:${(x - w / 2).toFixed(2)}%;top:${(y - h / 2).toFixed(2)}%;width:${w.toFixed(2)}%;height:${h.toFixed(2)}%`;
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
    this.kamera = null; // { x, y, z }: Bildschirm = Welt · z + (x, y)
    this.panelZu = new Set();
    this.leisteZu = false;
    this.logZu = false;
    this.warteAufWeiter = false;
    this.buehne = [];
    this.timer = null;
    this.letzterMensch = this.sitze.findIndex((s) => !s.ki);
    this.uebergabeFuer = null;
    this.endeGezeigt = false;
    this.meldung = null;
  }

  beenden() { clearTimeout(this.timer); this.beendet = true; }

  einhaengen(el) {
    this.el = el;
    el.innerHTML = `
      <div id="tisch" class="tisch"><div class="welt"><div class="welt-inhalt"></div></div></div>
      <div class="unten-links">
        <div class="zoomleiste" aria-label="Zoom">
          <button type="button" data-zoom="raus" title="Herauszoomen">−</button>
          <button type="button" data-zoom="wert" title="Ansicht zentrieren">100 %</button>
          <button type="button" data-zoom="rein" title="Hineinzoomen">+</button>
          <button type="button" data-zoom="voll" title="Vollbild">⛶</button>
        </div>
        <div id="minimap" class="minimap" title="Übersicht – klicken, um dorthin zu springen"></div>
      </div>
      <aside id="seitenleiste" class="seitenleiste" aria-label="Floss-Tableau und Gruppe"></aside>
      <section id="logBox" class="log-box" aria-label="Spielprotokoll"></section>`;
    this.tischBedienung();
    if (!this.kamera) requestAnimationFrame(() => { this.zentrieren(); });
    if (this.gesehenTag === null) this.nachAenderung(); else this.render();
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
      if (art === 'weiter') { this.warteAufWeiter = true; this.renderKopf(); return; }
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

  tempoGeaendert() { this.warteAufWeiter = false; this.renderKopf(); this.weiter(); }

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

  // Neue Tageskarten und Spezialkarten gross in der Tischmitte zeigen.
  nachAenderung() {
    const s = this.sl.s;
    const b = this.betrachter();
    const sv = b === null ? s : sicht(s, b);
    const neu = [];
    if (s.tagesKarte !== this.gesehenTag) {
      this.gesehenTag = s.tagesKarte;
      const d = tagesKarteDef(s);
      neu.push({ titel: `☀️ Tag ${s.tag}`, html: tagesKarte(this.cfg, s.tagesKarte, 'gross'), text: d?.text ?? '' });
    }
    for (const e of sv.ereignisse) {
      if (e.nr <= this.gesehenEreignis) continue;
      this.gesehenEreignis = e.nr;
      const name = esc(s.spieler[e.spieler].name);
      if (e.art === 'gezogen') neu.push({ titel: `🂠 ${name} zieht eine Handkarte`, html: e.karte ? spezialKarte(this.cfg, e.karte, 'gross') : rueckseite('spezial', 'gross'), text: e.karte ? 'auf die Hand' : 'verdeckt', farbe: spielerFarbe[e.spieler] });
      else if (e.art === 'route') neu.push({ titel: `🧭 ${name} zieht eine Routenkarte`, html: routenKarte(e.karte, !!e.karte, 'gross'), text: e.ergebnis, farbe: spielerFarbe[e.spieler] });
      else neu.push({ titel: e.art === 'gespielt' ? `▶ ${name} spielt eine Karte aus` : `❗ ${name} zieht eine Sofort-Karte`, html: spezialKarte(this.cfg, e.karte, 'gross'), text: e.ergebnis, farbe: spielerFarbe[e.spieler] });
    }
    if (neu.length && app.anzeige.buehne) this.buehneZeigen(neu);
    this.render();
  }

  buehneOffen() { return !$('#buehne').hidden; }
  buehneZeigen(karten) {
    const el = $('#buehne');
    this.buehne = [...(el.hidden ? [] : this.buehne), ...karten].slice(-6);
    const auto = this.sl.istBotDran() && app.tempo.art !== 'weiter';
    const ms = auto ? Math.max(600, (app.tempo.art === 'auto' ? app.tempo.pause * 1000 : TEMPO[app.tempo.art] ?? 350) + 700) : null;
    el.innerHTML = `<div class="buehne-rahmen" role="dialog" aria-label="Karten in der Tischmitte"><div class="buehne-karten">${this.buehne.map((k) => `<figure class="buehne-platz" style="--farbe:${k.farbe ?? 'var(--primaer)'}"><figcaption class="buehne-titel">${k.titel}</figcaption><div class="buehne-karte">${k.html}</div>${k.text ? `<div class="buehne-text">${esc(k.text)}</div>` : ''}</figure>`).join('')}</div>
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

  tagKarteZeigen() {
    const s = this.sl.s, d = tagesKarteDef(s);
    this.buehneZeigen([{ titel: `☀️ Tag ${s.tag}`, html: tagesKarte(this.cfg, s.tagesKarte, 'gross'), text: d?.text ?? '' }]);
  }

  uebergabeDialog(w) {
    const p = this.sl.s.spieler[w];
    const d = dialog(`<h2><span class="punkt" style="background:${spielerFarbe[w]}"></span>${esc(p.name)} ist dran</h2><p class="hinweis">Bitte das Gerät weitergeben. Deine Rohstoffe und Karten werden erst nach dem Bestätigen sichtbar.</p><div class="dialog-knoepfe"><button type="button" class="haupt" id="los">Los geht's</button></div>`);
    $('#los', d).addEventListener('click', () => { dialogZu(); this.render(); });
  }

  // ---------------- Darstellung ----------------
  render() {
    if (!this.el || app.aktuellerReiter() !== 'spiel') return;
    this.renderKopf(); this.renderTisch(); this.renderLeiste(); this.renderProtokoll(); this.minimapZeichnen();
  }

  // Toolbar (Tag, Wetter, Seed, Weiter-Knopf) und Hinweisleiste.
  renderKopf() {
    if (!this.el || app.aktuellerReiter() !== 'spiel') return;
    app.toolbar('spiel');
    const s = this.sl.s;
    const wer = entscheider(s), p = s.spieler[wer];
    const leiste = $('#hinweisleiste');
    if (s.ende) { leiste.innerHTML = `<span class="was-jetzt"><b>Partie zu Ende:</b> ${esc(ENDE[s.ende.grund] ?? s.ende.grund)} · Tag ${s.ende.tag}</span><button type="button" id="hlEnde">Ergebnis</button>`; $('#hlEnde').addEventListener('click', () => this.endeDialog()); return; }
    const ki = this.sitze[wer].ki;
    const plan = this.sl.bots[wer]?.ziel ? ` <span class="hinweis">· plant: ${esc(this.sl.bots[wer].ziel.text)}</span>` : '';
    const knoepfe = [];
    if (ki && this.warteAufWeiter) knoepfe.push('<button type="button" class="haupt" id="hlWeiter" title="Nächster KI-Schritt (Enter oder Leertaste)">Weiter ▶</button>');
    if (!ki) {
      const ak = erlaubteAktionen(s);
      const haupt = s.zug.phase === 'weitsicht_wuerfeln' ? [{ typ: 'wuerfeln' }, '🎲 Würfeln'] : s.zug.phase === 'kampf' ? [{ typ: 'kaempfen' }, '⚔️ Kämpfen'] : ['bewegung', 'aktion'].includes(s.zug.phase) ? [{ typ: 'zugBeenden' }, 'Zug beenden'] : null;
      if (haupt && ak.some((a) => JSON.stringify(a) === JSON.stringify(haupt[0]))) knoepfe.push(`<button type="button" class="haupt" data-aktion='${esc(JSON.stringify(haupt[0]))}'>${haupt[1]}</button>`);
    }
    leiste.innerHTML = `<span class="was-jetzt"><span class="punkt" style="background:${spielerFarbe[wer]}"></span><b>${esc(p.name)}</b>${ki ? ` 🤖 <span class="hinweis">(${esc(STUFEN[this.sitze[wer].stufe]?.name ?? '')})</span>` : ''}: ${esc(phaseText(s))}${ki ? plan : ` – ${esc(phaseHilfe(s))}`}</span>
      ${this.meldung ? `<span class="tipp">💡 ${esc(this.meldung)}</span>` : ''}${knoepfe.join('')}`;
    $('#hlWeiter')?.addEventListener('click', () => this.botSchritt());
    for (const k of $$('[data-aktion]', leiste)) k.addEventListener('click', () => this.mensch(JSON.parse(k.dataset.aktion)));
    if (!this.tasteWeiter) {
      this.tasteWeiter = (e) => { if (app.partie === this && this.warteAufWeiter && (e.key === 'Enter' || e.key === ' ') && !$('#dialog').open && !this.buehneOffen() && !e.target.closest?.('input, select, textarea')) { e.preventDefault(); this.botSchritt(); } };
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

  // Alles, was auf dem Tisch liegt: Brett, Stapel, Würfelschale, Vorrat, Spieler-Panels.
  renderTisch() {
    const s = this.sl.s, b = this.betrachter(), sv = this.sichtFuer(b);
    const ziele = this.zielFelder();
    const g = b === null ? gruppe(s, s.aktiv) : gruppe(s, b);
    const info = ketteInfo(s, g);
    const nr = new Map(Object.values(s.felder).filter((f) => f.kuestenNr !== null).map((f) => [f.kuestenNr, f.key]));
    const richtungSichtbar = b === null || (sv.spieler[routenBesitzer(s, g) ?? 0]?.route ?? 'verdeckt') !== 'verdeckt';
    const svg = brettSvg(sv, {
      ziele: new Set(ziele.keys()),
      kette: { gueltig: new Set(info.kette.map((n) => nr.get(n))), ungueltig: new Set(info.ungueltig.map((n) => nr.get(n))) },
      spur: app.anzeige.spur ? this.spur : [], sammelfeld: s.sammelfeld,
      zielStrand: richtungSichtbar ? new Set(zielStrand(s, g)) : new Set(),
      hervor: this.sitze[entscheider(s)]?.ki ? s.spieler[s.aktiv].feld : null,
    });
    const inhalt = $('.welt-inhalt', this.el);
    const scroll = new Map($$('.spieler-panel', inhalt).map((p) => [p.dataset.panel, $('.panel-inhalt', p)?.scrollTop ?? 0]));
    inhalt.innerHTML = `
      <div class="brett-platz" style="left:${-B}px;top:${-B}px;width:${2 * B}px;height:${2 * B}px">${svg}</div>
      <div class="auslage-titel" style="left:-770px;top:-450px">Stapel · Würfel · Vorrat</div>
      ${this.stapelHtml(sv)}
      ${sv.spieler.map((p, i) => this.panelHtml(sv, p, i, b)).join('')}`;
    for (const p of $$('.spieler-panel', inhalt)) { const i = $('.panel-inhalt', p); if (i) i.scrollTop = scroll.get(p.dataset.panel) ?? 0; }
    for (const f of $$('.feld.ziel', inhalt)) f.addEventListener('click', () => { if (this.gezogen) return; const a = ziele.get(f.dataset.feld); if (a) this.mensch(a); });
    for (const k of $$('[data-aktion]', inhalt)) k.addEventListener('click', () => this.mensch(JSON.parse(k.dataset.aktion)));
    for (const k of $$('[data-panel-klapp]', inhalt)) k.addEventListener('click', () => { const i = Number(k.dataset.panelKlapp); if (this.panelZu.has(i)) this.panelZu.delete(i); else this.panelZu.add(i); this.renderTisch(); this.minimapZeichnen(); });
    $('#handelKnopf', inhalt)?.addEventListener('click', () => this.handelDialog());
    $('[data-tageskarte]', inhalt)?.addEventListener('click', () => this.tagKarteZeigen());
    for (const k of $$('[data-gross]', inhalt)) k.addEventListener('click', () => dialog(`<h2>${esc(k.dataset.gross)}</h2><div class="gross-bild">${k.innerHTML}</div><div class="dialog-knoepfe"><button type="button" class="haupt" onclick="this.closest('dialog').close()">Schliessen</button></div>`));
    this.kameraSetzen();
  }

  stapelHtml(sv) {
    const s = this.sl.s;
    const stapel = (x, y, name, karte, zahl, extra = '') => `<div class="stapel" style="left:${x}px;top:${y}px"${extra}><div class="stapel-karten">${karte}</div><div class="stapel-name">${name}</div><div class="stapel-zahl">${zahl}</div></div>`;
    const d = tagesKarteDef(s);
    const tier = `<div class="tier-beutel">🐾<b>${s.tierBeutel.length}</b></div>`;
    const wuerfe = s.wuerfe.slice(-6);
    const letzter = wuerfe.at(-1);
    const vorrat = sv.vorrat;
    return [
      stapel(-770, -420, 'Tagesstapel', rueckseite('tag', 'mini'), `${s.tagesStapel.length} Karten`),
      stapel(-630, -420, 'Heute', `<div data-tageskarte title="${esc(d?.text ?? '')} – Klick: gross">${tagesKarte(this.cfg, s.tagesKarte, 'mini')}</div>`, `${esc(d?.symbol ?? '')} ${esc(d?.name ?? '')}`),
      stapel(-770, -200, 'Spezialkarten', rueckseite('spezial', 'mini'), `${s.spezialStapel.length} · Ablage ${s.spezialAblage.length}`),
      stapel(-630, -200, 'Ablage', s.spezialAblage.length ? `<div data-gross="Spezial-Ablage">${spezialKarte(this.cfg, s.spezialAblage.at(-1), 'mini')}</div>` : '<div class="karte mini leer"></div>', s.spezialAblage.length ? 'oberste Karte' : 'leer'),
      stapel(-770, 20, 'Routenkarten', rueckseite('route', 'mini'), `${s.routenStapel.length} Karten`),
      stapel(-630, 20, 'Tierbeutel', tier, `Ablage ${s.tierAblage.length}`),
      `<div class="wuerfelschale" style="left:-770px;top:250px"><div class="schale-titel">🎲 Würfelschale</div>
        <div class="schale-boden">${wuerfe.length ? wuerfe.map((w) => `<div class="wuerfel w-${w.wuerfel}" style="--farbe:${spielerFarbe[w.spieler] ?? 'var(--primaer)'}" title="${esc(w.zweck ?? '')}"><span class="w-art">${w.wuerfel}</span><span class="w-wert">${w.wert}</span></div>`).join('') : '<span class="leer-hinweis">leer</span>'}</div>
        <div class="schale-zweck">${letzter ? `${esc(s.spieler[letzter.spieler]?.name ?? '')}: ${esc(letzter.zweck ?? '')}` : 'Noch nicht gewürfelt'}</div></div>`,
      `<div class="vorrat-auslage" style="left:-770px;top:420px"><div class="schale-titel">📦 Materialvorrat ${vorrat ? '' : '<span class="hinweis">unbegrenzt</span>'}</div>
        <div class="rohstoff-karten">${ROHSTOFFE.map((r) => `<div class="rohstoff-karte${vorrat && !vorrat[r] ? ' null' : ''}" title="${ROHSTOFF[r]}: ${vorrat ? vorrat[r] : '∞'}"><img src="${bild.rohstoff(r)}" alt="${ROHSTOFF[r]}" draggable="false"/><b>${vorrat ? vorrat[r] : '∞'}</b></div>`).join('')}</div></div>`,
    ].join('');
  }

  panelHtml(sv, p, i, b) {
    const s = this.sl.s;
    const [x, y] = PANEL_ORT[i] ?? [460 + (i % 2) * 340, -420 + Math.floor(i / 2) * 620];
    const aktiv = i === entscheider(s) && !s.ende;
    const menschAmZug = aktiv && !this.sitze[i].ki;
    const offen = menschAmZug || !this.panelZu.has(i);
    const team = teamIndex(s, i);
    const max = herzenMax(s, s.spieler[i]);
    const status = p.ausgeschieden ? '<span class="status aus">✖ ausgeschieden</span>' : p.liegt ? '<span class="status liegt">🩹 am Boden</span>' : '';
    const kopf = `<header class="panel-kopf"><span class="punkt" style="background:${spielerFarbe[i]}"></span><b class="panel-name">${esc(p.name)}</b> ${this.sitze[i].ki ? '<span title="KI">🤖</span>' : '<span title="Mensch">🧑</span>'}${team !== null ? ` <span class="hinweis" title="${TEAM_NAMEN[team]}">${TEAM_SYMBOL[team]}</span>` : ''}${aktiv ? ' <span class="am-zug">am Zug</span>' : ''}
      <span class="panel-kurz">❤️${p.herzen} ⚡${p.energie}</span><button type="button" class="panel-klapp" data-panel-klapp="${i}" title="${offen ? 'Einklappen' : 'Aufklappen'}" ${menschAmZug ? 'disabled' : ''}>${offen ? '▾' : '▸'}</button></header>`;
    if (!offen) return `<section class="spieler-panel zu${aktiv ? ' ist-aktiv' : ''}" data-panel="${i}" style="left:${x}px;top:${y}px;--farbe:${spielerFarbe[i]}">${kopf}</section>`;
    const char = p.charakter ? s.cfg.charaktere[p.charakter] : null;
    const karte = char
      ? `<div class="spielerkarte" data-gross="${esc(char.name)}" title="${esc(`${char.name}: ${charakterText(s.cfg, p.charakter)} – Herzen ${p.herzen}, Energie ${p.energie}`)}"><img src="${bild.charakter(p.charakter)}" alt="Spielerkarte ${esc(char.name)}" draggable="false"/>
          ${p.charakter === 'laeufer' ? `<div class="faehigkeit-neu" title="Fähigkeit nach Regelstand V10">Hat er 0 Energie, darf er noch ${char.zusatzfelder} Feld gehen – einmal pro Zug.</div>` : ''}
          <img class="chip" src="${bild.herz}" alt="Herzen ${p.herzen}" style="${chipOrt(p.herzen, 'herz')}" draggable="false"/><img class="chip" src="${bild.energie}" alt="Energie ${p.energie}" style="${chipOrt(p.energie, 'energie')}" draggable="false"/></div>`
      : `<div class="spielerkarte verdeckt"><img src="${bild.charakterRueckseite}" alt="Spielerkarte (verdeckt)" draggable="false"/><div class="sk-werte"><span title="Herzen"><img src="${bild.herz}" alt=""/> ${p.herzen}/${max}</span><span title="Energie"><img src="${bild.energie}" alt=""/> ${p.energie}/${s.cfg.figur.energie}</span></div></div>`;
    const platz = (id, name, hat) => `<div class="ausruestung-karte${hat ? '' : ' leer'}" title="${esc(hat ? name : `${name}: noch nicht gebaut`)}">${hat && bild.werkzeug(id) ? `<img src="${bild.werkzeug(id)}" alt="${esc(name)}" draggable="false"/>` : `<span>${esc(name)}</span>`}</div>`;
    const waffe = p.ausruestung.waffe;
    const ausruestung = `<div class="ausruestung-karten">${platz('axt', 'Steinaxt', p.ausruestung.axt)}${platz('hacke', 'Spitzhacke', p.ausruestung.hacke)}${platz(waffe, waffe ? REZEPT[waffe]?.name ?? 'Waffe' : 'Waffe', !!waffe)}</div>`;
    const rohstoffe = p.hand
      ? `<div class="rohstoff-karten">${ROHSTOFFE.map((r) => `<div class="rohstoff-karte${p.hand[r] ? '' : ' null'}" title="${ROHSTOFF[r]}: ${p.hand[r]}"><img src="${bild.rohstoff(r)}" alt="${ROHSTOFF[r]}" draggable="false"/><b>${p.hand[r]}</b></div>`).join('')}</div>`
      : `<div class="rohstoffe verdeckt">🂠 ${p.anzahlRohstoffe ?? 0} Rohstoffe verdeckt</div>`;
    const karten = p.karten
      ? (p.karten.length ? `<div class="hand-raster">${p.karten.map((k) => `<div data-gross="${esc(s.cfg.spezialkarten.karten[k]?.name ?? k)}">${spezialKarte(s.cfg, k, 'hand')}</div>`).join('')}</div>` : '<div class="hinweis">Keine Spezialkarten</div>')
      : (p.anzahlKarten ? `<div class="hand-raster">${Array.from({ length: p.anzahlKarten }, () => rueckseite('spezial', 'hand')).join('')}</div>` : '<div class="hinweis">Keine Spezialkarten</div>');
    const route = p.route ? `<div class="route-zeile"><div class="route-karte">${routenKarte(p.route, p.route !== 'verdeckt')}</div><span>🧭 Routenkarte ${p.route === 'verdeckt' ? '(Richtung geheim)' : `– Abschnitt <b>${esc(p.route)}</b>`}</span></div>` : '';
    let aktionen = '';
    if (menschAmZug) aktionen = `<div class="panel-aktionen">${this.aktionenHtml()}</div>`;
    else if (aktiv) aktionen = `<div class="panel-aktionen"><b>🤖 ist dran</b> <span class="hinweis">${esc(phaseText(s))}${this.sl.bots[i]?.ziel ? ` · plant: ${esc(this.sl.bots[i].ziel.text)}` : ''}</span></div>`;
    void b;
    return `<section class="spieler-panel${aktiv ? ' ist-aktiv' : ''}" data-panel="${i}" style="left:${x}px;top:${y}px;--farbe:${spielerFarbe[i]}">${kopf}
      <div class="panel-inhalt">
        <div class="karten-reihe">${karte}${ausruestung}</div>
        <div class="charakter-text hinweis">${char ? `${esc(char.symbol)} <b>${esc(char.name)}</b>: ${esc(charakterText(s.cfg, p.charakter))}` : 'Charakter verdeckt'} ${status}</div>
        ${rohstoffe}
        <div class="panel-zeile"><b>Spezialkarten</b></div>${karten}${route}
      </div>${aktionen}</section>`;
  }

  aktionenHtml() {
    const s = this.sl.s, wer = entscheider(s), p = s.spieler[wer];
    const ak = erlaubteAktionen(s);
    const hat = (a) => ak.some((x) => JSON.stringify(x) === JSON.stringify(a));
    const knopf = (a, text, haupt = false, grund = null) => (hat(a) ? `<button type="button" class="${haupt ? 'haupt' : ''}" data-aktion='${esc(JSON.stringify(a))}'>${text}</button>` : grund ? `<button type="button" disabled title="${esc(grund)}">${text}</button>` : '');
    const z = s.zug, teile = [];
    switch (z.phase) {
      case 'weitsicht_wuerfeln': teile.push(`<div><b>1 · Weitsicht</b> W${s.cfg.zug.weitsicht.wuerfel} würfeln, dann Kacheln im Umkreis ${z.weitsichtRadius} aufdecken.</div>`, `<div class="knopf-reihe">${knopf({ typ: 'wuerfeln' }, '🎲 Würfeln', true)}</div>`); break;
      case 'weitsicht_waehlen': teile.push(`<div><b>Aufdecken</b>: noch ${z.weitsichtOffen} markierte Kachel${z.weitsichtOffen === 1 ? '' : 'n'} auf dem Brett anklicken${z.aufdeckenQuelle ? ` (${esc(z.aufdeckenQuelle)})` : ''}.</div>`); break;
      case 'kampf': {
        const k = z.kampf, chance = Math.round(100 * siegChance(tierZiel(s, k.tier), kampfBonus(s, p)));
        teile.push(`<div class="kampf-zeile"><img src="${bild.tier(k.tier)}" width="44" alt=""/> <span><b>Kampf gegen ${esc(TIER[k.tier]?.name)}</b>: W6 + ${kampfBonus(s, p)} ≥ ${tierZiel(s, k.tier)} (${chance} %). Niederlage: ${istGross(s, k.tier) || k.hinterhalt ? 'Schaden, ' : 'kein Schaden, '}${k.hinterhalt || k.steht ? 'du bleibst stehen' : 'zurück aufs Herkunftsfeld'}, der Zug endet.${k.blind ? ' <b>Keine Flucht</b> (blind betreten oder Hinterhalt).' : ' Oder markiertes Feld anklicken = Flucht.'}</span></div>`, `<div class="knopf-reihe">${knopf({ typ: 'kaempfen' }, '⚔️ Kämpfen', true)}</div>`);
        break;
      }
      case 'wahl': teile.push(`<div><b>${esc(z.wahl.quelle)}</b>: wähle</div>`, `<div class="knopf-reihe">${z.wahl.optionen.map((o) => knopf({ typ: 'wahl', index: o.index }, esc(o.name))).join('')}</div>`); break;
      case 'beute': teile.push(`<div><b>Duell gewonnen!</b> Wähle die Beute von ${esc(s.spieler[z.beute.von].name)}:</div>`, `<div class="knopf-reihe">${beuteKategorien(s, z.beute.von).map((w) => knopf({ typ: 'beute', wahl: w }, { rohstoff: '🪵 Rohstoff (blind)', spezial: '🂠 Spezialkarte (blind)', route: '🧭 Routenkarte' }[w])).join('')}</div>`); break;
      default: {
        teile.push('<div class="hinweis">Feld auf dem Brett anklicken = gehen. Abbau beendet die Bewegung. Trinken beendet den Zug.</div>');
        teile.push(`<div class="knopf-reihe">${knopf({ typ: 'abbauen' }, '⛏ Abbauen')}${knopf({ typ: 'trinken' }, '💧 Trinken (Zugende)', false, trinkenGrund(s) === 'kein Wasserfeld' ? null : trinkenGrund(s))}${knopf({ typ: 'essen' }, '🍖 Essen')}${knopf({ typ: 'kompassBergen' }, '🧭 Kompass bergen')}</div>`);
        teile.push(`<details class="rezepte"><summary>🛠 Craften</summary><div class="rezept-raster">${Object.keys(s.cfg.crafting.rezepte).filter((r) => s.cfg.crafting.rezepte[r].aktiv).map((r) => knopf({ typ: 'craften', rezept: r }, `${REZEPT[r]?.symbol ?? ''} ${REZEPT[r]?.name ?? r} <small>${rohstoffText(rezeptKosten(s, p, r))}</small>`, false, craftGrund(s, r))).join('')}</div></details>`);
        teile.push(`<div class="knopf-reihe">${knopf({ typ: 'flossBauen', art: 'solide' }, '🛶 Solides Floss', true, flossGrund(s, 'solide'))}${knopf({ typ: 'flossBauen', art: 'not' }, '🛶 Not-Floss (W6)', false, flossGrund(s, 'not'))}${knopf({ typ: 'wrackReparieren' }, '✈️ Wrack reparieren', true, wrackGrund(s))}</div>`);
        const extra = ak.filter((a) => ['reanimieren', 'sammelfeld', 'angreifen', 'duell'].includes(a.typ)).map((a) => knopf(a, a.typ === 'reanimieren' ? `🩹 ${esc(s.spieler[a.ziel].name)} reanimieren` : a.typ === 'sammelfeld' ? `📍 Sammelfeld Strand ${s.felder[a.feld].kuestenNr}` : a.typ === 'angreifen' ? `⚔️ ${esc(s.spieler[a.ziel].name)} angreifen` : `⚔️ Duell-Karte gegen ${esc(s.spieler[a.ziel].name)}`));
        if (extra.length) teile.push(`<div class="knopf-reihe">${extra.join('')}</div>`);
        teile.push(`<div class="knopf-reihe">${handelPartner(s).length ? '<button type="button" id="handelKnopf">🤝 Handeln / Schenken</button>' : ''}${knopf({ typ: 'zugBeenden' }, z.schritte === 0 ? 'Zug beenden (rasten)' : 'Zug beenden', true)}</div>`);
      }
    }
    const joker = ak.filter((a) => a.typ === 'joker');
    if (joker.length) teile.push(`<div class="knopf-reihe"><span class="hinweis">Handkarten:</span>${joker.map((a) => knopf(a, `${esc(s.cfg.spezialkarten.karten[a.karte]?.name)}: ${esc(s.cfg.spezialkarten.karten[a.karte]?.ausspielen.find((o) => o.wahl === a.wahl)?.name ?? a.wahl)}`)).join('')}</div>`);
    return teile.join('');
  }

  // Seitenleiste rechts: Floss-Tableau, Küstenfeuer-Kette, Gruppe. Einklappbar.
  renderLeiste() {
    const s = this.sl.s, b = this.betrachter(), sv = this.sichtFuer(b);
    const el = $('#seitenleiste', this.el);
    this.el.classList.toggle('leiste-zu', this.leisteZu);
    if (this.leisteZu) {
      el.innerHTML = `<button type="button" class="leiste-klapp" data-leiste-klapp title="Aufklappen">◂</button><div class="leiste-kurz">🛶<br>🔥<br>👥</div>`;
    } else {
      const scroll = $('.leiste-inhalt', el)?.scrollTop ?? 0;
      el.innerHTML = `<div class="leiste-kopf"><b>Floss und Spieler</b> <span class="hinweis">${esc(MODUS_NAME[s.modus])}</span><button type="button" class="leiste-klapp" data-leiste-klapp title="Einklappen (mehr Platz für das Brett)">▸</button></div>
        <div class="leiste-inhalt">${this.flossHtml(sv, b)}${this.ketteHtml(s, b)}${this.gruppeHtml(sv)}</div>`;
      $('.leiste-inhalt', el).scrollTop = scroll;
      for (const z of $$('[data-zeige]', el)) z.addEventListener('click', () => this.panelZeigen(Number(z.dataset.zeige)));
    }
    $('[data-leiste-klapp]', el).addEventListener('click', () => { this.leisteZu = !this.leisteZu; this.renderLeiste(); this.minimapZeichnen(); });
  }

  flossHtml(sv, b) {
    const s = this.sl.s;
    const g = gruppe(s, b ?? s.aktiv);
    if (!s.cfg.fluchtwege.floss.aktiv && !s.cfg.fluchtwege.wrack.aktiv) return '';
    const kasse = sv.spieler.every((p, k) => !g.includes(k) || p.hand) ? kasseGesamt(s, g) : null;
    const tabelle = (titel, kosten) => {
      const zeilen = ROHSTOFFE.filter((r) => kosten[r]).map((r) => `<tr class="${kasse && kasse[r] >= kosten[r] ? 'ok' : ''}"><td>${ROHSTOFF_SYMBOL[r]} ${ROHSTOFF[r]}</td><td>${kosten[r]}</td><td>${kasse ? kasse[r] : '?'}</td><td><span class="haken">${kasse && kasse[r] >= kosten[r] ? '✓' : '○'}</span></td></tr>`).join('');
      return `<div class="floss-teil"><b>${titel}</b><table class="floss-tabelle"><tr><th></th><th title="pro Person × fliehende Figuren">benötigt</th><th title="Vorrat der Gruppe">Gruppe</th><th></th></tr>${zeilen}</table></div>`;
    };
    const besitzer = routenBesitzer(s, g);
    const route = besitzer === null ? 'Routenkarte fehlt (Kompass mit der Spitzhacke bergen)' : `Routenkarte bei ${esc(s.spieler[besitzer].name)}${sv.spieler[besitzer].route !== 'verdeckt' ? `: Abschnitt <b>${esc(sv.spieler[besitzer].route)}</b>` : ''}`;
    const n = fliehende(s);
    return `<section class="floss-tableau" aria-label="Floss-Tableau"><h3>🛶 Floss und ✈️ Wrack <span class="hinweis">für ${n} Figur${n === 1 ? '' : 'en'}</span></h3>
      ${s.cfg.fluchtwege.floss.aktiv ? tabelle('Solides Floss', flossKosten(s, 'solide')) + (s.cfg.fluchtwege.floss.not.aktiv ? tabelle('Not-Floss <span class="hinweis">(W6, Gruppenwurf)</span>', flossKosten(s, 'not')) : '') : ''}
      ${s.cfg.fluchtwege.wrack.aktiv ? tabelle(`Flugzeugwrack${s.cfg.fluchtwege.wrack.brennsprit ? ' <span class="hinweis">+ 🧪 Brennsprit</span>' : ''}`, wrackKosten(s)) : ''}
      <ul class="haken-liste"><li>${besitzer === null ? '○' : '✓'} ${route}</li>${s.modus === 'koop' && s.sammelfeld ? `<li>📍 Sammelfeld Strand ${s.felder[s.sammelfeld].kuestenNr}</li>` : ''}${tagesKarteDef(s)?.effekte?.some((e) => e.typ === 'flossSperre') ? '<li class="fehler">Sturm: heute keine Floss-Flucht</li>' : ''}</ul></section>`;
  }

  ketteHtml(s, b) {
    if (!s.cfg.fluchtwege.feuer.aktiv) return '';
    const gruppen = s.modus === 'koop' ? [s.spieler.map((_, k) => k)] : s.modus === 'team' ? [0, 1].map((t) => s.spieler.flatMap((p, k) => (s.teams[t].includes(p.id) ? [k] : []))) : s.spieler.flatMap((p, k) => (p.ausgeschieden ? [] : [[k]]));
    const teile = gruppen.map((g) => {
      const info = ketteInfo(s, g);
      const t = s.modus === 'team' ? (s.teams[0].includes(s.spieler[g[0]].id) ? 0 : 1) : null;
      const name = s.modus === 'koop' ? 'Gruppe' : s.modus === 'team' ? `${TEAM_SYMBOL[t]} ${TEAM_NAMEN[t]}` : `<span class="punkt" style="background:${spielerFarbe[g[0]]}"></span>${esc(s.spieler[g[0]].name)}`;
      return `<div class="kette">${ringSvg(info)}<div><b>${name}</b><div class="kette-stand${info.fertig ? ' fertig' : ''}">${info.kette.length} von ${info.feuer} Feuern</div><div>${info.kette.map((n) => `<span class="feuer-nr gueltig">${n}</span>`).join('')}${info.ungueltig.map((n) => `<span class="feuer-nr verletzt" title="verletzt den Abstand, zählt nicht">${n}</span>`).join('')}</div></div></div>`;
    });
    void b;
    const zeile = ketteInfo(s, gruppen[0] ?? []);
    return `<section class="ketten-leiste"><h3>🔥 Küstenfeuer-Kette <span class="hinweis">${zeile.feuer} Feuer, Abstand ≥ ${zeile.abstand}</span></h3><div class="hinweis">Strandfelder 1–42 rundum (42 → 1 = 1 Feld) · ${s.modus === 'koop' ? 'alle Feuer gehören der Gruppe' : s.modus === 'team' ? 'nur Feuer des eigenen Teams' : 'nur eigene Feuer'} · gebaute Feuer bleiben stehen</div>${teile.join('')}</section>`;
  }

  gruppeHtml(sv) {
    const s = this.sl.s;
    const zeilen = sv.spieler.map((p, i) => {
      const status = p.ausgeschieden ? ' <span class="status aus">✖</span>' : p.liegt ? ' <span class="status liegt">🩹</span>' : '';
      const char = p.charakter ? s.cfg.charaktere[p.charakter] : null;
      return `<li class="gruppe-zeile${i === entscheider(s) && !s.ende ? ' am-zug-zeile' : ''}" data-zeige="${i}" title="Panel auf dem Tisch zeigen" style="--farbe:${spielerFarbe[i]}"><span class="punkt" style="background:${spielerFarbe[i]}"></span><b>${esc(p.name)}</b> ${this.sitze[i].ki ? '🤖' : '🧑'}${teamIndex(s, i) !== null ? ` ${TEAM_SYMBOL[teamIndex(s, i)]}` : ''}${status}<span class="gruppe-werte">${char ? `${esc(char.symbol)} ` : ''}❤️${p.herzen} ⚡${p.energie}${p.hatRoute ?? p.route ? ' 🧭' : ''}</span></li>`;
    }).join('');
    return `<section class="gruppen-leiste"><h3>👥 ${s.modus === 'koop' ? 'Gruppe' : 'Spieler'} <span class="hinweis">${esc(MODUS_NAME[s.modus])}</span></h3><ul class="gruppe-liste">${zeilen}</ul></section>`;
  }

  renderProtokoll() {
    const s = this.sl.s;
    const el = $('#logBox', this.el);
    const alt = $('.log-liste', el);
    const unten = !alt || alt.scrollHeight - alt.scrollTop - alt.clientHeight < 30;
    const ab = Math.max(0, s.log.length - 400);
    el.innerHTML = `<header class="log-kopf"><b>📜 Spielprotokoll</b> <span class="hinweis">${s.log.length} Einträge</span><button type="button" data-log-klapp title="${this.logZu ? 'Aufklappen' : 'Einklappen'}">${this.logZu ? '▴' : '▾'}</button></header>
      ${this.logZu ? '' : `<ol class="log-liste" start="${ab + 1}">${s.log.slice(ab).map((l, k) => `<li class="${ab + k >= this.logLaenge ? 'ki-jetzt' : ''}">${esc(l)}</li>`).join('')}</ol>`}`;
    this.logLaenge = s.log.length;
    const liste = $('.log-liste', el);
    if (liste) liste.scrollTop = unten ? liste.scrollHeight : alt.scrollTop;
    $('[data-log-klapp]', el).addEventListener('click', () => { this.logZu = !this.logZu; this.renderProtokoll(); });
  }

  // ---------------- Tisch: Zoom, Verschieben, Minimap ----------------
  tischBedienung() {
    const tisch = $('#tisch', this.el);
    tisch.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = tisch.getBoundingClientRect();
      this.zoomen(e.deltaY > 0 ? 1 / 1.12 : 1.12, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    let zug = null;
    tisch.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (e.target.closest('button, input, select, textarea, a, summary, .panel-inhalt, [data-tageskarte], [data-gross]')) return;
      zug = { x: e.clientX, y: e.clientY, kx: this.kamera.x, ky: this.kamera.y, id: e.pointerId, bewegt: false };
      this.gezogen = false;
    });
    tisch.addEventListener('pointermove', (e) => {
      if (!zug || e.pointerId !== zug.id) return;
      const dx = e.clientX - zug.x, dy = e.clientY - zug.y;
      if (!zug.bewegt && Math.hypot(dx, dy) < 5) return;
      if (!zug.bewegt) { zug.bewegt = true; tisch.setPointerCapture(e.pointerId); tisch.classList.add('zieht'); }
      this.kamera.x = zug.kx + dx; this.kamera.y = zug.ky + dy; this.kameraSetzen();
    });
    const ende = (e) => {
      if (!zug || e.pointerId !== zug.id) return;
      this.gezogen = zug.bewegt;
      zug = null; tisch.classList.remove('zieht');
      setTimeout(() => { this.gezogen = false; }, 0);
    };
    tisch.addEventListener('pointerup', ende);
    tisch.addEventListener('pointercancel', ende);
    for (const b of $$('[data-zoom]', this.el)) b.addEventListener('click', () => {
      const z = b.dataset.zoom, r = tisch.getBoundingClientRect();
      if (z === 'rein') this.zoomen(1.25, r.width / 2, r.height / 2);
      else if (z === 'raus') this.zoomen(0.8, r.width / 2, r.height / 2);
      else if (z === 'wert') this.zentrieren();
      else if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.().catch(() => {});
    });
    const mini = $('#minimap', this.el);
    mini.addEventListener('click', (e) => {
      const r = mini.getBoundingClientRect();
      const wx = WELT.x + ((e.clientX - r.left) / r.width) * WELT.w, wy = WELT.y + ((e.clientY - r.top) / r.height) * WELT.h;
      const t = tisch.getBoundingClientRect();
      this.kamera.x = t.width / 2 - wx * this.kamera.z; this.kamera.y = t.height / 2 - wy * this.kamera.z;
      this.kameraSetzen();
    });
    if (!this.groesseBeobachter) {
      this.groesseBeobachter = new ResizeObserver(() => this.minimapSicht());
    }
    this.groesseBeobachter.disconnect();
    this.groesseBeobachter.observe(tisch);
  }

  // Sichtbare Fläche des Tisches (ohne Seitenleiste).
  flaeche() {
    const t = $('#tisch', this.el);
    const leiste = this.leisteZu ? 44 : $('#seitenleiste', this.el)?.offsetWidth ?? 0;
    return { w: Math.max(200, (t?.clientWidth ?? 800) - leiste), h: Math.max(200, t?.clientHeight ?? 600) };
  }

  zentrieren() {
    const f = this.flaeche();
    const z = Math.max(ZOOM.min, Math.min(ZOOM.max, Math.min((f.w - 30) / WELT.w, (f.h - 30) / WELT.h)));
    this.kamera = { z, x: f.w / 2 - (WELT.x + WELT.w / 2) * z, y: f.h / 2 - (WELT.y + WELT.h / 2) * z };
    this.kameraSetzen();
  }

  zoomen(faktor, mx, my) {
    const k = this.kamera;
    const z = Math.max(ZOOM.min, Math.min(ZOOM.max, k.z * faktor));
    k.x = mx - (mx - k.x) * (z / k.z); k.y = my - (my - k.y) * (z / k.z); k.z = z;
    this.kameraSetzen();
  }

  panelZeigen(i) {
    const [x, y] = PANEL_ORT[i] ?? [460, -420];
    const f = this.flaeche();
    if (this.kamera.z < 0.6) this.kamera.z = 0.6;
    this.kamera.x = f.w / 2 - (x + 160) * this.kamera.z; this.kamera.y = 90 - y * this.kamera.z;
    this.panelZu.delete(i);
    this.renderTisch(); this.minimapZeichnen();
  }

  kameraSetzen() {
    if (!this.kamera || !this.el) return;
    const welt = $('.welt', this.el);
    if (!welt) return;
    const k = this.kamera;
    welt.style.transform = `translate(${k.x.toFixed(1)}px, ${k.y.toFixed(1)}px) scale(${k.z.toFixed(4)})`;
    const w = $('[data-zoom="wert"]', this.el);
    if (w) w.textContent = `${Math.round(k.z * 100)} %`;
    this.minimapSicht();
  }

  minimapZeichnen() {
    const el = $('#minimap', this.el);
    if (!el) return;
    const s = this.sl.s;
    const m = B / HALB;
    const rand = SE * m;
    const figuren = s.spieler.map((p, i) => { const f = s.felder[p.feld]; if (!f || p.ausgeschieden) return ''; const c = pixel(f.coord, SE); return `<circle cx="${(c.x * m).toFixed(0)}" cy="${(c.y * m).toFixed(0)}" r="${rand.toFixed(0)}" fill="${spielerFarbe[i]}" stroke="#fff" stroke-width="10"/>`; }).join('');
    const panels = s.spieler.map((_, i) => { const [x, y] = PANEL_ORT[i] ?? [460, -420]; return `<rect x="${x}" y="${y}" width="320" height="${this.panelZu.has(i) ? 40 : 500}" rx="12" fill="${spielerFarbe[i]}" opacity="0.35"/>`; }).join('');
    el.innerHTML = `<svg viewBox="${WELT.x} ${WELT.y} ${WELT.w} ${WELT.h}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <rect x="${WELT.x}" y="${WELT.y}" width="${WELT.w}" height="${WELT.h}" fill="#f3efe6"/>
      <rect x="-770" y="-420" width="250" height="620" rx="10" fill="#e2dbcc"/><rect x="-770" y="250" width="270" height="370" rx="10" fill="#e2dbcc"/>
      <image href="${bild.brett}" x="${-B}" y="${-B}" width="${2 * B}" height="${2 * B}" preserveAspectRatio="none"/>
      ${panels}${figuren}<rect class="sicht" x="0" y="0" width="0" height="0"/></svg>`;
    this.minimapSicht();
  }

  minimapSicht() {
    const r = $('#minimap .sicht', this.el);
    if (!r || !this.kamera) return;
    const k = this.kamera, f = this.flaeche();
    r.setAttribute('x', (-k.x / k.z).toFixed(0)); r.setAttribute('y', (-k.y / k.z).toFixed(0));
    r.setAttribute('width', (f.w / k.z).toFixed(0)); r.setAttribute('height', (f.h / k.z).toFixed(0));
  }

  // ---------------- Dialoge ----------------
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
    $('#dNeu', d).addEventListener('click', () => { dialogZu(); app.neuePartieDialog(); });
  }
}

export function phaseText(s) {
  const z = s.zug;
  return { weitsicht_wuerfeln: 'Weitsicht würfeln', weitsicht_waehlen: 'Kacheln aufdecken', bewegung: 'Bewegung und Aktionen', aktion: 'Aktionen (nach dem Abbau)', kampf: `Kampf gegen ${TIER[z.kampf?.tier]?.name ?? 'ein Tier'}`, wahl: 'Wahl treffen', beute: 'Duell-Beute wählen' }[z.phase] ?? z.phase;
}

// Was ist jetzt zu tun? (Hinweisleiste für Menschen)
function phaseHilfe(s) {
  const z = s.zug;
  return {
    weitsicht_wuerfeln: `würfle den W${s.cfg.zug.weitsicht.wuerfel} für die Weitsicht.`,
    weitsicht_waehlen: `klicke ${z.weitsichtOffen} markierte Kachel${z.weitsichtOffen === 1 ? '' : 'n'} auf dem Brett an.`,
    bewegung: 'Feld anklicken = gehen, Aktionen im eigenen Panel.',
    aktion: 'nach dem Abbau: Aktionen im eigenen Panel oder Zug beenden.',
    kampf: 'kämpfe oder fliehe auf ein markiertes Feld.',
    wahl: 'triff die Wahl im eigenen Panel.',
    beute: 'wähle die Beute im eigenen Panel.',
  }[z.phase] ?? '';
}

export function ringSvg(info) {
  const pos = (n, r = 36) => { const w = ((n - 1) / STRANDRING) * 2 * Math.PI; return { x: 48 + Math.sin(w) * r, y: 48 - Math.cos(w) * r }; };
  const boegen = info.luecken.map((l) => {
    const a = pos(l.von), c = pos(l.von + l.laenge), gross = l.laenge > STRANDRING / 2 ? 1 : 0;
    return `<path class="${l.gueltig ? 'gueltig' : 'verletzt'}" style="fill:none" d="M ${a.x.toFixed(1)} ${a.y.toFixed(1)} A 36 36 0 ${gross} 1 ${c.x.toFixed(1)} ${c.y.toFixed(1)}"><title>${l.von} → ${((l.von + l.laenge - 1) % STRANDRING) + 1}: Abstand ${l.laenge}</title></path>`;
  }).join('');
  const punkte = [...info.kette.map((n) => [n, 'gueltig']), ...info.ungueltig.map((n) => [n, 'verletzt'])].map(([n, k]) => { const p = pos(n); return `<circle class="${k}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4"><title>Feuer auf Strandfeld ${n}</title></circle>`; }).join('');
  const zahlen = [1, 11, 22, 32].map((n) => { const p = pos(n, 45); return `<text x="${p.x.toFixed(1)}" y="${(p.y + 2.5).toFixed(1)}">${n}</text>`; }).join('');
  return `<svg class="ring-leiste" viewBox="0 0 96 96" width="96" height="96" aria-hidden="true"><circle class="ring" cx="48" cy="48" r="36"/>${boegen}${punkte}${zahlen}</svg>`;
}

export { kasseAufFeld, BIOM };
