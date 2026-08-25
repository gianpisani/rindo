import { useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { BaseModal } from "@/components/BaseModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  Search,
  Trash2,
  ExternalLink,
  Eye,
  Volume2,
  Loader2,
  AlertTriangle,
  X,
} from "lucide-react";
import {
  MASTERY_CONFIG,
  MASTERY_ORDER,
  formatClock,
  youTubeWatchUrl,
} from "@/lib/learning-config";
import {
  BANDS,
  bandOf,
  debtScore,
  formatRank,
  inferMastery,
  kindOf,
  median,
  rarestWord,
  INFERRED_MASTERY_CONFIG,
  ITEM_KIND_CONFIG,
  type Band,
  type ItemKind,
  type MasteryEvidence,
} from "@/lib/corpus";
import { useItemSightings, type LearningItem } from "@/hooks/useLearningItems";
import { useDictionary, usePronunciation } from "@/hooks/useDictionary";
import type { Corpus } from "@/hooks/useCorpus";
import { BandComposition, BandPill } from "./BandComposition";

interface LearningVocabularyProps {
  items: LearningItem[];
  corpus: Corpus;
  onUpdate: (updates: Partial<LearningItem> & { id: string }) => void;
  onDelete: (id: string) => void;
}

/** Cómo se puede ordenar el diccionario. */
const SORTS = [
  { key: "debt", label: "Deuda", hint: "las que más te van a costar" },
  { key: "az", label: "A–Z", hint: "como un diccionario" },
  { key: "recent", label: "Reciente", hint: "las últimas que capturaste" },
  { key: "rare", label: "Rareza", hint: "de la más rara a la más común" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

/** Una entrada del diccionario con todo lo que el corpus sabe de ella. */
interface Entry {
  item: LearningItem;
  /** Palabra, expresión o frase — deducido del texto, no de la etiqueta. */
  kind: ItemKind;
  initial: string;
  rank: number | null;
  band: Band;
  /** La más rara que la compone. Es lo único rankeable de una frase larga. */
  rarest: { word: string; rank: number } | null;
  occurrences: number;
  /** Veces que aparece en lo que tienes por ver. */
  upcoming: number;
  videos: number;
  evidence: MasteryEvidence;
  debt: number;
}

export function LearningVocabulary({
  items,
  corpus,
  onUpdate,
  onDelete,
}: LearningVocabularyProps) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<ItemKind | null>(null);
  const [letter, setLetter] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("debt");
  const [selected, setSelected] = useState<LearningItem | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const entries = useMemo<Entry[]>(
    () =>
      items.map((item) => {
        const rank = corpus.rankOf(item.expression);
        const occurrences = corpus.occurrences(item.expression);
        const upcoming = corpus.upcomingOccurrences(item.expression);
        return {
          item,
          kind: kindOf(item.expression),
          initial: (item.normalized[0] ?? "?").toUpperCase(),
          rank,
          band: bandOf(rank),
          rarest: rarestWord(item.expression, corpus.rank),
          occurrences,
          upcoming,
          videos: corpus.videosWith(item.expression).length,
          evidence: inferMastery(occurrences, item.times_seen),
          // La deuda mira lo que viene: una palabra que aparece siete veces en
          // tu cola te va a costar más que una que ya pasó.
          debt: debtScore(occurrences + upcoming, rank),
        };
      }),
    [items, corpus]
  );

  /** La mediana del puesto de lo que te frena: la métrica madre, en chico. */
  const bandMedian = useMemo(
    () => median(entries.map((e) => e.rank).filter((r): r is number => r !== null)),
    [entries]
  );

  /** Cuántas palabras tienes en cada banda, para la barra del encabezado. */
  const bandCounts = useMemo(() => {
    const counts = Object.fromEntries(BANDS.map((b) => [b.key, 0])) as Record<
      Band["key"],
      number
    >;
    for (const entry of entries) counts[entry.band.key] += 1;
    return counts;
  }, [entries]);

  const letters = useMemo(
    () => new Set(entries.filter((e) => e.kind !== "sentence").map((e) => e.initial)),
    [entries]
  );

  const kindCounts = useMemo(() => {
    const counts: Record<ItemKind, number> = { word: 0, phrase: 0, sentence: 0 };
    for (const entry of entries) counts[entry.kind] += 1;
    return counts;
  }, [entries]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    const matching = entries.filter((entry) => {
      if (kind && entry.kind !== kind) return false;
      if (letter && entry.initial !== letter) return false;
      if (!query) return true;
      const { item } = entry;
      return (
        item.normalized.includes(query) ||
        item.meaning?.toLowerCase().includes(query) ||
        item.meaning_es?.toLowerCase().includes(query) ||
        item.translation_es?.toLowerCase().includes(query)
      );
    });

    const sorted = [...matching];
    switch (sort) {
      case "debt":
        sorted.sort((a, b) => b.debt - a.debt);
        break;
      case "az":
        sorted.sort((a, b) => a.item.normalized.localeCompare(b.item.normalized));
        break;
      case "recent":
        sorted.sort((a, b) => b.item.created_at.localeCompare(a.item.created_at));
        break;
      case "rare":
        sorted.sort((a, b) => (b.rank ?? Infinity) - (a.rank ?? Infinity));
        break;
    }
    return sorted;
  }, [entries, search, kind, letter, sort]);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center">
        <p className="text-sm font-medium">Tu diccionario está vacío</p>
        <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto">
          Durante una sesión, presiona E cada vez que escuches algo que no
          conoces. Se guarda acá con su contexto, su puesto en el ranking del
          inglés y cuántas veces más te va a aparecer.
        </p>
      </div>
    );
  }

  const activeSort = SORTS.find((s) => s.key === sort)!;

  return (
    <div className="space-y-3">
      {/* ── Portada: el tamaño y la forma de tu diccionario ── */}
      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-3xl font-bold tabular-nums leading-none">
              {items.length}
              <span className="text-sm text-muted-foreground font-semibold">
                {" "}
                {items.length === 1 ? "palabra" : "palabras"}
              </span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              capturadas de {corpus.videoCount || "—"}{" "}
              {corpus.videoCount === 1 ? "video" : "videos"}
            </p>
          </div>

          {bandMedian !== null && (
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums leading-none text-primary">
                {formatRank(Math.round(bandMedian))}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                puesto mediano
              </p>
            </div>
          )}
        </div>

        {corpus.isReady && (
          <BandComposition bandTokens={bandCounts} legend className="mt-5" />
        )}
      </div>

      {/* ── Qué guardaste: palabra, expresión o frase ────── */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setKind(null)}
          className={cn(
            "px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all shrink-0",
            kind === null
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
          )}
        >
          Todas
          <span className="opacity-60 ml-1 tabular-nums">{items.length}</span>
        </button>
        {(["word", "phrase", "sentence"] as ItemKind[]).map((option) => {
          if (kindCounts[option] === 0) return null;
          return (
            <button
              key={option}
              onClick={() => setKind(kind === option ? null : option)}
              className={cn(
                "px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all shrink-0",
                kind === option
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
              )}
            >
              {ITEM_KIND_CONFIG[option].plural}
              <span className="opacity-60 ml-1 tabular-nums">
                {kindCounts[option]}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Buscador ─────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar en tu diccionario…"
          className="pl-9 pr-9 h-11 rounded-xl"
        />
        {search && (
          <button
            onClick={() => {
              setSearch("");
              searchRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Orden ────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {SORTS.map((option) => (
          <button
            key={option.key}
            onClick={() => setSort(option.key)}
            className={cn(
              "px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all shrink-0",
              sort === option.key
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        ))}
        <span className="text-[11px] text-muted-foreground pl-1 shrink-0">
          {activeSort.hint}
        </span>
      </div>

      {/* ── Índice alfabético (no aplica a las frases) ───── */}
      <div className={cn("flex flex-wrap gap-0.5", kind === "sentence" && "hidden")}>
        {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((char) => {
          const has = letters.has(char);
          const isActive = letter === char;
          return (
            <button
              key={char}
              disabled={!has}
              onClick={() => setLetter(isActive ? null : char)}
              className={cn(
                "h-6 w-6 rounded-md text-[11px] font-semibold transition-all",
                !has && "text-muted-foreground/25 cursor-default",
                has && !isActive && "text-muted-foreground hover:bg-muted",
                isActive && "bg-primary text-primary-foreground"
              )}
            >
              {char}
            </button>
          );
        })}
      </div>

      {/* ── Las entradas ─────────────────────────────────── */}
      <div className="space-y-1.5">
        {filtered.map((entry) => (
          <EntryRow
            key={entry.item.id}
            entry={entry}
            showBand={corpus.isReady}
            onOpen={() => setSelected(entry.item)}
          />
        ))}

        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nada calza con eso.
          </p>
        )}
      </div>

      {selected && (
        <EntryDetail
          item={selected}
          corpus={corpus}
          open={!!selected}
          onOpenChange={(open) => !open && setSelected(null)}
          onUpdate={onUpdate}
          onDelete={(id) => {
            onDelete(id);
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}

// ── Una fila ────────────────────────────────────────────────

function EntryRow({
  entry,
  showBand,
  onOpen,
}: {
  entry: Entry;
  showBand: boolean;
  onOpen: () => void;
}) {
  const { item, kind, band, rank, rarest, occurrences, upcoming, videos, evidence } =
    entry;
  const inferred = INFERRED_MASTERY_CONFIG[evidence.level];
  const gloss = item.translation_es ?? item.meaning_es ?? item.meaning;
  const isSentence = kind === "sentence";

  return (
    <button
      onClick={onOpen}
      className={cn(
        "w-full flex gap-3 rounded-xl border border-border/60 bg-card px-3.5 py-3",
        "transition-all hover:border-primary/20 hover:shadow-sm text-left",
        isSentence ? "items-start" : "items-center"
      )}
    >
      <span
        title={evidence.reason}
        className={cn(
          "h-2 w-2 rounded-full shrink-0",
          inferred.dot,
          isSentence && "mt-1.5"
        )}
      />

      <div className="min-w-0 flex-1">
        {/* Una frase se lee entera; una palabra en una línea basta. */}
        <p
          className={cn(
            "text-sm font-semibold",
            isSentence ? "line-clamp-2 leading-snug" : "truncate"
          )}
        >
          {item.expression}
        </p>
        {gloss && (
          <p
            className={cn(
              "text-xs text-muted-foreground",
              isSentence ? "line-clamp-1 mt-0.5" : "truncate"
            )}
          >
            {gloss}
          </p>
        )}
        {/* En una frase el puesto no significa nada: lo que frena es su
            palabra más rara, y esa sí se muestra. */}
        {isSentence && rarest && showBand && (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
            más rara:
            <span className="font-medium text-foreground">{rarest.word}</span>
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: bandOf(rarest.rank).color }}
            />
            {formatRank(rarest.rank)}
          </span>
        )}
      </div>

      <div
        className={cn(
          "flex items-center gap-2 shrink-0",
          isSentence && "flex-col items-end gap-1 pt-0.5"
        )}
      >
        {occurrences > 0 && (
          <span
            title={`${occurrences} veces en ${videos} ${videos === 1 ? "video" : "videos"} que ya escuchaste`}
            className="text-[11px] font-medium tabular-nums text-muted-foreground"
          >
            {occurrences}×
          </span>
        )}
        {upcoming > 0 && (
          <span
            title={`Aparece ${upcoming} veces en lo que tienes por ver`}
            className="text-[11px] font-medium tabular-nums text-amber-500"
          >
            +{upcoming}
          </span>
        )}
        {item.times_seen > 1 && (
          <span
            title={`Te frenó ${item.times_seen} veces`}
            className="flex items-center gap-1 text-[11px] text-violet-500 font-medium tabular-nums"
          >
            <Eye className="h-3 w-3" />
            {item.times_seen}
          </span>
        )}
        {showBand && !isSentence && (
          <BandPill
            label={formatRank(rank)}
            color={band.color}
            className="hidden sm:inline-flex"
          />
        )}
      </div>
    </button>
  );
}

// ── La ficha ────────────────────────────────────────────────

function EntryDetail({
  item,
  corpus,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
}: {
  item: LearningItem;
  corpus: Corpus;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (updates: Partial<LearningItem> & { id: string }) => void;
  onDelete: (id: string) => void;
}) {
  const { data: sightings = [] } = useItemSightings(item.id);
  const [meaning, setMeaning] = useState(item.meaning ?? "");
  const [translation, setTranslation] = useState(item.translation_es ?? "");
  const [mySentence, setMySentence] = useState(item.my_sentence ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const kind = kindOf(item.expression);
  const rank = corpus.rankOf(item.expression);
  const band = bandOf(rank);
  const rarest = rarestWord(item.expression, corpus.rank);
  const occurrences = corpus.occurrences(item.expression);
  const upcoming = corpus.upcomingOccurrences(item.expression);
  const videos = corpus.videosWith(item.expression);
  const evidence = inferMastery(occurrences, item.times_seen);
  const inferred = INFERRED_MASTERY_CONFIG[evidence.level];
  const suggestion = corpus.suggestSpelling(item.expression);
  const examples = corpus.examples(item.expression, 3);

  const isDirty =
    meaning !== (item.meaning ?? "") ||
    translation !== (item.translation_es ?? "") ||
    mySentence !== (item.my_sentence ?? "");

  const save = () => {
    onUpdate({
      id: item.id,
      meaning: meaning.trim() || null,
      translation_es: translation.trim() || null,
      my_sentence: mySentence.trim() || null,
    });
  };

  return (
    <>
      <BaseModal
        open={open}
        onOpenChange={onOpenChange}
        title={item.expression}
        description={ITEM_KIND_CONFIG[kind].label}
        maxWidth="lg"
        footer={
          isDirty ? (
            <Button
              onClick={() => {
                save();
                onOpenChange(false);
              }}
              className="w-full h-11 font-semibold rounded-xl"
            >
              Guardar
            </Button>
          ) : undefined
        }
      >
        <div className="space-y-5">
          <Pronunciation term={item.expression} />

          {/* Aviso de errata: no está en inglés y nunca se dijo en tus videos */}
          {suggestion && occurrences === 0 && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">
                No encontré <span className="font-semibold">{item.expression}</span>{" "}
                en el inglés ni en tus videos.{" "}
                <button
                  onClick={() => {
                    onUpdate({
                      id: item.id,
                      expression: suggestion,
                      normalized: suggestion,
                    });
                    toast.success(`Corregida a “${suggestion}”`);
                  }}
                  className="font-semibold text-amber-600 dark:text-amber-400 underline underline-offset-2"
                >
                  ¿Querías decir “{suggestion}”?
                </button>
              </p>
            </div>
          )}

          {/* Lo que el corpus sabe */}
          <div className="grid grid-cols-3 gap-2">
            {/* Una frase entera no tiene puesto: se muestra la palabra que la
                hace difícil, que es lo que de verdad te frenó. */}
            {kind === "sentence" ? (
              <Stat
                value={rarest ? formatRank(rarest.rank) : "—"}
                label="la más rara"
                detail={rarest?.word}
                color={rarest ? bandOf(rarest.rank).color : undefined}
              />
            ) : (
              <Stat
                value={formatRank(rank)}
                label="puesto en inglés"
                detail={corpus.isReady ? band.label : undefined}
                color={band.color}
              />
            )}
            <Stat
              value={String(occurrences)}
              label={occurrences === 1 ? "vez que la oíste" : "veces que la oíste"}
              detail={
                videos.length > 0
                  ? `en ${videos.length} ${videos.length === 1 ? "video" : "videos"}`
                  : "en lo que ya viste"
              }
            />
            <Stat
              value={upcoming > 0 ? `+${upcoming}` : String(item.times_seen)}
              label={upcoming > 0 ? "veces por venir" : "veces que te frenó"}
              detail={upcoming > 0 ? "en tu cola" : undefined}
            />
          </div>

          {/* Dominio: primero la evidencia, después la etiqueta que pones tú */}
          <div className="rounded-xl border border-border/60 p-3.5">
            <div className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", inferred.dot)} />
              <span className="text-sm font-semibold">{inferred.label}</span>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground border border-border/60 rounded-md px-1.5 py-0.5">
                inferido
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              {evidence.reason}.
            </p>

            <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border/50">
              {MASTERY_ORDER.map((m) => {
                const config = MASTERY_CONFIG[m];
                const isActive = item.mastery === m;
                return (
                  <button
                    key={m}
                    onClick={() => onUpdate({ id: item.id, mastery: m })}
                    className={cn(
                      "px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all",
                      "flex items-center gap-1.5",
                      isActive
                        ? cn(config.border, config.bg, "text-foreground")
                        : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
                    {config.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ficha editable */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Qué significa</Label>
              <Input
                value={meaning}
                onChange={(e) => setMeaning(e.target.value)}
                placeholder="Find something unexpectedly"
                className="h-10 rounded-xl text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">En español</Label>
              <Input
                value={translation}
                onChange={(e) => setTranslation(e.target.value)}
                placeholder="encontrarse con / toparse con"
                className="h-10 rounded-xl text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tu propia frase</Label>
              <Textarea
                value={mySentence}
                onChange={(e) => setMySentence(e.target.value)}
                placeholder="I came across this tool last week."
                rows={2}
                className="rounded-xl resize-none text-sm"
              />
            </div>
          </div>

          {/* Ejemplos de verdad, sacados de tus propios videos */}
          {examples.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                Cómo se dice en tus videos
              </p>
              <div className="space-y-1.5">
                {examples.map((example, index) => (
                  <a
                    key={`${example.externalId}-${example.seconds}-${index}`}
                    href={youTubeWatchUrl(example.externalId, example.seconds)}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      "block rounded-xl border border-border/60 px-3 py-2.5",
                      "hover:border-primary/25 transition-colors group"
                    )}
                  >
                    <p className="text-sm leading-snug">
                      <Highlight text={example.text} term={item.expression} />
                    </p>
                    <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-1 tabular-nums">
                      {formatClock(example.seconds)}
                      <span className="truncate">{example.title ?? "Tu corpus"}</span>
                      <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </p>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Dónde te frenó */}
          {sightings.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  Dónde te frenó
                </p>
                {sightings.length > 1 && (
                  <span className="text-[11px] text-violet-500 font-medium">
                    {sightings.length} veces
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {sightings.map((sighting, index) => (
                  <div key={sighting.id} className="flex gap-3">
                    <div className="flex flex-col items-center shrink-0 pt-1">
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          index === 0 ? "bg-primary" : "bg-violet-500"
                        )}
                      />
                      {index < sightings.length - 1 && (
                        <span className="w-px flex-1 bg-border mt-1" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 pb-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                          {index === 0 ? "Primera vez" : "Otra vez"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(sighting.created_at), "d MMM", {
                            locale: es,
                          })}
                        </span>
                      </div>

                      <p className="text-sm font-medium truncate mt-0.5">
                        {sighting.session_title ?? "Sesión"}
                      </p>

                      {sighting.context && (
                        <p className="text-xs text-muted-foreground italic mt-0.5">
                          “{sighting.context}”
                        </p>
                      )}

                      {sighting.timestamp_seconds !== null &&
                        sighting.session_external_id && (
                          <a
                            href={youTubeWatchUrl(
                              sighting.session_external_id,
                              sighting.timestamp_seconds
                            )}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors mt-1 tabular-nums"
                          >
                            {formatClock(sighting.timestamp_seconds)}
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              className="rounded-xl text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Eliminar
            </Button>
          </div>
        </div>
      </BaseModal>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        onConfirm={() => onDelete(item.id)}
        title={`¿Eliminar "${item.expression}"?`}
        description="Se borra la expresión y todo su historial de apariciones."
        confirmText="Eliminar"
      />
    </>
  );
}

// ── Piezas chicas ───────────────────────────────────────────

function Stat({
  value,
  label,
  detail,
  color,
}: {
  value: string;
  label: string;
  detail?: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 p-3">
      <p
        className="text-lg font-bold tabular-nums leading-none truncate"
        style={color ? { color } : undefined}
      >
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground mt-1.5 leading-tight">
        {label}
      </p>
      {detail && (
        <p className="text-[10px] text-muted-foreground/70 leading-tight">
          {detail}
        </p>
      )}
    </div>
  );
}

/** Resalta la palabra dentro de la frase donde se dijo. */
function Highlight({ text, term }: { text: string; term: string }) {
  const first = term.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (!first) return <>{text}</>;

  // Se marca por raíz: en la frase la palabra viene conjugada.
  const stem = (first.length > 4 ? first.slice(0, -1) : first).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
  const parts = text.split(new RegExp(`(${stem}\\w*)`, "gi"));

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase().startsWith(stem) ? (
          <mark
            key={index}
            className="bg-primary/15 text-foreground rounded px-0.5 font-semibold"
          >
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
}

/** Fonética y audio, con las mismas dos fuentes que usa la captura. */
function Pronunciation({ term }: { term: string }) {
  const { data, isLoading } = useDictionary(term);
  const { data: extra } = usePronunciation(
    term,
    !isLoading && (!data?.phonetic || !data?.audioUrl)
  );
  const [playing, setPlaying] = useState(false);

  const phonetic = data?.phonetic ?? extra?.phonetic ?? null;
  const audioUrl = data?.audioUrl ?? extra?.audioUrl ?? null;
  const approximate = !data?.phonetic && !!extra?.approximate;

  if (!phonetic && !audioUrl) return null;

  const play = () => {
    if (!audioUrl) return;
    const audio = new Audio(audioUrl);
    const fail = () => {
      setPlaying(false);
      toast.error("No pude reproducir la pronunciación");
    };
    setPlaying(true);
    audio.onended = () => setPlaying(false);
    audio.onerror = fail;
    audio.play().catch(fail);
  };

  return (
    <div className="flex items-center gap-2 -mt-1">
      {audioUrl && (
        <button
          onClick={play}
          title="Escuchar cómo se pronuncia"
          className="text-muted-foreground hover:text-primary transition-colors"
        >
          {playing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </button>
      )}
      {phonetic && (
        <span
          title={
            approximate
              ? "Aproximada: armada juntando la fonética de cada palabra"
              : undefined
          }
          className="text-sm text-muted-foreground font-mono"
        >
          {approximate ? `≈ ${phonetic}` : phonetic}
        </span>
      )}
    </div>
  );
}
