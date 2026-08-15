// ── Marcador para traer la transcripción desde YouTube ──────
//
// Por qué existe: el endpoint de subtítulos de YouTube (timedtext) responde
// 200 con cuerpo vacío a cualquier petición sin un token de BotGuard generado
// por su propio reproductor. Comprobado desde el mismo origen de youtube.com,
// con sesión iniciada y cookies: 0 bytes. También se probaron instancias de
// Invidious (listan las pistas, no bajan el texto) y r.jina.ai (devuelve solo
// los capítulos). No hay vía automática gratuita.
//
// Pero el panel "Mostrar transcripción" sí la renderiza en el DOM — por eso
// una persona la ve. Este marcador hace lo mismo que haría esa persona: abre
// el panel, espera a que cargue, lo lee y lo deja en el portapapeles con el
// formato que Rindo ya sabe leer.
//
// CUIDADO al editar SOURCE: se colapsa a una sola línea para meterlo en la
// URL, así que NO puede contener comentarios `//` (comentarían el resto del
// programa) ni saltos de línea significativos. El test de abajo lo verifica.

const SOURCE = `
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const PANEL = 'ytd-engagement-panel-section-list-renderer';
  const TARGET = 'engagement-panel-searchable-transcript';
  const STAMP = /^\\d{1,2}:\\d{2}(:\\d{2})?$/;

  const toast = (msg, bad) => {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = 'position:fixed;z-index:2147483647;left:50%;top:24px;transform:translateX(-50%);padding:14px 22px;border-radius:12px;font:600 15px system-ui,sans-serif;color:#fff;box-shadow:0 8px 28px rgba(0,0,0,.4);background:' + (bad ? '#e11d48' : '#10b981');
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 5000);
  };

  const panelOf = () => [...document.querySelectorAll(PANEL)].find((p) => (p.getAttribute('target-id') || '') === TARGET);

  try {
    if (!location.href.includes('/watch')) {
      toast('Abre un video de YouTube primero', true);
      return;
    }

    toast('Buscando los subtitulos...');

    let panel = panelOf();
    if (!panel || panel.getAttribute('visibility') !== 'ENGAGEMENT_PANEL_VISIBILITY_EXPANDED') {
      const expand = document.querySelector('#expand');
      if (expand) expand.click();
      await sleep(700);
      const btn = [...document.querySelectorAll('button')].find((b) => /transcript|transcripci/i.test((b.getAttribute('aria-label') || '') + ' ' + (b.textContent || '')));
      if (!btn) {
        toast('Este video no tiene transcripcion disponible', true);
        return;
      }
      btn.click();
      await sleep(1000);
      panel = panelOf();
    }

    if (!panel) {
      toast('No pude abrir el panel de transcripcion', true);
      return;
    }

    const tab = [...panel.querySelectorAll('[role="tab"], tp-yt-paper-tab, yt-tab-shape, button')].filter((el) => /transcripci|transcript/i.test(el.textContent || '')).pop();
    if (tab) {
      tab.click();
      await sleep(600);
    }

    let segs = [];
    for (let i = 0; i < 40; i++) {
      segs = [...panel.querySelectorAll('ytd-transcript-segment-renderer')];
      if (segs.length) break;
      await sleep(500);
    }

    if (!segs.length) {
      toast('La transcripcion no alcanzo a cargar, reintenta', true);
      return;
    }

    const rows = [];
    for (const s of segs) {
      const parts = (s.textContent || '').split('\\n').map((x) => x.trim()).filter(Boolean);
      if (parts.length < 2 || !STAMP.test(parts[0])) continue;
      rows.push(parts[0] + '\\n' + parts.slice(1).join(' '));
    }

    if (!rows.length) {
      toast('No pude leer las lineas, reintenta', true);
      return;
    }

    await navigator.clipboard.writeText(rows.join('\\n'));
    toast('Listo: ' + rows.length + ' lineas copiadas. Vuelve a Rindo y pega.');
  } catch (e) {
    toast('Error: ' + (e && e.message ? e.message : e), true);
  }
})();
`;

/** Una sola línea, sin comentarios, lista para ir en la URL. */
function minify(source: string): string {
  const flat = source
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");

  if (flat.includes("//")) {
    throw new Error(
      "El bookmarklet no puede contener comentarios `//`: al ir en una sola " +
        "línea comentarían el resto del programa."
    );
  }

  return flat;
}

/** El marcador listo para arrastrar a la barra de favoritos. */
export const TRANSCRIPT_BOOKMARKLET = `javascript:${encodeURIComponent(
  minify(SOURCE)
)}`;
