// ── Metadatos de un video sin API key ───────────────────────
//
// El reproductor embebido ya entrega título y canal, pero eso exige montarlo.
// Para la lista de "ver después" hace falta saberlos antes de reproducir nada,
// así que se piden por oEmbed: YouTube responde con CORS abierto para el
// dominio que pregunta, y noembed queda de respaldo. Ninguno pide API key.

export interface VideoOEmbed {
  title: string | null;
  author: string | null;
}

const TIMEOUT_MS = 6000;

async function getJson(url: string): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function pick(data: Record<string, unknown> | null): VideoOEmbed | null {
  if (!data) return null;
  const title = typeof data.title === "string" ? data.title : null;
  const author = typeof data.author_name === "string" ? data.author_name : null;
  return title ? { title, author } : null;
}

/** Título y canal de un video de YouTube. Devuelve null si ninguno responde. */
export async function fetchVideoOEmbed(videoId: string): Promise<VideoOEmbed | null> {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

  const primary = pick(
    await getJson(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`
    )
  );
  if (primary) return primary;

  return pick(await getJson(`https://noembed.com/embed?url=${encodeURIComponent(watchUrl)}`));
}
