# Offene Punkte – Insel-Survival V11

Diese Punkte sind nicht entschieden. Jeder ist als Schalter oder Regler umgesetzt, Standard laut Dokument (Regelstand V10, Auftrag V11 und Antworten vom 27.10.2026). Die Simulation kann die Folgen messen.

| Nr | Thema | Schalter / Regler | Standard | Bemerkung |
|---|---|---|---|---|
| 1 | Seil-Vorrat | `vorrat.karten.seil` | 12 | Das solide Floss braucht 3 Seil pro Person, zu viert also 12 Seil, genau so viele Seilkarten hat der Prototyp. Dazu kommt Seil für Werkzeuge und Shelter. Der Validator warnt «Seil reicht nur knapp». |
| 2 | Seil über Blätter tauschen | `crafting.rezepte.seil.aktiv` | an (2 Blätter = 1 Seil) | Ohne diesen Tausch ist das solide Floss zu viert kaum bezahlbar. |
| 3 | Materialvorrat begrenzt | `vorrat.unbegrenzt`, `vorrat.leerOhneErtrag`, `vorrat.rueckgabe` | begrenzt, leerer Stapel = kein Ertrag, abgegebene Karten zurück in den Vorrat | Offen ist, ob verbaute Karten (Werkzeug, Lagerfeuer, Floss) wieder in den Vorrat kommen. V11 legt alle abgegebenen Karten zurück (Schalter `rueckgabe`). |
| 4 | Feuerkette ohne Gewitter | – (Messung) | – | Ohne Gewitter wird kein Feuer mehr gelöscht. Die Simulation misst, ob die Feuerkette zum Standardweg wird (Bericht «Anteil gewählter Fluchtweg»). |
| 5 | Wasser beendet den Zug | `zug.wasser.zugende` | an | Energie wird knapper. Die Simulation zählt «Wasser-Zugenden» und vergleicht per A/B mit `zugende = aus`. |
| 6 | Feuerkette für 5 und 6 Personen | `fluchtwege.feuer.tabelle` | keine Zeilen 5 und 6 | Das Spiel hat höchstens 4 Spieler (Antwort 27.10.). Der Validator blockiert mehr als 4 Spieler. Zeilen für 5 und 6 könnten in der Tabelle ergänzt werden, falls das Spiel erweitert wird. |
| 7 | Not-Floss nach «zurück an Land» | `fluchtwege.floss.not.nachLandGratis`, `nachLandNaechsterTag` | gratis in allen Modi, erst am nächsten Tag | Antwort 27.10. (Empfehlung, im Team noch zu bestätigen). v10 hatte in Team und PvP «Material verloren». |
| 8 | Hinterhalt gegen kleines Tier | `tiere.hinterhaltKleinSchaden` | 1 Herz | Wie v10. Sonst richten kleine Tiere keinen Schaden an. |
| 9 | Startfeld auf Tier- oder Spezialfeld | `figur.startfeld.tierfeldErlaubt` | aus (wird mit einer Sandbank getauscht, wie v10) | Ist es erlaubt, kämpft die Figur zu Beginn ihres ersten Zugs ohne Flucht. |
| 10 | Routenkarte beim Ausscheiden (PvP) | `duelle.routeBeiAusscheiden` | Kompass liegt wieder unter dem Vulkanfels | wie v10 |
| 11 | Spezialkarten-Stapel kleiner als Spezialfelder | `spezialkarten.stapel` | 20 (bei 20 Spezialfeldern) | Wird der Stapel kleiner gestellt, warnt der Validator. |
| 12 | Shelter-Lager als Siegweg | – | entfällt | Antwort 27.10.: keine Siegmöglichkeit über Shelter. |
| 13 | Zählweise «Feuer zählt nicht» | – (Regeldeutung) | Ein Feuer zählt, solange die Kette damit noch vollständig gebaut werden kann | v10 markierte auch korrekt gesetzte Feuer als ungültig (siehe CHANGES.md). Die Siegbedingung (alle Feuer mit gültigem Rundum-Abstand) ist davon nicht betroffen. Im Team bestätigen. |

## Messung (Stand 27.10.2026, je 150 Partien, Bots «normal», Standard V10)

| Modus | Siegquote | Anteil der Fluchten (Floss / Feuer / Wrack) | Wasser-Zugenden pro Partie | Duelle pro Partie |
|---|---|---|---|---|
| Koop 2 | 12,0 % | 33 % / 67 % / 0 % | 7,2 | – |
| Koop 3 | 10,7 % | 0 % / 100 % / 0 % | 12,0 | – |
| Koop 4 | 10,0 % | 0 % / 100 % / 0 % | 15,9 | – |
| Team 2 gegen 2 | 12,7 % | 32 % / 16 % / 53 % | 12,9 | 3,5 |
| PvP 2 | 46,0 % | 88 % / 0 % / 12 % | 5,1 | 3,5 |
| PvP 3 | 27,3 % | 74 % / 0 % / 26 % | 7,8 | 6,6 |
| PvP 4 | 25,3 % | 77 % / 0 % / 23 % | 10,5 | 10,3 |

Vergleich v10 (dort im Reiter «Simulation», KI «Stark», je 60 Partien): Koop 3 bis 10 %, die Küstenfeuer-Kette nie.

- **Zu Nr. 4 (Feuerkette ohne Gewitter):** Im Koop ab 3 Personen wird die Feuerkette zum einzigen erfolgreichen Weg (100 % der Fluchten). Im PvP gewinnt sie nie (3 Feuer mit Abstand 13 sind allein zu weit verteilt), im Team selten. Der Floss scheitert im Koop meist am Kompass und am Material für viele Personen.
- **Zu Nr. 5 (Wasser beendet den Zug):** A/B-Vergleich Koop 3, 150 Partien mit gleichen Seeds. Mit Zugende 10,7 % Siegquote, ohne 12,7 % (Unterschied 2 Prozentpunkte, statistisch nicht deutlich). Wasser beendet rund 12 Züge pro Partie.
- **Allgemein:** Alle Modi liegen unter oder um 10 bis 15 % (Koop, Team), PvP höher, weil es dort immer einen Sieger geben kann. Die Werte messen die Regeln nur, soweit die Bots menschlich spielen. Echte Playtests bleiben der Massstab (Abgleich über «⬇ Protokoll» und `node sim/cli.mjs --import`).

