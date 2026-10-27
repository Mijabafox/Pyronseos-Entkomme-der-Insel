// Spielleitung: verbindet Engine, Bots und (im Browser) Menschen. Gemeinsam für Browser und Simulation.
// Bots bekommen ausschliesslich den Beobachtungs-Snapshot (sicht), nie den Spielzustand.
import { neuePartie, erlaubteAktionen, ausfuehren, istErlaubt, entscheider, handelPruefen } from '../engine/engine.js';
import { sicht } from '../engine/sicht.js';
import { ableiten } from '../engine/rng.js';
import { botErzeugen } from '../bots/bot.js';

export const MAX_AKTIONEN = 40000;

export class Spielleiter {
  constructor(cfg, opt = {}) {
    this.cfg = cfg;
    this.seed = (opt.seed ?? cfg.match.seed ?? 1) >>> 0;
    this.modus = opt.modus ?? cfg.match.modus;
    this.sitze = (opt.sitze ?? Array.from({ length: cfg.match.spieler }, (_, k) => ({ name: `KI ${k + 1}`, ki: true }))).map((x) => ({ ...x }));
    this.s = neuePartie(cfg, { seed: this.seed, modus: this.modus, sitze: this.sitze, protokoll: opt.protokoll !== false, tagesKarten: opt.tagesKarten });
    const stufe = cfg.ki?.standardStufe ?? 'normal';
    this.bots = this.sitze.map((x, i) => (x.ki ? botErzeugen({ index: i, stufe: x.stufe ?? stufe, persoenlichkeit: x.persoenlichkeit ?? {}, seed: ableiten(this.seed, `bot${i}`), cfg, echtzeit: !!opt.echtzeit }) : null));
    this.zuege = [];
    this.notizen = []; // Plan-Notizen der Bots (fürs Replay-Protokoll)
    this.handelMeldungen = [];
    this.letzterAktiv = -1;
  }

  get zustand() { return this.s; }
  wer() { return entscheider(this.s); }
  istBotDran() { return !this.s.ende && this.bots[this.wer()] !== null; }
  istMenschDran() { return !this.s.ende && this.bots[this.wer()] === null; }

  beobachtenAlle() {
    if (this.s.aktiv === this.letzterAktiv) return;
    this.letzterAktiv = this.s.aktiv;
    this.bots.forEach((b, i) => { if (b?.mem) b.mem.beobachten(sicht(this.s, i)); });
  }

  // Ein Bot-Schritt. Gibt { wer, aktion } zurück (oder null, wenn ein Mensch dran ist / Ende).
  botSchritt() {
    if (!this.istBotDran()) return null;
    this.beobachtenAlle();
    if (this.zuege.length >= MAX_AKTIONEN) { this.abbrechen(); return null; }
    const i = this.wer();
    const bot = this.bots[i];
    for (let versuch = 0; versuch < 4; versuch++) {
      const aktionen = erlaubteAktionen(this.s);
      if (!aktionen.length) { this.abbrechen(); return null; }
      const a = bot.entscheiden(sicht(this.s, i), aktionen);
      if (bot.ziel && bot.ziel.text !== bot.letzterPlan) {
        bot.letzterPlan = bot.ziel.text;
        const text = `Tag ${this.s.tag} · ${this.s.spieler[i].name}: plant: ${bot.ziel.text}`;
        if (this.s.protokoll) this.s.log.push(text);
        this.notizen.push({ vor: this.zuege.length, text });
      }
      if (a.typ === 'handeln') {
        const r = this.handeln(a);
        if (r.angenommen) return { wer: i, aktion: a, handel: r };
        continue;
      }
      if (!istErlaubt(this.s, a)) { const ersatz = aktionen.find((x) => x.typ === 'zugBeenden') ?? aktionen[0]; this.ausfuehren(i, ersatz); return { wer: i, aktion: ersatz }; }
      this.ausfuehren(i, a);
      return { wer: i, aktion: a };
    }
    const ak = erlaubteAktionen(this.s);
    const ersatz = ak.find((x) => x.typ === 'zugBeenden') ?? ak[0];
    this.ausfuehren(i, ersatz);
    return { wer: i, aktion: ersatz };
  }

  ausfuehren(i, a) {
    ausfuehren(this.s, a);
    this.zuege.push(a);
  }

  // Mensch spielt eine Aktion (Browser). Gibt Fehlertext oder null zurück.
  menschAktion(a) {
    if (a.typ === 'handeln') return null;
    if (!istErlaubt(this.s, a)) return 'Diese Aktion ist gerade nicht erlaubt.';
    this.ausfuehren(this.wer(), a);
    return null;
  }

  // Handel anbieten. Ist der Partner ein Bot, entscheidet er; ist er ein Mensch, muss die Oberfläche fragen (antwort übergeben).
  handeln(angebot, antwortMensch = null) {
    const fehler = handelPruefen(this.s, angebot);
    if (fehler) return { angenommen: false, grund: fehler };
    const partner = this.bots[angebot.mit];
    let r;
    if (partner) r = partner.handelAnnehmen(sicht(this.s, angebot.mit), angebot, this.s.aktiv);
    else if (antwortMensch !== null) r = { angenommen: antwortMensch, grund: antwortMensch ? 'angenommen' : 'abgelehnt' };
    else return { angenommen: false, grund: 'frage', offen: true };
    this.handelMeldungen.push({ tag: this.s.tag, von: this.s.aktiv, ...angebot, ...r });
    if (r.angenommen) this.ausfuehren(this.s.aktiv, { ...angebot, typ: 'handeln' });
    else if (this.s.protokoll) this.s.log.push(`Tag ${this.s.tag} · ${this.s.spieler[angebot.mit].name} lehnt den Handel ab: ${r.grund}`);
    return r;
  }

  abbrechen() {
    if (!this.s.ende) this.s.ende = { grund: 'abbruch', sieger: null, gewinner: [], tag: this.s.tag };
  }

  // Spielt, bis ein Mensch dran ist oder die Partie endet.
  laufen(max = MAX_AKTIONEN) {
    let n = 0;
    while (this.istBotDran() && n++ < max) this.botSchritt();
    if (!this.s.ende && this.zuege.length >= MAX_AKTIONEN) this.abbrechen();
    return this.s;
  }

  // Protokoll für Replay und Export (Seed plus Zugliste).
  protokoll(teilCfg = null) {
    return {
      format: 'insel-survival-v11-partie', version: 1, seed: this.seed, modus: this.modus,
      sitze: this.sitze.map((x) => ({ name: x.name, ki: x.ki, stufe: x.stufe ?? null, persoenlichkeit: x.persoenlichkeit ?? null, charakter: x.charakter ?? null })),
      konfig: teilCfg ?? this.cfg, zuege: this.zuege, notizen: this.notizen,
      ergebnis: this.s.ende ? { grund: this.s.ende.grund, tag: this.s.ende.tag, gewinner: this.s.ende.gewinner } : null,
    };
  }
}

// Replay: aus Seed und Zugliste exakt dieselbe Partie nachspielen. Liefert alle Zwischenstände.
export function nachspielen(cfg, prot, { zwischen = false } = {}) {
  const s = neuePartie(cfg, { seed: prot.seed, modus: prot.modus, sitze: prot.sitze, protokoll: true });
  const staende = zwischen ? [klonFlach(s)] : null;
  const notizen = [...(prot.notizen ?? [])];
  prot.zuege.forEach((a, k) => {
    while (notizen.length && notizen[0].vor <= k) s.log.push(notizen.shift().text);
    ausfuehren(s, a);
    if (zwischen) staende.push(klonFlach(s));
  });
  for (const n of notizen) s.log.push(n.text);
  return { s, staende };
}
function klonFlach(s) { const { cfg, ...rest } = s; const k = JSON.parse(JSON.stringify(rest)); k.cfg = cfg; return k; }
