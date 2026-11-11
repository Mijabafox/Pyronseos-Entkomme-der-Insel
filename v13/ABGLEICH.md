# Abgleichsliste V13 gegen die Basisversion V12

Regelstand 11.11.2026 (Dokumentation V08, Spielanleitung v5). Basis ist `v12/` (Regelstand 05.11.2026 plus Änderungen vom 10.11.2026). Spalte «V13 neu»: ✅ = umgesetzt, = = war schon so, ⚠️ = Annahme (im Regeln-Tab markiert).

## 1. Kurzliste der Änderungen seit v11

| Nr | Regel | Basis (V12) | V13 neu |
|---|---|---|---|
| 1 | Zugablauf: nur Weitsicht fix, danach laufen, essen, bauen, Karten, handeln, duellieren beliebig gemischt; Abbauen oder Rasten zum Schluss; nach dem Abbau nur noch craften | nach dem Abbau waren noch alle Aktionen erlaubt (essen, handeln, Karten, Duell) | ✅ Phase «nach dem Abbau» erlaubt nur noch Rezepte und «Zug beenden» (Engine `aktionsListe`, Panel zeigt nur Bau-Menü) |
| 2 | +1 Energie pro Tag für alle, die nicht K.O. sind, vor der Tageskarte | schon umgesetzt (N1) | = |
| 3 | Gegen den Uhrzeigersinn, Startperson beginnt jeden Tag und deckt die Tageskarte auf | Reihenfolge ab Startperson, Text «im Uhrzeigersinn» | ✅ Texte und Regeln-Tab: gegen den Uhrzeigersinn (Sitzreihenfolge), Startperson fix |
| 4 | Startfelder zu viert 6, 17, 27, 38 | 1, 12, 23, 34 | ✅ `config.json` |
| 5 | Routenkarte verdeckt vor der Person, keine Handkarte; Kompass nach dem Ziehen aus dem Spiel, keine zweite Routenkarte | eigene Kompasskarte, Routenkarte als Handkarte, Neuziehen möglich | ✅ Kompasskarte entfällt, nur noch die Routenkarte vor der Person; kein Neuziehen |
| 6 | Kompass bergen zählt wie Abbauen (Spitzhacke, 0 Energie, Zug endet) | 0 Energie, beendete nur die Bewegung, danach alle Aktionen | ✅ wie Abbauen: danach nur noch craften, dann Zugende, keine Rast |
| 7 | Vulkanfelsen nur durch Betreten, leere Vulkanfelsen kommen vom Brett | nur durch Betreten | ✅ leere Vulkanfelsen werden beim Aufdecken entfernt |
| 8 | Spezialfeld gibt erst beim Betreten eine Karte, danach Plättchen weg | Karte schon beim Aufdecken aus der Ferne | ✅ `zug.spezialAusDerFerne = false` |
| 9 | Leere Plättchen kommen nach dem Aufdecken vom Brett | blieben liegen | ✅ `kern.aufdecken`: Dickicht, Lichtung, Geröll, Sandbank, leerer Vulkanfels → leer |
| 10 | Tierkampf: Sieg = weiterziehen; klein verloren −1, Tier weg, Figur bleibt, Zugende; gross verloren −2, zurück, Tier bleibt, Zugende; offenes Tier angreifen = Schritt (1 Energie) | schon so (10.11.) | = |
| 11 | Duell beendet den Zug; Beute 1 Handkarte blind oder die verdeckte Routenkarte; Fern-Duell nur Handkarte | Beute «Kompasskarte», Routenkarte blind raubbar | ✅ Beute «Routenkarte» als eigene Wahl, blind nur Rohstoffe und Spezialkarten |
| 12 | Werkzeuge und Waffen offen vor der Person, max. 1 pro Sorte; nur Rohstoff- und Spezialkarten auf der Hand | Handkarten ohne Limit (Test-Schalter) | ✅ `ausruestung.limitProTyp = true`, `offen = true`, nicht blind raubbar |
| 13 | Shelter: betreten oder drin bleiben = +4 Energie, Zug endet; schützt vor Frost und Giftwolke | «Im Shelter erholen» +4, Rasten im Shelter nur +2 | ✅ Rasten auf dem Shelterfeld (nicht bewegt) +4 statt +2 |
| 14 | Lagerfeuer heilt nicht; Feuer und Shelter nur auf leeren oder abgebauten Feldern, je max. 1 pro Feld; Feuer gehört dem Erbauer | Feuer heilte +2, überall baubar, nur 1 Bauwerk pro Feld | ✅ `lagerfeuerHerzen = 0`, Prüfung «leeres Feld», Feuer (`f.bau`) und Shelter (`f.shelter`) getrennt |
| 15 | K.O.: Figur bleibt liegen, kein +1 Energie, keine Tageskarten; PvP ausgeschieden; Plündern in PvP und Team, Figur danach vom Brett | PvP ausgeschieden ohne Plündern, Kompass zurück unter den Felsen | ✅ Plündern beim Betreten, ganzer Besitz, Werkzeug-Limit, Zugende, Figur vom Brett |
| 16 | Rauchbombe: 0 Schaden, Ausweichen auf nicht verdecktes Nachbarfeld nach Wahl, 1 Energie, Zug geht weiter | schon so | = (⚠️ Felder mit Tier oder Spezialfeld ausgenommen) |
| 17 | Nach einer geglückten Flucht wird die Runde zu Ende gespielt, wer in derselben Runde flieht, hat nicht verloren | Partie endete sofort | ✅ `flucht()` / `fluchtAbschliessen()`, Ergebnis «Gewonnen», «Nicht verloren», «Verloren» |
| 18 | Gebirge-Regel bei Tageskarten gilt auch, wenn das Plättchen weg ist | nur solange das graue Plättchen lag | ✅ `istGebirge` = Gebirgs- oder Vulkanfeld |
| 19 | Kooperativ als «Empfohlen für die erste Partie» | schon so | = |
| 20 | Alter ab 12 Jahren | 14 Jahre | ✅ Regeln-Tab |

## 2. Basisdaten bis 6. Besitz

| Regel | Basis (V12) | V13 neu |
|---|---|---|
| 2–4 Personen, Team genau 4, höchstens 20 Tage, 30 Tage als Test-Option | gleich | = |
| 45–120 Minuten (erste Partie 75–120) | nicht genannt | ✅ Regeln-Tab |
| Brett 169 Felder, Krater, 6 Vulkanfelsen, 115 Inselplättchen gemischt, 5 Buchten, Strandring 1–42, Abschnitte | gleich | = |
| Mehrere Figuren auf einem Feld, Durchlaufen erlaubt | gleich | = (jetzt im Regeln-Tab erwähnt) |
| Plättchen-Aufteilung (Wald 53, Wiese 27, Gebirge 35, Strand 47, Vulkan 7) | gleich | = |
| Teiche, Wrack, Krater und Kompass-Vulkanfels bleiben liegen | gleich | = (Kompass-Fels nach dem Bergen leer) |
| Offenes Tier ist Hindernis | gleich | = |
| Material und Vorrat begrenzt, leer = nichts | gleich | = |
| Herzen 5 (Überlebenskünstler 6), Energie 0–6 | gleich | = |
| Bandagen werden direkt eingesetzt | Bandage als Karte auf der Hand | ✅ ⚠️ Craften = sofort +2 Herzen, Wiederbeleben craftet direkt |
| Sichtbarkeit: Koop alles offen ausser Spezialkarten, Routenkarte offen; Team im Team offen; PvP Hand und Routenkarte verdeckt, Werkzeuge offen | PvP alles verdeckt, auch Charakter | ✅ `sichtbarkeit` in `config.json` |
| Charakter, Herzen, Energie in allen Modi sichtbar | PvP Charakter verdeckt | ✅ |
| Sechs Charaktere | gleich | = (Texte angepasst) |

## 3. Aufbau, Tag, Zug

| Regel | Basis (V12) | V13 neu |
|---|---|---|
| Tageskarten 7 + 12 + Lava | gleich | = |
| Spezialkarten 20er-Stapel, Brennsprit unter den ersten 10 | gleich | = |
| 16 Routenkarten | gleich | = (nur eine wird gezogen) |
| W6 für Startperson, gegen den Uhrzeigersinn laufen, Startplättchen weg | gleich | = (⚠️ Startfeld zufällig unter den freien) |
| Weitsicht W3, Umkreis 2, Kundschafter +1, Fernglas 3, Nebel aus, Vulkanfelsen nie | gleich | = |
| Tierfeld bei Weitsicht: Tier offen, leerer Beutel = leer und weg | gleich | = |
| Schritte 1 Energie, Läufer bei 0 Energie 1 Feld gratis | gleich | = |
| Teich: durchlaufen, trinken = Energie 6, Zugende, Dürre | gleich | = |
| Essen +3, Bauen 0 Energie | gleich | = (jetzt auch zwischen den Schritten) |
| Handeln 1× pro Zug, Umkreis 2, max. 4 Karten: Rohstoffe, Nahrung, Werkzeuge, Spezialkarten, Brennsprit, Routenkarte; Limit beim Empfänger; Koop schenken | nur Rohstoffe, Brennsprit, Routenkarte | ✅ Engine und Handels-Dialog (⚠️ fremde Spezialkarten nicht gezielt verlangbar) |
| Abbauen: Baum, Fels, Busch, Strandgut, Werkzeugbonus | gleich | = |
| Rasten +2 (Brise +3), nur ohne Bewegung | gleich | = (⚠️ nur über «Zug beenden») |
| Was den Zug sofort beendet | teilweise | ✅ inkl. Kompass bergen und Plündern |

## 4. Kampf, Duell, K.O., Bauen, Karten, Flucht, Ende

| Regel | Basis (V12) | V13 neu |
|---|---|---|
| Tierkampf-Boni: nur bessere Waffe, Jäger +1, Schärfstein +2, Messer, Wildnis | gleich | = |
| Hinterhalt: Figur bleibt stehen, Tier zurück in den Beutel | gleich | = |
| Duell 1× pro Zug, Umkreis 2, 1 Energie, nie Partner, nie K.O. | gleich | = |
| Wiederbeleben Koop und Team mit Bandage, selbes oder Nachbarfeld, 2 Herzen; Team nur Partner | gleich | = |
| Koop: K.O. nicht ausraubbar, alle K.O. = Niederlage | gleich | = |
| Bau-Rezepte (Seil, Steinaxt, Spitzhacke, Holzspeer, Machete, Bandage, Lagerfeuer, Shelter) | gleich | = |
| Werkzeuge max. 1 pro Sorte, Bau gesperrt | Test-Schalter | ✅ |
| 19 Ereignisse mit Wirkungen | gleich | = |
| 36 Spezialkarten, Texte Duell, Rauch | Texte mit Kompasskarte | ✅ Texte angepasst |
| Floss: Routenkarte nötig, Abschnitt, Sturm; solide und Not-Floss nach Tabelle | Kompass und Routenkarte nötig | ✅ nur Routenkarte (Kompass ist aus dem Spiel) |
| Not-Floss 1–2 / 3–4 / 5–6, Koop Floss bleibt, sonst Material weg, Routenkarte bleibt | gleich | = |
| Signalfeuer-Tabelle 3/9, 4/7, 5/5, 6/4, rund um den Ring, Koop alle auf Feuerfeld | gleich | = |
| Wrack: alle auf dem Feld, niemand K.O., Reparatur + Brennsprit | gleich | = |
| Ergebnis: Gewonnen / Nicht verloren / Verloren | nur Gewinner | ✅ Ergebnisdialog, Hinweisleiste, Simulation |
| PvP: Letzte/r übrig gewinnt | gleich | = (erst ohne laufende Flucht-Runde) |
| Team: verbleibendes Mitglied nach Plündern flieht allein | – | ✅ ⚠️ Annahme |

## 5. Test-Schalter, KI, Simulation

| Regel | Basis (V12) | V13 neu |
|---|---|---|
| Test-Schalter: Ruhige Tage, Tierschaden, +1 Energie pro Tag, Spieldauer | 9 Schalter | ✅ nur noch die 4 verlangten; Shelter-Preis, Feuerabstände, Werkzeuglimit, Flucht vor Tierfeld und Werkzeuge offen sind jetzt feste Regel (als Regler weiter verstellbar) |
| Werte im Protokoll und in der Simulation | gleich | = |
| KI: freier Zugablauf, nach Abbau nur craften | – | ✅ |
| KI: Routenkarte verdeckt und raubbar, Duell beendet den Zug | Kompasskarte | ✅ Beute «Routenkarte» |
| KI: Plündern in PvP und Team | – | ✅ geht auf erreichbare K.O.-Gegner |
| KI: Shelter-Nutzung | nur Erholen, nie gebaut | ✅ baut bei wenig Energie einen Shelter und geht hinein |
| KI: Werkzeug-Limit, Spezialfelder erst beim Betreten | – | ✅ über die erlaubten Aktionen |
| KI: Feuer nur auf leerem Feld | – | ✅ Feuerplan meidet Quellen, Strandgut wird erst abgebaut |
| Koop-KI: Sammelfeld, Material bündeln, Wiederbeleben | gleich | = |
| Simulation: Siegquote, Fluchtweg, Siegtag, K.O.s, Kompassfund, «Nicht verloren», Plünderungen | ohne «Nicht verloren» und Plünderungen | ✅ CLI `--alle`, Browser-Tab, CSV |
| Regel-Chat nutzt den neuen Regeltext | gleich | ✅ neuer Text |
