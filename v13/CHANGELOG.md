# Pyronesos – Entkomme der Insel · Version 13

Was ist neu gegenüber V12? V13 setzt den Regelstand vom 11.11.2026 um (Dokumentation V08, Spielanleitung v5). Basis ist `v12/`, die Ordner `v12/`, `v11/` und älter sind unverändert. Jede Regel ist in `ABGLEICH.md` gegen V12 abgeglichen.

Stand: 11.11.2026.

## 1. Regeln

**Zugablauf**

- Nur die Weitsicht ist fix am Anfang. Danach laufen, essen, bauen, Karten spielen, handeln und duellieren in beliebiger Reihenfolge und beliebig gemischt.
- Abbauen oder Rasten kommt zum Schluss. Nach dem Abbauen sind nur noch Rezepte erlaubt (auch mit den gerade abgebauten Rohstoffen), danach endet der Zug. Im Spiel sind dann nur das Bau-Menü und «Zug beenden» aktiv.
- Kompass bergen zählt wie Abbauen: Spitzhacke, 0 Energie, danach nur noch craften, dann Zugende.
- Gespielt wird gegen den Uhrzeigersinn (Sitzreihenfolge). Die Startperson beginnt jeden Tag und deckt immer die Tageskarte auf.
- Rasten gibt es nur über «Zug beenden» ohne Bewegung und ohne Abbau. Erzwungene Zugenden geben keine Rast mehr dazu.

**Brett und Plättchen**

- Leere Plättchen (Dickicht, Lichtung, Geröll, Sandbank, leerer Vulkanfels) kommen beim Aufdecken sofort vom Brett, auch per Weitsicht, Aussichtsfelsen oder Vollmond.
- Ein Spezialfeld gibt erst beim Betreten eine Karte, danach kommt das Plättchen weg (V12: schon beim Aufdecken aus der Ferne).
- Die Gebirge-Regel der Tageskarten gilt auch, wenn das Plättchen schon weg ist (das Feld merkt sich sein Biom).
- Startfelder zu viert: 6, 17, 27, 38 (V12: 1, 12, 23, 34).

**Besitz und Sichtbarkeit**

- Die Kompasskarte gibt es nicht mehr. Wer den Kompass birgt, legt sofort die Routenkarte verdeckt vor sich (Koop: offen). Der Kompass kommt aus dem Spiel, eine zweite Routenkarte gibt es nicht. Das Floss braucht nur noch die Routenkarte.
- Werkzeuge und Waffen liegen offen vor der Person, höchstens 1 pro Sorte (in V12 ein Test-Schalter). Auf der Hand sind nur Rohstoff- und Spezialkarten.
- Die Bandage wird direkt eingesetzt: craften = +2 Herzen, Wiederbeleben craftet sie direkt.
- Charakter, Herzen und Energie sind in allen Modi für alle sichtbar (V12: im PvP verdeckt).

**Bauen**

- Lagerfeuer und Shelter nur auf leeren oder abgebauten Feldern. Pro Feld höchstens 1 Feuer und 1 Shelter (beide zusammen sind möglich).
- Das Lagerfeuer heilt nicht mehr.
- Shelter: betreten und hinein oder drin bleiben (Zug dort begonnen, nicht bewegt) = +4 Energie, der Zug endet. Durchlaufen ist erlaubt.

**Duell, K.O., Plündern**

- Duell-Beute: 1 Handkarte blind (Rohstoffe und Spezialkarten) oder die verdeckte Routenkarte. Werkzeuge sind nicht raubbar. Beim Fern-Duell nur 1 Handkarte.
- K.O.-Figuren bleiben liegen, bekommen kein +1 Energie und sind von Tageskarten nicht betroffen.
- Neu: Plündern im PvP und im Team. Wer das Feld einer gegnerischen K.O.-Figur betritt, bekommt ihren ganzen Besitz (Karten, Werkzeuge, Waffen, Routenkarte), der Zug endet, die Figur kommt vom Brett. Überzählige Werkzeuge gehen in den Vorrat. Den Teampartner plündert man nie, im Koop gibt es kein Plündern.
- Im PvP bleibt eine ausgeschiedene Figur liegen, bis sie geplündert wird (V12: Kompass zurück unter den Felsen).

**Handel**

- Tauschbar sind jetzt auch Werkzeuge, Waffen und Spezialkarten (vorher nur Rohstoffe, Brennsprit, Routenkarte). Das Werkzeug-Limit gilt auch beim Empfänger. Der Handels-Dialog hat dafür neue Zeilen.

**Spielende**

- Nach der ersten geglückten Flucht wird die Runde zu Ende gespielt (bis zur Person vor der Startperson). Wer in derselben Runde flieht, hat nicht verloren. Geflohene Figuren setzen bis Spielende aus.
- Ergebnis mit drei Zuständen: 🏆 Gewonnen, ⛵ Nicht verloren, 🌋 Verloren (Ergebnisdialog, Hinweisleiste, Simulation).

**Sonstiges**

- Altersangabe ab 12 Jahren, Spieldauer 45–120 Minuten.
- Kooperativ bleibt als «Empfohlen für die erste Partie» markiert (Startmenü und Regeln-Tab).

## 2. Test-Schalter

Nur noch die vier verlangten Schalter: Ruhige Tage (7 + 12 oder 10 + 9), Tierschaden (klein −1 / gross −2 oder 0 / −1), +1 Energie pro Tag (an oder aus), Spieldauer (20 oder 30 Tage). Die fünf übrigen Schalter aus V12 (Shelter-Preis, Feuerabstände, Werkzeuglimit, Flucht vor Tierfeld, Werkzeuge offen) sind jetzt feste Regel. Die Werte bleiben im Reiter «Regler» verstellbar.

## 3. Oberfläche

- Panel: Werkzeuge und Waffen als vier offene Plätze, Routenkarte verdeckt vor der Figur, Handkarten getrennt. Status «geflohen», «ausgeschieden (plünderbar)», «vom Brett».
- Aktionen im Panel nach Phasen «2 · Unterwegs» und «3 · Nach dem Abbau», Knopf «Zug beenden (im Shelter bleiben, +4)».
- Brett: Feuer und Shelter auf demselben Feld, geflohene und geplünderte Figuren verschwinden, liegende PvP-Figuren bleiben sichtbar.
- Hinweis in der Kopfzeile während der letzten Runde nach einer Flucht.
- Regeln-Tab komplett neu nach dem Regelstand 11.11.2026, mit Test-Schaltern, bestätigten Klarstellungen und Annahmen. Der Regel-Chat sucht im neuen Text.
- Speicherschlüssel im Browser heissen jetzt `v13-…`, damit V12-Einstellungen nicht übernommen werden.

## 4. KI und Simulation

- KI: nach dem Abbau nur noch craften; Feuerkette plant nur noch Felder, auf denen gebaut werden darf (Strandgut wird vorher abgebaut, Quellen gemieden); Beute «Routenkarte»; geht auf erreichbare gegnerische K.O.-Figuren zum Plündern; baut bei wenig Energie einen Shelter und geht hinein.
- Simulation: neue Kennzahlen «Nicht verloren» und «Plünderungen» (Kommandozeile `--alle`, Browser-Tab, CSV). Neu `sim/messung-v13.mjs` für Erreichbarkeit und Test-Schalter.

## 5. Messung

150 Partien pro Zeile, Bots «normal» (Kommandozeile `node sim/cli.mjs --alle --partien 150`):

| Modus | Spieler | Siegquote | Floss | Feuer | Wrack | Ø Siegtag | K.O.s pro Partie | Kompass gefunden (Ø Tag) | Nicht verloren | Plünderungen |
|---|---|---|---|---|---|---|---|---|---|---|
| Koop | 2 | 42,7 % | 0,0 % | 42,0 % | 0,7 % | 14,7 | 0,37 | 2,0 % (14,0) | – | – |
| Koop | 3 | 42,0 % | 0,0 % | 42,0 % | 0,0 % | 14,8 | 0,76 | 0,0 % | – | – |
| Koop | 4 | 45,3 % | 0,0 % | 45,3 % | 0,0 % | 15,6 | 0,91 | 0,0 % | – | – |
| Team | 4 | 75,3 % | 1,3 % | 51,3 % | 22,7 % | 15,9 | 0,44 | 10,7 % (12,4) | 2,7 % | 0,25 |
| PvP | 2 | 67,3 % | 20,7 % | 0,0 % | 6,0 % | 14,0 | 0,84 | 94,7 % (6,6) | 0,0 % | 0,00 |
| PvP | 3 | 57,3 % | 30,0 % | 0,0 % | 10,7 % | 15,2 | 1,43 | 99,3 % (5,8) | 0,7 % | 0,48 |
| PvP | 4 | 42,7 % | 18,0 % | 0,0 % | 19,3 % | 15,3 | 1,81 | 100,0 % (5,6) | 0,0 % | 0,75 |

Mit Bots «gut» (60 Partien pro Zeile): Koop 2/3/4 46,7 / 55,0 / 41,7 % · Team 63,3 % · PvP 2/3/4 60,0 / 36,7 / 31,7 %.

Keine Partie ist hängen geblieben (0 Abbrüche am Zuglimit). Im PvP zählt «letzte/r Überlebende/r» als Sieg, darum ist die Siegquote höher als die Summe der Fluchtwege.

**Erreichbarkeit der Fluchtwege** (je 40 Partien, die anderen beiden Wege ausgeschaltet, `node sim/messung-v13.mjs 40`):

| Nur dieser Weg | Koop 2 | Koop 3 | Koop 4 | Team | PvP 2 | PvP 3 | PvP 4 |
|---|---|---|---|---|---|---|---|
| Floss | 40,0 % | 42,5 % | 20,0 % | 37,5 % | 32,5 % | 35,0 % | 25,0 % |
| Feuer | 50,0 % | 40,0 % | 47,5 % | 75,0 % | 42,5 % | 45,0 % | 62,5 % |
| Wrack | 32,5 % | 40,0 % | 57,5 % | 60,0 % | 32,5 % | 47,5 % | 62,5 % |

Alle drei Fluchtwege sind in allen Modi und Spielerzahlen erreichbar.

**Test-Schalter im A/B-Vergleich** (je 80 Partien, gleiche Seeds):

| Schalter | Koop 3 Standard → Alternative | PvP 3 Standard → Alternative |
|---|---|---|
| Ruhige Tage (10 + 9) | 42,5 % → 46,3 % | 57,5 % → 57,5 % |
| Tierschaden (0 / −1) | 42,5 % → 58,8 % (K.O. 0,68 → 0,21) | 57,5 % → 41,3 % |
| +1 Energie pro Tag aus | 42,5 % → 6,3 % | 57,5 % → 22,5 % |
| Spieldauer 30 Tage | 42,5 % → 66,3 % | 57,5 % → 87,5 % |

**Auffällig**

- Koop liegt rund 15 Prozentpunkte unter V12 (56,7 bis 60 %). Hauptgründe: Das Lagerfeuer heilt nicht mehr, und Feuer gehen nur auf leere Felder (Strandgut zuerst abbauen).
- Die Koop-Bots wählen weiterhin fast nur die Feuerkette, Floss und Wrack kommen im Koop kaum vor. Allein gespielt sind beide erreichbar.
- «+1 Energie pro Tag» bleibt der grösste Hebel. Ohne ihn ist Koop kaum zu gewinnen (6 %).
- Im PvP sinkt die Siegquote mit milderem Tierschaden, weil mehr Figuren lange leben und kaum jemand als Letzte/r übrig bleibt.
- «Nicht verloren» kommt selten vor (Team 2,7 %, PvP 3 0,7 %): Selten fliehen zwei Parteien in derselben Runde.
- Die Zahlen messen die Regeln nur so weit, wie die Bots menschlich spielen.

## 6. Annahmen (im Regeln-Tab als «Annahme» markiert)

- Team nach Plündern: Das verbleibende Mitglied flieht allein (Kosten für 1 Figur), das zählt als Team-Flucht (laut Auftrag noch offen).
- Bandage: craften = sofort einsetzen, keine Bandage auf Vorrat.
- Nach dem Abbau nur Rezepte, also kein Floss- oder Wrack-Bau.
- Rasten nur über «Zug beenden» ohne Bewegung und Abbau.
- Plündern geschieht automatisch beim Betreten des Feldes.
- Rauchbombe: Ausweichfeld ohne Tier und ohne Spezialfeld; im Duell endet der Zug der angreifenden Person trotzdem.
- Handel: fremde Spezialkarten sind verdeckt und können nicht gezielt verlangt werden.
- Startfeld zufällig unter den freien Feldern, Routenkarte bleibt beim misslungenen Not-Floss liegen, Felsrutsch trifft die schwächste Waffe, kein Bau auf dem Krater.

Siehe auch `OFFENE_PUNKTE.md`.

## 7. Entscheide bei Unklarheiten im Auftrag

- Der Auftrag nennt das Repo «Mijabafox/insel-survival». Gearbeitet wurde im vorhandenen Repo dieses Prototyps (`Pyronseos-Entkomme-der-Insel`, Titel im README «Insel-Survival»).
- Der Auftrag verlangt einen Branch `v13`. Diese Sitzung hat einen fest vorgegebenen Arbeits-Branch, darum liegt V13 dort. Kein Push auf `main`.

## 8. Tests

`node --test test/*.test.mjs`: 82 Tests, alle grün. `test/v12.test.mjs` heisst jetzt `test/v13.test.mjs`: 14 Tests aus V12 übernommen (Regel unverändert), 11 veraltete entfernt, 13 neue für den Regelstand 11.11.2026 (Zugablauf, Bauen auf leeren Feldern, Shelter, Werkzeuge offen, Fern-Duell, Spezialfeld, Gebirge, Kompass, Plündern PvP und Team, Flucht-Runde mit «Nicht verloren», Handel, Test-Schalter). Sechs Tests aus `stufe2` und `stufe5` wurden auf die neuen Regeln angepasst.

Im Browser geprüft (Chromium): Startdialog, Partie mit Mensch und KI (Würfeln, Gehen, Zug beenden), ganze KI-Partie PvP bis zum Ergebnisdialog mit drei Zuständen, Regeln-Tab mit Regel-Chat, Simulation, Regler, Karten, Replay. Keine Konsolenfehler.
