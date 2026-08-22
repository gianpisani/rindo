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
// ── Los dos paneles ─────────────────────────────────────────
//
// YouTube está migrando el panel de transcripción y hoy conviven dos, elegidos
// por video (no por cuenta ni por navegador), así que uno se topa con los dos
// el mismo día:
//
//   · el viejo, Polymer: panel `engagement-panel-searchable-transcript` con
//     líneas `ytd-transcript-segment-renderer`.
//   · el nuevo, Lit: panel `PAmodern_transcript_view` con líneas
//     `transcript-segment-view-model` y clases `ytw…`.
//
// Eso explica el "funciona en algunos videos y en otros no": el marcador solo
// conocía las líneas viejas. Y no bastaba con sumar el selector nuevo, porque
// el panel nuevo trae dos trampas más:
//
//   1. No hay saltos de línea. El viejo dejaba "0:44\ntexto" en textContent;
//      el nuevo lo pega todo, y además intercala una etiqueta invisible para
//      lectores de pantalla ("44 segundos"), así que leer por líneas daba
//      "0:4444 segundostexto" y no matcheaba ninguna marca de tiempo.
//   2. YouTube deja paneles duplicados y ocultos en el DOM con el mismo texto
//      dentro. Leerlos todos duplicaba la transcripción entera.
//
// Por eso las líneas se leen por estructura (marca de tiempo + lo visible)
// y solo desde el panel que está realmente en pantalla.
//
// CUIDADO al editar SOURCE: se colapsa a una sola línea para meterlo en la
// URL, así que NO puede contener comentarios `//` (comentarían el resto del
// programa) ni saltos de línea significativos. Para comentar algo ahí dentro
// se usan bloques `/* … */`, que sobreviven al colapso. minify() lo verifica.

const SOURCE = `
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const SEGMENTS = 'ytd-transcript-segment-renderer, transcript-segment-view-model';
  const PANEL = 'ytd-engagement-panel-section-list-renderer';
  const STAMP = /^\\d{1,2}:\\d{2}(:\\d{2})?$/;
  const OPEN = /mostrar transcripci|ver transcripci|show transcript/i;
  const SHUT = /cerrar|ocultar|close|hide/i;
  const TAB = /transcripci|transcript/i;

  const toast = (msg, bad) => {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = 'position:fixed;z-index:2147483647;left:50%;top:24px;transform:translateX(-50%);padding:14px 22px;border-radius:12px;font:600 15px system-ui,sans-serif;color:#fff;box-shadow:0 8px 28px rgba(0,0,0,.4);background:' + (bad ? '#e11d48' : '#10b981');
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 5000);
  };

  const label = (el) => ((el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '')).replace(/\\s+/g, ' ').trim();

  /* Solo las líneas del panel que está en pantalla: YouTube deja paneles
     duplicados y ocultos con el mismo texto, y leerlos todos la duplica. */
  const segments = () => [...document.querySelectorAll(SEGMENTS)].filter((s) => s.offsetParent !== null);

  /* En el panel nuevo lo clickeable suele ser un botón adentro del chip. */
  const press = (el) => {
    const target = el.querySelector('button, a, [role="button"], [role="tab"]') || el;
    target.click();
  };

  /* La lista se pide recién cuando entra en viewport, así que si quedó un
     continuation pendiente hay que asomarlo para que YouTube la traiga. */
  const waitForSegments = async (tries) => {
    for (let i = 0; i < tries; i++) {
      if (segments().length) return true;
      const more = document.querySelector('ytd-continuation-item-renderer');
      if (more) more.scrollIntoView({ block: 'center' });
      await sleep(500);
    }
    return segments().length > 0;
  };

  /* Lee una línea sin depender de las clases de YouTube: la marca de tiempo es
     el primer descendiente cuyo texto es exactamente una marca, y el texto es
     todo lo demás menos lo que está solo para lectores de pantalla. */
  const read = (el) => {
    const all = [...el.querySelectorAll('*')];
    const stampEl = all.find((c) => STAMP.test((c.textContent || '').trim()));
    if (!stampEl) return null;

    const laidOut = el.offsetWidth > 0 || el.offsetHeight > 0;
    const skip = [stampEl];
    for (const c of all) {
      if (c === stampEl || !(c.textContent || '').trim()) continue;
      const cls = typeof c.className === 'string' ? c.className : '';
      const invisible = laidOut && c.offsetWidth <= 1 && c.offsetHeight <= 1;
      if (invisible || /a11y|screenreader|visuallyhidden/i.test(cls)) skip.push(c);
    }

    skip.forEach((n) => n.setAttribute('data-rindo-skip', ''));
    const copy = el.cloneNode(true);
    skip.forEach((n) => n.removeAttribute('data-rindo-skip'));
    copy.querySelectorAll('[data-rindo-skip]').forEach((n) => n.remove());

    const text = (copy.textContent || '').replace(/\\s+/g, ' ').trim();
    if (!text) return null;
    return (stampEl.textContent || '').trim() + '\\n' + text;
  };

  try {
    if (!location.href.includes('/watch')) {
      toast('Abre un video de YouTube primero', true);
      return;
    }

    toast('Buscando los subtitulos...');

    if (!segments().length) {
      const expand = document.querySelector('#expand');
      if (expand) expand.click();
      await sleep(700);
      const btn = [...document.querySelectorAll('button')].filter((b) => OPEN.test(label(b)) && !SHUT.test(label(b)))[0];
      if (!btn) {
        toast('Este video no tiene transcripcion disponible', true);
        return;
      }
      press(btn);
      await sleep(1000);
    }

    /* Algunos videos abren el panel en la pestaña "Capítulos": hay que pasar
       a la de transcripción, que según el video es un chip o una tab. */
    if (!(await waitForSegments(20))) {
      const open = [...document.querySelectorAll(PANEL)].filter((p) => (p.getAttribute('visibility') || '').includes('EXPANDED'));
      for (const panel of open) {
        const tab = [...panel.querySelectorAll('chip-view-model, chip-shape, [role="tab"], tp-yt-paper-tab, yt-tab-shape')].filter((el) => TAB.test(el.textContent || '')).pop();
        if (!tab) continue;
        press(tab);
        if (await waitForSegments(20)) break;
      }
    }

    const segs = segments();
    if (!segs.length) {
      toast('La transcripcion no alcanzo a cargar, reintenta', true);
      return;
    }

    const rows = [];
    const seen = new Set();
    for (const s of segs) {
      const row = read(s);
      if (row && !seen.has(row)) {
        seen.add(row);
        rows.push(row);
      }
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

/** Una sola línea, sin comentarios de línea, lista para ir en la URL. */
function minify(source: string): string {
  const flat = source
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");

  if (flat.includes("//")) {
    throw new Error(
      "El bookmarklet no puede contener comentarios `//`: al ir en una sola " +
        "línea comentarían el resto del programa. Usa bloques `/* … */`."
    );
  }

  return flat;
}

/** El marcador listo para arrastrar a la barra de favoritos. */
export const TRANSCRIPT_BOOKMARKLET = `javascript:${encodeURIComponent(
  minify(SOURCE)
)}`;
