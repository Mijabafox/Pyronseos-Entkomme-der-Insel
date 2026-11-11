# Pyronesos – Entkomme der Insel · Version 13

Browser-Prototyp mit dem Regelstand vom 11.11.2026 (Dokumentation V08, Spielanleitung v5). Alle drei Modi (Kooperativ, Team 2 gegen 2, Jeder gegen jeden), 2 bis 4 Personen, gespielt solo gegen KI-Mitspieler. Eine Regel-Engine für Browser und Simulation, eine `config.json` als Quelle aller Werte. Was neu ist, steht in `CHANGELOG.md`, der Abgleich jeder Regel mit V12 in `ABGLEICH.md`.

## Im Browser spielen

1. Den Repository-Ordner mit einem kleinen Webserver öffnen (die Seite lädt `config.json` und Module):
   ```
   python3 -m http.server 8012
   ```
   Startet einen lokalen Server im aktuellen Ordner.
2. `http://localhost:8012/v13/` öffnen (auf GitHub Pages: `…/v13/`).
3. Die Seite öffnet auf dem Spieltisch mit dem Dialog **Neue Partie**: Modus, Spielart (Regel-Modus oder Freier Tisch), Spieler und Seed. Voreingestellt ist Standard V13, Kooperativ (empfohlen für die erste Partie), du plus zwei KI auf «normal». Ein Klick auf **Partie starten** genügt.
4. Unter **🧪 Test-Schalter** stellst du die vier Playtest-Varianten einzeln um (Standard = aktueller Regelstand). Unter **Erweitert** (zugeklappt) wählst du das Preset und die KI-Persönlichkeit je Sitz; «Regler öffnen» führt zu allen Werten. Fehler der Prüfung blockieren den Start und werden im Dialog in Klartext gezeigt.
5. **＋ Neue Partie** oben rechts öffnet den Dialog jederzeit wieder. Während einer Partie im Regel-Modus sind die Regler gesperrt.

Reiter: **Spiel** (Regel-Modus für Koop, Team und PvP oder Freier Tisch; Tisch mit Zoom, Verschieben und Minimap), **Regler** (alle Werte nach Bereichen, Suche, Presets, Export und Import, Einzel-Reset), **Karten** (Tages- und Spezialkarten als Bilder, Editor im Dialog), **Simulation** (Serie, Sweep, A/B, Abgleich mit echten Partien), **Replay**, **Regeln** (Regelwerk V13 aus der aktuellen Konfiguration, mit Test-Schaltern, Annahmen und Regel-Chat).

**Freier Tisch** (für Playtests): keine Regelprüfung, keine KI. Figuren, offene Karten, Panels, Marker und Plättchen frei ziehen; Felder auf- und zudecken (Klick, Nebel, Rechtsklick-Menü); Werte mit +/−; Stapel ziehen, mischen, Ablage; Würfeln, Tierjagd, eigene Karten, Spieler dazu, Szenarien speichern und laden, Playtest-Protokoll (CSV); Rückgängig mit Strg+Z. Der Tisch wird im Browser gespeichert und lässt sich im Startdialog fortsetzen.

KI-Tempo (Toolbar oben): schnell, normal, langsam, «sehr langsam – Auto» (Pause 1 bis 5 s pro Schritt) und «sehr langsam – Weiter-Knopf» (Enter oder Leertaste). Jederzeit umschaltbar. **⬇ Protokoll** speichert die Partie für Replay und Abgleich.

## Simulation über die Kommandozeile

Node 20 oder neuer, keine Abhängigkeiten.

```
cd v13
node sim/cli.mjs --hilfe
node sim/cli.mjs --alle --partien 100
node sim/cli.mjs --schalter tierschaden,ruhigeTage --modus koop --spieler 3
node sim/messung-v13.mjs 40
node sim/cli.mjs --ab-schalter energieProTag --partien 200 --modus koop --spieler 3
node sim/cli.mjs --partien 200 --modus koop --spieler 3 --bots normal,normal,gut
node sim/cli.mjs --preset hart --csv ergebnis.csv
node sim/cli.mjs --sweep fluchtwege.floss.solide.proPerson.seil=1:4 --sweep2 match.spieler=2:4 --partien 50
node sim/cli.mjs --ab config/presets/einfach.json --partien 300
node sim/cli.mjs --import meine-partien.json
node sim/cli.mjs --replay 17 --json partie17.json
```

- `--alle` zeigt Siegquote, Fluchtweg, Siegtag, K.O.s, Kompassfund, «Nicht verloren» und Plünderungen für alle Modi und Spielerzahlen.
- `sim/messung-v13.mjs` misst die Erreichbarkeit jedes Fluchtwegs allein und die vier Test-Schalter im A/B-Vergleich.
- `--schalter` stellt Test-Schalter auf die Alternative, `--ab-schalter` vergleicht einen Schalter bei gleichen Seeds.
- `--sweep` druckt eine Heatmap und speichert mit `--csv` eine Tabelle.
- `--ab` vergleicht die aktuelle Konfiguration mit einer zweiten bei gleichen Seeds, mit Signifikanzangabe.
- `--import` liest im Browser exportierte Protokolle und zeigt, wo die Bots deutlich anders spielen als Menschen.
- Gleiche Konfiguration plus gleicher Seed ergibt immer exakt dieselbe Partie.

## Tests

```
cd v13
node --test test/*.test.mjs
```

Prüft Regelstand, Validator, Reproduzierbarkeit, Informationsgrenze der Bots, Bot-Verhalten, Simulation, Sweep, A/B, Replay und Import (rund 2 Minuten). `test/v13.test.mjs` prüft die Regeln vom 11.11.2026.

## Aufbau

| Ordner | Inhalt |
|---|---|
| `config/` | `config.json` (Standard V13) und Presets (`standard`, `einfach`, `hart`) |
| `engine/` | Regel-Engine (rein JavaScript): Zufall, Brett, Effekt-Baukasten, Regeln, Validator, Regler-Schema, Beobachtungs-Snapshot, Test-Schalter (`schalter.js`) |
| `bots/` | Zufalls-Bot, Bots mit Stufen und Persönlichkeit, Gedächtnis, Vorausschau (Stufe «gut») |
| `sim/` | Spielleiter (Engine, Bots, Menschen), Simulation, Kommandozeile, Web Worker |
| `ui/` | Browser-Oberfläche |
| `test/` | Tests (`node --test`) |

Siehe auch `CHANGELOG.md` (neu gegenüber V12, Messung, Annahmen), `ABGLEICH.md` und `OFFENE_PUNKTE.md`. `CHANGES.md` ist die Historie von v11.
