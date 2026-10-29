# Insel-Survival · Version 11

Prototyp mit Regelstand V10, Regler-Labor und menschennaher KI. Eine Regel-Engine für Browser und Simulation, eine `config.json` als Quelle aller Werte.

## Im Browser spielen

1. Den Repository-Ordner mit einem kleinen Webserver öffnen (die Seite lädt `config.json` und Module):
   ```
   python3 -m http.server 8011
   ```
   Startet einen lokalen Server im aktuellen Ordner.
2. `http://localhost:8011/v11/` öffnen (auf GitHub Pages: `…/v11/`).
3. Die Seite öffnet wie V10 auf dem Spieltisch mit dem Dialog **Neue Partie**: Modus, Spielart (Regel-Modus oder Freier Tisch), Spieler und Seed. Voreingestellt ist Standard V10, Koop, du plus zwei KI auf «normal». Ein Klick auf **Partie starten** genügt.
4. Unter **Erweitert** (zugeklappt) wählst du das Preset und die KI-Persönlichkeit je Sitz; «Regler öffnen» führt zu allen Werten. Fehler der Prüfung blockieren den Start und werden im Dialog in Klartext gezeigt.
5. **＋ Neue Partie** oben rechts öffnet den Dialog jederzeit wieder. Während einer Partie im Regel-Modus sind die Regler gesperrt.

Reiter: **Spiel** (Regel-Modus für Koop, Team und PvP oder Freier Tisch; Tisch mit Zoom, Verschieben und Minimap wie V10), **Regler** (alle Werte nach Bereichen, Suche, Presets, Export und Import, Einzel-Reset), **Karten** (Tages- und Spezialkarten als Bilder, Editor im Dialog), **Simulation** (Serie, Sweep, A/B, Abgleich mit echten Partien), **Replay**, **Regeln** (Spielanleitung wie V10 aus der aktuellen Konfiguration).

**Freier Tisch** (wie V10, für Playtests): keine Regelprüfung, keine KI. Figuren, offene Karten, Panels, Marker und Plättchen frei ziehen; Felder auf- und zudecken (Klick, Nebel, Rechtsklick-Menü); Werte mit +/−; Stapel ziehen, mischen, Ablage; Würfeln, Tierjagd, eigene Karten, Spieler dazu, Szenarien speichern und laden, Playtest-Protokoll (CSV); Rückgängig mit Strg+Z. Der Tisch wird im Browser gespeichert und lässt sich im Startdialog fortsetzen.

KI-Tempo (Toolbar oben): schnell, normal, langsam, «sehr langsam – Auto» (Pause 1 bis 5 s pro Schritt) und «sehr langsam – Weiter-Knopf» (Enter oder Leertaste). Jederzeit umschaltbar. **⬇ Protokoll** speichert die Partie für Replay und Abgleich.

## Simulation über die Kommandozeile

Node 20 oder neuer, keine Abhängigkeiten.

```
cd v11
node sim/cli.mjs --hilfe
node sim/cli.mjs --partien 200 --modus koop --spieler 3 --bots normal,normal,gut
node sim/cli.mjs --preset hart --csv ergebnis.csv
node sim/cli.mjs --sweep fluchtwege.floss.solide.proPerson.seil=1:4 --sweep2 match.spieler=2:4 --partien 50
node sim/cli.mjs --ab config/presets/einfach.json --partien 300
node sim/cli.mjs --import meine-partien.json
node sim/cli.mjs --replay 17 --json partie17.json
```

- `--sweep` druckt eine Heatmap und speichert mit `--csv` eine Tabelle.
- `--ab` vergleicht die aktuelle Konfiguration mit einer zweiten bei gleichen Seeds, mit Signifikanzangabe.
- `--import` liest im Browser exportierte Protokolle und zeigt, wo die Bots deutlich anders spielen als Menschen.
- Gleiche Konfiguration plus gleicher Seed ergibt immer exakt dieselbe Partie.

## Tests

```
cd v11
node --test test/*.test.mjs
```

Prüft Regelstand, Validator, Reproduzierbarkeit, Informationsgrenze der Bots, Bot-Verhalten, Simulation, Sweep, A/B, Replay und Import (rund 40 s).

## Aufbau

| Ordner | Inhalt |
|---|---|
| `config/` | `config.json` (Standard V10) und Presets (`standard`, `einfach`, `hart`) |
| `engine/` | Regel-Engine (rein JavaScript): Zufall, Brett, Effekt-Baukasten, Regeln, Validator, Regler-Schema, Beobachtungs-Snapshot |
| `bots/` | Zufalls-Bot, Bots mit Stufen und Persönlichkeit, Gedächtnis, Vorausschau (Stufe «gut») |
| `sim/` | Spielleiter (Engine, Bots, Menschen), Simulation, Kommandozeile, Web Worker |
| `ui/` | Browser-Oberfläche |
| `test/` | Tests (`node --test`) |

Siehe auch `CHANGES.md` (Änderungen und Checkliste) und `OFFENE_PUNKTE.md`.
