// Web Worker für die Simulation im Browser (blockiert die Oberfläche nicht).
import { serie, auswerten, sweep, abVergleich, abgleich, protokollKennzahlen } from './simulation.js';

self.onmessage = (e) => {
  const m = e.data;
  const fortschritt = (i, n) => self.postMessage({ art: 'fortschritt', i, n });
  try {
    if (m.art === 'serie') {
      const partien = serie(m.cfg, m.opt, fortschritt);
      self.postMessage({ art: 'fertig', ergebnis: { partien, auswertung: auswerten(partien) } });
    } else if (m.art === 'sweep') {
      self.postMessage({ art: 'fertig', ergebnis: sweep(m.cfg, m.opt, m.sweep, fortschritt) });
    } else if (m.art === 'ab') {
      self.postMessage({ art: 'fertig', ergebnis: abVergleich(m.cfg, m.cfgB, m.opt, fortschritt) });
    } else if (m.art === 'import') {
      const echte = m.protokolle.map((p) => protokollKennzahlen(p, m.cfg));
      const bots = serie(m.cfg, { ...m.opt, modus: echte[0]?.modus ?? m.opt.modus, spieler: echte[0]?.spieler ?? m.opt.spieler }, fortschritt);
      self.postMessage({ art: 'fertig', ergebnis: abgleich(echte, bots) });
    }
  } catch (f) {
    self.postMessage({ art: 'fehler', text: String(f?.message ?? f) });
  }
};
