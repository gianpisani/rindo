"""Genera src/data/emojis.ts desde los datos oficiales de Unicode + CLDR es.

Descarga las fuentes y reescribe el archivo. Correr desde la raíz del repo:

    python3 scripts/generate-emojis.py

Las fuentes se cachean en .cache/emoji/ para no volver a bajarlas.
"""
import json, subprocess, unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache" / "emoji"
OUT = ROOT / "src" / "data" / "emojis.ts"

CLDR = "https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json"
SOURCES = {
    "emoji-test.txt": "https://unicode.org/Public/emoji/latest/emoji-test.txt",
    "annotations-es.json": f"{CLDR}/cldr-annotations-full/annotations/es/annotations.json",
    "annotations-derived-es.json": (
        f"{CLDR}/cldr-annotations-derived-full/annotationsDerived/es/annotations.json"
    ),
}

CACHE.mkdir(parents=True, exist_ok=True)
for filename, url in SOURCES.items():
    if not (CACHE / filename).exists():
        print(f"descargando {filename}...")
        # curl y no urllib: en macOS el Python de python.org suele venir sin
        # los certificados raíz instalados y falla la verificación TLS.
        subprocess.run(["curl", "-sSfL", "-o", str(CACHE / filename), url], check=True)

# Los grupos oficiales de Unicode son los mismos que las pestañas del teclado de iOS.
META = {
    "Smileys & Emotion": ("smileys", "Caras y emociones", "😀"),
    "People & Body": ("people", "Personas y cuerpo", "🧑"),
    "Animals & Nature": ("animals", "Animales y naturaleza", "🐻"),
    "Food & Drink": ("food", "Comida y bebida", "🍔"),
    "Travel & Places": ("travel", "Viajes y lugares", "✈️"),
    "Activities": ("activities", "Actividades y deportes", "⚽"),
    "Objects": ("objects", "Objetos", "💡"),
    "Symbols": ("symbols", "Símbolos y señales", "❤️"),
    "Flags": ("flags", "Banderas", "🏁"),
}

groups, order, english = {}, [], {}
g = None
for line in open(CACHE / "emoji-test.txt", encoding="utf-8"):
    if line.startswith("# group:"):
        g = line.split(":", 1)[1].strip()
        if g not in groups:
            groups[g] = []
            order.append(g)
        continue
    if line.startswith("#") or not line.strip() or "fully-qualified" not in line:
        continue
    cps, rest = line.split(";", 1)
    codes = [int(c, 16) for c in cps.split()]
    if any(0x1F3FB <= c <= 0x1F3FF for c in codes):  # variantes de tono de piel
        continue
    comment = rest.split("#", 1)[1].strip()
    char, tail = comment.split(" ", 1)
    groups[g].append(char)
    english[char] = tail.split(" ", 1)[1]  # descarta la versión "E1.0"

ann = {}
for f in ("annotations-es.json", "annotations-derived-es.json"):
    d = json.load(open(CACHE / f, encoding="utf-8"))
    root = d.get("annotations") or d["annotationsDerived"]
    ann.update(root["annotations"])


def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFD", s.lower()) if not unicodedata.combining(c))


def search_text(char):
    """Nombre + sinónimos, en minúscula y sin tildes, deduplicado por palabra."""
    # CLDR indexa varios emoji sin el selector de variación U+FE0F.
    entry = ann.get(char) or ann.get(char.replace("️", "")) or {}
    parts = list(entry.get("tts", [])) + list(entry.get("default", []))
    if not parts:
        parts = [english.get(char, "")]
    seen, words = set(), []
    for part in parts:
        for w in strip_accents(part).replace("-", " ").split():
            if w not in seen:
                seen.add(w)
                words.append(w)
    return " ".join(words)


def esc(s):
    return s.replace("\\", "\\\\").replace('"', '\\"')


lines = [
    "// GENERADO desde los datos oficiales de Unicode (emoji-test.txt) y las",
    "// anotaciones en español de CLDR. Los grupos son los mismos que usa el",
    "// teclado de iOS. No editar a mano: regenerar si se quiere actualizar.",
    "",
    "export interface EmojiCategory {",
    "  id: string;",
    "  label: string;",
    "  icon: string;",
    "  emojis: string[];",
    "}",
    "",
    "export const EMOJI_CATEGORIES: EmojiCategory[] = [",
]

for g in order:
    if g not in META or not groups[g]:
        continue
    gid, label, icon = META[g]
    lines += [
        "  {",
        f'    id: "{gid}",',
        f'    label: "{label}",',
        f'    icon: "{icon}",',
        "    emojis: [",
    ]
    chars = groups[g]
    for i in range(0, len(chars), 8):
        row = ", ".join(f'"{esc(c)}"' for c in chars[i : i + 8])
        lines.append(f"      {row},")
    lines += ["    ],", "  },"]

lines += [
    "];",
    "",
    "/** Texto buscable por emoji: nombre y sinónimos en español, sin tildes. */",
    "export const EMOJI_SEARCH_TEXT: Record<string, string> = {",
]
for g in order:
    for c in groups.get(g, []):
        if g in META:
            lines.append(f'  "{esc(c)}": "{esc(search_text(c))}",')
lines += ["};", ""]

OUT.write_text("\n".join(lines), encoding="utf-8")
print("emojis:", sum(len(groups[g]) for g in order if g in META))
