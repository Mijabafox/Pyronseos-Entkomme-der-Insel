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

// Grösste Teilkette, die noch fertig gebaut werden kann (für die Anzeige «x von y»).
// Bedingung: benachbarte Feuer der Teilkette >= abstand, und die Lücke rundum lässt Platz
// für die fehlenden Feuer (>= abstand * (fehlende + 1)).
export function besteTeilkette(nummern, feuer, abstand, ring) {
  const s = [...new Set(nummern)].sort((a, b) => a - b);
  if (s.length === 0) return [];
  const fertig = ketteFertig(s, feuer, abstand, ring);
  if (fertig) return fertig;
  const passt = (t) => {
    if (t.length > feuer) return false;
    for (let i = 1; i < t.length; i++) if (t[i] - t[i - 1] < abstand) return false;
    if (t.length <= 1) return true;
    return abstandRing(t[t.length - 1], t[0], ring) >= abstand * (feuer - t.length + 1);
  };
  let beste = [];
  if (s.length <= 16) {
    for (let m = 1; m < 1 << s.length; m++) {
      const t = s.filter((_, i) => m & (1 << i));
      if (t.length < beste.length || !passt(t)) continue;
      if (t.length > beste.length || t.join(',') < beste.join(',')) beste = t;
    }
    return beste;
  }
  // Viele Feuer: gierig ab jedem Start.
  for (let i = 0; i < s.length; i++) {
    const t = [s[i]];
    for (let j = i + 1; j < s.length && t.length < feuer; j++) if (s[j] - t[t.length - 1] >= abstand && passt([...t, s[j]])) t.push(s[j]);
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
    const noetig = i === kette.length - 1 ? abstand * (feuer - kette.length + 1) : abstand;
    return { von, bis, laenge, gueltig: laenge >= noetig };
  });
}

// Gleichmässig verteilte Wunschpositionen (Startversatz s) für eine Kette.
export function wunschkette(start, feuer, ring) {
  return Array.from({ length: feuer }, (_, d) => ((start - 1 + Math.round((d * ring) / feuer)) % ring) + 1).sort((a, b) => a - b);
}
