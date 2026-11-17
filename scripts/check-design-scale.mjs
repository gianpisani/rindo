#!/usr/bin/env node
// Chequea que src/ use solo la escala de diseño cerrada (ver tailwind.config.ts y
// los tokens --fs-* / --radius-card / --shadow-float de src/index.css):
//   texto   text-xs · text-sm · text-xl · text-hero
//   grosor  font-normal · font-medium · font-semibold
//   radio   rounded-card · rounded-full · rounded-none (y direccionales: rounded-t-card…)
//   sombra  shadow-float · shadow-none
// Escape: un comentario `design-scale-ok: motivo` en la misma línea o en la anterior.
// Uso: node scripts/check-design-scale.mjs  (exit 1 si hay violaciones)
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC = join(ROOT, "src");
const ESCAPE = "design-scale-ok";

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );

// Clase base sin variantes (md:, hover:, dark:, data-[state=open]:, group-hover:…) ni `!`.
const baseOf = (token) => {
  let depth = 0, cut = 0;
  for (let i = 0; i < token.length; i++) {
    if (token[i] === "[") depth++;
    else if (token[i] === "]") depth--;
    else if (token[i] === ":" && depth === 0) cut = i + 1;
  }
  return token.slice(cut).replace(/^!/, "");
};

const DIR = "(?:-(?:[trblse]|tl|tr|bl|br|ss|se|es|ee))?";
const RULES = [
  [/^text-\[[\d.]+(?:px|rem|em)\]$/, "text-xs / text-sm / text-xl / text-hero"],
  [/^text-(?:base|lg|[2-9]xl)$/, "no existe en la escala: text-xs / text-sm / text-xl / text-hero"],
  [/^font-(?:thin|extralight|light|bold|extrabold|black)$/, "font-normal / font-medium (font-semibold solo para el hero)"],
  [new RegExp(`^rounded${DIR}-(?:sm|md|lg|xl|2xl|3xl|\\[(?!inherit\\]).*\\])$`), "rounded-card (superficies) / rounded-full (lo que se toca)"],
  [/^shadow-(?:sm|md|lg|xl|2xl|inner|\[.*\])$/, "shadow-float (solo lo que flota) / sin sombra"],
  [/^drop-shadow(?:-.*)?$/, "sin drop-shadow; resolver legibilidad con color/contraste"],
];
// `rounded` y `shadow` sueltos solo se marcan dentro de una lista de clases (2+ tokens),
// para no confundirlos con palabras o props.
const BARE = [
  [new RegExp(`^rounded${DIR}$`), "rounded-card / rounded-full"],
  [/^shadow$/, "shadow-float / sin sombra"],
];

function checkClassList(str, multi) {
  const out = [];
  for (const token of str.split(/[\s"'`{}(),;]+/)) {
    if (!token || !/^[!\w-[\]:.\/&=]+$/.test(token)) continue;
    const base = baseOf(token);
    for (const [re, hint] of multi ? [...RULES, ...BARE] : RULES) if (re.test(base)) out.push([token, hint]);
  }
  return out;
}

// Extrae literales de string ('', "", ``) de TS/TSX saltando comentarios. Devuelve
// [offset, contenido]. Los ${…} de un template quedan dentro del contenido: sus strings
// internos se revisan igual.
function stringsOf(src) {
  const res = [];
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "/") i = src.indexOf("\n", i) === -1 ? src.length : src.indexOf("\n", i);
    else if (c === "/" && src[i + 1] === "*") i = src.indexOf("*/", i + 2) + 1 || src.length;
    else if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < src.length && src[j] !== c && (c === "`" || src[j] !== "\n")) j += src[j] === "\\" ? 2 : 1;
      res.push([i + 1, src.slice(i + 1, j)]);
      i = j;
    }
  }
  return res;
}

function checkCssDecl(line) {
  const out = [];
  const fs = line.match(/font-size\s*:\s*([^;}]+)/);
  if (fs && /\d(?:px|rem)\b/.test(fs[1]) && !/var\(--fs-/.test(fs[1]))
    out.push([`font-size: ${fs[1].trim()}`, "var(--fs-1|2|3|hero), inherit o em relativo"]);
  const fw = line.match(/font-weight\s*:\s*([^;}]+)/);
  if (fw && /^(?:[1-3]00|[7-9]00|bold|bolder|lighter)\b/.test(fw[1].trim()))
    out.push([`font-weight: ${fw[1].trim()}`, "400 / 500 (600 solo para el hero)"]);
  const apply = line.match(/@apply\s+([^;]+)/);
  if (apply) out.push(...checkClassList(apply[1], true));
  return out;
}

const violations = [];
for (const file of walk(SRC)) {
  const isCss = file.endsWith(".css");
  if (!isCss && !/\.(?:ts|tsx)$/.test(file)) continue;
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  const escaped = (n) => lines[n].includes(ESCAPE) || (n > 0 && lines[n - 1].includes(ESCAPE));
  const report = (n, hits) => {
    if (!escaped(n)) for (const [token, hint] of hits) violations.push(`${relative(ROOT, file)}:${n + 1}  ${token}  → ${hint}`);
  };
  if (isCss) {
    lines.forEach((line, n) => report(n, checkCssDecl(line)));
    continue;
  }
  const lineStarts = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === "\n") lineStarts.push(i + 1);
  const lineAt = (off) => {
    let lo = 0, hi = lineStarts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; lineStarts[mid] <= off ? (lo = mid) : (hi = mid - 1); }
    return lo;
  };
  for (const [offset, str] of stringsOf(src)) {
    const multi = str.trim().split(/\s+/).length > 1;
    let pos = offset;
    for (const part of str.split("\n")) {
      report(lineAt(pos), checkClassList(part, multi));
      pos += part.length + 1;
    }
  }
}

if (violations.length) {
  console.error(violations.join("\n"));
  console.error(`\n${violations.length} fuera de la escala de diseño. Corregir o justificar con un comentario "${ESCAPE}: motivo".`);
  process.exit(1);
}
console.log("Escala de diseño: OK");
