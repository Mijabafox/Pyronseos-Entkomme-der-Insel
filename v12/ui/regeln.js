// Regeln-Reiter im Aufbau der V10-Spielanleitung: Abschnitte, Tabellen mit Kartenbildern, Werte aus der aktuellen
// Konfiguration. Werte, die vom Standard V12 abweichen, sind markiert (Tooltip zeigt den Standard).
import { app, geaendertZahl } from './zustand.js';
import { $, esc, herunterladen } from './dom.js';
import { lesen, mal, rohstoffText } from '../engine/config.js';
import { INHALT, BIOM, TIER } from '../engine/namen.js';
import { STRANDRING } from '../engine/brett.js';
import { bild } from './bilder.js';
import { spezialKarte, tagesKarte } from './karten.js';
import { charakterText, rezeptName, rezeptSymbol, rezeptWirkung } from './texte.js';
import { schalterListe } from '../engine/schalter.js';

const MODI = [
  ['Kooperativ ★', '2 bis 4', 'nur wenn alle gleichzeitig fliehen und niemand K.O. ist', 'alles offen ausser Spezialkarten (Anzahl sichtbar), Charaktere offen', 'alle Figuren (Spielerzahl)'],
  ['Team 2 gegen 2', 'genau 4', 'das Team, dessen beide Mitglieder zuerst fliehen', 'für den Partner alles offen, fürs andere Team verdeckt, Charaktere offen', '2 Figuren (das Team)'],
  ['Jeder gegen jeden', '2 bis 4', 'wer zuerst flieht oder als Letzter übrig bleibt', 'alles verdeckt (auch der Charakter), nur die verdeckte Kompasskarte liegt vor dir', '1 Figur'],
];

export function regelnZeigen(el) {
  const c = app.cfg, std = app.standard;
  // Wert mit Markierung, falls er vom Standard V12 abweicht.
  const w = (pfad, text = null) => {
    const v = lesen(c, pfad), s = lesen(std, pfad);
    const t = text ?? (typeof v === 'object' && v ? rohstoffText(v) : String(v));
    if (JSON.stringify(v) === JSON.stringify(s)) return esc(t);
    const st = typeof s === 'object' && s ? rohstoffText(s) : String(s);
    return `<span class="abweichung" title="Standard (Regelstand 05.11.2026): ${esc(st)}">${esc(t)}</span>`;
  };
  const fw = c.fluchtwege, z = c.zug, t = c.tiere, d = c.duelle;
  const rauchEnergie = (c.spezialkarten.karten.rauchbombe?.effekte ?? []).find((e) => e.typ === 'rauch')?.energie ?? 1;
  const personen = [1, 2, 3, 4];
  const fluchtZeilen = personen.map((n) => {
    const f = fw.feuer.tabelle[n];
    return `<tr><td><b>${n}</b> ${n === 1 ? 'Figur (Jeder gegen jeden)' : `Figuren${n === 2 ? ' (Kooperativ 2, Team)' : ` (Kooperativ ${n})`}`}</td>
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
  <h1>📖 Pyronesos – Entkomme der Insel <span class="hinweis">Version 12 · Regelstand 05.11.2026 mit Team-Notizen · Konfiguration «${esc(app.presetName)}»${geaendertZahl() ? ` (${geaendertZahl()} ${geaendertZahl() === 1 ? 'Wert' : 'Werte'} angepasst)` : ''}</span></h1>
  <p class="regeln-werkzeug"><button type="button" id="regelnAlsText">📄 Regeln als Text</button> <span class="hinweis">Das ganze Regelwerk als Textdatei, aus denselben Werten erzeugt wie diese Seite. <span class="abweichung">Markierte Werte</span> weichen vom Standard ab. <span class="annahme">Annahme</span> = Auslegung des Prototyps, im Team zu bestätigen. <span class="neu-v12">neu</span> = aus den Team-Notizen.</span></p>
  <div class="regel-chat regeln-werkzeug"><b>💬 Regel-Chat</b> <span class="hinweis">Frage oder Stichwort eingeben. Die Antwort kommt direkt aus diesem Regeltext (ohne Internet).</span>
    <form id="regelChat"><input id="regelFrage" placeholder="z. B. «Kann der Kompass geraubt werden?» oder «Not-Floss»" autocomplete="off"/><button type="submit">Fragen</button></form>
    <div id="regelAntwort" class="regel-chat-antwort"></div>
  </div>
  <p>Flugzeugabsturz auf einer Vulkaninsel. Das Wrack liegt irgendwo im Wald, in der Mitte raucht ein aktiver Vulkan. Nach ${c.match.tage.ruhig + c.match.tage.ereignisse + (c.match.tage.lava ? 1 : 0)} Tagen kommt die Lava. Sammelt Rohstoffe, baut Werkzeuge und entkommt vorher. ${w('match.spielerMin')} bis ${w('match.spielerMax')} Personen, Kennerspiel ab 14 Jahren. Im Prototyp ist jeder Sitz Mensch oder KI.</p>

  <section><h2>🎲 Die Modi</h2>
    <table><thead><tr><th>Modus</th><th>Personen</th><th>Sieg</th><th>Sichtbarkeit</th><th>Fluchtkosten für</th></tr></thead><tbody>${MODI.map((m) => `<tr><td><b>${m[0]}</b></td><td>${m[1]}</td><td>${m[2]}</td><td>${m[3]}</td><td>${m[4]}</td></tr>`).join('')}</tbody></table>
    <ul>
      <li><b>Kooperativ</b> <span class="neu-v12">★ Empfohlen für die erste Partie</span>: Gewonnen nur, wenn alle gleichzeitig fliehen und niemand K.O. ist. Alles offen ausser Spezialkarten (Anzahl sichtbar). Handeln und Rohstoffe verschenken erlaubt. Wiederbeleben mit einer Pflanzenbandage von jemandem auf demselben oder einem Nachbarfeld, Wiedereinstieg mit ${w('figur.reanimationHerzen')} Herzen. Keine Duelle. Regel für die Gruppe: Alle dürfen Vorschläge machen, jede Person entscheidet selbst über ihre Figur.</li>
      <li><b>Team 2 gegen 2:</b> Team Sonne (Sitz 1 und 3) und Team Mond (Sitz 2 und 4), die Teammitglieder sitzen abwechselnd. Im Team alles offen, fürs andere Team verdeckt, Charaktere offen. Fliehen: beide auf demselben Feld, Kosten für 2 Figuren, gemeinsam bezahlt. Wiederbeleben nur durch den Teampartner. Duelle gegen das andere Team. Kompass und Routenkarte gelten fürs ganze Team.</li>
      <li><b>Jeder gegen jeden:</b> Alles verdeckt (auch der Charakter), nur die verdeckte Kompasskarte liegt vor dir. Keine Wiederbelebung, 0 Herzen = ausgeschieden <span class="annahme">Annahme</span> ${d.routeBeiAusscheiden === 'ablage' ? '(Kompass und Routenkarte sind dann aus dem Spiel)' : '(der Kompass liegt dann wieder unter seinem Vulkanfelsen, die Routenkarte geht auf die Ablage)'}. Wer zuerst flieht oder als Letzter übrig bleibt, gewinnt.</li>
    </ul>
    <p>K.O.-Figuren setzen ihren Zug aus, bis sie wiederbelebt sind.</p>
  </section>

  <section><h2>🗺️ Spielfeld</h2>
    <p>Sechseck-Raster mit Kantenlänge 8, also 8 Ringe: 1 + 6 + 12 + 18 + 24 + 30 + 36 + 42 = 169 Felder. Einseitiges Brett. Ring 0 ist der Krater (wird nie abgeräumt), Ring 1 sind die 6 Vulkanfelsen, unter einem liegt der Kompass. Ringe 2–6: 115 Inselplättchen (Wald, Wiese, Gebirge, zufällig gemischt) plus 5 Sandfelder in den Buchten. Ring 7: Strandring mit ${STRANDRING} Feldern, im Uhrzeigersinn 1–${STRANDRING} nummeriert, Feld ${STRANDRING} grenzt an Feld 1. Alle 47 Strandplättchen (42 Ring + 5 Buchten) werden verdeckt gemischt verteilt.</p>
    <p>Die Rückseite jedes Plättchens zeigt das Biom, der Inhalt ist erst nach dem Aufdecken sichtbar. Kompassrose mit 8 Richtungen. Strandabschnitte: N 41–3, NO 4–8, O 9–14, SO 15–19, S 20–24, SW 25–29, W 30–35, NW 36–40.</p>
    <table class="biom-tabelle">${['wald', 'wiese', 'gebirge', 'strand'].map(biomZeile).join('')}<tr><td><img class="plaettchen-bild" src="${bild.hinten('vulkan')}" alt=""/> <b>Vulkan 7</b></td><td>1 Krater, 6 Vulkanfels (einer mit Kompass)</td></tr></table>
    <p><b>Nach dem Abbau:</b> Baum, Fels, Blätterbusch und Strandgut werden entfernt, es bleibt leerer Boden. Tierfelder bleiben als Hindernis, bis das Tier besiegt ist; dann geht das Tier zurück in den Beutel und das Plättchen weg. Wasserquellen, Flugzeugwrack und Vulkan bleiben immer liegen. Ein offenes Tier ist ein Hindernis: aussen herum gehen oder angreifen, durchlaufen geht nicht.</p>
    <p><b>Biom für Tageskarten:</b> Wald = dunkelgrünes Feld, Wiese = hellgrünes Feld; das Feld merkt sich das Biom des ursprünglichen Plättchens, auch nach dem Abbau. Gebirge = die Figur steht auf einem Stein- oder Vulkanplättchen oder auf dem Vulkan <span class="annahme">Annahme</span> (das graue Gebirgsplättchen liegt noch auf dem Feld, oder Vulkanfeld).</p>
    <p><span class="neu-v12">neu</span> <b>Vulkanfelsen nur durch Betreten aufdecken:</b> Die 6 Vulkanfelsen können nicht per Weitsicht, Altem Fernglas, Altem Aussichtsfelsen oder Vollmond aufgedeckt werden. Man muss draufgehen.</p>
  </section>

  <section><h2>📦 Material und Vorrat</h2>
    <p>${c.vorrat.unbegrenzt ? 'Der Vorrat ist unbegrenzt.' : `Der Vorrat ist begrenzt. Rohstoffkarten: ${w('vorrat.karten')}. Ausrüstungskarten: Steinaxt ${w('vorrat.ausruestung.axt')}, Spitzhacke ${w('vorrat.ausruestung.hacke')}, Holzspeer ${w('vorrat.ausruestung.holzspeer')}, Stein-Machete ${w('vorrat.ausruestung.steinmachete')}, Pflanzenbandage ${w('vorrat.ausruestung.bandage')}. Bau-Marker: Lagerfeuer ${w('vorrat.marker.lagerfeuer')}, Shelter ${w('vorrat.marker.shelter')}, Floss ${w('vorrat.marker.floss')}.`} Tierbeutel: 15 kleine Tiere (${esc(klein)}) und 10 grosse (${esc(gross)}). Würfel: Erkundungswürfel W${w('zug.weitsicht.wuerfel')}, Kampfwürfel W6.</p>
    <p>Ist ein Vorrat leer, gibt es nichts mehr davon <span class="annahme">Annahme</span>. Das Spiel meldet es im Protokoll («Vorrat leer»).</p>
  </section>

  <section><h2>🧍 Tableau, Inventar und Charaktere</h2>
    <p>Herzen: Start ${w('figur.herzen')}, Maximum ${w('figur.herzen')} (Überlebenskünstler ${w('charaktere.ueberlebenskuenstler.herzen')}). 0 Herzen = K.O. Energie: 0 bis ${w('figur.energie')}, Start ${w('figur.energie')}, nie darüber. Kein Handkartenlimit. Rohstoffe, Nahrung, Werkzeuge, Waffen, Bandagen, Spezialkarten und die Routenkarte sind auf der Hand${c.ausruestung.offen ? ' <span class="abweichung">(Test-Schalter: Werkzeuge und Waffen liegen offen)</span>' : ''}${c.ausruestung.limitProTyp ? ' <span class="abweichung">(Test-Schalter: höchstens 1 Werkzeug oder Waffe pro Typ)</span>' : ''}.</p>
    <p><span class="neu-v12">neu</span> <b>Die Kompasskarte liegt verdeckt vor dir</b> auf dem Tisch, nicht auf der Hand. Alle sehen, dass dort eine Kompasskarte liegt.</p>
    <p>Sechs Charaktere, zufällig verteilt, jeder höchstens einmal:</p>
    <div class="charakter-raster">${charaktere}</div>
  </section>

  <section><h2>🧰 Spielaufbau</h2>
    <ol>
      <li>Vulkan: Krater in die Mitte, 6 Vulkanfelsen verdeckt mischen (einer mit Kompass).</li>
      <li>47 Strandplättchen verdeckt auf alle Sandfelder (42 Ring + 5 Buchten).</li>
      <li>Wald-, Wiesen- und Gebirgsplättchen zusammen mischen und auf alle grünen Felder legen.</li>
      <li>Tageskarten: ${w('match.tage.ruhig')} der 10 Ruhigen Tage und ${w('match.tage.ereignisse')} der 19 Ereignisse mischen, die Lava-Endkarte als letzte Karte darunter. Der Rest ist aus dem Spiel.</li>
      <li>Spezialkarten: Brennsprit heraus. Aus den übrigen ${pool - 1} verdeckt ${c.spezialkarten.stapel - 1} ziehen. ${c.spezialkarten.stapel - c.spezialkarten.brennspritOben} davon als unteren Stapel. Den Brennsprit unter die übrigen ${c.spezialkarten.brennspritOben - 1} mischen und diese ${w('spezialkarten.brennspritOben')} obendrauf. Der Brennsprit liegt damit immer unter den ersten ${c.spezialkarten.brennspritOben} Karten. Die restlichen Karten sind aus dem Spiel.</li>
      <li>${8 * c.routen.jeRichtung} Routenkarten mischen (8 Richtungen je ${w('routen.jeRichtung')}-mal). Vorrat bereitlegen, Tiere in den Beutel.</li>
      <li>Charaktere zufällig verteilen, Herzen ${w('figur.herzen')} (Überlebenskünstler ${w('charaktere.ueberlebenskuenstler.herzen')}), Energie ${w('figur.energie')}.</li>
      <li>Feste Startfelder: 2 Personen ${c.figur.startfeld.felder[2].join(' und ')} · 3 Personen ${c.figur.startfeld.felder[3].join(', ')} · 4 Personen ${c.figur.startfeld.felder[4].join(', ')}.</li>
      <li>Alle werfen 1× W6. Der höchste Wurf ist Startperson. In absteigender Reihenfolge (Gleichstand: nochmals werfen) wählt jede Person ein freies Startfeld und läuft von dort so viele Felder <b>gegen den Uhrzeigersinn</b>, wie sie gewürfelt hat. Der gleiche Wurf zählt für Reihenfolge und Schritte. <span class="annahme">Annahme</span> Im Prototyp wird das freie Startfeld zufällig gewählt.</li>
      <li>Das Strandplättchen unter der Figur kommt ungesehen aus dem Spiel. Alle starten auf leerem Sand.</li>
    </ol>
    <p>Gespielt wird im Uhrzeigersinn, die Startperson beginnt.</p>
  </section>

  <section><h2>⏳ Ablauf eines Tages</h2>
    <ol>
      <li>${c.zug.energieProTag > 0 ? `<span class="neu-v12">neu</span> Alle Figuren, die nicht K.O. sind, bekommen +${w('zug.energieProTag')} Energie (Maximum ${w('figur.energie')}). <span class="annahme">Annahme</span> Das kommt vor der Tageskarte und gilt ab dem zweiten Tag.` : '<span class="abweichung">Test-Schalter: keine Energie zu Tagesbeginn.</span>'}</li>
      <li>Die Startperson deckt 1 Tageskarte auf. Sie wird gross in der Mitte gezeigt und gilt sofort für alle (meist bis zum Ende des Tages).</li>
      <li>Alle machen der Reihe nach ihren Zug.</li>
      <li>Wird die Lava-Karte aufgedeckt, ist das Spiel sofort vorbei: alle auf der Insel verlieren.</li>
    </ol>
  </section>

  <section><h2>🔄 Der Zug in vier Phasen</h2>
    <h3>Phase 1 · Weitsicht</h3>
    <ul>
      <li>W${w('zug.weitsicht.wuerfel')} werfen und so viele verdeckte Plättchen im Umkreis von ${w('zug.weitsicht.radius')} Feldern aufdecken (du wählst). Kundschafter +${w('charaktere.kundschafter.kacheln')}, Altes Fernglas Umkreis 3. Vulkanfelsen sind ausgenommen.</li>
      <li>Tierfeld aufgedeckt: sofort blind ein Tier ziehen und offen darauflegen.</li>
      <li>Spezialfeld aus der Ferne aufgedeckt: sofort die oberste Spezialkarte ziehen und abhandeln.</li>
    </ul>
    <h3>Phase 2 · Bewegung</h3>
    <ul>
      <li>${w('zug.schrittEnergie')} Energie pro Schritt, beliebig weit, solange die Energie reicht. Ein verdecktes Feld wird beim Betreten sofort aufgedeckt.</li>
      <li>Verdecktes Tierfeld betreten: Tier ziehen, Pflichtkampf, keine Flucht${t.flucht ? ` <span class="abweichung">(Test-Schalter: für ${t.fluchtEnergie} Energie 1 Feld zurück oder zur Seite)</span>` : ''}. Offenes Tier: umgehen oder gezielt angreifen.</li>
      <li>Spezialfeld betreten: oberste Spezialkarte ziehen.</li>
      <li>Wasserquelle betreten: Das Spiel bietet «💧 Trinken» an. Trinken = Energie auf ${w('zug.wasser.auffuellen')}, der Zug endet sofort. <span class="annahme">Annahme</span> Trinken ist freiwillig, man kann auch durchlaufen. Bei Dürre gibt die Quelle keine Energie.</li>
      <li><span class="neu-v12">neu</span> Vulkanfels betreten: Der Fels wird aufgedeckt. Den Kompass bergen geht nur mit Spitzhacke, kostet ${w('zug.kompassEnergie')} Energie und beendet ${z.kompassBeendetZug ? 'den Zug' : 'die Bewegung'}.</li>
    </ul>
    <h3>Phase 3 · Abbauen oder Rasten</h3>
    <ul>
      <li>Abbauen: ${z.abbauEnergie ? `${w('zug.abbauEnergie')} Energie` : '0 Energie'}, beendet die Bewegung, Phase 4 bleibt möglich. Das Plättchen wird entfernt. Baum: ${rohstoffText(z.ertrag.baum.basis)} (Steinaxt: 3 Holz + 1 Blatt) · Fels: ${rohstoffText(z.ertrag.fels.basis)} (Spitzhacke: 3 Stein) · Blätterbusch: ${rohstoffText(z.ertrag.blaetterbusch.basis)} · Strandgut: ${rohstoffText(z.ertrag.strandgut.basis)}.</li>
      <li>Rasten: Wer sich im ganzen Zug nicht bewegt und nichts abgebaut hat, bekommt +${w('zug.rasten')} Energie. Im Shelter gibt es stattdessen mehr, siehe unten.</li>
      <li><span class="neu-v12">neu 10.11.</span> <b>Shelter wie die Wasserquelle:</b> Wer im Zug auf einem Shelterfeld steht (auch nach der Bewegung), kann sich erholen: +${w('zug.rastenShelter')} Energie (höchstens ${w('figur.energie')}), danach endet der Zug. Das gilt für alle Figuren, die auf dem Feld stehen.</li>
    </ul>
    <h3>Phase 4 · Aktionen (beliebige Reihenfolge)</h3>
    <ul>
      <li>Bauen und Craften (0 Energie).</li>
      <li>Nahrung essen: +${w('zug.nahrungEnergie')} Energie, jederzeit im eigenen Zug.</li>
      <li>Pflanzenbandage: +${w('crafting.bandageHerzen')} Herzen oder Wiederbelebung.</li>
      <li>Handkarten ausspielen.</li>
      <li>Handel: ${w('zug.handel.proZug')}× pro Zug mit einer Person im Umkreis ${w('zug.handel.radius')}, höchstens ${w('zug.handel.maxKarten')} Karten pro Seite. Im Kooperativ-Modus auch verschenken. <span class="annahme">Annahme</span> Im Prototyp sind Rohstoffe, der Brennsprit und die Routenkarte tauschbar, die Kompasskarte nicht.</li>
      <li>Duell (nur Team und Jeder gegen jeden), siehe unten. <span class="neu-v12">neu 10.11.</span> Nach einem Duell endet der Zug.</li>
    </ul>
  </section>

  ${d.aktiv ? `<section><h2>⚔️ Duell</h2>
    <ul>
      <li>${w('duelle.proZug')}× pro Zug, Ziel im Umkreis ${w('duelle.radius')}, kostet ${w('duelle.energie')} Energie. Kein Duell im Kooperativ-Modus.</li>
      <li>Beide werfen W6 + Waffe. Der höhere Wert gewinnt, Gleichstand = nichts. <span class="annahme">Annahme</span> Im Kampf und im Duell zählt nur die beste Waffe, Speer und Machete addieren sich nicht.</li>
      <li>Der Verlierer verliert ${w('duelle.herzen')} Herz. Der Sieger nimmt genau eins: 1 Handkarte blind (das kann die Routenkarte sein) <b>oder</b> die verdeckte Kompasskarte, falls der Verlierer sie hat.</li>
      <li><span class="neu-v12">neu</span> Die Kompasskarte kann nur bei einem verlorenen <b>normalen</b> Duell geraubt werden, nicht beim Fern-Duell (Karte «Duell-Herausforderung»).</li>
      <li><span class="neu-v12">neu 10.11.</span> <b>Nach einem Duell endet der Zug</b>, egal wie es ausgeht (auch bei Gleichstand). Das gilt für das normale Duell und für das Fern-Duell.</li>
    </ul>
  </section>` : ''}

  <section><h2>🐾 Tierkampf</h2>
    <ul>
      <li>W6 + Boni ≥ Zielwert = Sieg (Gleichstand reicht). Boni: Holzspeer +${w('crafting.rezepte.holzspeer.kampf')}, Stein-Machete +${w('crafting.rezepte.steinmachete.kampf')}, Jäger +${w('charaktere.jaeger.kampf')}, Schärfstein +2. Das Jagdmesser gewinnt automatisch.</li>
      <li>Klein (Zielwert ${w('tiere.zielKlein')}): Sieg ${w('tiere.nahrungKlein')} Nahrung, Niederlage −${w('tiere.schaden.hase')} Herz.</li>
      <li>Gross (Zielwert ${w('tiere.zielGross')}): Sieg ${w('tiere.nahrungGross')} Nahrung, Niederlage −${w('tiere.schaden.baer')} Herzen.</li>
      <li>Sieg: Das Tier geht zurück in den Beutel, das Plättchen weg.</li>
      <li><span class="neu-v12">neu 10.11.</span> Niederlage gegen ein <b>grosses Tier</b>: Schaden, die Figur geht zurück aufs vorherige Feld, das Tier bleibt liegen, der Zug endet.</li>
      <li><span class="neu-v12">neu 10.11.</span> Niederlage gegen ein <b>kleines Tier</b>: Schaden, das Tier verschwindet (zurück in den Beutel, das Plättchen weg), die Figur bleibt auf dem Feld stehen, der Zug endet.</li>
      <li>Hinterhalt (Spezialkarte): Die Figur bleibt stehen, das Tier geht nach dem Kampf zurück in den Beutel.</li>
      <li><span class="neu-v12">neu 10.11.</span> <b>Rauchbombe:</b> Wer einen Tierkampf oder ein Duell verliert und eine Rauchbombe hat, wird gefragt. Einsetzen = 0 Schaden, du wählst selbst ein sicheres Nachbarfeld (aufgedeckt, ohne Tier, ${rauchEnergie} Energie). Nach einem Tierkampf geht dein Zug danach weiter, das Tier bleibt liegen. Im Duell gibt es dann keine Beute.</li>
      <li>Ist der Beutel leer, bleibt das Tierfeld leer. Bei «Wildnis» kämpfen alle Tiere mit +1.</li>
    </ul>
    <div class="token-reihe">${[...Object.keys(t.klein), ...Object.keys(t.gross)].map((x) => `<figure><img src="${bild.tier(x)}" alt=""/><figcaption>${esc(TIER[x]?.name ?? x)}</figcaption></figure>`).join('')}</div>
  </section>

  <section><h2>🛠️ Crafting</h2>
    <table><thead><tr><th>Gegenstand</th><th>Rezept</th><th>Wirkung</th></tr></thead><tbody>${rezepte}</tbody></table>
    <p>Der Sanitäter braucht für die Pflanzenbandage nur ${rohstoffText(c.charaktere.sanitaeter.bandageKosten)}. «Bei einem Lagerfeuer» heisst: auf dem Feuerfeld oder einem Nachbarfeld. Das Lagerfeuer brennt dauerhaft.</p>
  </section>

  <section><h2>☀️ Tageskarten</h2>
    <p>10 Ruhige Tage (${w('match.tage.ruhig')} im Spiel), 19 Ereignisse (${w('match.tage.ereignisse')} im Spiel), 1 Lava-Endkarte. Wer etwas abgeben muss und es nicht hat, bekommt die Strafe. Gewitter und Wolkenbruch gibt es nicht mehr.</p>
    <table class="karten-tabelle"><thead><tr><th>#</th><th>Karte</th><th>Ereignis und Wirkung</th></tr></thead><tbody>${tageskarten}</tbody></table>
  </section>

  <section><h2>❗ Spezialkarten</h2>
    <p>${pool} Karten im Pool, ${w('spezialkarten.stapel')} im Stapel. Der Brennsprit liegt immer unter den ersten ${w('spezialkarten.brennspritOben')} Karten.</p>
    <h3>Handkarten (beim Ziehen sehen die anderen nur die Rückseite, beim Ausspielen alle die Karte)</h3>
    <table class="karten-tabelle"><tbody>${spezialZeilen((a) => a === 'joker')}</tbody></table>
    <h3>Sofort-Karten: Glücksfunde und Gefahren (gross für alle gezeigt)</h3>
    <table class="karten-tabelle"><tbody>${spezialZeilen((a) => a !== 'joker')}</tbody></table>
  </section>

  <section><h2>🧭 Kompass und Routen</h2>
    <ul>
      <li>Der Kompass liegt unter einem der 6 Vulkanfelsen. Er ist nur durch Betreten auffindbar und nur mit Spitzhacke bergbar (${w('zug.kompassEnergie')} Energie, beendet ${z.kompassBeendetZug ? 'den Zug' : 'die Bewegung'}).</li>
      <li>Die Kompasskarte liegt verdeckt vor der Person. Im normalen Duell ist sie raubbar, im Fern-Duell nicht.</li>
      <li>Wer den Kompass besitzt, zieht 1 Routenkarte auf die Hand (Jeder gegen jeden und Team geheim, Kooperativ offen). ${8 * c.routen.jeRichtung} Karten, 8 Richtungen je ${w('routen.jeRichtung')}-mal.</li>
      <li>Wird der Kompass geraubt, behält der Verlierer seine Routenkarte (sie ist eine normale Handkarte). Der neue Besitzer zieht eine eigene Routenkarte.</li>
      <li>Im Team gelten Kompass und Routenkarte fürs ganze Team.</li>
      <li><span class="annahme">Annahme</span> Jede Person hält höchstens 1 Routenkarte. Wer den Kompass hat, aber keine Routenkarte mehr (blind geraubt), zieht zu Beginn des eigenen Zugs eine neue. Wer eine Routenkarte blind raubt und schon eine hat, legt die erbeutete ab.</li>
    </ul>
  </section>

  <section><h2>🏆 Flucht</h2>
    <p>Die Kosten gelten pro fliehende Figur. Kooperativ: alle fliehen · Team: beide Teammitglieder · Jeder gegen jeden: nur die eigene Figur.</p>
    <table class="flucht-tabelle"><thead><tr><th>Fliehende Figuren</th><th>🛶 Solides Floss (sicher)</th><th>🛶 Not-Floss (W6-Risiko)</th><th>🔥 Küsten-Signalfeuer</th><th>✈️ Flugzeugwrack</th></tr></thead><tbody>${fluchtZeilen}</tbody></table>
    <ol>
      ${fw.floss.aktiv ? `<li><b>🛶 Weg 1 · Floss.</b> Voraussetzung: ${fw.floss.kompassNoetig ? '<span class="neu-v12">neu</span> Kompass, ' : ''}Routenkarte auf der Hand, Figur im richtigen Strandabschnitt. Das gilt für das solide Floss und für das Not-Floss. Kooperativ: Routenkarte offen, 📍 Sammelfeld im Abschnitt, bezahlt wird aus allen Inventaren der Figuren auf diesem Feld. Bei «Sturm» gibt es keine Floss-Flucht.${fw.floss.not.aktiv ? `<br><b>Not-Floss:</b> 1× W6 für alle. 1–${w('fluchtwege.floss.not.kentertBis')}: das Floss zerbricht, alle −${w('fluchtwege.floss.not.schaden')} Herzen. ${fw.floss.not.kentertBis + 1}–${w('fluchtwege.floss.not.landBis')}: zurück an Land (${fw.floss.not.nachLandGratis ? (fw.floss.not.nachLandGratisNurKoop ? 'Kooperativ: das Floss bleibt liegen und kann am nächsten Tag ohne neues Material erneut eingesetzt werden; Team und Jeder gegen jeden: Material weg' : 'das Floss bleibt liegen und kann am nächsten Tag ohne neues Material erneut eingesetzt werden') : 'Material weg'}). ${fw.floss.not.landBis + 1}–6: Flucht geglückt.<br><span class="annahme">Annahme</span> Die Routenkarte wird erst bei geglückter Flucht abgegeben. Misslingt das Not-Floss, bleibt sie auf der Hand.` : ''}</li>` : ''}
      ${fw.feuer.aktiv ? `<li><b>🔥 Weg 2 · Küsten-Signalfeuer.</b> Normale Lagerfeuer (je ${w('crafting.rezepte.lagerfeuer.kosten')}) auf den Strandfeldern 1–${STRANDRING}, gezählt rund um den Ring. Alle Feuer der Kette müssen untereinander mindestens den Abstand aus der Tabelle haben. Team und Jeder gegen jeden: nur eigene Feuer bzw. Team-Feuer zählen. Kooperativ: alle Feuer zählen${fw.feuer.koopAlleAufFeuer ? ', und nach dem letzten Feuer müssen alle Figuren auf einem Feuerfeld der Kette stehen (nicht zwingend demselben)' : ''}.</li>` : ''}
      ${fw.wrack.aktiv ? `<li><b>✈️ Weg 3 · Flugzeugwrack.</b> Alle Fliehenden auf dem Wrackfeld, keiner K.O. Reparatur nach Tabelle${fw.wrack.brennsprit ? ', dazu 1 Brennsprit als Treibstoff (egal für wie viele Figuren)' : ''}.</li>` : ''}
    </ol>
  </section>

  <section><h2>🏁 Spielende</h2>
    <ul>
      <li>Flucht geglückt (Person, Team oder ganze Gruppe).</li>
      <li>Jeder gegen jeden: Der letzte Überlebende gewinnt.</li>
      <li>Kooperativ: Sind alle gleichzeitig K.O., ist die Partie verloren.</li>
      <li>Lava-Karte am letzten Tag: alle auf der Insel verlieren.</li>
    </ul>
  </section>

  <section><h2>🧪 Test-Schalter (für Playtests)</h2>
    <p>Standard = aktueller Regelstand. Jeder Schalter ist im Dialog «Neue Partie» einzeln umstellbar. Der Stand steht im Spielprotokoll und in der Simulation.</p>
    <table><thead><tr><th>Schalter</th><th>Standard</th><th>Alternative</th><th>Jetzt</th></tr></thead><tbody>${schalterListe(c).map((x) => `<tr><td><b>${esc(x.name)}</b></td><td>${esc(x.standard)}</td><td>${esc(x.alternative)}</td><td>${x.stand === 'standard' ? 'Standard' : `<span class="abweichung">${x.stand === 'alternative' ? 'Alternative' : 'eigener Wert'}</span>`}</td></tr>`).join('')}</tbody></table>
  </section>

  <section><h2>📝 Annahmen des Prototyps</h2>
    <p>Diese Punkte stehen so nicht ausdrücklich im Regelwerk. Der Prototyp legt sie so aus, bitte im Team bestätigen.</p>
    <ul>
      <li><span class="annahme">Annahme</span> Im Kampf und im Duell zählt nur die beste Waffe (Speer und Machete addieren sich nicht).</li>
      <li><span class="annahme">Annahme</span> Wasserquelle: Trinken ist freiwillig, man kann auch durchlaufen.</li>
      <li><span class="annahme">Annahme</span> «+1 Energie pro Tag» kommt vor der Tageskarte.</li>
      <li><span class="annahme">Annahme</span> Gebirge für Tageskarten = das graue Gebirgsplättchen liegt noch auf dem Feld, oder Vulkanfeld.</li>
      <li><span class="annahme">Annahme</span> Bei leerem Vorrat gibt es nichts.</li>
      <li><span class="annahme">Annahme</span> Die Routenkarte wird erst bei geglückter Floss-Flucht abgegeben.</li>
      <li><span class="annahme">Annahme</span> Wiederbeleben auf demselben oder einem Nachbarfeld gilt auch im Team-Modus.</li>
      <li><span class="annahme">Annahme</span> Scheidet der Kompassbesitzer aus (Jeder gegen jeden), liegt der Kompass wieder unter seinem Vulkanfelsen.</li>
      <li><span class="annahme">Annahme</span> Ein Hinterhalt mit kleinem Tier richtet den normalen Schaden eines kleinen Tiers an (kein Sonderfall mehr).</li>
      <li><span class="annahme">Annahme</span> Spieldauer «30 Tage» = 10 Ruhige Tage + 19 Ereignisse + Lava.</li>
      <li><span class="annahme">Annahme</span> Felsrutsch: Wer mehrere Waffen hat, verliert die schwächste.</li>
      <li><span class="annahme">Annahme</span> Rauchbombe im Duell: Auch wenn der Angreifer sie einsetzt, endet sein Zug, weil nach jedem Duell der Zug endet.</li>
      <li><span class="annahme">Annahme</span> «Sicheres Nachbarfeld» für die Rauchbombe = aufgedeckt, ohne Tier und ohne Spezialfeld.</li>
    </ul>
  </section>

  <section><h2>🃏 Zwei Arten zu spielen</h2>
    <ul>
      <li><b>Regel-Modus:</b> Das Programm setzt alle Regeln durch. Karten werden sichtbar vom Stapel gezogen, Würfel rollen in der Würfelschale. Du bedienst deinen Zug über Klicks auf Brett und Panel. KI-Mitspieler in vier Stufen, mit Persönlichkeit.</li>
      <li><b>Freier Tisch:</b> wie ein echter Spieltisch für Playtests – alles frei verschiebbar, Werte mit +/−, keine Regelprüfung, nur Menschen.</li>
    </ul>
    <p class="hinweis">Der Seed (oben in der Toolbar) bestimmt Insel und Stapel: gleicher Seed = gleiche Partie.</p>
  </section>
</article>`;
  regelChat(el);
  $('#regelnAlsText', el).addEventListener('click', () => herunterladen('pyronesos-v12-regeln.md', alsMarkdown($('.regeln', el)), 'text/markdown;charset=utf-8'));
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

// Regel-Chat: beantwortet Fragen mit den passendsten Stellen aus dem Regeltext dieser Seite (Stichwortsuche, ohne Internet).
const STOPP = new Set(['der', 'die', 'das', 'ein', 'eine', 'einen', 'und', 'oder', 'ist', 'sind', 'wie', 'was', 'wer', 'wann', 'kann', 'darf', 'man', 'ich', 'wir', 'mit', 'ohne', 'bei', 'beim', 'den', 'dem', 'des', 'von', 'für', 'auf', 'aus', 'nicht', 'auch', 'noch', 'nur', 'viel', 'viele', 'wird', 'werden', 'gibt', 'geht', 'muss', 'mein', 'meine', 'sich', 'dann', 'wenn', 'eigentlich', 'bitte', 'einem', 'einer', 'zum', 'zur', 'ins', 'als', 'hat', 'haben', 'habe']);
const SYNONYM = { ko: ['k.o.'], tot: ['k.o.', 'ausgeschieden'], sterben: ['k.o.', 'ausgeschieden'], reanimieren: ['wiederbeleb'], wiederbeleben: ['wiederbeleb'], heilen: ['herzen', 'bandage'], klauen: ['raub', 'blind'], stehlen: ['raub', 'blind'], rauben: ['raub'], geraubt: ['raub'], wasser: ['wasserquelle', 'trinken'], quelle: ['wasserquelle'], feuer: ['lagerfeuer', 'signalfeuer'], flugzeug: ['wrack'], boot: ['floss'], schlafen: ['rasten'], pause: ['rasten'], essen: ['nahrung'], waffe: ['speer', 'machete', 'waffe'], gewinnen: ['sieg', 'flucht', 'gewinnt'], verlieren: ['niederlage', 'verlieren'], start: ['startfeld', 'startperson'], anfang: ['aufbau', 'startfeld'], pvp: ['jeder gegen jeden'], koop: ['kooperativ'], coop: ['kooperativ'], tiere: ['tier'], kampf: ['tierkampf', 'kampf'], angriff: ['duell'], angreifen: ['duell', 'angreifen'], fernglas: ['fernglas', 'weitsicht'], aufdecken: ['aufdecken', 'weitsicht'], tauschen: ['handel'], schenken: ['verschenken'], geben: ['handel', 'verschenken'] };

function regelChat(el) {
  const form = el.querySelector('#regelChat'), feld = el.querySelector('#regelFrage'), aus = el.querySelector('#regelAntwort');
  if (!form) return;
  const stellen = [];
  for (const sec of el.querySelectorAll('.regeln section')) {
    const titel = sec.querySelector('h2')?.innerText.trim() ?? '';
    for (const e of sec.querySelectorAll('p, li, tr')) {
      const text = e.innerText.replace(/\s+/g, ' ').trim();
      if (text.length >= 12) stellen.push({ titel, text, klein: text.toLowerCase() });
    }
  }
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const frage = feld.value.trim();
    if (!frage) { aus.innerHTML = ''; return; }
    const woerter = frage.toLowerCase().replace(/[^a-zäöü0-9+\- ]/g, ' ').split(/\s+/).filter((x) => x.length >= 2 && !STOPP.has(x));
    const gruppen = woerter.map((x) => [x.length > 5 ? x.slice(0, x.length - 2) : x, ...(SYNONYM[x] ?? [])]);
    const bewertet = stellen.map((s) => {
      let punkte = 0, treffer = 0;
      for (const g of gruppen) { if (g.some((x) => s.klein.includes(x))) { treffer++; punkte += 2; } if (g.some((x) => s.titel.toLowerCase().includes(x))) punkte += 1; }
      if (treffer === gruppen.length && gruppen.length > 1) punkte += 3;
      return { s, punkte: punkte - Math.min(1, s.text.length / 900), treffer };
    }).filter((x) => x.treffer > 0).sort((a, b) => b.punkte - a.punkte).slice(0, 5);
    aus.innerHTML = bewertet.length
      ? `<div class="hinweis">Die passendsten Stellen im Regeltext:</div>${bewertet.map((x) => `<div class="treffer"><b class="wo">${esc(x.s.titel)}</b>${esc(x.s.text)}</div>`).join('')}`
      : '<div class="hinweis">Dazu steht nichts im Regeltext. Versuch ein anderes Stichwort, zum Beispiel «Kompass», «Not-Floss», «Duell» oder «Rasten».</div>';
  });
}
