// Regeln-Reiter im Aufbau der V10-Spielanleitung: Abschnitte, Tabellen mit Kartenbildern, Werte aus der aktuellen
// Konfiguration. Werte, die vom Standard V13 abweichen, sind markiert (Tooltip zeigt den Standard).
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
  ['Kooperativ ★ empfohlen für die erste Partie', '2 bis 4', 'alle fliehen zusammen, wer K.O. ist, muss vorher wiederbelebt werden', 'alles offen ausser Spezialkarten (Anzahl sichtbar), Routenkarte offen', 'alle Figuren (Spielerzahl)'],
  ['Team 2 gegen 2', 'genau 4', 'das Team, dessen beide Mitglieder zuerst fliehen (anderes Team in derselben Runde: nicht verloren)', 'im Team alles offen, fürs andere Team Handkarten und Routenkarte verdeckt', '2 Figuren (das Team)'],
  ['Jeder gegen jeden', '2 bis 4', 'wer zuerst flieht (dieselbe Runde: nicht verloren) oder als Letzte/r übrig bleibt', 'Handkarten und Routenkarte verdeckt, Werkzeuge und Waffen offen', '1 Figur'],
];

export function regelnZeigen(el) {
  const c = app.cfg, std = app.standard;
  // Wert mit Markierung, falls er vom Standard V13 abweicht.
  const w = (pfad, text = null) => {
    const v = lesen(c, pfad), s = lesen(std, pfad);
    const t = text ?? (typeof v === 'object' && v ? rohstoffText(v) : String(v));
    if (JSON.stringify(v) === JSON.stringify(s)) return esc(t);
    const st = typeof s === 'object' && s ? rohstoffText(s) : String(s);
    return `<span class="abweichung" title="Standard (Regelstand 11.11.2026): ${esc(st)}">${esc(t)}</span>`;
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
  <h1>📖 Pyronesos – Entkomme der Insel <span class="hinweis">Version 13 · Regelstand 11.11.2026 (Dokumentation V08, Spielanleitung v5) · Konfiguration «${esc(app.presetName)}»${geaendertZahl() ? ` (${geaendertZahl()} ${geaendertZahl() === 1 ? 'Wert' : 'Werte'} angepasst)` : ''}</span></h1>
  <p class="regeln-werkzeug"><button type="button" id="regelnAlsText">📄 Regeln als Text</button> <span class="hinweis">Das ganze Regelwerk als Textdatei, aus denselben Werten erzeugt wie diese Seite. <span class="abweichung">Markierte Werte</span> weichen vom Standard ab. <span class="annahme">Annahme</span> = Auslegung des Prototyps, im Team zu bestätigen. <span class="neu-v12">neu</span> = neu seit Version 11.</span></p>
  <div class="regel-chat regeln-werkzeug"><b>💬 Regel-Chat</b> <span class="hinweis">Frage oder Stichwort eingeben. Die Antwort kommt direkt aus diesem Regeltext (ohne Internet).</span>
    <form id="regelChat"><input id="regelFrage" placeholder="z. B. «Kann die Routenkarte geraubt werden?» oder «Plündern»" autocomplete="off"/><button type="submit">Fragen</button></form>
    <div id="regelAntwort" class="regel-chat-antwort"></div>
  </div>
  <p>Flugzeugabsturz auf einer Vulkaninsel. Das Wrack liegt irgendwo im Wald, in der Mitte raucht ein aktiver Vulkan. Nach ${c.match.tage.ruhig + c.match.tage.ereignisse + (c.match.tage.lava ? 1 : 0)} Tagen kommt die Lava. Sammelt Rohstoffe, baut Werkzeuge und entkommt vorher. ${w('match.spielerMin')} bis ${w('match.spielerMax')} Personen (Team-Modus genau 4), <span class="neu-v12">neu</span> ab 12 Jahren, 45–120 Minuten (erste Partie 75–120 Minuten). Höchstens ${c.match.tage.ruhig + c.match.tage.ereignisse + (c.match.tage.lava ? 1 : 0)} Spieltage, ein Tag = eine Runde. Im Prototyp ist jeder Sitz Mensch oder KI.</p>

  <section><h2>🎲 Die Modi</h2>
    <table><thead><tr><th>Modus</th><th>Personen</th><th>Sieg</th><th>Sichtbarkeit</th><th>Fluchtkosten für</th></tr></thead><tbody>${MODI.map((m) => `<tr><td><b>${m[0]}</b></td><td>${m[1]}</td><td>${m[2]}</td><td>${m[3]}</td><td>${m[4]}</td></tr>`).join('')}</tbody></table>
    <ul>
      <li><b>Kooperativ</b> <span class="neu-v12">★ Empfohlen für die erste Partie</span>: Alle fliehen zusammen, wer K.O. ist, muss vorher wiederbelebt werden. Alles offen ausser Spezialkarten (Anzahl sichtbar), die Routenkarte liegt offen. Handeln und verschenken erlaubt, keine Duelle. Das Floss-Tableau zeigt für die aktuelle Spielerzahl Material und fehlende Voraussetzungen. Regel für die Gruppe: Alle dürfen Vorschläge machen, jede Person entscheidet selbst über ihre Figur.</li>
      <li><b>Team 2 gegen 2</b> (genau 4): Team Sonne (Sitz 1 und 3) und Team Mond (Sitz 2 und 4), die Teammitglieder sitzen abwechselnd, die Zugreihenfolge wechselt zwischen den Teams. Im Team alles offen, Kompass und Routenkarte gelten fürs ganze Team. Fliehen: beide auf demselben Feld, Kosten für 2 Figuren. Wiederbeleben nur durch den Partner, Duelle nur gegen das andere Team. Eine K.O.-Figur kann vom anderen Team geplündert werden, danach kommt sie vom Brett und das Team spielt mit einer Figur weiter. <span class="annahme">Annahme</span> Wurde ein Teammitglied geplündert, darf das verbleibende Mitglied allein fliehen (Kosten für 1 Figur), das zählt als Team-Flucht.</li>
      <li><b>Jeder gegen jeden</b> (2–4): Handkarten und Routenkarte verdeckt, Werkzeuge und Waffen offen. Keine Wiederbelebung: K.O. = ausgeschieden und plünderbar. Duelle sind das wichtigste Mittel, um anderen die Routenkarte oder Material abzunehmen.</li>
    </ul>
    <p><span class="neu-v12">neu</span> Charakter, Herzen und Energie sind in allen Modi für alle sichtbar (kein Mogeln).</p>
  </section>

  <section><h2>🗺️ Spielfeld</h2>
    <p>Sechseck-Raster mit Kantenlänge 8, also 8 Ringe: 1 + 6 + 12 + 18 + 24 + 30 + 36 + 42 = 169 Felder. Einseitiges Brett. Ring 0 ist der Krater (wird nie abgeräumt), Ring 1 sind die 6 Vulkanfelsen, unter einem liegt der Kompass. Ringe 2–6 (120 Felder): 115 Inselplättchen (Wald 53, Wiese 27, Gebirge 35, zufällig gemischt) plus 5 Sandfelder in den Buchten. Ring 7: Strandring mit ${STRANDRING} Feldern, im Uhrzeigersinn 1–${STRANDRING} nummeriert, Feld ${STRANDRING} grenzt an Feld 1. Alle 47 Strandplättchen (42 Ring + 5 Buchten) werden verdeckt gemischt verteilt.</p>
    <p>Die Rückseite jedes Plättchens zeigt das Biom, der Inhalt ist erst nach dem Aufdecken sichtbar. Kompassrose mit 8 Richtungen. Strandabschnitte: N 41–3, NO 4–8, O 9–14, SO 15–19, S 20–24, SW 25–29, W 30–35, NW 36–40. Mehrere Figuren dürfen auf einem Feld stehen, man darf durch Felder mit Figuren durchlaufen.</p>
    <table class="biom-tabelle">${['wald', 'wiese', 'gebirge', 'strand'].map(biomZeile).join('')}<tr><td><img class="plaettchen-bild" src="${bild.hinten('vulkan')}" alt=""/> <b>Vulkan 7</b></td><td>1 Krater, 6 Vulkanfels (einer mit Kompass)</td></tr></table>
    <p>Summe: 20 Spezialfelder, 23 Tierfelder, 6 Quellen.</p>
    <h3>Was mit den Plättchen passiert</h3>
    <ul>
      <li><span class="neu-v12">neu</span> <b>Leeres Plättchen</b> (Leeres Dickicht, Freie Lichtung, Geröll, Sandbank, leerer Vulkanfels): kommt nach dem Aufdecken sofort vom Brett, auch per Weitsicht, Aussichtsfelsen oder Vollmond.</li>
      <li>Baum, Fels, Busch, Strandgut: kommt nach dem Abbau vom Brett.</li>
      <li><span class="neu-v12">neu</span> <b>Spezialfeld:</b> kommt weg, sobald jemand es betreten und die Karte gezogen hat.</li>
      <li>Tierfeld: siehe Tierkampf. Ein offenes Tier ist ein Hindernis: umgehen oder angreifen, durchlaufen geht nicht.</li>
      <li>Teiche/Quellen, Flugzeugwrack, Krater und der Vulkanfels mit dem Kompass bleiben liegen.</li>
    </ul>
    <p><span class="neu-v12">neu</span> <b>Biom für Tageskarten:</b> Jedes Feld merkt sich das Biom seines ursprünglichen Plättchens, auch nachdem das Plättchen weg ist. Wald = dunkelgrünes Feld, Wiese = hellgrünes Feld. Gebirge = Feld mit Stein-/Gebirgsplättchen oder Vulkanplättchen oder der Vulkan selbst, auch wenn das Plättchen schon weg ist.</p>
  </section>

  <section><h2>📦 Material und Vorrat</h2>
    <p>${c.vorrat.unbegrenzt ? 'Der Vorrat ist unbegrenzt.' : `Der Vorrat ist begrenzt. Rohstoffkarten: ${w('vorrat.karten')}. Ausrüstungskarten: Steinaxt ${w('vorrat.ausruestung.axt')}, Spitzhacke ${w('vorrat.ausruestung.hacke')}, Holzspeer ${w('vorrat.ausruestung.holzspeer')}, Machete ${w('vorrat.ausruestung.steinmachete')}, Bandage ${w('vorrat.ausruestung.bandage')}. Marker: Feuer ${w('vorrat.marker.lagerfeuer')}, Shelter ${w('vorrat.marker.shelter')}, Floss ${w('vorrat.marker.floss')}.`} Tierbeutel 25: klein ${esc(klein)} (= 15), gross ${esc(gross)} (= 10). Würfel: W${w('zug.weitsicht.wuerfel')} (Weitsicht), W6 (Kämpfe).</p>
    <p>Ist eine Sorte aufgebraucht, gibt es davon nichts mehr (das Spiel meldet es kurz im Protokoll). Das gilt auch für Marker und den Spezialkartenstapel.</p>
  </section>

  <section><h2>🧍 Spielerkarte, Werte und Besitz</h2>
    <ul>
      <li>Herzen: Start ${w('figur.herzen')}, Maximum ${w('figur.herzen')} (Überlebenskünstler ${w('charaktere.ueberlebenskuenstler.herzen')}/${w('charaktere.ueberlebenskuenstler.herzen')}). 0 Herzen = K.O.</li>
      <li>Energie: 0–${w('figur.energie')}, Start ${w('figur.energie')}, nie über ${w('figur.energie')}.</li>
      <li><b>Auf der Hand</b> (kein Limit): Rohstoff-, Nahrungs- und Spezialkarten.</li>
      <li><span class="neu-v12">neu</span> <b>Offen vor der Person:</b> Werkzeuge und Waffen, von jeder Sorte höchstens eines (1 Steinaxt, 1 Spitzhacke, 1 Holzspeer, 1 Machete). Bandagen werden direkt eingesetzt.</li>
      <li><span class="neu-v12">neu</span> <b>Verdeckt vor der Person:</b> die Routenkarte (keine Handkarte).</li>
      <li>Sichtbarkeit: Kooperativ alles offen ausser Spezialkarten (Anzahl sichtbar), Routenkarte offen. Team: im eigenen Team alles offen, für das andere Team sind Handkarten und Routenkarte verdeckt. Jeder gegen jeden: Handkarten und Routenkarte verdeckt, Werkzeuge und Waffen offen.</li>
      <li>Charakter, Herzen und Energie sind in allen Modi für alle sichtbar. Die Spielerkarte zeigt rechts alle Bau-Rezepte inklusive Lagerfeuer und Shelter.</li>
    </ul>
    <p>Sechs Charaktere, zufällig verteilt, jeder höchstens einmal:</p>
    <div class="charakter-raster">${charaktere}</div>
  </section>

  <section><h2>🧰 Spielaufbau</h2>
    <ol>
      <li>Inselinneres: 115 Plättchen (Wald 53, Wiese 27, Gebirge 35) verdeckt gemischt auf alle grünen Felder.</li>
      <li>Strand: 47 Strandplättchen verdeckt auf die 42 Randfelder und die 5 Buchten.</li>
      <li>Vulkan: Krater in die Mitte, 6 Vulkanfelsen verdeckt gemischt im Kreis darum.</li>
      <li>Tageskarten: ${w('match.tage.ruhig')} der 10 Ruhigen Tage + ${w('match.tage.ereignisse')} der 19 Ereignisse mischen, Lava-Karte als ${c.match.tage.ruhig + c.match.tage.ereignisse + 1}. Karte darunter. Rest aus dem Spiel.</li>
      <li>Spezialkarten: Brennsprit heraus. Aus den übrigen ${pool - 1} verdeckt ${c.spezialkarten.stapel - 1} ziehen. ${c.spezialkarten.stapel - c.spezialkarten.brennspritOben} davon als unteren Stapel. Brennsprit unter die übrigen ${c.spezialkarten.brennspritOben - 1} mischen, diese obendrauf. Der Brennsprit liegt damit immer unter den ersten ${w('spezialkarten.brennspritOben')} Karten. Restliche Karten aus dem Spiel.</li>
      <li>${8 * c.routen.jeRichtung} Routenkarten mischen.</li>
      <li>Vorrat bereitlegen, 25 Tiere in den Beutel.</li>
      <li>Charaktere zufällig verteilen, Herzen ${w('figur.herzen')} (Überlebenskünstler ${w('charaktere.ueberlebenskuenstler.herzen')}), Energie ${w('figur.energie')}.</li>
      <li>Feste Startfelder: <b>2 Personen ${c.figur.startfeld.felder[2].join(' und ')} · 3 Personen ${c.figur.startfeld.felder[3].join(', ')} · 4 Personen ${c.figur.startfeld.felder[4].join(', ')}</b>.</li>
      <li>Alle werfen nacheinander 1× W6. Wer am höchsten würfelt (bei Gleichstand nochmals), ist die Startperson, wählt ein Startfeld und zieht von dort so viele Felder <b>gegen den Uhrzeigersinn</b> dem Strand entlang, wie gewürfelt. Danach folgen die anderen in Sitzreihenfolge gegen den Uhrzeigersinn, jeweils mit ihrem eigenen Wurf und einem freien Startfeld. Beispiel: Wurf 5, Startfeld 17 → Figur steht auf Feld 12. <span class="annahme">Annahme</span> Im Prototyp wird das freie Startfeld zufällig gewählt.</li>
      <li>Das Strandplättchen unter jeder Figur kommt ungesehen aus dem Spiel. Alle starten auf leerem Sand.</li>
    </ol>
  </section>

  <section><h2>⏳ Ablauf eines Tages</h2>
    <ol>
      <li>${c.zug.energieProTag > 0 ? `<span class="neu-v12">neu</span> <b>Energie:</b> Alle Figuren, die nicht K.O. sind, bekommen +${w('zug.energieProTag')} Energie (höchstens ${w('figur.energie')}).` : '<span class="abweichung">Test-Schalter: keine Energie zu Tagesbeginn.</span>'}</li>
      <li><b>Tageskarte:</b> Die Startperson deckt die oberste Tageskarte auf. Sie wird gross in der Mitte angezeigt, gilt sofort für alle (ausser K.O.-Figuren) und bleibt den ganzen Tag liegen.</li>
      <li><span class="neu-v12">neu</span> <b>Züge:</b> Reihum <b>gegen den Uhrzeigersinn</b>, beginnend bei der Startperson. Die Startperson bleibt das ganze Spiel dieselbe und deckt immer die Tageskarte auf.</li>
      <li>Lava-Karte aufgedeckt = Spiel sofort vorbei, alle auf der Insel verlieren.</li>
    </ol>
  </section>

  <section><h2>🔄 Der Zug</h2>
    <p><span class="neu-v12">neu</span> Nur die Weitsicht ist fix am Anfang. Danach laufen, essen, bauen, Karten spielen, handeln und duellieren in beliebiger Reihenfolge und beliebig gemischt. Abbauen oder Rasten kommt zum Schluss. Nach dem Abbauen darf man nur noch craften, danach endet der Zug.</p>
    <h3>1 · Weitsicht (immer zuerst)</h3>
    <ul>
      <li>W${w('zug.weitsicht.wuerfel')} werfen, so viele verdeckte Plättchen im Umkreis von bis zu ${w('zug.weitsicht.radius')} Feldern aufdecken. Die Person wählt, welche.</li>
      <li>Kundschafter +${w('charaktere.kundschafter.kacheln')} Plättchen, Altes Fernglas Umkreis 3 statt 2, Nebel = keine Weitsicht.</li>
      <li>Vulkanfelsen können nie aufgedeckt werden (auch nicht per Aussichtsfelsen oder Vollmond).</li>
      <li>Tierfeld aufgedeckt: sofort blind ein Tier ziehen und offen darauflegen. Beutel leer = Feld gilt als leer und kommt weg.</li>
      <li><span class="neu-v12">neu</span> Spezialfeld aufgedeckt: <b>noch keine Karte</b>, die gibt es erst beim Betreten.</li>
      <li><span class="neu-v12">neu</span> Leeres Plättchen aufgedeckt: kommt vom Brett.</li>
    </ul>
    <h3>2 · Unterwegs (beliebig oft und gemischt)</h3>
    <p><b>Bewegen</b></p>
    <ul>
      <li>Jeder Schritt auf ein Nachbarfeld kostet ${w('zug.schrittEnergie')} Energie, beliebig weit, solange die Energie reicht. Läufer: bei 0 Energie noch ${w('charaktere.laeufer.zusatzfelder')} Feld gratis (1× pro Zug).</li>
      <li>Verdecktes Feld betreten = sofort aufdecken und abhandeln: leer → kommt vom Brett, weitergehen erlaubt · Rohstoff → hier kann zum Schluss abgebaut werden · Tierfeld → sofort Tier ziehen und kämpfen, Ausweichen geht nicht · Spezialfeld → oberste Spezialkarte ziehen, Plättchen kommt weg.</li>
      <li>Bereits aufgedecktes Spezialfeld betreten → Karte ziehen, Plättchen weg.</li>
      <li><span class="neu-v12">neu</span> Offenes Tier angreifen = Schritt auf sein Feld (${w('zug.schrittEnergie')} Energie) und Kampf.</li>
      <li>Teich/Quelle: man darf durchlaufen. Wer stehen bleibt und trinkt, hat Energie ${w('zug.wasser.auffuellen')}, der Zug endet. Bei Dürre gibt es keine Energie.</li>
      <li><span class="neu-v12">neu</span> <b>Shelter:</b> genau wie beim Teich. Man darf durchlaufen. Wer stehen bleibt und hineingeht, bekommt +${w('zug.rastenShelter')} Energie, der Zug endet.</li>
      <li><span class="neu-v12">neu</span> Vulkanfels betreten: wird aufgedeckt. Leer → kommt vom Brett. Kompass → Fels bleibt liegen, der Kompass kann mit Spitzhacke geborgen werden (siehe Abbauen).</li>
      <li><span class="neu-v12">neu</span> <b>Plündern</b> (Team und Jeder gegen jeden): Wer das Feld einer gegnerischen K.O.-Figur betritt, bekommt ihren ganzen Besitz, danach endet der Zug.</li>
    </ul>
    <p><b>Aktionen vor, zwischen und nach den Schritten</b></p>
    <ul>
      <li>Nahrung essen: 1 Nahrung abgeben, +${w('zug.nahrungEnergie')} Energie.</li>
      <li>Bauen (0 Energie, auch noch nach dem Abbauen möglich).</li>
      <li>Bandage einsetzen: +${w('crafting.bandageHerzen')} Herzen oder Wiederbelebung (im Prototyp: Bandage craften = sofort einsetzen).</li>
      <li>Spezialkarten von der Hand ausspielen.</li>
      <li><span class="neu-v12">neu</span> <b>Handeln:</b> ${w('zug.handel.proZug')}× pro Zug mit einer Person im Umkreis ${w('zug.handel.radius')}, höchstens ${w('zug.handel.maxKarten')} Karten pro Seite. Erlaubt: Rohstoffe, Nahrung, Werkzeuge, Spezialkarten, auch Brennsprit und Routenkarte. Das Werkzeug-Limit gilt auch beim Empfänger. Koop: Karten dürfen auch verschenkt werden.</li>
      <li><b>Duell</b> (nur Team und Jeder gegen jeden): siehe unten, beendet den Zug.</li>
    </ul>
    <h3>3 · Zum Schluss: Abbauen oder Rasten</h3>
    <ul>
      <li><span class="neu-v12">neu</span> <b>Nach dem Abbauen darf man noch craften</b> (beliebig viele Rezepte, auch mit den gerade abgebauten Rohstoffen), sonst nichts mehr: kein Schritt, kein Essen, kein Handeln, kein Duell, keine Handkarte. Danach endet der Zug. Im Spiel: nach dem Abbau sind nur noch das Bau-Menü und «Zug beenden» aktiv.</li>
      <li>Abbauen auf dem eigenen Feld, ${z.abbauEnergie ? `${w('zug.abbauEnergie')} Energie` : '0 Energie'}, das Plättchen kommt weg: Baum ${rohstoffText(z.ertrag.baum.basis)} (Steinaxt: 3 Holz + 1 Blatt) · Fels ${rohstoffText(z.ertrag.fels.basis)} (Spitzhacke: 3 Stein) · Busch ${rohstoffText(z.ertrag.blaetterbusch.basis)} · Strandgut ${rohstoffText(z.ertrag.strandgut.basis)}.</li>
      <li><span class="neu-v12">neu</span> <b>Kompass bergen</b> zählt wie Abbauen: auf dem offenen Kompass-Feld, Spitzhacke nötig, ${w('zug.kompassEnergie')} Energie. Sofort 1 Routenkarte ziehen und verdeckt vor sich legen (Koop: offen). Der Kompass kommt aus dem Spiel, eine zweite Routenkarte gibt es nicht. Der Vulkanfels bleibt als leeres Feld liegen.</li>
      <li>Rasten: wer sich in diesem Zug nicht bewegt (und nichts abgebaut) hat, +${w('zug.rasten')} Energie (Brise +3).</li>
      <li><span class="neu-v12">neu</span> Im Shelter bleiben (Zug auf dem Shelter-Feld begonnen und nicht bewegt): +${w('zug.rastenShelter')} Energie statt +${w('zug.rasten')}.</li>
    </ul>
    <p><b>Das beendet den Zug sofort:</b> Abbauen (nur Craften ist danach noch erlaubt), Kompass bergen (ebenso), Rasten, am Teich trinken, Shelter betreten, Tierkampf verloren, Duell führen, K.O.-Figur plündern, Gefahr «Tiefe Fallgrube». Die Person darf ihren Zug auch jederzeit freiwillig beenden (Knopf «Zug beenden»).</p>
  </section>

  <section><h2>🐾 Tierkampf</h2>
    <p>Ausgelöst durch: verdecktes Tierfeld betreten, offenes Tier angreifen, Gefahr «Hinterhalt».</p>
    <ul>
      <li>W6 + Boni ≥ Zielwert = Sieg (Gleichstand reicht). Boni: bessere Waffe (Holzspeer +${w('crafting.rezepte.holzspeer.kampf')} oder Machete +${w('crafting.rezepte.steinmachete.kampf')}, nicht beide), Jäger +${w('charaktere.jaeger.kampf')}, Schärfstein +2. Jagdmesser = sofortiger Sieg.</li>
      <li>Wildnis-Tageskarte: alle Tiere +1.</li>
    </ul>
    <table><thead><tr><th></th><th>Kleine Tiere (${w('tiere.zielKlein')}+)</th><th>Grosse Tiere (${w('tiere.zielGross')}+)</th></tr></thead><tbody>
      <tr><td><b>Sieg</b></td><td>${w('tiere.nahrungKlein')} Nahrung, Tier zurück in den Beutel, Plättchen weg, <span class="neu-v12">neu</span> <b>weiterziehen erlaubt</b></td><td>${w('tiere.nahrungGross')} Nahrung, Tier zurück in den Beutel, Plättchen weg, <span class="neu-v12">neu</span> <b>weiterziehen erlaubt</b></td></tr>
      <tr><td><b>Niederlage</b></td><td>−${w('tiere.schaden.hase')} Herz, Tier verschwindet trotzdem (zurück in den Beutel, Plättchen weg), Figur bleibt auf dem Feld, Zug endet</td><td>−${w('tiere.schaden.baer')} Herzen, Figur zurück aufs Feld, von dem sie kam, Tier bleibt liegen, Zug endet</td></tr>
    </tbody></table>
    <p>Beim Hinterhalt gibt es kein «Herkunftsfeld»: bei Niederlage gegen ein grosses Tier bleibt die Figur stehen, das Tier kommt zurück in den Beutel.</p>
    <p><span class="neu-v12">neu</span> <b>Rauchbombe:</b> bei Tierkampf oder Duell 0 Schaden, Ausweichen auf ein nicht verdecktes Nachbarfeld nach Wahl, ${rauchEnergie} Energie (bei 0 Energie nicht einsetzbar), danach geht der Zug normal weiter. <span class="annahme">Annahme</span> Felder mit Tier oder Spezialfeld sind ausgenommen, das Tier bleibt nach dem Ausweichen liegen.</p>
    <div class="token-reihe">${[...Object.keys(t.klein), ...Object.keys(t.gross)].map((x) => `<figure><img src="${bild.tier(x)}" alt=""/><figcaption>${esc(TIER[x]?.name ?? x)}</figcaption></figure>`).join('')}</div>
  </section>

  ${d.aktiv ? `<section><h2>⚔️ Duell (nur Team und Jeder gegen jeden)</h2>
    <ul>
      <li>${w('duelle.proZug')}× pro Zug, Ziel bis ${w('duelle.radius')} Felder entfernt, kostet ${w('duelle.energie')} Energie. Nie gegen den eigenen Teampartner, nie gegen K.O.-Figuren.</li>
      <li>Beide W6 + bessere Waffe (Holzspeer +1 oder Machete +2, nicht beide). Gleichstand = nichts.</li>
      <li>Verlierer −${w('duelle.herzen')} Herz. <span class="neu-v12">neu</span> Sieger nimmt eines: <b>1 Handkarte blind</b> oder <b>die verdeckte Routenkarte</b> des Verlierers.</li>
      <li><span class="neu-v12">neu</span> Danach endet der Zug der angreifenden Person.</li>
      <li><b>Fern-Duell</b> (Karte Duell-Herausforderung): beliebige Distanz, beide nur W6 ohne Boni, Sieger zieht nur 1 Handkarte blind, <b>Routenkarte nicht raubbar</b>. Zug endet ebenfalls.</li>
    </ul>
  </section>` : ''}

  <section><h2>🩹 K.O. und Plündern</h2>
    <ul>
      <li>0 Herzen = K.O. Die Figur bleibt auf ihrem Feld liegen.</li>
      <li><b>Kooperativ und Team:</b> Wiederbeleben mit Bandage von demselben Feld oder einem Nachbarfeld, die Figur steht mit ${w('figur.reanimationHerzen')} Herzen auf und spielt ab ihrem nächsten Zug normal. Im Team nur durch den eigenen Partner. Solange K.O.: setzt aus, <span class="neu-v12">neu</span> kein +1 Energie, von Tageskarten nicht betroffen. Im Koop kann sie nicht ausgeraubt werden.</li>
      <li><b>Jeder gegen jeden:</b> Wer K.O. ist, scheidet aus.</li>
      <li><span class="neu-v12">neu</span> <b>Plündern (Jeder gegen jeden und Team):</b> Wer das Feld einer gegnerischen K.O.-Figur betritt, bekommt ihren ganzen Besitz (alle Karten, Werkzeuge, Waffen, Routenkarte). Danach endet sein Zug, und die geplünderte Figur kommt vom Brett (im Team ist sie damit endgültig ausgeschieden, Wiederbeleben geht nicht mehr). Den eigenen Teampartner kann man nicht plündern. Werkzeug-Limit beim Plündern: überzählige Werkzeuge gehen zurück in den Vorrat.</li>
      <li>Koop: Sind alle gleichzeitig K.O., verliert die Gruppe.</li>
    </ul>
  </section>

  <section><h2>🛠️ Bauen</h2>
    <p>Jederzeit im eigenen Zug, so oft man will, auch noch nach dem Abbauen (nicht nach dem Rasten). 0 Energie. Rohstoffe zurück in den Vorrat, Ausrüstungskarte oder Marker nehmen.</p>
    <table><thead><tr><th>Gegenstand</th><th>Rezept</th><th>Wirkung</th></tr></thead><tbody>${rezepte}</tbody></table>
    <ul>
      <li>Werkzeuge und Waffen: höchstens 1 pro Sorte, der Bau ist gesperrt, wenn man die Sorte schon hat.</li>
      <li><span class="neu-v12">neu</span> Feuer und Shelter nur auf leeren oder abgebauten Feldern (kein Plättchen mehr darauf), pro Feld höchstens 1 Feuer und 1 Shelter.</li>
      <li>Alle dürfen Feuer und Shelter nutzen. Jedes Feuer speichert, wer es gebaut hat (für das Signalfeuer). <span class="neu-v12">neu</span> Das Lagerfeuer heilt nicht mehr.</li>
      <li>Der Sanitäter braucht für die Bandage nur ${rohstoffText(c.charaktere.sanitaeter.bandageKosten)}, ohne Nahrung. «Bei einem Lagerfeuer» = auf dem Feuerfeld oder einem Nachbarfeld.</li>
    </ul>
  </section>

  <section><h2>☀️ Tageskarten</h2>
    <p>10 Ruhige Tage (${w('match.tage.ruhig')} im Spiel), 19 Ereignisse (${w('match.tage.ereignisse')} im Spiel), 1 Lava-Endkarte. «Nach links» = an die nächste Person in Zugreihenfolge. Wer etwas abgeben muss und es nicht hat, bekommt die Strafe. K.O.-Figuren sind nicht betroffen. <span class="neu-v12">neu</span> Die Gebirge-Regel gilt auch, wenn das Plättchen schon weg ist.</p>
    <table class="karten-tabelle"><thead><tr><th>#</th><th>Karte</th><th>Ereignis und Wirkung</th></tr></thead><tbody>${tageskarten}</tbody></table>
  </section>

  <section><h2>❗ Spezialkarten</h2>
    <p>${pool} Karten im Pool, ${w('spezialkarten.stapel')} im Stapel. Gezogen beim Betreten eines Spezialfelds. Stapel leer = nichts mehr. Handkarten sind geheim (ausser Anzahl im Koop), Glücksfunde und Gefahren wirken sofort.</p>
    <h3>Handkarten (beim Ziehen sehen die anderen nur die Rückseite, beim Ausspielen alle die Karte)</h3>
    <table class="karten-tabelle"><tbody>${spezialZeilen((a) => a === 'joker')}</tbody></table>
    <h3>Sofort-Karten: Glücksfunde und Gefahren (gross für alle gezeigt)</h3>
    <table class="karten-tabelle"><tbody>${spezialZeilen((a) => a !== 'joker')}</tbody></table>
  </section>

  <section><h2>🏆 Flucht</h2>
    <p>Die Kosten gelten pro fliehende Figur. Kooperativ: alle · Team: beide Partner · Jeder gegen jeden: nur die eigene Figur.</p>
    <table class="flucht-tabelle"><thead><tr><th>Fliehende Figuren</th><th>🛶 Solides Floss (sicher)</th><th>🛶 Not-Floss (W6)</th><th>🔥 Signalfeuer</th><th>✈️ Flugzeugwrack</th></tr></thead><tbody>${fluchtZeilen}</tbody></table>
    <ol>
      ${fw.floss.aktiv ? `<li><b>🛶 Weg 1 · Floss.</b> (1) Vulkanfels mit Kompass durch Betreten finden. (2) Mit Spitzhacke bergen (zählt wie Abbauen), sofort 1 Routenkarte verdeckt vor sich legen (Koop: offen). Der Kompass kommt aus dem Spiel. (3) Auf einem Strandfeld im Abschnitt der Routenkarte das Floss bauen: Rohstoffe und Routenkarte abgeben. Bei «Sturm» nicht möglich. Koop: alle treffen sich auf einem Feld im Abschnitt (📍 Sammelfeld) und bezahlen gemeinsam. Team: beide auf demselben Feld, bezahlen gemeinsam.${fw.floss.not.aktiv ? ` <b>Not-Floss:</b> 1× W6 für alle Fliehenden. 1–${w('fluchtwege.floss.not.kentertBis')}: Floss zerbricht, alle Fliehenden −${w('fluchtwege.floss.not.schaden')} Herzen. ${c.fluchtwege.floss.not.kentertBis + 1}–${w('fluchtwege.floss.not.landBis')}: zurück an Land – Team/Jeder gegen jeden: Material weg, <b>Routenkarte bleibt</b>; Koop: das Floss bleibt liegen und kann am nächsten Tag ohne neues Material nochmals benutzt werden. ${c.fluchtwege.floss.not.landBis + 1}–6: Flucht geglückt.` : ''}</li>` : ''}
      ${fw.feuer.aktiv ? `<li><b>🔥 Weg 2 · Signalfeuer.</b> Lagerfeuer (je ${w('crafting.rezepte.lagerfeuer.kosten')}) auf dem Strandring 1–${STRANDRING}, gezählt rund um den Ring (${STRANDRING} grenzt an 1). Zwischen zwei Feuern der Kette liegen mindestens so viele Felder wie in der Tabelle. Jeder gegen jeden: nur eigene Feuer · Team: nur Feuer des eigenen Teams · Koop: alle Feuer zählen${fw.feuer.koopAlleAufFeuer ? ', nach dem letzten Feuer müssen alle auf einem Feuerfeld der Kette stehen (nicht unbedingt demselben)' : ''}. Brennt das letzte Feuer mit richtigem Abstand (und im Koop stehen alle richtig), ist die Flucht geglückt.</li>` : ''}
      ${fw.wrack.aktiv ? `<li><b>✈️ Weg 3 · Flugzeugwrack.</b> Alle Fliehenden auf dem Wrackfeld, niemand K.O. Reparatur nach Tabelle${fw.wrack.brennsprit ? ', dazu 1 Brennsprit als Treibstoff (egal für wie viele Figuren)' : ''}.</li>` : ''}
    </ol>
  </section>

  <section><h2>🏁 Spielende und Sieg</h2>
    <ul>
      <li><span class="neu-v12">neu</span> <b>Sobald jemand erfolgreich flieht, wird die laufende Runde noch zu Ende gespielt</b> (bis zur Person vor der Startperson), damit alle gleich viele Züge haben. In dieser Runde dürfen auch andere noch fliehen. Geflohene Figuren setzen für den Rest aus.</li>
      <li>Lava-Karte aufgedeckt: alle auf der Insel verlieren.</li>
      <li>Jeder gegen jeden: nur noch eine Person übrig → sie gewinnt.</li>
      <li>Koop: alle gleichzeitig K.O. → Niederlage.</li>
    </ul>
    <table><thead><tr><th>Modus</th><th>Sieg</th></tr></thead><tbody>
      <tr><td>Kooperativ</td><td>alle fliehen zusammen, wer K.O. ist, muss vorher wiederbelebt werden</td></tr>
      <tr><td>Team</td><td>das Team, dessen beide Mitglieder zuerst fliehen; schafft es das andere Team in derselben Runde auch, hat es nicht verloren</td></tr>
      <tr><td>Jeder gegen jeden</td><td>wer zuerst flieht, gewinnt; wer in derselben Runde ebenfalls flieht, hat nicht verloren; wer als Letzte/r übrig bleibt, gewinnt ebenfalls</td></tr>
    </tbody></table>
    <p>Ergebnis-Anzeige mit drei Zuständen: <b>🏆 Gewonnen</b>, <b>⛵ Nicht verloren</b>, <b>🌋 Verloren</b>.</p>
  </section>

  <section><h2>🧪 Test-Schalter (für Playtests)</h2>
    <p>Standard = aktueller Regelstand. Jeder Schalter ist im Dialog «Neue Partie» einzeln umstellbar. Der Stand steht im Spielprotokoll und in der Simulation.</p>
    <table><thead><tr><th>Schalter</th><th>Standard</th><th>Alternative</th><th>Jetzt</th></tr></thead><tbody>${schalterListe(c).map((x) => `<tr><td><b>${esc(x.name)}</b></td><td>${esc(x.standard)}</td><td>${esc(x.alternative)}</td><td>${x.stand === 'standard' ? 'Standard' : `<span class="abweichung">${x.stand === 'alternative' ? 'Alternative' : 'eigener Wert'}</span>`}</td></tr>`).join('')}</tbody></table>
  </section>

  <section><h2>✅ Vom Team bestätigte Klarstellungen (11.11.)</h2>
    <ul>
      <li>Im Kampf und Duell zählt nur die bessere Waffe (Speer und Machete addieren sich nicht).</li>
      <li>Shelter wie Teich: Man darf durchlaufen. Wer stehen bleibt und hineingeht, bekommt +${w('zug.rastenShelter')} Energie, der Zug endet.</li>
      <li>Leere Plättchen kommen sofort beim Aufdecken vom Brett, auch per Weitsicht, Aussichtsfelsen oder Vollmond.</li>
      <li>Kleines Tier verloren: Tier kommt zurück in den Beutel, Plättchen weg.</li>
      <li>Charaktere liegen in allen Modi offen, damit alle sehen, wer wie viele Herzen und wie viel Energie hat (kein Mogeln).</li>
      <li>Plündern gibt es im Jeder gegen jeden und im Team-Modus. Die geplünderte Figur kommt danach vom Brett.</li>
      <li>Geflohene Figuren setzen bis Spielende aus.</li>
    </ul>
  </section>

  <section><h2>📝 Annahmen des Prototyps</h2>
    <p>Diese Punkte stehen so nicht ausdrücklich im Regelwerk. Der Prototyp legt sie so aus, bitte im Team bestätigen.</p>
    <ul>
      <li><span class="annahme">Annahme</span> Team: Wurde ein Teammitglied geplündert, darf das verbleibende Mitglied allein fliehen (Kosten für 1 Figur, Signalfeuer-Tabelle für 1 Figur), das zählt als Team-Flucht. Das Team gewinnt dann gemeinsam.</li>
      <li><span class="annahme">Annahme</span> Die Bandage wird beim Craften direkt eingesetzt (+${w('crafting.bandageHerzen')} Herzen) oder beim Wiederbeleben direkt gecraftet. Es gibt keine Bandage auf Vorrat.</li>
      <li><span class="annahme">Annahme</span> Nach dem Abbauen (und nach dem Kompass-Bergen) sind nur Rezepte erlaubt, also auch kein Floss- oder Wrack-Bau.</li>
      <li><span class="annahme">Annahme</span> Rasten gibt es nur über «Zug beenden» ohne Bewegung und ohne Abbau. Erzwungene Zugenden (Trinken, Shelter, Duell, Kampf verloren, Plündern, Fallgrube) geben keine zusätzliche Rast.</li>
      <li><span class="annahme">Annahme</span> Plündern geschieht automatisch beim Betreten des Feldes, auch wenn man nur durchlaufen wollte.</li>
      <li><span class="annahme">Annahme</span> Rauchbombe: Felder mit Tier oder Spezialfeld sind als Ausweichfeld ausgenommen. Im Duell endet der Zug der angreifenden Person trotzdem.</li>
      <li><span class="annahme">Annahme</span> Wiederbeleben auf demselben oder einem Nachbarfeld gilt auch im Team-Modus.</li>
      <li><span class="annahme">Annahme</span> Die Routenkarte wird erst bei geglückter Floss-Flucht abgegeben. Beim Not-Floss 1–4 bleibt sie liegen.</li>
      <li><span class="annahme">Annahme</span> Beim Handeln sind fremde Spezialkarten verdeckt: Man kann eigene Spezialkarten anbieten, aber keine bestimmte fremde Spezialkarte verlangen.</li>
      <li><span class="annahme">Annahme</span> Spieldauer «30 Tage» = 10 Ruhige Tage + 19 Ereignisse + Lava.</li>
      <li><span class="annahme">Annahme</span> Felsrutsch: Wer mehrere Waffen hat, verliert die schwächste.</li>
      <li><span class="annahme">Annahme</span> Auf dem Krater kann nicht gebaut werden.</li>
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
  $('#regelnAlsText', el).addEventListener('click', () => herunterladen('pyronesos-v13-regeln.md', alsMarkdown($('.regeln', el)), 'text/markdown;charset=utf-8'));
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
const SYNONYM = { ausrauben: ['plünder', 'raub'], routenkarte: ['routenkarte'], ko: ['k.o.'], tot: ['k.o.', 'ausgeschieden'], sterben: ['k.o.', 'ausgeschieden'], reanimieren: ['wiederbeleb'], wiederbeleben: ['wiederbeleb'], heilen: ['herzen', 'bandage'], klauen: ['raub', 'blind'], stehlen: ['raub', 'blind'], rauben: ['raub'], geraubt: ['raub'], wasser: ['wasserquelle', 'trinken'], quelle: ['wasserquelle'], feuer: ['lagerfeuer', 'signalfeuer'], flugzeug: ['wrack'], boot: ['floss'], schlafen: ['rasten'], pause: ['rasten'], essen: ['nahrung'], waffe: ['speer', 'machete', 'waffe'], gewinnen: ['sieg', 'flucht', 'gewinnt'], verlieren: ['niederlage', 'verlieren'], start: ['startfeld', 'startperson'], anfang: ['aufbau', 'startfeld'], pvp: ['jeder gegen jeden'], koop: ['kooperativ'], coop: ['kooperativ'], tiere: ['tier'], kampf: ['tierkampf', 'kampf'], angriff: ['duell'], angreifen: ['duell', 'angreifen'], fernglas: ['fernglas', 'weitsicht'], aufdecken: ['aufdecken', 'weitsicht'], tauschen: ['handel'], schenken: ['verschenken'], geben: ['handel', 'verschenken'] };

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
      : '<div class="hinweis">Dazu steht nichts im Regeltext. Versuch ein anderes Stichwort, zum Beispiel «Kompass», «Routenkarte», «Plündern», «Not-Floss», «Duell» oder «Rasten».</div>';
  });
}
