# Änderungen V11 gegenüber V10 und Abweichungen vom Auftrag

## Ausgangslage

- Von v10 liegt im Repository nur das fertige, minifizierte Build (`v10/assets/index-*.js`), kein Quellcode. V11 ist deshalb neu geschrieben. Die Regeln wurden aus dem v10-Code übernommen, Bilder, Brett-Raster und Farbpalette aus `v10/`.
- v9 wurde nur für die Regler-Idee angesehen (Konfigurationsbaum, Presets, Sweep, A/B, Replay). Keine Spielregeln aus v9 übernommen.

## Stufe 1: Engine, config.json, Validator

- Eine Regel-Engine in reinem JavaScript (`engine/`), ohne Build-Schritt, läuft im Browser und in Node.
- `config/config.json` ist die einzige Quelle aller Spielwerte (Standard V10). Presets in `config/presets/` (Standard, Einfach, Hart) sind Teilkonfigurationen, die mit dem Standard zusammengeführt werden.
- Zufall nur über einen seedbaren Generator mit getrennten Quellen: Brett, Start, Tageskarten, Spezialkarten, Tierbeutel, Routenkarten, Würfel, Duell-Beute, Bots.
- Validator (`engine/validator.js`) mit Fehlern (blockieren) und Warnungen.
- Regler werden automatisch aus der Konfiguration abgeleitet (`engine/schema.js`), mit Namen und Mindest-/Höchstwert.

## Regelstand Abschnitt 1: in v10 fehlend oder abweichend, in V11 umgesetzt

- **Not-Floss (1.5):** Wurf 3–4 «zurück an Land» → nächster Versuch gratis in allen Modi (v10: nur Koop, in Team und PvP war das Material verloren). Erneuter Versuch erst am nächsten Tag. Beides als Schalter.
- **Materialvorrat:** v10 hatte im Regel-Modus keinen begrenzten Vorrat. V11: Standard begrenzt (Holz 30, Stein 20, Blätter 25, Seil 12, Abfall 20, Nahrung 15), leerer Stapel = kein Ertrag, Schalter «unbegrenzt».
- Alle übrigen Punkte aus Abschnitt 1 setzt v10 bereits um. Sie wurden 1:1 übernommen und mit Tests abgesichert (siehe Checkliste).

## Abweichungen vom Auftrag

- **Spielerzahl:** höchstens 4 (Antwort vom 27.10.: «es gibt nur 4 Spieler, also 2 gegen 2»). Der Regler geht von 2 bis 4. Der Validator blockiert 5 und 6 mit Klartext. Team ist immer 2 gegen 2.
- **Shelter-Lager als vierter Weg:** entfällt (Antwort 27.10.).
- **Freier Tisch und Regel-Fragen** aus v10 sind nicht in V11 (Antwort 27.10.), v10 bleibt erreichbar.
- Die Würfelgrösse im Tier- und Duellkampf (W6) ist Teil der Grundmechanik und kein Regler.

## Stufe 2: Effekt-Baukasten und Karten als Daten

- Alle 19 Tageskarten, Ruhiger Tag, Lava und alle Spezialkarten stehen als Daten in `config.json` und bestehen aus Bausteinen (`engine/effekte.js`): Herzen, Energie, Rohstoff geben/nehmen, Abgabe mit Ersatz, Karte weitergeben, Felder aufdecken, Bewegung gratis, Tier ziehen und kämpfen, Zug beenden, Kampfbonus, Abbau-Faktor, Wurf wiederholen, Weitsicht ändern, Bewegungskosten ändern, Trinken sperren, Rasten-Wert, Floss sperren, Rettungswurf, Würfeltabelle, Wahl, Werkzeug verlieren, Ausweichen, Schutz, Kampfsieg, Rauch, Duell, Brennsprit.
- Bedingungen pro Effekt: Biom, «nicht bei Feuer/Shelter» (Schutz durch Shelter oder Feuer), mit/ohne Waffe, hat Werkzeug, Modus. Zielgruppe «aktiv» oder «alle».
- Tageskarten-Modifikatoren wirken den ganzen Tag (z. B. Nebel, Erdrutsch, Dürre, Brise, Wildnis, Sturm).
- Neue Grundmechaniken (Phasen, Rauch-Reaktion, Messer im Duell) bleiben bewusst im Code.
- Regeltests für jeden Punkt aus Abschnitt 1 (`test/stufe2.test.mjs`).
