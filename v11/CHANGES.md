# Änderungen V11 gegenüber V10 und Abweichungen vom Auftrag

## Ausgangslage

- Von v10 liegt im Repository nur das fertige, minifizierte Build (`v10/assets/index-*.js`), kein Quellcode. V11 ist deshalb neu geschrieben. Die Regeln wurden aus dem v10-Code übernommen, Bilder, Brett-Raster und Farbpalette aus `v10/`.
- v9 wurde nur für die Regler-Idee angesehen (Konfigurationsbaum, Presets, Sweep, A/B, Replay). Es wurden keine Spielregeln aus v9 übernommen.

## Aufbau

- Eine Regel-Engine in reinem JavaScript (`engine/`), ohne Build-Schritt. Browser-Spiel, Simulation (Node und Web Worker) und Tests nutzen denselben Code.
- `config/config.json` ist die einzige Quelle aller Spielwerte (Standard V10). Presets in `config/presets/` (Standard, Einfach, Hart) sind Teilkonfigurationen und werden mit dem Standard zusammengeführt. Eigene Presets werden im Browser gespeichert oder als Datei exportiert und importiert.
- Zufall läuft nur über einen seedbaren Generator mit getrennten Quellen: Brett, Start, Tageskarten, Spezialkarten, Tierbeutel, Routenkarten, Würfel, Duell-Beute und je Bot eine eigene Quelle.
- Regler werden automatisch aus der Konfiguration abgeleitet (`engine/schema.js`, rund 300 Regler mit Namen, Mindest- und Höchstwert). Jeder Wert ist im Browser und in der Simulation einstellbar, dazu `--set PFAD=WERT` auf der Kommandozeile.
- Validator (`engine/validator.js`): Fehler blockieren den Start, Warnungen informieren nur, z. B. «Seil reicht nur knapp».
- Karten sind Daten aus dem Effekt-Baukasten (`engine/effekte.js`). Neue Phasen und neue Grundmechaniken (Rauch-Reaktion, Messer im Duell) bleiben bewusst im Code.

## Regelstand Abschnitt 1: in v10 fehlend oder abweichend, in V11 umgesetzt

- **Not-Floss (1.5):** Wurf 3–4 heisst «zurück an Land». Der nächste Versuch ist jetzt in allen Modi gratis (v10: nur im Koop, in Team und PvP war das Material verloren). Er geht erst am nächsten Tag. Beides sind Schalter.
- **Materialvorrat:** v10 hatte im Regel-Modus keinen begrenzten Vorrat. V11 begrenzt ihn standardmässig (Holz 30, Stein 20, Blätter 25, Seil 12, Abfall 20, Nahrung 15). Ein leerer Stapel gibt keinen Ertrag. «Unbegrenzt» ist ein Schalter.
- **Zählweise der Feuerkette (Fehler aus v10):** v10 hat ein korrekt gesetztes Feuer als «zählt nicht» markiert, wenn die fehlenden Feuer nicht alle in die Lücke rundum passten. Beispiel Koop 3: Feuer auf 2 und 18 – das dritte Feuer gehört auf 10, also zwischen die beiden. V11 zählt ein Feuer, solange die Kette damit noch vollständig gebaut werden kann (alle Abstände mindestens so gross wie verlangt, und die fehlenden Feuer passen in die Lücken). Die Siegbedingung ist unverändert. Siehe auch OFFENE_PUNKTE.md, Nr. 13.
- Alle übrigen Punkte aus Abschnitt 1 setzt v10 bereits um. Sie wurden 1:1 übernommen und mit Tests abgesichert (`test/stufe2.test.mjs`).

## Abweichungen vom Auftrag

- **Spielerzahl:** höchstens 4 (Antwort vom 27.10.: «es gibt nur 4 Spieler, also 2 gegen 2»). Der Regler geht von 2 bis 4, der Validator blockiert 5 und 6 mit Klartext. Team ist immer 2 gegen 2. Die Feuer-Tabelle hat deshalb nur die Zeilen 1 bis 4.
- **Shelter-Lager als vierter Weg:** entfällt (Antwort 27.10.).
- **Freier Tisch und Regel-Fragen** aus v10 sind nicht in V11 (Antwort 27.10.), v10 bleibt erreichbar.
- **Reihenfolge der Stufen:** Stufe 5 (Bots) und der Kern von Stufe 6 wurden vor Stufe 3 und 4 (Browser) gebaut, weil der Spieltisch KI-Mitspieler braucht.
- **Zeitbudget der Stufe «gut»:** Damit Partien mit gleichem Seed exakt gleich bleiben, bestimmt die Zahl der Stichproben (`ki.stichproben`, Standard 3) den Aufwand. Das Zeitbudget `ki.zeitbudgetMs` begrenzt zusätzlich nur im Browser. Die Vorausschau läuft höchstens zweimal pro Zug: zu Zugbeginn, beim Abbau oder vor dem Zugende.
- Die Würfelgrösse im Tier- und Duellkampf (W6) ist Teil der Grundmechanik und kein Regler.
- **Handel im PvP:** Bots schlagen im PvP keinen Handel vor, weil sie fremde Hände nicht kennen. Angebote nehmen sie nur an, wenn sie selbst profitieren. Im Koop und im Team verschenken sie Material gezielt: an den, der am Strand ein Lagerfeuer bauen kann, und Bandage-Material an Verletzte.

## Bots (Stufe 5)

- **Informationsgrenze:** Bots erhalten nur den Beobachtungs-Snapshot (`engine/sicht.js`). Darin fehlen verdeckte Plättchen, der Tierbeutel, Stapel-Reihenfolgen, künftige Tageskarten, fremde verdeckte Hände, fremde Routen-Richtungen und Zufallszustände. Der Spielleiter gibt keine Referenz auf den Spielzustand weiter. Ein Test verändert Verdecktes und prüft, dass Snapshot und Entscheid gleich bleiben.
- **Gedächtnis:** Ursprüngliche Plättcheninhalte, gespielte und gezogene Karten sowie bekannte Routen-Richtungen. Vergessen mit dem Regler «Vergesslichkeit». Unbekanntes wird aus Erlaubtem geschätzt: Inhalt verdeckter Felder, Anteil Gefahren im Spezialstapel.
- **Bedürfnisse und Planung:**
  - Essen mit Nahrungsreserve für den Siegweg.
  - Trinken als letzte Aktion: Die Laufstrecke endet an der Quelle. Bei Dürre geht der Bot nicht hin.
  - Rasten, wenn es nichts Besseres gibt.
  - Tierkampf mit Erwartungswert: Eine Niederlage kostet Schaden, Zurücksetzen und das Zugende.
  - Grosse Tiere meidet er, wenn er schwach ist.
  - Der Läufer nutzt sein Zusatzfeld gezielt.
- **Crafting und Siegweg:** Werkzeug vor dem Bedarf (Spitzhacke vor dem Kompass, Axt nur, wenn sie sich noch lohnt), Waffe vor grossen Tieren. Der Siegweg wird nach Aufwand in Schritten gewählt (Material, Wege, Kompass, Brennsprit) und gewechselt, wenn sich die Lage ändert.
  - Feuerkette: Strandnummern mit gültigem Rundum-Abstand, Material zum «Baumeister».
  - Floss: Die Figur mit der Routenkarte muss am Zielstrand stehen. Der Bot plant Seil über Blätter ein und wählt das Not-Floss bei Zeitnot oder wenn ein Gratis-Versuch bereitliegt.
- **Zusammenspiel:** Koop und Team mit Aufgabenteilung nach Nähe und Charakter (Kompass-Sucher), Reanimieren, Sammelfeld. Jeder Bot entscheidet selbst, alle rechnen aus offenen Infos gleich. PvP und Team: Duelle nach Nutzen, Routenkarte rauben, mit der Routenkarte Gegnern ausweichen, Beute nach Bedarf.
- **Stufen:** Zufall (Vergleichslinie), sehr einfach, einfach, normal, gut. Dazu Persönlichkeits-Regler je Bot: Risiko, Kooperation, Aggression, Ungeduld, Sparsamkeit, bevorzugter Siegweg, Fehlerquote, Aufmerksamkeitsfehler.

## Simulation (Stufe 6)

- Läuft über die Kommandozeile (`sim/cli.mjs`) und im Browser (Web Worker). Ausgabe als Bericht, CSV und JSON: Siegquoten pro Fluchtweg, Modus, Charakter, Spielerzahl und Bot-Stufe; Tage; Lava und Tod; Anteil gewählter Fluchtweg; Materialknappheit; Einfluss jeder Tages- und Spezialkarte; Duelle und Raube; Zurücksetzungen; Wasser-Zugenden.
- Parameter-Sweep über einen oder zwei Parameter, mit Heatmap. Ungültige Zellen markiert der Validator.
- A/B-Vergleich mit gleichen Seeds und Signifikanzangabe (z-Test für Quoten, t-Test für Mittelwerte).
- Replay: Seed plus Zugliste, im Browser Schritt für Schritt (mit Plan-Notizen der Bots im Log).
- Abgleich mit echten Partien: Im Spiel speichert **⬇ Protokoll** die Partie. Die Simulation importiert solche Protokolle und meldet deutliche Unterschiede. Im Bericht steht: Bot-gegen-Bot-Ergebnisse messen die Balance der Regeln nur, soweit die Bots menschlich spielen. Echte Playtests bleiben der Massstab.

## Erste Messung (je 150 Partien, Bots «normal», Standard V10)

Siehe Abschnitt «Messung» in OFFENE_PUNKTE.md.

## Checkliste (Auftrag Abschnitt 8)

| Punkt | Ergebnis | Nachweis |
|---|---|---|
| v9 nur für die Regler-Idee angesehen, keine Regeln übernommen | ✅ | siehe «Ausgangslage» |
| Regelstand Abschnitt 1 vollständig umgesetzt (Wasser, Tierkampf-Zurücksetzen, Routenkarte als Handkarte, Läufer, kein Gewitter, Floss-Kosten, Feuerkette) | ✅ | `test/stufe2.test.mjs` (je ein Test pro Punkt) |
| Eine config.json für Browser und Simulation, keine fest verdrahteten Werte | ✅ | `config/config.json`; Test «Keine Spielwerte fest im Engine-Code» |
| Alle Regler aus Abschnitt 3 im Browser vor Spielbeginn und in der Simulation einstellbar | ✅ | Reiter Setup (gesperrt während der Partie), `--set`, `--config`, `--preset`; Ausnahme Spieler 5 und 6, siehe oben |
| Karten einzeln an/aus, Anzahl und Effektwerte änderbar | ✅ | Reiter Karten (inkl. neuer Varianten und JSON); Test «Neue Kartenvariante aus Bausteinen wirkt» |
| Validator blockiert unmögliche Konfigurationen und warnt bei knappen | ✅ | `test/stufe1.test.mjs`; im Browser wird «Partie starten» gesperrt |
| Gleiche Konfiguration plus Seed ergibt dieselbe Partie | ✅ | Tests Reproduzierbarkeit (Engine, Bots aller Stufen, Simulation, Replay) |
| Test Informationsgrenze: Bot-Entscheid ändert sich nicht, wenn Verdecktes verändert wird | ✅ | `test/stufe5.test.mjs` (Koop, Team, PvP; Stufen sehr einfach, normal, gut) |
| Bots essen, trinken (als letzte Aktion), rasten, bauen Werkzeug vor dem Bedarf, planen Feuerkette korrekt, wählen und wechseln den Siegweg | ✅ | `test/stufe5.test.mjs`; Trinken beendet laut Regel immer den Zug |
| Routenkarte: Floss nur mit Karte am Zielstrand, Raub im PvP von Bots berücksichtigt | ✅ | Tests 1.5/1.8, «Bot greift den Routenkarten-Besitzer an», «Bot wählt die Routenkarte als Beute» |
| Stufen sehr einfach bis gut, Persönlichkeits-Regler, Zufalls-Bot als Vergleich | ✅ | Koop 3, je 40 Partien: Zufall 0 %, sehr einfach 0 %, einfach 12,5 %, normal 10 %, gut 17,5 %; Test «aggressive Bots greifen öfter an» |
| Sweep, A/B-Vergleich, Replay und Import echter Protokolle funktionieren | ✅ | `test/stufe6.test.mjs`; im Browser durchgespielt |
| «Sehr langsam» im Browser in beiden Varianten und umschaltbar | ✅ | KI-Tempo «sehr langsam – Auto» (Pause 1–5 s) und «Weiter-Knopf», jederzeit umschaltbar, Log scrollbar |
| OFFENE_PUNKTE.md enthält Seil-Vorrat, Feuerkette 5 und 6 Personen, Messung der Folgen ohne Gewitter | ✅ | OFFENE_PUNKTE.md Nr. 1, 4, 5, 6 |
| Kein scharfes S im ganzen Spieltext | ✅ | Suche über alle Text- und Codedateien in `v11/`: keines gefunden |

Tests: `node --test test/*.test.mjs`. Stand der letzten Ausführung: 55 Tests bestanden, 0 fehlgeschlagen.

## Nachbesserung: Design wie V10 und eigener Reiter «Regler»

Nur die Oberfläche wurde geändert (`index.html`, `style.css`, `ui/`). Engine, Bots, Simulation, `config.json` und Tests sind unverändert. Es war keine Engine-Änderung nötig.

**Stufe 1 – Reiter «Regler» und kurzes Setup**

- Reiter in der Reihenfolge Spiel, Setup, Regler, Karten, Simulation, Replay, Regeln. Beim Laden ist «Setup» aktiv, «Partie starten» springt zu «Spiel».
- Neuer Reiter «Regler» (`ui/regler.js`):
  - Links eine feste Bereichsliste mit der Zahl der Regler und der geänderten Regler je Bereich, rechts die Regler des gewählten Bereichs.
  - Oben fix: Suche (Name oder Pfad, über alle Bereiche), Presets (laden, speichern als, löschen), Export und Import als Datei, «↺ Standard V10» und die Zahl der Werte, die vom Standard abweichen.
  - Darunter steht fix das Prüfergebnis. Fehler und Warnungen sind Links zum betroffenen Regler: Der Bereich öffnet sich, der Regler blinkt und bekommt den Fokus.
  - Geänderte Regler sind farbig markiert («● geändert»). Jeder hat einen eigenen Knopf «↺ Standard», dazu Standardwert, Minimum und Maximum als Hinweis.
  - Während einer Partie ist alles gesperrt. Es gibt «Partie beenden und entsperren» und «Zum Spiel».
- Setup (`ui/setup.js`) enthält nur noch Preset (nur Auswahl), Modus, Spielerzahl, Seed, Sitze, Prüfergebnis und «Partie starten». Neben dem Start-Knopf stehen die Zahl der geänderten Werte und der Link «Regler anpassen».

**Stufe 2 – Look und Bedienung wie V10**

- Toolbar wie V10 (`ui/toolbar.js`): Logo, Modus-Pille, Reiterknöpfe (der aktive in der Primärfarbe), Tag mit Wetter-Pille (Klick zeigt die Tageskarte gross) und Seed, KI-Tempo (mit Pause bei «sehr langsam – Auto»), «Weiter ▶», «⬇ Protokoll», rechts die Schalter, «⌖» und «＋ Neue Partie».
- Die Hinweisleiste unter der Toolbar zeigt, wer dran ist und was zu tun ist, mit dem passenden Hauptknopf (Würfeln, Kämpfen, Zug beenden oder Weiter).
- Der Spieltisch füllt die volle Höhe. Die Seite scrollt nicht, nur der Tisch zoomt und lässt sich verschieben:
  - Mausrad zoomt um den Mauszeiger.
  - Ziehen verschiebt den Tisch.
  - Unten links liegt die Zoomleiste (−, %, +, Vollbild); ein Klick auf % zentriert die Ansicht.
  - Die Minimap zeigt den sichtbaren Ausschnitt; ein Klick springt dorthin.
- Auf dem Tisch liegen:
  - das Brett in der Mitte;
  - links die Stapel (Tagesstapel, Tageskarte, Spezialkarten und Ablage, Routenkarten, Tierbeutel), die Würfelschale und der Materialvorrat;
  - rechts die Spieler-Panels.
- Spieler-Panels wie V10:
  - Farbbalken, Kopf mit Herzen und Energie, einklappbar.
  - Original-Spielerkarte mit den Herz- und Energie-Chips auf der aktuellen Zahl (gleiche Lage wie V10), Ausrüstungsplätze als Karten und Rohstoffe als Kartenbilder mit Zahl.
  - Spezialkarten und die Routenkarte.
  - Die Aktionen des Menschen am Zug stehen fest unten im Panel. Das Craften ist aufklappbar.
- Die einklappbare Seitenleiste rechts enthält Floss-Tableau (benötigt, Gruppe, Haken), Küstenfeuer-Kette und Gruppe. Ein Klick auf einen Spieler in der Gruppe springt zu seinem Panel.
- Das Protokoll ist eine einklappbare, scrollbare Box unten rechts. Neue Einträge sind gelb hinterlegt.
- Grosse Karten erscheinen in der Tischmitte wie in V10 (Bühne mit Titel, Karte und Text). Die Tageskarte von Tag 1 erscheint gleich beim Start.
- Dialoge haben den V10-Stil (Kopfzeile mit Trennlinie, Schatten, Radius).
- Farben, Schatten, Radien und Schrift stammen aus den V10-Variablen.
- Es wurde kein V10-Code kopiert. Die Lage der Chips auf der Spielerkarte (Masse des Kartenbildes) und die CSS-Werte stammen aus V10.

**Abweichungen**

- Die Bereichsliste im Reiter «Regler» hat genau die 14 verlangten Bereiche. Die Schema-Bereiche sind so zugeordnet:
  - «Routenkarten» (`routen.*`, 1 Regler) liegt unter «Fluchtwege».
  - Die Pausen fürs KI-Tempo (`browser.*`) liegen unter «KI».
  - «Tageskarten» zeigt `match.tage.*` (ruhige Tage, Ereignis-Tage, Lava-Karte).
  - Die einzelnen Tages- und Spezialkarten bearbeitest du wie bisher im Reiter «Karten». Das Schema überspringt sie, und ein Link führt dorthin.
- Ein Validator-Fehler bei einer einzelnen Karte (z. B. «Tageskarte «…»: unbekannter Effekt») verlinkt auf den Reiter «Karten», weil es dafür keinen Regler gibt.
- Die Toolbar hat sieben Reiter statt drei. Damit sie in eine Zeile passt, werden die Texte schmaler gemacht:
  - Unter 1960 px sind die Schalter rechts nur Symbole (👣 KI-Spur, 🃏 Karten gross), mit Tooltip.
  - Unter 1600 px fallen Knopftexte und der Logo-Text weg, solange eine Partie läuft.
  - Unter 1400 px zeigen die Reiter nur noch Symbole.
  - Wie in V10 scrollt die Toolbar notfalls waagrecht.
- Werkzeuge und Freier Tisch aus V10 gibt es in V11 nicht: Auswahl, Hand, Pinsel, Nebel, Marker, Edit-Schalter, Szenarien und Regel-Fragen fehlen. Panels und Karten lassen sich deshalb nicht verschieben.
- Die zwei Schalter rechts in der Toolbar sind neu und haben kein V10-Gegenstück: «KI-Spur» und «Karten gross». Mit «Karten gross» aus läuft die Partie, ohne dass neue Karten in der Tischmitte erscheinen.
- «＋ Neue Partie» fragt während einer laufenden Partie nach, beendet sie und öffnet das Setup. V10 öffnete einen Start-Dialog.

**Checkliste Nachbesserung**

| Punkt | Ergebnis |
|---|---|
| V10 und V11 nebeneinander sehen gleich aus | ✓ Im Browser verglichen (1440 × 900): gleiche Toolbar, Hinweisleiste, Tisch mit Punktmuster, Zoomleiste, Minimap, Seitenleiste, Protokoll-Box, Bühne und Spieler-Panels mit Original-Spielerkarte und Chips. Abweichungen siehe oben. |
| Tisch scrollt nicht als Seite | ✓ Seitenhöhe = Fensterhöhe in allen Reitern. Zoom (Rad, −/+), Verschieben und Minimap getestet. |
| Reiter «Regler» mit Bereichsliste, Suche, Presets, Export/Import | ✓ |
| Geänderte Regler markiert und einzeln zurücksetzbar | ✓ Markierung, «↺ Standard» je Regler, Zähler oben und je Bereich. |
| Validator-Ergebnis in Regler und Setup sichtbar, Fehler verlinken auf Regler | ✓ Getestet mit «Herzen = 20»: Der Link öffnet «Figur» und setzt den Fokus auf «Herzen». |
| Setup enthält nur Start-relevantes | ✓ Preset, Modus, Spielerzahl, Seed, Sitze, Prüfung, Start, Link «Regler anpassen». |
| Start springt zu «Spiel», Regler während Partie gesperrt | ✓ Inklusive «Partie beenden und entsperren». |
| Tests grün, keine Engine-Datei geändert | ✓ `node --test test/*.test.mjs`: 55 von 55. Ein `git diff` gegen main zeigt in `engine/`, `bots/`, `sim/`, `config/` und `test/` keine Änderung. |
| Kein ß, Umlaute als ä/ö/ü | ✓ Geprüft in `ui/`, `index.html` und `style.css`. |

Zusätzlich im Browser getestet:

- Ganze KI-Partien in Koop, Team und PvP bis zum Ende-Dialog.
- Ein Menschen-Zug mit Würfeln, Aufdecken, Gehen und «Zug beenden».
- Der Modus «sehr langsam – Weiter-Knopf» (Knopf und Enter).
- Hot-Seat im Team-Modus mit Übergabe-Dialog; fremde Charaktere sind verdeckt.
- Replay aus dem Ende-Dialog.
- Alle Reiter ohne Fehler in der Konsole.
