// Anzeigenamen (Deutsch, ohne ß).

export const TIER = {
  hase: { name: 'Hase', symbol: '🐇' }, wildhuhn: { name: 'Wildhuhn', symbol: '🐓' },
  schwein: { name: 'Schwein', symbol: '🐖' }, krebs: { name: 'Krebs', symbol: '🦀' },
  baer: { name: 'Bär', symbol: '🐻' }, tiger: { name: 'Tiger', symbol: '🐅' },
  schlange: { name: 'Schlange', symbol: '🐍' }, krokodil: { name: 'Krokodil', symbol: '🐊' },
};
export const tierName = (t) => TIER[t]?.name ?? t;

export const INHALT = {
  baum: 'Baum', blaetterbusch: 'Blätterbusch', tier: 'Tier', spezial: 'Spezialfeld', wasserquelle: 'Wasserquelle',
  flugzeugwrack: 'Flugzeugwrack', dickicht: 'leeres Dickicht', lichtung: 'Lichtung', fels: 'Fels', bergquelle: 'Bergquelle',
  geroell: 'Geröll', strandgut: 'Strandgut', suesswasser: 'Süsswasser-Zufluss', sandbank: 'Sandbank', vulkanfels: 'Vulkanfels',
  leer: 'leer', krater: 'Krater',
};
export const BIOM = { wald: 'Wald', wiese: 'Wiese', gebirge: 'Gebirge', strand: 'Strand', vulkan: 'Vulkan' };
export const ROHSTOFF = { holz: 'Holz', stein: 'Stein', blaetter: 'Blätter', seil: 'Seil', abfall: 'Abfall', nahrung: 'Nahrung' };
export const ROHSTOFF_SYMBOL = { holz: '🪵', stein: '🪨', blaetter: '🍃', seil: '🪢', abfall: '🥫', nahrung: '🍖' };
export const REZEPT = {
  seil: { name: 'Seil', symbol: '🪢', wirkung: 'Grundmaterial' },
  steinaxt: { name: 'Steinaxt', symbol: '🪓', wirkung: 'mehr Holz beim Abbau' },
  spitzhacke: { name: 'Spitzhacke', symbol: '⛏️', wirkung: 'mehr Stein, nötig für den Kompass' },
  holzspeer: { name: 'Holzspeer', symbol: '🔱', wirkung: 'Waffe' },
  steinmachete: { name: 'Machete', symbol: '🗡️', wirkung: 'Waffe' },
  bandage: { name: 'Pflanzenbandage', symbol: '🩹', wirkung: 'Herzen oder Reanimation auf deinem Feld' },
  lagerfeuer: { name: 'Lagerfeuer', symbol: '🔥', wirkung: 'beim Bau Herzen; am Strand Teil der Küstenfeuer-Kette' },
  shelter: { name: 'Shelter', symbol: '⛺', wirkung: 'besseres Rasten, Schutz vor Giftwolke und Frost' },
};
export const ENDE = {
  floss: 'Flucht mit dem soliden Floss', notfloss: 'Flucht mit dem Not-Floss', signalfeuer: 'Rettung dank der Küstenfeuer-Kette',
  wrack: 'Flucht mit dem reparierten Flugzeugwrack', ueberlebender: 'Letzter Überlebender',
  lava: 'Der Vulkan ist ausgebrochen. Niemand ist entkommen.', alle_ko: 'Alle liegen gleichzeitig am Boden. Die Insel hat gewonnen.',
  abbruch: 'Partie abgebrochen (Zuglimit)',
};
export const FLUCHTWEG_VON_GRUND = { floss: 'floss', notfloss: 'floss', signalfeuer: 'feuer', wrack: 'wrack' };
