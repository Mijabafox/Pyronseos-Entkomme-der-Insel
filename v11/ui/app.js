// Einstieg der Oberfläche: Reiter, Zustand, Module. Die Seite öffnet wie V10 auf dem Spieltisch mit dem Startdialog.
import { $, $$ } from './dom.js';
import { app, startZustand } from './zustand.js';
import { toolbarZeichnen } from './toolbar.js';
import { spielZeigen, neuesSpiel } from './spiel.js';
import { FreierTisch } from './frei.js';
import { startDialogZeigen, startDialogOffen } from './startdialog.js';
import { reglerZeigen } from './regler.js';
import { kartenZeigen } from './editor.js';
import { simZeigen } from './simtab.js';
import { replayZeigen } from './replay.js';
import { regelnZeigen } from './regeln.js';

const ansichten = { spiel: spielZeigen, regler: reglerZeigen, karten: kartenZeigen, sim: simZeigen, replay: replayZeigen, regeln: regelnZeigen };
let aktuell = 'spiel';

export function reiter(name) {
  if (name !== 'spiel' && startDialogOffen()) $('#dialog').close();
  aktuell = name;
  for (const b of $$('[data-reiter]')) b.classList.toggle('an', b.dataset.reiter === name);
  for (const k of Object.keys(ansichten)) $(`#ansicht-${k}`).hidden = k !== name;
  // Der Spieltisch scrollt nie als Seite, nur Zoom und Verschieben.
  document.body.classList.toggle('tisch-sichtbar', name === 'spiel');
  $('#hinweisleiste').hidden = name !== 'spiel';
  ansichten[name]($(`#ansicht-${name}`));
  toolbarZeichnen();
  if (name === 'spiel' && !app.partie && !app.frei && !$('#dialog').open) startDialogZeigen();
}
app.reiter = reiter;
app.aktuellerReiter = () => aktuell;

// «Neue Partie»: Startdialog über dem Spieltisch.
app.neuePartieDialog = () => { if (aktuell !== 'spiel') reiter('spiel'); startDialogZeigen(); };
app.partieStarten = () => { app.frei?.beenden(); app.frei = null; neuesSpiel(); reiter('spiel'); };
// Freier Tisch: neu (Namen aus den Sitzen, Seed aus dem Startdialog) oder den zuletzt gespeicherten fortsetzen.
app.freiStarten = (fortsetzen = false) => {
  app.partie?.beenden(); app.partie = null;
  app.frei?.beenden();
  const seed = app.cfg.match.seed ?? Math.floor(Math.random() * 1e6) + 1;
  app.frei = (fortsetzen && FreierTisch.laden()) || FreierTisch.neu(app.cfg, app.sitze.map((s) => s.name), seed);
  app.frei.speichern();
  reiter('spiel');
};

app.hoerer.add(() => toolbarZeichnen());
await startZustand();
for (const b of $$('[data-reiter]')) b.addEventListener('click', () => reiter(b.dataset.reiter));
reiter('spiel');
