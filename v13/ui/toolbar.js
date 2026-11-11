// Toolbar oben wie in V10: Modus-Pille, Reiter, Tag mit Wetter und Seed, KI-Tempo, Knöpfe, Schalter rechts.
import { $, esc } from './dom.js';
import { app } from './zustand.js';
import { tagesKarteDef } from '../engine/effekte.js';
import { MODUS_KURZ } from '../engine/namen.js';

const TEMPO = [['schnell', 'schnell'], ['normal', 'normal'], ['langsam', 'langsam'], ['auto', 'sehr langsam – Auto (jeder Schritt)'], ['weiter', 'sehr langsam – Weiter-Knopf']];

// teil = 'spiel': nur Modus, Tag und Knöpfe (bei jedem Spielschritt, ohne offene Auswahllisten zu stören).
export function toolbarZeichnen(teil = 'alle') {
  const p = app.partie, s = p?.sl.s;
  const imSpiel = app.aktuellerReiter?.() === 'spiel';
  // Freier Tisch: eigene Werkzeugleiste wie V10 (Modus-Badge «Frei»).
  $('#tbModus').classList.toggle('frei', !!app.frei);
  $('#toolbar').classList.toggle('frei-modus', !!app.frei && imSpiel);
  if (app.frei) {
    $('#tbModus').textContent = 'Frei';
    $('#tbModus').title = 'Freier Tisch: keine Regelprüfung, nur Menschen';
    if (imSpiel) { app.frei.toolbar(teil); return; }
    // In den anderen Reitern: Werkzeuge des Tisches ausblenden (sie wirken nur auf dem Tisch).
    $('#tbTag').hidden = true; $('#tbTempo').innerHTML = ''; $('#tbKnoepfe').innerHTML = '';
    $('#tbRechts').innerHTML = '<button type="button" class="haupt" id="tbNeu" title="Neue Partie">＋<span class="tb-text"> Neue Partie</span></button>';
    $('#tbNeu').addEventListener('click', () => app.neuePartieDialog());
    return;
  }
  $('#tbModus').textContent = MODUS_KURZ[s?.modus ?? app.cfg.match.modus] ?? '';
  $('#tbModus').title = s ? 'Modus der laufenden Partie' : 'Modus der nächsten Partie (im Startdialog änderbar)';

  const tag = $('#tbTag');
  tag.hidden = !s;
  if (s) {
    const d = tagesKarteDef(s);
    tag.innerHTML = `<span class="tag-anzeige" title="Seed ${s.seed}">Tag <b>${s.tag}</b>/${s.tag + s.tagesStapel.length}</span>
      <button type="button" class="wetter" id="tbWetter" title="${esc(d?.text ?? 'Tageskarte')} – Klick: gross zeigen">${esc(d?.symbol ?? '')}<span class="wetter-text"> ${esc(d?.name ?? '')}</span></button>
      <span class="tb-seed" title="Seed: dieselbe Zahl ergibt dieselbe Insel und dieselbe Partie">🌱<span class="tb-text"> Seed</span> <b>${s.seed}</b></span>`;
    $('#tbWetter').addEventListener('click', () => p.tagKarteZeigen());
  }

  const kn = $('#tbKnoepfe');
  kn.innerHTML = s ? `${p.warteAufWeiter ? '<button type="button" class="haupt" id="tbWeiter" title="Nächster KI-Schritt (Enter oder Leertaste)">Weiter ▶</button>' : ''}
    <button type="button" id="tbExport" title="Spielprotokoll speichern (für Replay und Abgleich mit der Simulation)"><span class="tb-symbol">⬇</span><span class="tb-text">Protokoll</span></button>` : '';
  $('#tbWeiter')?.addEventListener('click', () => p.botSchritt());
  $('#tbExport')?.addEventListener('click', () => p.exportieren());
  if (teil === 'spiel') return;

  const t = app.tempo;
  $('#tbTempo').innerHTML = `<label title="KI-Tempo: «sehr langsam» zeigt jeden KI-Schritt einzeln">🤖 <select id="tbTempoWahl" aria-label="KI-Tempo">${TEMPO.map(([k, n]) => `<option value="${k}" ${t.art === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <label ${t.art === 'auto' ? '' : 'hidden'} title="Pause pro KI-Schritt">⏱ <select id="tbPause" aria-label="Pause in Sekunden">${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${t.pause === n ? 'selected' : ''}>${n} s</option>`).join('')}</select></label>`;
  $('#tbTempoWahl').addEventListener('change', (e) => { t.art = e.target.value; app.tempoSpeichern(); toolbarZeichnen(); app.partie?.tempoGeaendert(); });
  $('#tbPause').addEventListener('change', (e) => { t.pause = Number(e.target.value); app.tempoSpeichern(); });

  const a = app.anzeige;
  $('#tbRechts').innerHTML = `<label class="schalter" title="Letzte Bewegungen der KI als Linie auf dem Brett"><input type="checkbox" id="tbSpur" ${a.spur ? 'checked' : ''}/><span>👣<span class="tb-text"> KI-Spur</span></span></label>
    <label class="schalter" title="Neue Tages- und Spezialkarten gross in der Tischmitte zeigen"><input type="checkbox" id="tbBuehne" ${a.buehne ? 'checked' : ''}/><span>🃏<span class="tb-text"> Karten gross</span></span></label>
    <button type="button" id="tbZentrieren" title="Ansicht zentrieren" ${s && imSpiel ? '' : 'disabled'}>⌖</button>
    <button type="button" class="haupt" id="tbNeu" title="Neue Partie">＋<span class="tb-text"> Neue Partie</span></button>`;
  $('#tbSpur').addEventListener('change', (e) => { a.spur = e.target.checked; app.anzeigeSpeichern(); app.partie?.render(); });
  $('#tbBuehne').addEventListener('change', (e) => { a.buehne = e.target.checked; app.anzeigeSpeichern(); });
  $('#tbZentrieren').addEventListener('click', () => app.partie?.zentrieren());
  $('#tbNeu').addEventListener('click', () => app.neuePartieDialog());
}
app.toolbar = toolbarZeichnen;
