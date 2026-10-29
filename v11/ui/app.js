// Einstieg der Oberfläche: Reiter, Zustand, Module.
import { $, $$ } from './dom.js';
import { app, startZustand } from './zustand.js';
import { toolbarZeichnen } from './toolbar.js';
import { spielZeigen } from './spiel.js';
import { setupZeigen } from './setup.js';
import { reglerZeigen } from './regler.js';
import { kartenZeigen } from './editor.js';
import { simZeigen } from './simtab.js';
import { replayZeigen } from './replay.js';
import { regelnZeigen } from './regeln.js';

const ansichten = { spiel: spielZeigen, setup: setupZeigen, regler: reglerZeigen, karten: kartenZeigen, sim: simZeigen, replay: replayZeigen, regeln: regelnZeigen };
let aktuell = 'setup';

export function reiter(name) {
  aktuell = name;
  for (const b of $$('[data-reiter]')) b.classList.toggle('an', b.dataset.reiter === name);
  for (const k of Object.keys(ansichten)) $(`#ansicht-${k}`).hidden = k !== name;
  // Der Spieltisch scrollt nie als Seite, nur Zoom und Verschieben.
  document.body.classList.toggle('tisch-sichtbar', name === 'spiel');
  $('#hinweisleiste').hidden = name !== 'spiel';
  ansichten[name]($(`#ansicht-${name}`));
  toolbarZeichnen();
}
app.reiter = reiter;
app.aktuellerReiter = () => aktuell;

app.hoerer.add(() => toolbarZeichnen());
await startZustand();
for (const b of $$('[data-reiter]')) b.addEventListener('click', () => reiter(b.dataset.reiter));
reiter('setup');
