# Offene Punkte – Pyronesos V12

Diese Punkte sind im Regelwerk vom 05.11.2026 nicht ausdrücklich entschieden. Der Prototyp legt sie aus (im Regeln-Tab als «Annahme» markiert). Bitte im Team bestätigen.

| Nr | Thema | Auslegung im Prototyp | Schalter / Regler |
|---|---|---|---|
| 1 | Handel mit Ausrüstung und Spezialkarten | Tauschbar sind Rohstoffe, Brennsprit und Routenkarte. Werkzeuge, Waffen, Bandagen und andere Spezialkarten noch nicht, die Kompasskarte nie. | – |
| 2 | Routenkarte beim Not-Floss | Wird erst bei geglückter Flucht abgegeben, bei 1–4 bleibt sie auf der Hand. | – |
| 3 | Mehrere Routenkarten | Höchstens 1 pro Person. Wer eine zweite blind raubt, legt sie ab. Wer den Kompass hat und keine Routenkarte mehr, zieht zu Zugbeginn eine neue. | – |
| 4 | Startfeld wählen | Im Prototyp zufällig unter den freien Startfeldern. | `figur.startfeld.felder` |
| 5 | Kompass beim Ausscheiden (PvP) | Liegt wieder unter seinem Vulkanfelsen. | `duelle.routeBeiAusscheiden` |
| 6 | Wiederbeleben im Team | Selbes oder Nachbarfeld wie im Koop. | `figur.reanimationRadius` |
| 7 | Felsrutsch mit mehreren Waffen | Die schwächste Waffe geht verloren. | – |
| 8 | Floss-Marker | Werden nicht gezählt, ein gebautes Floss beendet die Partie. | – |
| 9 | Koop-Bots und Floss | Die Bots wählen im Koop fast immer die Feuerkette, das Floss praktisch nie. Allein gespielt ist das Wrack im Koop am erfolgreichsten. Playtest nötig. | Simulation |
| 10 | Wirkung «+1 Energie pro Tag» | Im A/B-Vergleich (Koop 3) hebt sie die Siegquote von 21 % auf 55 %. Grösster Einzelhebel der neuen Regeln. | `energieProTag` |

Messung und Begründungen: siehe `CHANGELOG.md`, Abschnitt 6.
