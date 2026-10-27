// Regelübersicht aus der aktuellen Konfiguration (Werte immer aktuell).
import { app } from './zustand.js';
import { esc } from './dom.js';
import { mal, rohstoffText } from '../engine/config.js';
import { bild } from './bilder.js';

export function regelnZeigen(el) {
  const c = app.cfg, fw = c.fluchtwege;
  const zeilen = [1, 2, 3, 4].map((n) => {
    const z = fw.feuer.tabelle[n];
    return `<tr><td>${n} ${n === 1 ? 'Person (PvP)' : `Personen${n === 2 ? ' (Koop 2, Team)' : ` (Koop ${n})`}`}</td><td>${rohstoffText(mal(fw.floss.solide.proPerson, n))}</td><td>${rohstoffText(mal(fw.floss.not.proPerson, n))}</td><td>${z ? `${z.feuer} Feuer, Abstand ≥ ${z.abstand} = ${rohstoffText(mal(c.crafting.rezepte.lagerfeuer.kosten, z.feuer))}` : '–'}</td><td>${fw.wrack.brennsprit ? 'Brennsprit + ' : ''}${rohstoffText(mal(fw.wrack.proPerson, n))}</td></tr>`;
  }).join('');
  const rezepte = Object.entries(c.crafting.rezepte).map(([id, r]) => `<tr class="${r.aktiv ? '' : 'aus'}"><td>${esc(id)}</td><td>${rohstoffText(r.kosten)}</td><td>${r.kampf ? `Kampf +${r.kampf}` : ''}</td></tr>`).join('');
  const tage = Object.values(c.tageskarten.karten).filter((k) => k.aktiv).map((k) => `<li><b>${esc(k.symbol ?? '')} ${esc(k.name)}</b>: ${esc(k.text)}</li>`).join('');
  const spezial = Object.values(c.spezialkarten.karten).filter((k) => k.aktiv).map((k) => `<li><b>${esc(k.symbol ?? '')} ${esc(k.name)}</b> (${k.anzahl}×, ${k.art}): ${esc(k.text)}</li>`).join('');
  el.innerHTML = `<div class="kasten"><h2>📖 Regeln (aktuelle Konfiguration: ${esc(app.presetName)})</h2>
  <p>${c.match.tage.ruhig} ruhige Tage und ${c.match.tage.ereignisse} Ereignisse${c.match.tage.lava ? ', danach die Lava-Karte' : ''}. Jeder Zug: Weitsicht (W${c.zug.weitsicht.wuerfel}, Umkreis ${c.zug.weitsicht.radius}), Bewegung (${c.zug.schrittEnergie} Energie pro Schritt), Abbau (beendet die Bewegung), Aktionen. Rasten ohne Schritt: +${c.zug.rasten} Energie, im Shelter +${c.zug.rastenShelter}. Nahrung: +${c.zug.nahrungEnergie} Energie.</p>
  <p><b>Wasser:</b> Durchlaufen ${c.zug.wasser.durchlaufen ? 'erlaubt' : 'nicht erlaubt'}, Trinken freiwillig: Energie auf ${c.zug.wasser.auffuellen}${c.zug.wasser.zugende ? ', danach endet der Zug sofort' : ''}. Bei Dürre kein Trinken.</p>
  <p><b>Tierkampf:</b> W6 + Bonus ≥ ${c.tiere.zielKlein} (klein) bzw. ${c.tiere.zielGross} (gross). Niederlage: Schaden laut Tier${c.tiere.zuruecksetzen ? ', zurück aufs Herkunftsfeld' : ''}, der Zug endet, das Tier bleibt. Hinterhalt: kein Zurücksetzen, kleines Tier ${c.tiere.hinterhaltKleinSchaden} Herz.</p>
  <p><b>Kompass und Routenkarte:</b> Wer den Kompass mit der Spitzhacke birgt, zieht sofort eine Routenkarte (Handkarte), der Zug endet. Floss nur, wenn die Figur mit der Routenkarte am Zielstrand steht und sie abgibt. Not-Floss W6: 1–${fw.floss.not.kentertBis} kentert, ${fw.floss.not.kentertBis + 1}–${fw.floss.not.landBis} zurück an Land${fw.floss.not.nachLandGratis ? ' (nächster Versuch gratis' + (fw.floss.not.nachLandNaechsterTag ? ', ab dem nächsten Tag)' : ')') : ' (Material verloren)'}, ${fw.floss.not.landBis + 1}–6 Flucht geglückt.</p>
  <p><b>Küstenfeuer-Kette:</b> Lagerfeuer auf den Strandfeldern 1–42, Abstand rundum gezählt (42 zu 1 = 1). Koop: alle Feuer der Gruppe, Team: nur eigenes Team, PvP: nur eigene. Fremde Feuer zählen nicht und blockieren nicht. Feuer mit zu kleinem Abstand dürfen gebaut werden (wärmen, heilen), zählen aber nicht. Sieg sofort mit dem letzten gültigen Feuer.</p>
  <p><b>Duelle (Team, PvP):</b> Umkreis ${c.duelle.radius}, ${c.duelle.energie} Energie, Verlierer −${c.duelle.herzen} Herz. Der Sieger wählt eine Kategorie, die der Verlierer hat: ${['rohstoff', 'spezial', 'route'].filter((k) => c.duelle.beute[k]).join(', ')}. Werkzeuge und Waffen liegen offen und sind nicht klaubar.</p>
  <p><b>Materialvorrat:</b> ${c.vorrat.unbegrenzt ? 'unbegrenzt' : `${rohstoffText(c.vorrat.karten, ', ')}${c.vorrat.leerOhneErtrag ? ' – leerer Stapel = kein Ertrag' : ''}`}.</p>
  <h3>🚩 Fluchtkosten (pro Person mal Anzahl fliehender Personen)</h3>
  <table class="tabelle"><tr><th>Personen</th><th>🛶 Solides Floss</th><th>🛶 Not-Floss</th><th>🔥 Küstenfeuer-Kette</th><th>✈️ Flugzeugwrack</th></tr>${zeilen}</table>
  <h3>🛠️ Rezepte</h3><table class="tabelle"><tr><th>Rezept</th><th>Kosten</th><th></th></tr>${rezepte}</table>
  <h3>☀️ Tageskarten</h3><ul>${tage}</ul>
  <h3>❗ Spezialkarten</h3><ul>${spezial}</ul>
  <h3>Charaktere</h3><div class="zeile">${Object.entries(c.charaktere).filter(([, x]) => x.aktiv).map(([id, x]) => `<figure style="margin:0;width:200px"><img class="charakter-bild" src="${bild.charakter(id)}" alt="${esc(x.name)}"/></figure>`).join('')}</div>
  </div>`;
}
