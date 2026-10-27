// Spielbrett: 169 Felder (8 pro Kante), Vulkan in der Mitte, Strandring 1–42.
// Biom-Zonen werden mit jedem Seed neu angeordnet (wie v10), Dünen liegen auf den gedruckten Feldern.
import { scheibe, ring, abstand, MITTE, schluessel, nachbarn, winkel, himmelsrichtung } from './hex.js';
import { Zufall, ableiten } from './rng.js';

export const FELDER_PRO_KANTE = 8;
export const R = FELDER_PRO_KANTE - 1; // äusserster Ring = Strand
export const INNEN = [2, 3, 4, 5, 6];
export const DUENEN_GEDRUCKT = ['-5,6', '-3,-3', '4,2', '5,1', '6,-6'];
export const SEED_FESTE_ZONEN = 20260924;
export const QUELLEN = ['wasserquelle', 'bergquelle', 'suesswasser'];

export const STRANDRING = ring(R).length; // 42

export function anzahlFelder() { return scheibe(R).length; }

// Prüft, ob die Plättchen-Anzahlen auf das Brett passen. Gibt Fehlertexte zurück.
export function plaettchenPruefen(plaettchen) {
  const f = [];
  const sum = (b) => Object.values(plaettchen[b] ?? {}).reduce((s, n) => s + (n ?? 0), 0);
  const vulkanFelder = scheibe(1).length;
  if (sum('vulkan') !== vulkanFelder) f.push(`Vulkan: ${sum('vulkan')} Plättchen, aber ${vulkanFelder} Vulkanfelder.`);
  if ((plaettchen.vulkan?.vulkanfels ?? 0) < 1) f.push('Vulkan: mindestens 1 Vulkanfels nötig (Kompass).');
  const innen = INNEN.reduce((s, n) => s + ring(n).length, 0);
  const duenen = sum('strand') - STRANDRING;
  if (duenen < 0) f.push(`Strand: ${sum('strand')} Plättchen, der Strandring hat aber ${STRANDRING} Felder.`);
  const belegt = sum('wald') + sum('wiese') + sum('gebirge') + Math.max(0, duenen);
  if (belegt !== innen) f.push(`Inneres Brett (Ringe 2–6): ${belegt} Plättchen (Wald + Wiese + Gebirge + Dünen), es braucht genau ${innen}.`);
  if (duenen !== DUENEN_GEDRUCKT.length) f.push(`Dünen: ${duenen} Strandplättchen über dem Ring, gedruckt sind ${DUENEN_GEDRUCKT.length}.`);
  return f;
}

// Erzeugt die Biom-Zonen (welches Feld welches Biom hat).
export function zonen(cfg, seed) {
  const pl = cfg.brett.plaettchen, z = cfg.brett.zonen;
  const rng = new Zufall(cfg.brett.festeBiome ? SEED_FESTE_ZONEN : ableiten(seed, 'zonen'));
  const sum = (b) => Object.values(pl[b]).reduce((s, n) => s + n, 0);
  const alle = scheibe(R), karte = new Map();
  const ringVon = (c) => abstand(c, MITTE);
  const innen = alle.filter((c) => INNEN.includes(ringVon(c)));
  for (const c of alle) {
    if (ringVon(c) <= 1) karte.set(schluessel(c), { biom: 'vulkan', duene: false });
    if (ringVon(c) === R) karte.set(schluessel(c), { biom: 'strand', duene: false });
  }
  const gruppen = [
    { biom: 'strand', duene: true, anzahl: sum('strand') - STRANDRING, keime: z.duenenKeime, keimRinge: [6], erlaubt: [5, 6] },
    { biom: 'gebirge', duene: false, anzahl: sum('gebirge'), keime: z.gebirgeKeime, keimRinge: [2, 3], erlaubt: INNEN },
    { biom: 'wald', duene: false, anzahl: sum('wald'), keime: z.waldKeime, keimRinge: INNEN, erlaubt: INNEN },
    { biom: 'wiese', duene: false, anzahl: sum('wiese'), keime: z.wieseKeime, keimRinge: INNEN, erlaubt: INNEN },
  ];
  const frei = (c) => !karte.has(schluessel(c)) && INNEN.includes(ringVon(c));
  const setze = (c, g) => { karte.set(schluessel(c), { biom: g.biom, duene: g.duene }); g.anzahl--; };
  for (const g of gruppen) for (let k = 0; k < g.keime && g.anzahl > 0; k++) {
    const kand = innen.filter((c) => frei(c) && g.keimRinge.includes(ringVon(c)));
    if (kand.length) setze(rng.wahl(kand), g);
  }
  while (gruppen.some((g) => g.anzahl > 0)) {
    const offen = gruppen.filter((g) => g.anzahl > 0);
    let n = rng.int(1, offen.reduce((s, g) => s + g.anzahl, 0));
    const g = offen.find((x) => (n -= x.anzahl) <= 0);
    const eigene = innen.filter((c) => { const b = karte.get(schluessel(c)); return b && b.biom === g.biom && b.duene === g.duene; });
    const rand = new Map();
    for (const c of eigene) for (const nb of nachbarn(c)) if (frei(nb) && g.erlaubt.includes(ringVon(nb))) rand.set(schluessel(nb), nb);
    let kand = [...rand.values()];
    if (!kand.length) kand = innen.filter((c) => frei(c) && g.erlaubt.includes(ringVon(c)));
    if (!kand.length) kand = innen.filter(frei);
    setze(rng.wahl(kand), g);
  }
  // Dünen auf die gedruckten Felder tauschen.
  const gedruckt = new Set(DUENEN_GEDRUCKT);
  const falsch = [...karte.entries()].filter(([k, b]) => b.duene && !gedruckt.has(k)).map(([k]) => k);
  const fehlt = [...gedruckt].filter((k) => !karte.get(k)?.duene);
  fehlt.forEach((k, i) => { const alt = karte.get(k); karte.set(k, { biom: 'strand', duene: true }); karte.set(falsch[i], alt); });
  // Strandnummern 1–42 im Uhrzeigersinn ab Norden.
  const strand = [...ring(R)].sort((a, b) => winkel(a) - winkel(b));
  const nr = new Map(strand.map((c, i) => [schluessel(c), i + 1]));
  return alle.map((c) => {
    const k = schluessel(c), b = karte.get(k), amRand = ringVon(c) === R;
    return { key: k, coord: c, ring: ringVon(c), biom: b.biom, duene: b.duene,
      kuestenNr: amRand ? nr.get(k) : null, richtung: amRand ? himmelsrichtung(winkel(c)) : null };
  });
}

// Felder mit verdeckten Plättchen belegen.
export function brettAufbauen(state) {
  const cfg = state.cfg;
  const basis = zonen(cfg, state.seed);
  const felder = {};
  for (const biom of ['vulkan', 'wald', 'wiese', 'gebirge', 'strand']) {
    const stapel = [];
    for (const [inhalt, n] of Object.entries(cfg.brett.plaettchen[biom])) for (let i = 0; i < n; i++) stapel.push(inhalt);
    const gemischt = mischeQuelle(state, stapel);
    basis.filter((f) => f.biom === biom).forEach((f, i) => {
      felder[f.key] = { ...f, inhalt: gemischt[i], aufgedeckt: false, bau: null, tier: null, kompass: gemischt[i] === 'vulkanfels' };
    });
  }
  return felder;
}

import { mischen } from './rng.js';
function mischeQuelle(state, liste) { return mischen(state, 'brett', liste); }

export function istQuelle(feld) { return feld.aufgedeckt && QUELLEN.includes(feld.inhalt); }
