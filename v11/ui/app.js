// Einstieg der Oberfläche: Reiter, Zustand, Module.
import { $, $$ } from './dom.js';
import { app, startZustand } from './zustand.js';
import { setupZeigen } from './setup.js';
import { reglerZeigen } from './regler.js';
import { spielZeigen } from './spiel.js';
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
  ansichten[name]($(`#ansicht-${name}`));
}
app.reiter = reiter;
app.aktuellerReiter = () => aktuell;

await startZustand();
for (const b of $$('[data-reiter]')) b.addEventListener('click', () => reiter(b.dataset.reiter));
reiter('setup');
