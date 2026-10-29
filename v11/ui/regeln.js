// Regeln-Reiter im Aufbau der V10-Spielanleitung: Abschnitte, Tabellen mit Kartenbildern, Werte aus der aktuellen
// Konfiguration. Werte, die vom Standard V10 abweichen, sind markiert (Tooltip zeigt den Standard).
import { app, geaendertZahl } from './zustand.js';
import { $, esc, herunterladen } from './dom.js';
import { lesen, mal, rohstoffText } from '../engine/config.js';
import { INHALT, BIOM, TIER } from '../engine/namen.js';
import { STRANDRING } from '../engine/brett.js';
import { bild } from './bilder.js';
import { spezialKarte, tagesKarte } from './karten.js';
import { charakterText, rezeptName, rezeptSymbol, rezeptWirkung } from './texte.js';

const MODI = [
  ['Koop', '2 bis 4', 'alle Figuren fliehen gemeinsam, sonst Niederlage (Lava oder alle gleichzeitig am Boden)', 'Rohstoffe, Ausrüstung und Charakter aller Figuren offen (Spezialkarten verdeckt, Anzahl sichtbar)', 'alle Figuren (Spielerzahl)'],
  ['Team (2 gegen 2)', 'genau 4', 'erstes Team, dessen beide Mitglieder fliehen', 'Teampartner sehen Rohstoffe, Ausrüstung und Charakter voneinander, das Gegnerteam nur Herzen, Energie und Anzahl Handkarten', '2 Figuren (das Team)'],
  ['PvP (jeder gegen jeden)', '2 bis 4', 'wer zuerst flieht oder als letzter Überlebender übrig bleibt', 'verdeckt, nur Werkzeuge und Waffen liegen offen (auch die Richtung der Routenkarte; wer eine hat, sehen alle)', '1 Figur'],
];

export function regelnZeigen(el) {
  const c = app.cfg, std = app.standard;
  // Wert mit Markierung, falls er vom Standard V10 abweicht.
  const w = (pfad, text = null) => {
    const v = lesen(c, pfad), s = lesen(std, pfad);
    const t = text ?? (typeof v === 'object' && v ? rohstoffText(v) : String(v));
    if (JSON.stringify(v) === JSON.stringify(s)) return esc(t);
    const st = typeof s === 'object' && s ? rohstoffText(s) : String(s);
    return `<span class="abweichung" title="Standard V10: ${esc(st)}">${esc(t)}</span>`;
  };
  const fw = c.fluchtwege, z = c.zug, t = c.tiere, d = c.duelle;
  const personen = [1, 2, 3, 4];
  const fluchtZeilen = personen.map((n) => {
    const f = fw.feuer.tabelle[n];
    return `<tr><td><b>${n}</b> ${n === 1 ? 'Figur (PvP)' : `Figuren${n === 2 ? ' (Koop 2, Team)' : ` (Koop ${n})`}`}</td>
      <td>${fw.floss.aktiv ? rohstoffText(mal(fw.floss.solide.proPerson, n)) : '–'}</td>
      <td>${fw.floss.aktiv && fw.floss.not.aktiv ? rohstoffText(mal(fw.floss.not.proPerson, n)) : '–'}</td>
      <td>${fw.feuer.aktiv && f ? `${w(`fluchtwege.feuer.tabelle.${n}.feuer`)} Feuer, Abstand ≥ ${w(`fluchtwege.feuer.tabelle.${n}.abstand`)}<br><span class="hinweis">${rohstoffText(mal(c.crafting.rezepte.lagerfeuer.kosten, f.feuer))}</span>` : '–'}</td>
      <td>${fw.wrack.aktiv ? `${fw.wrack.brennsprit ? 'Brennsprit + ' : ''}${rohstoffText(mal(fw.wrack.proPerson, n))}` : '–'}</td></tr>`;
  }).join('');
  const biomZeile = (b) => {
    const e = Object.entries(c.brett.plaettchen[b] ?? {}).filter(([, n]) => n);
    const summe = e.reduce((s, [, n]) => s + n, 0);
    return `<tr><td><img class="plaettchen-bild" src="${bild.hinten(b)}" alt=""/> <b>${BIOM[b]} ${summe}</b></td><td>${e.map(([k, n]) => `${w(`brett.plaettchen.${b}.${k}`, String(n))} ${esc(INHALT[k] ?? k)}`).join(', ')}</td></tr>`;
  };
  const rezepte = Object.entries(c.crafting.rezepte).map(([id, r]) => `<tr class="${r.aktiv ? '' : 'aus'}"><td>${rezeptSymbol(id)} <b>${rezeptName(id)}</b>${r.aktiv ? '' : ' <span class="hinweis">(ausgeschaltet)</span>'}</td><td>${w(`crafting.rezepte.${id}.kosten`)}</td><td>${esc(rezeptWirkung(c, id))}</td></tr>`).join('');
  const charaktere = Object.entries(c.charaktere).filter(([, x]) => x.aktiv).map(([id, x]) => `<figure class="charakter-figur"><img src="${bild.charakter(id)}" alt="Spielerkarte ${esc(x.name)}"/><figcaption>${esc(x.symbol)} <b>${esc(x.name)}</b>: ${esc(charakterText(c, id))}</figcaption></figure>`).join('');
  const tageskarten = Object.entries(c.tageskarten.karten).filter(([, k]) => k.aktiv).map(([id, k], i) => `<tr><td>${i + 1}</td><td class="karten-zelle">${tagesKarte(c, id, 'regel')}</td><td><b>${esc(k.symbol ?? '')} ${esc(k.name)}</b>${(k.anzahl ?? 1) > 1 ? ` <span class="hinweis">${k.anzahl}×</span>` : ''}<br>${esc(k.text)}</td></tr>`).join('');
  const sk = Object.entries(c.spezialkarten.karten).filter(([, k]) => k.aktiv);
  const spezialZeilen = (filter) => sk.filter(([, k]) => filter(k.art)).map(([id, k]) => `<tr><td class="karten-zelle">${spezialKarte(c, id, 'regel')}</td><td><b>${k.anzahl}× ${esc(k.symbol ?? '')} ${esc(k.name)}</b><br>${esc(k.text)}</td></tr>`).join('');
  const klein = Object.keys(t.klein).map((x) => TIER[x]?.name ?? x).join(', '), gross = Object.keys(t.gross).map((x) => TIER[x]?.name ?? x).join(', ');
  const pool = sk.reduce((s, [, k]) => s + (k.anzahl ?? 0), 0);
  el.innerHTML = `<article class="regeln">
  <h1>📖 Spielanleitung Insel-Survival <span class="hinweis">Version 11 · Regelstand V10 · Konfiguration «${esc(app.presetName)}»${geaendertZahl() ? ` (${geaendertZahl()} ${geaendertZahl() === 1 ? 'Wert' : 'Werte'} angepasst)` : ''}</span></h1>
  <p class="regeln-werkzeug"><button type="button" id="regelnAlsText">📄 Regeln als Text</button> <span class="hinweis">Das ganze Regelwerk als Textdatei, aus denselben Werten erzeugt wie diese Seite. <span class="abweichung">Markierte Werte</span> weichen vom Standard V10 ab.</span></p>
  <p>Ihr seid auf einer Vulkaninsel gestrandet. Sammelt Rohstoffe, baut Werkzeuge und findet einen Weg von der Insel, bevor der Vulkan ausbricht. ${w('match.spielerMin')} bis ${w('match.spielerMax')} Spieler, jeder Sitz Mensch oder KI.</p>

  <section><h2>🎲 Spielmodi</h2>
    <table><thead><tr><th>Modus</th><th>Sitze</th><th>Sieg</th><th>Information</th><th>Fluchtkosten gelten für</th></tr></thead><tbody>${MODI.map((m) => `<tr><td><b>${m[0]}</b></td><td>${m[1]}</td><td>${m[2]}</td><td>${m[3]}</td><td>${m[4]}</td></tr>`).join('')}</tbody></table>
    <ul>
      <li><b>Koop:</b> Alle spielen gemeinsam gegen die Insel. Liegen alle gleichzeitig am Boden oder kommt die Lava, verliert ihr alle. Keine Angriffe, kein Duell.</li>
      <li><b>Team:</b> Team Sonne (Sitz 1 und 3) gegen Team Mond (Sitz 2 und 4). Teampartner reanimieren sich, greifen sich nicht an und fliehen zusammen.</li>
      <li><b>PvP:</b> Jeder für sich. Wer 0 Herzen hat, scheidet aus (eine Routenkarte geht ${d.routeBeiAusscheiden === 'ablage' ? 'auf die Ablage' : 'zurück, der Kompass liegt wieder unter dem Vulkanfels'}).</li>
    </ul>
  </section>

  <section><h2>🗺️ Spielfeld</h2>
    <p>169 Sechseckfelder (8 pro Kante), Ringe 0–7. Ring 0 + 1 = 7 Vulkanfelder, Ring 7 = ${STRANDRING} Strandfelder (im Uhrzeigersinn 1–${STRANDRING}). Die 6 Kanten von Ring 7 sind die 6 Inselseiten. Strand und Vulkan sind fest; Wald, Wiese und Gebirge werden mit jedem Seed neu angeordnet und sind über die Plättchen-Rückseiten immer sichtbar, die Inhalte je Biom gemischt und verdeckt.</p>
    <table class="biom-tabelle">${['wald', 'wiese', 'gebirge', 'strand', 'vulkan'].map(biomZeile).join('')}</table>
    <p class="hinweis">Verdeckte Plättchen zeigen das Biom, der Inhalt bleibt verborgen bis zum Aufdecken. Erledigtes verschwindet: abgebaute Bäume, Felsen, Blätterbüsche, Strandgut, besiegte Tiere und gezogene Spezialkarten werden entfernt, es bleibt leerer Boden. Wasserquellen, Flugzeugwrack und Vulkan werden nie entfernt. Der Vulkanfels mit dem Kompass liegt zufällig auf einem der 7 Vulkanfelder.</p>
  </section>

  <section><h2>🧍 Spieler und Charaktere</h2>
    <p>${w('figur.herzen')} Herzen, ${w('figur.energie')} Energie (auch Maximum). Rohstoffe und Spezialkarten verdeckt auf der Hand (kein Limit). Ausrüstung: höchstens 1 Steinaxt, 1 Spitzhacke, 1 Waffe. 0 Herzen: Koop und Team am Boden – ein Mitspieler (Team: nur der Teampartner) auf demselben Feld kann mit einer Bandage reanimieren (danach ${w('figur.reanimationHerzen')} Herzen); PvP ausgeschieden. Werkzeuge und Waffen liegen in allen Modi offen. Mehrere Figuren dürfen auf demselben Feld stehen. Die Charaktere werden bei jeder Partie neu zugelost (jeder höchstens einmal).</p>
    <div class="charakter-raster">${charaktere}</div>
  </section>

  <section><h2>⏳ Zeit</h2>
    <p>Tagesreihe: ${w('match.tage.ruhig')} × «Ruhiger Tag» + ${w('match.tage.ereignisse')} zufällige Ereignisse, gemischt${c.match.tage.lava ? '; danach kommt die Lava' : ''}. Pro Tag (= eine Runde aller Spieler) wird 1 Karte aufgedeckt und gross in der Mitte gezeigt. Die Ausbruch-Karte: alle, die noch auf der Insel sind, verlieren.</p>
  </section>

  <section><h2>🔄 Zug eines Spielers</h2>
    <ol>
      <li><b>Weitsicht:</b> W${w('zug.weitsicht.wuerfel')} würfeln, so viele verdeckte Kacheln im Umkreis von ${w('zug.weitsicht.radius')} Ringen aufdecken.</li>
      <li><b>Bewegung:</b> ${w('zug.schrittEnergie')} Energie pro Schritt, betretene Felder werden aufgedeckt.</li>
      <li><b>Abbau</b> (${z.abbauEnergie ? `${w('zug.abbauEnergie')} Energie, ` : 'kostet keine Energie, '}beendet die Bewegung, das Plättchen wird entfernt): Baum ${rohstoffText(z.ertrag.baum.basis)} (mit Steinaxt mehr) · Fels ${rohstoffText(z.ertrag.fels.basis)} (mit Spitzhacke mehr) · Blätterbusch ${rohstoffText(z.ertrag.blaetterbusch.basis)} · Strandgut ${rohstoffText(z.ertrag.strandgut.basis)}.</li>
      <li><b>Spezialfeld, Bauen, Interaktion:</b> Spezialfeld = Spezialkarte ziehen. Craften und Essen jederzeit im Zug (auch nach dem Abbau). Trinken beendet den Zug. Schenken oder Tauschen im Umkreis ${w('zug.handel.radius')} (${w('zug.handel.proZug')}× pro Zug, höchstens ${w('zug.handel.maxKarten')} Karten pro Seite). Team und PvP: Angriff auf einen Gegner im Umkreis ${w('duelle.radius')} (siehe Duelle).</li>
    </ol>
    <p><b>Regeneration:</b> Rasten (keine Bewegung im Zug) +${w('zug.rasten')} Energie, im Shelter +${w('zug.rastenShelter')} · Nahrung +${w('zug.nahrungEnergie')} Energie · Wasserfeld: durchlaufen ${z.wasser.durchlaufen ? 'erlaubt' : 'nicht erlaubt'}, «💧 Trinken» freiwillig – Energie auf ${w('zug.wasser.auffuellen')}${z.wasser.zugende ? ', danach endet der Zug sofort' : ''} (nicht bei Dürre).</p>
  </section>

  <section><h2>🐾 Tiere</h2>
    <p>Flucht: ${w('tiere.fluchtEnergie')} Energie, kein Kampf – nur bei Tieren, die man vorher offen gesehen hat. Wer ein verdecktes Tierfeld blind betritt (oder in einen Hinterhalt gerät), muss kämpfen.</p>
    <ul>
      <li>Klein (${esc(klein)}), W6 + Bonus ≥ ${w('tiere.zielKlein')}: Sieg = ${w('tiere.nahrungKlein')} Nahrung, Niederlage = kein Schaden${t.zuruecksetzen ? ', zurück aufs Herkunftsfeld' : ''}.</li>
      <li>Gross (${esc(gross)}), W6 + Bonus ≥ ${w('tiere.zielGross')}: Sieg = ${w('tiere.nahrungGross')} Nahrung, Niederlage = Schaden laut Tier, Zug endet, Tier bleibt.</li>
      <li>Hinterhalt: kein Zurücksetzen, auch ein kleines Tier macht ${w('tiere.hinterhaltKleinSchaden')} Herz Schaden.</li>
    </ul>
    <div class="token-reihe">${[...Object.keys(t.klein), ...Object.keys(t.gross)].map((x) => `<figure><img src="${bild.tier(x)}" alt=""/><figcaption>${esc(TIER[x]?.name ?? x)}</figcaption></figure>`).join('')}</div>
  </section>

  <section><h2>🛠️ Crafting</h2>
    <table><thead><tr><th>Gegenstand</th><th>Kosten</th><th>Wirkung</th></tr></thead><tbody>${rezepte}</tbody></table>
    <p>🔥 Das Lagerfeuer heilt beim Bau +${w('crafting.lagerfeuerHerzen')} Herzen, auch abseits des Strands. Auf dem Strandring zählt es für die Küstenfeuer-Kette.</p>
  </section>

  <section><h2>❗ Spezialkarten</h2>
    <p>Pool ${pool} Karten (aus der Liste berechnet). Stapel = ${w('spezialkarten.stapel')} Karten, der Brennsprit ist immer dabei.</p>
    <h3>Handkarten (beim Ziehen sehen die anderen nur die Rückseite, beim Ausspielen alle die Karte)</h3>
    <table class="karten-tabelle"><tbody>${spezialZeilen((a) => a === 'joker')}</tbody></table>
    <h3>Sofort-Karten: Gefahren und Glücksfunde (gross für alle gezeigt)</h3>
    <table class="karten-tabelle"><tbody>${spezialZeilen((a) => a !== 'joker')}</tbody></table>
  </section>

  <section><h2>🧭 Kompass und Routenkarte</h2>
    <p>Der Kompass liegt unter dem Vulkanfels, nur mit Spitzhacke bergbar${z.kompassEnergie ? ` (${w('zug.kompassEnergie')} Energie)` : ''}. Wer ihn birgt, zieht sofort 1 Routenkarte; die Bergung beendet den Zug. Routenstapel: ${8 * c.routen.jeRichtung} Karten (8 Richtungen je ${w('routen.jeRichtung')}×). Die Routenkarte ist eine Handkarte und nennt den Strandabschnitt für das Floss. Koop: die Richtung ist offen, die Gruppe wählt im Abschnitt ein 📍 Sammelfeld. Team und PvP: alle sehen, wer eine Routenkarte hat (🧭), die Richtung bleibt geheim. Floss: wer die Routenkarte hat, steht beim Bau am Zielstrand und gibt sie ab.</p>
  </section>

  ${d.aktiv ? `<section><h2>⚔️ Duelle (nur Team und PvP)</h2>
    <p>Angriff auf einen Gegner (nicht den Teampartner) im Umkreis ${w('duelle.radius')}, kostet ${w('duelle.energie')} Energie, ${w('duelle.proZug')}× pro Zug. Beide würfeln W6 + Waffe. Der Verlierer verliert ${w('duelle.herzen')} Herz. Der Sieger wählt eine <b>Kategorie</b>, die der Verlierer hat: ${['rohstoff', 'spezial', 'route'].filter((k) => d.beute[k]).map((k) => ({ rohstoff: '<b>Rohstoff</b>', spezial: '<b>Spezialkarte</b>', route: '<b>Routenkarte</b>' })[k]).join(', ')} (Rohstoff und Spezialkarte blind gezogen, die Routenkarte direkt). Werkzeuge und Waffen kann man nicht rauben. Bei Gleichstand passiert nichts. Rauch des Verlierers verhindert Schaden und Beute.</p>
  </section>` : ''}

  <section><h2>☀️ Tages-Ereignisse</h2>
    <table class="karten-tabelle"><thead><tr><th>#</th><th>Karte</th><th>Ereignis und Wirkung</th></tr></thead><tbody>${tageskarten}</tbody></table>
  </section>

  <section><h2>🏆 Siegbedingungen</h2>
    <p>Fluchtkosten gelten immer <b>pro fliehende Figur</b> und werden mit der Anzahl fliehender Figuren multipliziert: Koop = alle Figuren, Team = 2 (das Team), PvP = 1. Alle fliehenden Figuren stehen am Fluchtort und sind auf den Beinen; bezahlt wird gemeinsam aus ihren Händen auf dem Feld.</p>
    <table class="flucht-tabelle"><thead><tr><th>Fliehende Figuren</th><th>🛶 Solides Floss</th><th>🛶 Not-Floss</th><th>🔥 Küstenfeuer-Kette</th><th>✈️ Flugzeugwrack</th></tr></thead><tbody>${fluchtZeilen}</tbody></table>
    <ol>
      ${fw.floss.aktiv ? `<li><b>🛶 Floss</b> (Routenkarte auf der Hand): alle fliehenden Figuren auf demselben Strandfeld des Abschnitts (Koop: 📍 Sammelfeld). Solides Floss = Flucht geglückt.${fw.floss.not.aktiv ? `<br>Not-Floss: W6 – 1–${w('fluchtwege.floss.not.kentertBis')} kentert (Koop: alle −${w('fluchtwege.floss.not.schadenKoop')} Herzen) · ${fw.floss.not.kentertBis + 1}–${w('fluchtwege.floss.not.landBis')} zurück an Land${fw.floss.not.nachLandGratis ? ` (nächster Versuch ohne neues Material${fw.floss.not.nachLandNaechsterTag ? ', ab dem nächsten Tag' : ''})` : ' (Material verloren)'} · ${fw.floss.not.landBis + 1}–6 Flucht gelingt.` : ''} «Sturm» sperrt die Floss-Flucht für den Tag.</li>` : ''}
      ${fw.feuer.aktiv ? `<li><b>🔥 Küstenfeuer-Kette:</b> reguläre Lagerfeuer (je ${w('crafting.rezepte.lagerfeuer.kosten')}) auf den Strandfeldern 1–${STRANDRING}. Zwischen benachbarten Feuern der Kette liegen mindestens so viele Nummern wie in der Tabelle, rund um den Ring gezählt (Feld ${STRANDRING} grenzt an Feld 1). Koop: alle Feuer gehören der Gruppe, Team: nur Feuer des eigenen Teams, PvP: nur eigene Feuer. Sieg sofort, sobald das letzte nötige Feuer mit gültigem Abstand steht. Ein Feuer mit zu kleinem Abstand darf gebaut werden (wärmt und heilt), zählt aber nicht. Gebaute Feuer bleiben stehen.</li>` : ''}
      ${fw.wrack.aktiv ? `<li><b>✈️ Flugzeugwrack:</b> vor Ort im Wald, ${fw.wrack.brennsprit ? '1 Brennsprit (Spezialkarte) + ' : ''}Material nach Tabelle, alle fliehenden Figuren beim Wrack.</li>` : ''}
      <li><b>🏆 PvP:</b> Wer als letzter Überlebender übrig bleibt, gewinnt allein.</li>
      <li><b>Ausbruch-Karte</b> = alle verlieren. Koop: <b>alle gleichzeitig am Boden</b> = verloren.</li>
    </ol>
  </section>

  <section><h2>📦 Materialvorrat</h2>
    <p>${c.vorrat.unbegrenzt ? 'Der Vorrat ist unbegrenzt.' : `Der Vorrat ist begrenzt: ${w('vorrat.karten')}.${c.vorrat.leerOhneErtrag ? ' Ist ein Stapel leer, gibt der Abbau dieses Rohstoffs nichts.' : ''}`}</p>
  </section>

  <section><h2>🃏 Zwei Arten zu spielen</h2>
    <ul>
      <li><b>Regel-Modus:</b> Das Programm setzt alle Regeln durch. Karten werden sichtbar vom Stapel gezogen, Würfel rollen in der Würfelschale. Du bedienst deinen Zug über Klicks auf Brett und Panel. KI-Spieler möglich (Stufen Zufall bis Gut, mit Persönlichkeit).</li>
      <li><b>Freier Tisch:</b> wie ein echter Spieltisch für Playtests – alles frei verschiebbar, Werte mit +/−, keine Regelprüfung, nur Menschen. Figur ziehen = bewegen, verdecktes Feld anklicken = aufdecken, Stapel anklicken = Karte ziehen.</li>
    </ul>
    <p class="hinweis">Der Seed (oben in der Toolbar) bestimmt Insel und Stapel: gleicher Seed = gleiche Partie. Jede neue Partie mischt mit einem neuen Seed, ausser ihr gebt einen ein.</p>
  </section>
</article>`;
  $('#regelnAlsText', el).addEventListener('click', () => herunterladen('insel-survival-v11-regeln.md', alsMarkdown($('.regeln', el)), 'text/markdown;charset=utf-8'));
}

// Die Seite als Markdown-Text (Überschriften, Absätze, Listen, Tabellen).
function alsMarkdown(artikel) {
  const zeilen = [];
  const text = (e) => e.innerText.replace(/\s+/g, ' ').trim();
  for (const e of artikel.querySelectorAll('h1, h2, h3, p, li, tr, figcaption')) {
    if (e.closest('.regeln-werkzeug')) continue;
    if (e.tagName === 'H1') zeilen.push(`# ${text(e)}`, '');
    else if (e.tagName === 'H2') zeilen.push('', `## ${text(e)}`, '');
    else if (e.tagName === 'H3') zeilen.push('', `### ${text(e)}`, '');
    else if (e.tagName === 'P') zeilen.push(text(e), '');
    else if (e.tagName === 'LI' || e.tagName === 'FIGCAPTION') zeilen.push(`- ${text(e)}`);
    else zeilen.push(`| ${[...e.children].map(text).filter(Boolean).join(' | ')} |`);
  }
  return zeilen.join('\n').replace(/\n{3,}/g, '\n\n');
}
