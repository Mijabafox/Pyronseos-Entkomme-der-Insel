// Gemeinsame Tisch-Mechanik für Regel-Modus und Freien Tisch (wie V10): Welt mit Zoom und Verschieben,
// Zoomleiste unten links, Minimap, Vollbild. Die Seite selbst scrollt nie.
import { $, $$ } from './dom.js';

export const ZOOM = { min: 0.12, max: 2.5 };

export class TischAnsicht {
  constructor(welt) {
    this.welt = welt; // { x, y, w, h }: alles, was auf dem Tisch liegt
    this.kamera = null; // { x, y, z }: Bildschirm = Welt · z + (x, y)
  }

  geruestHtml({ seitenleiste = false, log = false } = {}) {
    return `
      <div id="tisch" class="tisch"><div class="welt"><div class="welt-inhalt"></div></div></div>
      <div class="unten-links">
        <div class="zoomleiste" aria-label="Zoom">
          <button type="button" data-zoom="raus" title="Herauszoomen">−</button>
          <button type="button" data-zoom="wert" title="Ansicht zentrieren">100 %</button>
          <button type="button" data-zoom="rein" title="Hineinzoomen">+</button>
          <button type="button" data-zoom="voll" title="Vollbild">⛶</button>
        </div>
        <div id="minimap" class="minimap" title="Übersicht – klicken, um dorthin zu springen"></div>
      </div>
      ${seitenleiste ? '<aside id="seitenleiste" class="seitenleiste" aria-label="Floss-Tableau und Gruppe"></aside>' : ''}
      ${log ? '<section id="logBox" class="log-box" aria-label="Spielprotokoll"></section>' : ''}`;
  }

  // Bildschirmpunkt → Weltkoordinaten.
  weltPunkt(clientX, clientY) {
    const r = $('#tisch', this.el).getBoundingClientRect(), k = this.kamera;
    return { x: (clientX - r.left - k.x) / k.z, y: (clientY - r.top - k.y) / k.z };
  }

  // Unterklassen können mit zugBeginnen(e) ein eigenes Ziehen übernehmen ({ bewegen(e), ende(e) }); sonst wird der Tisch verschoben.
  tischBedienung() {
    const tisch = $('#tisch', this.el);
    tisch.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = tisch.getBoundingClientRect();
      this.zoomen(e.deltaY > 0 ? 1 / 1.12 : 1.12, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    let zug = null;
    tisch.addEventListener('pointerdown', (e) => {
      if (!this.kamera || (e.button !== 0 && e.pointerType === 'mouse')) return;
      const eigen = this.zugBeginnen?.(e);
      if (eigen) { zug = { eigen, x: e.clientX, y: e.clientY, id: e.pointerId, bewegt: false }; this.gezogen = false; return; }
      if (e.target.closest('button, input, select, textarea, a, summary, label, .panel-inhalt, [data-tageskarte], [data-gross], [contenteditable]')) return;
      zug = { x: e.clientX, y: e.clientY, kx: this.kamera.x, ky: this.kamera.y, id: e.pointerId, bewegt: false };
      this.gezogen = false;
    });
    tisch.addEventListener('pointermove', (e) => {
      if (!zug || e.pointerId !== zug.id) return;
      const dx = e.clientX - zug.x, dy = e.clientY - zug.y;
      if (!zug.bewegt && Math.hypot(dx, dy) < 5) return;
      if (!zug.bewegt) { zug.bewegt = true; tisch.setPointerCapture(e.pointerId); tisch.classList.add('zieht'); }
      if (zug.eigen) { zug.eigen.bewegen(e, dx / this.kamera.z, dy / this.kamera.z); return; }
      this.kamera.x = zug.kx + dx; this.kamera.y = zug.ky + dy; this.kameraSetzen();
    });
    const ende = (e) => {
      if (!zug || e.pointerId !== zug.id) return;
      const z = zug;
      zug = null;
      tisch.classList.remove('zieht');
      this.gezogen = z.bewegt;
      if (z.eigen) z.eigen.ende(e, z.bewegt);
      setTimeout(() => { this.gezogen = false; }, 0);
    };
    tisch.addEventListener('pointerup', ende);
    tisch.addEventListener('pointercancel', ende);
    for (const b of $$('[data-zoom]', this.el)) b.addEventListener('click', () => {
      const z = b.dataset.zoom, r = tisch.getBoundingClientRect();
      if (z === 'rein') this.zoomen(1.25, r.width / 2, r.height / 2);
      else if (z === 'raus') this.zoomen(0.8, r.width / 2, r.height / 2);
      else if (z === 'wert') this.zentrieren();
      else if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.().catch(() => {});
    });
    const mini = $('#minimap', this.el);
    mini.addEventListener('click', (e) => {
      const r = mini.getBoundingClientRect(), W = this.welt;
      // Die Minimap zeigt die Welt mit «meet»: Seitenverhältnis berücksichtigen.
      const s = Math.min(r.width / W.w, r.height / W.h);
      const ox = (r.width - W.w * s) / 2, oy = (r.height - W.h * s) / 2;
      const wx = W.x + (e.clientX - r.left - ox) / s, wy = W.y + (e.clientY - r.top - oy) / s;
      const f = this.flaeche();
      this.kamera.x = f.w / 2 - wx * this.kamera.z; this.kamera.y = f.h / 2 - wy * this.kamera.z;
      this.kameraSetzen();
    });
    if (!this.groesseBeobachter) this.groesseBeobachter = new ResizeObserver(() => this.minimapSicht());
    this.groesseBeobachter.disconnect();
    this.groesseBeobachter.observe(tisch);
  }

  // Sichtbare Fläche des Tisches (ohne Seitenleiste).
  flaeche() {
    const t = $('#tisch', this.el);
    const leiste = this.leisteZu ? 44 : $('#seitenleiste', this.el)?.offsetWidth ?? 0;
    return { w: Math.max(200, (t?.clientWidth ?? 800) - leiste), h: Math.max(200, t?.clientHeight ?? 600) };
  }

  zentrieren() {
    const f = this.flaeche(), W = this.welt;
    const z = Math.max(ZOOM.min, Math.min(ZOOM.max, Math.min((f.w - 30) / W.w, (f.h - 30) / W.h)));
    this.kamera = { z, x: f.w / 2 - (W.x + W.w / 2) * z, y: f.h / 2 - (W.y + W.h / 2) * z };
    this.kameraSetzen();
  }

  zoomen(faktor, mx, my) {
    const k = this.kamera;
    if (!k) return;
    const z = Math.max(ZOOM.min, Math.min(ZOOM.max, k.z * faktor));
    k.x = mx - (mx - k.x) * (z / k.z); k.y = my - (my - k.y) * (z / k.z); k.z = z;
    this.kameraSetzen();
  }

  // Kamera auf einen Weltpunkt setzen (z. B. Panel oder Figur zeigen).
  zeigeWelt(x, y, zMin = 0.6) {
    const f = this.flaeche();
    if (!this.kamera) this.zentrieren();
    if (this.kamera.z < zMin) this.kamera.z = zMin;
    this.kamera.x = f.w / 2 - x * this.kamera.z; this.kamera.y = f.h / 2 - y * this.kamera.z;
    this.kameraSetzen();
  }

  kameraSetzen() {
    if (!this.kamera || !this.el) return;
    const welt = $('.welt', this.el);
    if (!welt) return;
    const k = this.kamera;
    welt.style.transform = `translate(${k.x.toFixed(1)}px, ${k.y.toFixed(1)}px) scale(${k.z.toFixed(4)})`;
    const w = $('[data-zoom="wert"]', this.el);
    if (w) w.textContent = `${Math.round(k.z * 100)} %`;
    this.minimapSicht();
  }

  minimapSicht() {
    const r = $('#minimap .sicht', this.el);
    if (!r || !this.kamera) return;
    const k = this.kamera, f = this.flaeche();
    r.setAttribute('x', (-k.x / k.z).toFixed(0)); r.setAttribute('y', (-k.y / k.z).toFixed(0));
    r.setAttribute('width', (f.w / k.z).toFixed(0)); r.setAttribute('height', (f.h / k.z).toFixed(0));
  }
}
