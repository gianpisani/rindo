/**
 * Los invariantes de `groupCues`, sobre entradas generadas.
 *
 * Un algoritmo que ordena subtítulos no se revisa mirando: se revisa fijando lo
 * que tiene que ser cierto para CUALQUIER transcripción y después generando
 * transcripciones hasta cansarse. El generador es determinista —semilla fija—
 * así que una falla se reproduce exactamente, hoy y en un año.
 *
 * El espacio que barre es el que existe de verdad: desde el subtítulo
 * automático sin un solo punto hasta el profesional con puntuación completa,
 * pasando por líneas de una palabra, párrafos de cuarenta, silencios largos,
 * timestamps repetidos y una sola línea más larga que el máximo.
 *
 *   npm run check:blocks
 */
import { groupCues, splitWords, wordTimes, type Cue } from "../src/lib/transcript";

/** Palabra es lo que la app llama palabra, no lo que hay entre espacios. */
const countWords = (text: string) =>
  splitWords(text).filter((part) => part.isWord).length;

/** PRNG con semilla: mismo run, mismos casos, siempre. */
function makeRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const WORDS = "the quick brown fox jumps over a lazy dog while running through fields".split(" ");

interface Shape {
  name: string;
  /** Probabilidad de que una línea termine en punto. */
  punctuation: number;
  minWords: number;
  maxWords: number;
  /** Probabilidad de un silencio largo entre líneas. */
  gaps: number;
}

const SHAPES: Shape[] = [
  { name: "auto sin puntuación", punctuation: 0, minWords: 10, maxWords: 35, gaps: 0.02 },
  { name: "auto fragmentado", punctuation: 0.2, minWords: 1, maxWords: 11, gaps: 0.05 },
  { name: "manual con puntos", punctuation: 0.85, minWords: 3, maxWords: 25, gaps: 0.1 },
  { name: "una palabra por línea", punctuation: 0.3, minWords: 1, maxWords: 2, gaps: 0.01 },
  { name: "párrafos enormes", punctuation: 0.5, minWords: 30, maxWords: 60, gaps: 0.2 },
  { name: "con silencios largos", punctuation: 0.4, minWords: 4, maxWords: 15, gaps: 0.4 },
];

function generate(shape: Shape, random: () => number, count: number): Cue[] {
  const cues: Cue[] = [];
  let t = 0;

  for (let i = 0; i < count; i++) {
    const words = shape.minWords + Math.floor(random() * (shape.maxWords - shape.minWords + 1));
    const text =
      Array.from({ length: words }, () => WORDS[Math.floor(random() * WORDS.length)]).join(" ") +
      (random() < shape.punctuation ? "." : random() < 0.15 ? "," : "");

    cues.push({ t, text });
    t += Math.max(1, Math.round(words * 0.4)) + (random() < shape.gaps ? 5 + Math.floor(random() * 20) : 0);
  }

  return cues;
}

const failures: string[] = [];
function check(condition: boolean, message: string) {
  if (!condition) failures.push(message);
}

function verify(label: string, cues: Cue[]) {
  const blocks = groupCues(cues);

  // 1. Solo junta: ni pierde, ni inventa, ni reescribe.
  check(
    blocks.map((b) => b.text).join(" ") === cues.map((c) => c.text).join(" "),
    `${label}: el texto cambió`
  );

  // 2. Cada trozo original sobrevive con su segundo, y en orden.
  const segments = blocks.flatMap((b) => b.segments);
  check(segments.length === cues.length, `${label}: se perdieron trozos`);
  check(
    segments.every((s, i) => s.t === cues[i].t && s.text === cues[i].text),
    `${label}: un trozo cambió de tiempo o de texto`
  );

  // 3. El tiempo del bloque es el de su primer trozo, y nunca retrocede.
  check(
    blocks.every((b, i) => b.t === b.segments[0].t && (i === 0 || b.t >= blocks[i - 1].t)),
    `${label}: el tiempo de los bloques no es monótono`
  );

  // 4. Determinista: mismo dentro, mismo fuera.
  check(
    JSON.stringify(groupCues(cues)) === JSON.stringify(blocks),
    `${label}: no es determinista`
  );

  // 5. No cose a través de un silencio absurdo. El umbral real se calcula con
  // el ritmo de cada transcripción; acá se comprueba una cota independiente y
  // grosera, justamente para no reimplementar en el test lo que el test juzga.
  for (const block of blocks) {
    for (let i = 1; i < block.segments.length; i++) {
      const span = block.segments[i].t - block.segments[i - 1].t;
      check(span < 30, `${label}: juntó a través de ${span}s de silencio`);
    }
  }

  // 6. Un bloque no se pasa del máximo salvo que un solo cue ya se pasara.
  check(
    blocks.every((b) => b.text.length <= 190 || b.segments.length === 1),
    `${label}: un bloque juntado se pasó del máximo`
  );

  // 7. Los tiempos por palabra suben y caen dentro del bloque.
  blocks.forEach((block, i) => {
    const end = blocks[i + 1]?.t ?? block.t + 30;
    const times = wordTimes(block, end);
    const words = countWords(block.text);
    check(times.length === words, `${label}: faltan tiempos de palabra`);
    check(
      times.every((time, j) => time >= block.t && (j === 0 || time >= times[j - 1])),
      `${label}: los tiempos por palabra no avanzan`
    );
  });
}

// ── Los bordes, a mano ────────────────────────────────────

verify("vacío", []);
verify("una sola línea", [{ t: 0, text: "hola." }]);
verify("una línea gigante", [{ t: 0, text: "palabra ".repeat(80).trim() }]);
verify("tiempos repetidos", [
  { t: 5, text: "una" },
  { t: 5, text: "dos" },
  { t: 5, text: "tres." },
]);
// El japonés no se parte en palabras: `splitWords` reconoce letras y dígitos, y
// esa es una limitación vieja de toda la pantalla —no se puede tocar una palabra
// de un subtítulo japonés hoy tampoco—. Lo que acá se comprueba es que agrupar
// no explote con esa entrada, no que la resuelva.
verify("sin espacios ni puntos", [{ t: 0, text: "日本語のテキスト" }, { t: 3, text: "もっと" }]);

// ── El espacio, generado ──────────────────────────────────

const random = makeRandom(20260827);
let cases = 0;
for (const shape of SHAPES) {
  for (let run = 0; run < 100; run++) {
    const count = 1 + Math.floor(random() * 400);
    verify(`${shape.name} #${run}`, generate(shape, random, count));
    cases++;
  }
}

if (failures.length) {
  console.error(`✘ ${failures.length} fallas:\n` + [...new Set(failures)].slice(0, 20).join("\n"));
  process.exit(1);
}

console.log(`✓ ${cases + 5} transcripciones, 7 invariantes cada una, todo en pie`);
