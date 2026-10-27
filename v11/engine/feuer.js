// Küstenfeuer-Kette: reine Rechenfunktionen (ohne Spielzustand).
// Abstand = Differenz der Strandnummern, rundum gezählt (42 zu 1 = 1).

export function abstandRing(von, bis, ring) {
  return (((bis - von) % ring) + ring) % ring;
}

// Gibt es unter den Feuern eine Kette mit `feuer` Feuern und überall Abstand >= `abstand` (auch rundum)?
// Für einen festen Start ist «immer das früheste passende Feuer nehmen» optimal.
export function ketteFertig(nummern, feuer, abstand, ring) {
  const s = [...new Set(nummern)].sort((a, b) => a - b);
  if (feuer <= 0) return [];
  if (s.length < feuer) return null;
  for (let i = 0; i < s.length; i++) {
    // Absolute Positionen ab Start s[i] (nach dem Umlauf + ring).
    const pos = [];
    for (let j = 0; j < s.length; j++) pos.push(s[(i + j) % s.length] + (i + j >= s.length ? ring : 0));
    const kette = [pos[0]];
    for (let j = 1; j < pos.length && kette.length < feuer; j++) if (pos[j] - kette[kette.length - 1] >= abstand) kette.push(pos[j]);
    if (kette.length === feuer && pos[0] + ring - kette[kette.length - 1] >= abstand) {
      return kette.map((n) => ((n - 1) % ring) + 1).sort((a, b) => a - b);
    }
  }
  return null;
}

// Lässt sich die Teilkette noch zu einer vollen Kette ergänzen?
// Alle Lücken (rundum) >= abstand, und in die Lücken passen zusammen die fehlenden Feuer:
// in eine Lücke der Länge g passen floor(g / abstand) - 1 weitere Feuer.
export function ergaenzbar(teil, feuer, abstand, ring) {
  const t = [...teil].sort((a, b) => a - b);
  if (t.length > feuer) return false;
  if (t.length <= 1) return Math.floor(ring / abstand) >= feuer;
  let platz = 0;
  for (let i = 0; i < t.length; i++) {
    const g = abstandRing(t[i], t[(i + 1) % t.length], ring);
    if (g < abstand) return false;
    platz += Math.floor(g / abstand) - 1;
  }
  return platz >= feuer - t.length;
}

// Grösste Teilkette, die noch fertig gebaut werden kann (für «x von y» und «zählt / zählt nicht»).
export function besteTeilkette(nummern, feuer, abstand, ring) {
  const s = [...new Set(nummern)].sort((a, b) => a - b);
  if (s.length === 0) return [];
  const fertig = ketteFertig(s, feuer, abstand, ring);
  if (fertig) return fertig;
  let beste = [];
  if (s.length <= 16) {
    for (let m = 1; m < 1 << s.length; m++) {
      const t = s.filter((_, i) => m & (1 << i));
      if (t.length < beste.length || t.length > feuer || !ergaenzbar(t, feuer, abstand, ring)) continue;
      if (t.length > beste.length || t.join(',') < beste.join(',')) beste = t;
    }
    return beste;
  }
  // Viele Feuer: gierig ab jedem Start.
  for (let i = 0; i < s.length; i++) {
    const t = [s[i]];
    for (let j = i + 1; j < s.length && t.length < feuer; j++) if (ergaenzbar([...t, s[j]], feuer, abstand, ring)) t.push(s[j]);
    if (t.length > beste.length) beste = t;
  }
  return beste;
}

// Lücken zwischen den Feuern der Teilkette (für die Ringanzeige).
export function luecken(kette, feuer, abstand, ring) {
  if (kette.length < 2) return [];
  return kette.map((von, i) => {
    const bis = kette[(i + 1) % kette.length];
    const laenge = abstandRing(von, bis, ring);
    return { von, bis, laenge, gueltig: laenge >= abstand };
  });
}

// Gleichmässig verteilte Wunschpositionen (Startversatz s) für eine Kette.
export function wunschkette(start, feuer, ring) {
  return Array.from({ length: feuer }, (_, d) => ((start - 1 + Math.round((d * ring) / feuer)) % ring) + 1).sort((a, b) => a - b);
}
