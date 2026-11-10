# Pyronesos – Entkomme der Insel · Version 12

Was ist neu gegenüber v11? V12 setzt den Regelstand vom 05.11.2026 um (Regelwerk und Spielanleitung) plus die Team-Notizen N1 bis N6. Der Ordner `v11/` ist unverändert.

Stand: 10.11.2026.

## 1. Neu aus den Team-Notizen

| Nr. | Regel | Umsetzung |
|---|---|---|
| N1 | +1 Energie pro Tag | Zu Beginn jedes neuen Tages (ab Tag 2) bekommen alle Figuren, die nicht K.O. sind, +1 Energie, höchstens 6. Kommt vor der Tageskarte. Als Test-Schalter abstellbar. |
| N2 | Kompass bergen kostet 0 Energie | Braucht weiterhin die Spitzhacke. Beendet nur noch die Bewegung, nicht mehr den ganzen Zug. |
| N3 | Vulkanfelsen nur durch Betreten | Weitsicht, Altes Fernglas, Alter Aussichtsfelsen und Vollmond lassen die 6 Vulkanfelsen aus. |
| N4 | Kompass für beide Flösse | Solides Floss und Not-Floss brauchen Kompass und Routenkarte. |
| N5 | Kompasskarte verdeckt vor dir | Eigene Karte, für alle sichtbar. Im normalen Duell raubbar, im Fern-Duell nicht. |
| N6 | Kooperativ als Einstieg | Im Startdialog und im Regeln-Tab als «Empfohlen für die erste Partie» markiert. |

Nicht umgesetzt (laut Team nicht fix): «Wasserquelle gibt weniger Energie, beendet aber den Zug nicht».

## 2. Geänderte Regeln gegenüber v11

**Aufbau und Brett**

- Name: Pyronesos – Entkomme der Insel (vorher Insel-Survival).
- Vulkan: Der Krater liegt fest und offen in der Mitte. Rundherum 6 verdeckte Vulkanfelsen, einer mit Kompass (v11: 7 gemischte Vulkanfelder).
- Wald-, Wiesen- und Gebirgsplättchen sind zufällig gemischt (v11: zusammenhängende Zonen). Die 5 Buchten liegen wie in v11.
- Tageskarten: 7 Ruhige Tage + 12 Ereignisse + Lava (v11: 10 + 9).
- Spezialkarten: Pool 36 (Gefahren je 2, Kräuter 3). Der Brennsprit liegt immer unter den ersten 10 Karten des 20er-Stapels.
- Feste Startfelder (2: 1 und 22 · 3: 1, 15, 29 · 4: 1, 12, 23, 34). Alle werfen einen W6, der höchste Wurf beginnt. Jede Figur läuft so viele Felder gegen den Uhrzeigersinn. Das Plättchen unter der Figur kommt aus dem Spiel.
- Begrenzter Vorrat auch für Ausrüstung (Steinaxt, Spitzhacke, Holzspeer, Stein-Machete je 4, Pflanzenbandage 6) und Bau-Marker (Lagerfeuer 10, Shelter 4, Floss 4).

**Zug**

- Ein Spezialfeld, das aus der Ferne aufgedeckt wird, löst sofort die oberste Spezialkarte aus.
- Tierkampf: Pflichtkampf, keine Flucht. Schaden bei Niederlage: klein −1, gross −2 (v11: 0 und −1).
- Rasten nur, wenn im ganzen Zug weder bewegt noch abgebaut wurde.
- Ausrüstung sind Karten auf der Hand, ohne Limit. Im Kampf zählt die beste Waffe.
- Die Pflanzenbandage ist eine Karte: craften, später benutzen. Wiederbeleben geht auf demselben oder einem Nachbarfeld.
- Shelter kostet 1 Holz + 1 Abfall (v11: 3 Holz + 2 Seil).
- Duell: Der Sieger nimmt genau eins, 1 Handkarte blind oder die Kompasskarte. Blind gezogen werden können Rohstoffe, Ausrüstung, Spezialkarten und die Routenkarte.
- Fern-Duell (Karte «Duell-Herausforderung»): nur 1 Handkarte blind. Im Kooperativ-Modus wird die Karte beim Ziehen abgelegt und neu gezogen.
- Wird der Kompass geraubt, behält der Verlierer seine Routenkarte. Der neue Besitzer zieht eine eigene.

**Flucht**

- Feuer-Tabelle: 3 Feuer Abstand 9 · 4 Feuer Abstand 7 · 5 Feuer Abstand 5 · 6 Feuer Abstand 4 (v11: 13 / 9 / 7 / 6).
- Kooperativ: Nach dem letzten Feuer müssen alle Figuren auf einem Feuerfeld der Kette stehen.
- Not-Floss 1–2: alle −2 Herzen in allen Modi (v11: Team K.O., PvP ausgeschieden). 3–4: Nur im Kooperativ-Modus bleibt das Floss liegen, sonst ist das Material weg.

**Sichtbarkeit**

- Jeder gegen jeden: alles verdeckt, auch Werkzeuge. Nur die verdeckte Kompasskarte liegt sichtbar vor der Person.
- Team: Charaktere offen.

## 3. Test-Schalter

Im Dialog «Neue Partie» unter «🧪 Test-Schalter», in der Simulation und über die Kommandozeile (`--schalter`). Der Stand steht im Spielprotokoll.

| Schalter | Standard | Alternative | ID |
|---|---|---|---|
| Ruhige Tage | 7 Ruhige + 12 Ereignisse | 10 Ruhige + 9 Ereignisse | `ruhigeTage` |
| Tierschaden | klein −1, gross −2 | klein 0, gross −1 | `tierschaden` |
| Shelter-Preis | 1 Holz, 1 Abfall | 3 Holz, 2 Seil | `shelterPreis` |
| Feuerabstände | 9 / 7 / 5 / 4 | 13 / 9 / 7 / 6 | `feuerabstaende` |
| Werkzeug-/Waffenlimit | kein Limit | max. 1 pro Typ | `werkzeuglimit` |
| Flucht vor Tierfeld | aus (Pflichtkampf) | für 1 Energie 1 Feld zurück oder zur Seite | `fluchtVorTier` |
| Werkzeuge offen | aus | Werkzeuge und Waffen offen, Diebstahl nur aus verdeckten Karten | `werkzeugeOffen` |
| +1 Energie pro Tag | an | aus | `energieProTag` |
| Spieldauer | 20 Tage | 30 Tage | `spieldauer` |

## 4. Oberfläche

- Startdialog: Koop-Empfehlung, Test-Schalter.
- Spieler-Panel: Kompasskarte verdeckt vor der Figur, Ausrüstung als Handkarten mit Anzahl, fremde Hände verdeckt.
- Neue Knöpfe: «Bandage benutzen», «Kompass bergen (0 Energie)», Beute «1 Handkarte blind» oder «Kompasskarte nehmen».
- Floss-Tableau mit Kompass-Zeile. Ketten-Anzeige meldet im Koop, wer noch auf ein Feuerfeld muss.
- Regeln-Tab: neuer Regeltext nach dem Regelstand 05.11.2026, Test-Schalter mit aktuellem Stand, Annahmen markiert.
- Regel-Chat im Regeln-Tab: Stichwortsuche über den Regeltext, ohne Internet. In v11 gab es keinen Regel-Chat (zuletzt in v4), er ist neu gebaut.

## 5. KI und Simulation

- Bots kennen Kompasskarte und Routenkarte getrennt. Sie greifen den Kompassbesitzer nur im normalen Duell an und wählen als Beute den Kompass.
- Bots betreten die Vulkanfelsen, statt sie per Weitsicht zu suchen.
- Bots benutzen die Bandage-Karte und beleben vom Nachbarfeld aus wieder.
- Koop: Steht die Feuerkette, gehen alle Bots auf das nächste Feuerfeld der Kette. Die Kette wird kompakt geplant (genau der Mindestabstand).
- Simulation: neue Kennzahlen K.O.s pro Partie, Wiederbelebungen, Kompassraube. Neu: `--alle` (Übersicht aller Modi und Spielerzahlen), `--schalter`, `--ab-schalter`. Im Browser lässt sich im A/B-Vergleich ein Test-Schalter als Variante B wählen.

## 6. Messung (150 Partien pro Zeile, Bots «normal», Standard V12)

| Modus | Spieler | Siegquote | Floss | Feuer | Wrack | Ø Siegtag | K.O.s pro Partie | Kompass gefunden (Ø Tag) |
|---|---|---|---|---|---|---|---|---|
| Koop | 2 | 48,7 % | 0,0 % | 47,3 % | 1,3 % | 14,0 | 0,36 | 0,7 % (10,0) |
| Koop | 3 | 57,3 % | 0,0 % | 57,3 % | 0,0 % | 15,0 | 0,65 | 0,0 % |
| Koop | 4 | 49,3 % | 0,0 % | 49,3 % | 0,0 % | 15,0 | 0,69 | 0,0 % |
| Team | 4 | 70,0 % | 0,7 % | 41,3 % | 28,0 % | 14,8 | 1,04 | 4,0 % (13,7) |
| PvP | 2 | 75,3 % | 13,3 % | 0,0 % | 17,3 % | 12,3 | 0,45 | 81,3 % (7,2) |
| PvP | 3 | 76,0 % | 15,3 % | 0,0 % | 32,0 % | 14,6 | 0,97 | 98,7 % (6,3) |
| PvP | 4 | 64,7 % | 16,0 % | 0,0 % | 34,7 % | 14,5 | 1,51 | 99,3 % (5,9) |

Mit Bots «gut» (60 Partien pro Zeile): Koop 2/3/4 46,7 / 55,0 / 56,7 % · Team 65,0 % · PvP 2/3/4 66,7 / 70,0 / 58,3 %.

Keine Partie ist hängen geblieben (0 Abbrüche am Zuglimit). Im PvP zählt auch «letzter Überlebender» als Sieg, darum ist die Siegquote höher als die Summe der Fluchtwege.

**Erreichbarkeit der Fluchtwege** (je 40 Partien, die anderen beiden Wege ausgeschaltet):

| Nur dieser Weg | Koop 2 | Koop 3 | Koop 4 | Team | PvP 2 |
|---|---|---|---|---|---|
| Floss | 42,5 % | 20,0 % | 35,0 % | 20,0 % | 7,5 % |
| Feuer | 72,5 % | 65,0 % | 55,0 % | 57,5 % | 47,5 % |
| Wrack | 55,0 % | 67,5 % | 77,5 % | 55,0 % | 45,0 % |

**Test-Schalter im A/B-Vergleich** (Koop 3, je 100 Partien, gleiche Seeds):

| Schalter | Standard | Alternative | Unterschied |
|---|---|---|---|
| +1 Energie pro Tag | 55 % | 21 % (aus) | 34 Prozentpunkte, sehr deutlich |
| Tierschaden | 55 %, 0,67 K.O.s | 70 %, 0,14 K.O.s | 15 Prozentpunkte, deutlich |
| Feuerabstände | 55 % | 50 % (13/9/7/6) | 5 Prozentpunkte, nicht deutlich |

**Auffällig**

- Die Koop-Bots wählen fast immer die Feuerkette. Mit den neuen Abständen ist sie der billigste Weg, das Floss wird im Koop praktisch nie gebaut und der Kompass kaum gesucht. Allein gespielt ist das Flugzeugwrack im Koop sogar erfolgreicher (55 bis 78 %). Ob echte Gruppen das auch so sehen, zeigt erst der Playtest.
- Im PvP baut kein Bot die Feuerkette, obwohl sie allein erreichbar ist (47,5 %).
- Die Zahlen messen die Regeln nur, soweit die Bots menschlich spielen.

## 7. Annahmen (im Regeln-Tab als «Annahme» markiert)

Aus dem Auftrag:

- Im Kampf und im Duell zählt nur die beste Waffe.
- Wasserquelle: Trinken ist freiwillig, man kann auch durchlaufen.
- «+1 Energie pro Tag» kommt vor der Tageskarte.
- Gebirge für Tageskarten = das graue Gebirgsplättchen liegt noch auf dem Feld, oder Vulkanfeld.
- Bei leerem Vorrat gibt es nichts.

Aus den Rückfragen vom 10.11.2026 (Vorschläge übernommen):

- Die Routenkarte wird erst bei geglückter Floss-Flucht abgegeben. Misslingt das Not-Floss, bleibt sie auf der Hand.
- Spieldauer «30 Tage» = 10 Ruhige Tage + 19 Ereignisse + Lava.
- Hinterhalt mit kleinem Tier: normaler Schaden eines kleinen Tiers, kein Sonderfall mehr.
- Wiederbeleben auf demselben oder einem Nachbarfeld gilt auch im Team-Modus.
- Scheidet der Kompassbesitzer im PvP aus, liegt der Kompass wieder unter seinem Vulkanfelsen.

Zusätzlich vom Prototyp getroffen, bitte im Team bestätigen:

- Handel: Tauschbar sind Rohstoffe, der Brennsprit und die Routenkarte (wie v11). Werkzeuge, Waffen, Bandagen und andere Spezialkarten sind noch nicht tauschbar, die Kompasskarte nie. Diese Frage war offen und ist nicht entschieden.
- Jede Person hält höchstens 1 Routenkarte. Wer den Kompass hat, aber keine Routenkarte mehr (blind geraubt), zieht zu Beginn des eigenen Zugs eine neue. Wer eine Routenkarte blind raubt und schon eine hat, legt die erbeutete ab.
- Das Startfeld wird zufällig unter den freien Startfeldern gewählt (keine eigene Auswahl im Dialog).
- Felsrutsch: Wer mehrere Waffen hat, verliert die schwächste.
- Der Floss-Marker (4 Stück) wird nicht gezählt, weil ein gebautes Floss die Partie beendet.
- Auf dem Krater kann nicht gebaut werden.

## 8. Tests

`node --test test/*.test.mjs`: 75 Tests, alle grün. Neu ist `test/v12.test.mjs` mit 20 Tests zu N1 bis N6, Aufbau, Startfeldern, Brennsprit-Lage, Ausrüstungskarten, Bandage, Test-Schaltern, Simulation aller Modi und Erreichbarkeit der drei Fluchtwege. 16 Tests aus v11 wurden auf den neuen Regelstand angepasst.

Im Browser geprüft (Chromium): Startdialog, Partien in Koop, Team und PvP, Freier Tisch, Regeln-Tab mit Regel-Chat, Simulation, Regler, Karten, Replay. Keine Konsolenfehler.

## 9. Nicht geändert

Tabs Spiel, Regler, Karten, Simulation, Replay und Regeln, Seed, Freier Tisch, KI-Stufen mit Persönlichkeit, Pixel-Art-Design, Sweep, A/B-Vergleich und Abgleich mit echten Partien. `CHANGES.md` ist die Historie von v11 und bleibt zum Nachlesen im Ordner.
