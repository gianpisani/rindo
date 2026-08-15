import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { BaseModal } from "@/components/BaseModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Search, Trash2, ExternalLink, Eye } from "lucide-react";
import {
  ITEM_TYPE_CONFIG,
  MASTERY_CONFIG,
  MASTERY_ORDER,
  formatClock,
  youTubeWatchUrl,
  type Mastery,
} from "@/lib/learning-config";
import {
  useItemSightings,
  type LearningItem,
} from "@/hooks/useLearningItems";

interface LearningVocabularyProps {
  items: LearningItem[];
  onUpdate: (updates: Partial<LearningItem> & { id: string }) => void;
  onDelete: (id: string) => void;
}

export function LearningVocabulary({
  items,
  onUpdate,
  onDelete,
}: LearningVocabularyProps) {
  const [search, setSearch] = useState("");
  const [masteryFilter, setMasteryFilter] = useState<Mastery | null>(null);
  const [selected, setSelected] = useState<LearningItem | null>(null);

  const counts = useMemo(() => {
    const map: Record<Mastery, number> = {
      new: 0,
      learning: 0,
      familiar: 0,
      mastered: 0,
    };
    for (const item of items) map[item.mastery] += 1;
    return map;
  }, [items]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      if (masteryFilter && item.mastery !== masteryFilter) return false;
      if (!query) return true;
      return (
        item.normalized.includes(query) ||
        item.meaning?.toLowerCase().includes(query) ||
        item.translation_es?.toLowerCase().includes(query)
      );
    });
  }, [items, search, masteryFilter]);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center">
        <p className="text-sm font-medium">Tu diccionario está vacío</p>
        <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto">
          Durante una sesión, presiona E cada vez que escuches algo que no
          conoces. Se guarda acá con su contexto.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <p className="text-2xl font-bold tabular-nums leading-none">
          {items.length}
          <span className="text-sm text-muted-foreground font-semibold">
            {" "}
            {items.length === 1 ? "expresión" : "expresiones"}
          </span>
        </p>

        <div className="flex flex-wrap gap-1.5 mt-4">
          {MASTERY_ORDER.map((m) => {
            const config = MASTERY_CONFIG[m];
            const isActive = masteryFilter === m;
            return (
              <button
                key={m}
                onClick={() => setMasteryFilter(isActive ? null : m)}
                className={cn(
                  "px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all",
                  "flex items-center gap-1.5 tabular-nums",
                  isActive
                    ? cn(config.border, config.bg, "text-foreground")
                    : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
                {config.label}
                <span className="opacity-60">{counts[m]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar…"
          className="pl-9 h-11 rounded-xl"
        />
      </div>

      {/* Lista */}
      <div className="space-y-1.5">
        {filtered.map((item) => {
          const config = MASTERY_CONFIG[item.mastery];
          return (
            <button
              key={item.id}
              onClick={() => setSelected(item)}
              className={cn(
                "w-full flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3.5 py-3",
                "transition-all hover:border-primary/20 hover:shadow-sm text-left"
              )}
            >
              <span className={cn("h-2 w-2 rounded-full shrink-0", config.dot)} />

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{item.expression}</p>
                {(item.meaning || item.translation_es) && (
                  <p className="text-xs text-muted-foreground truncate">
                    {item.meaning ?? item.translation_es}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {item.times_seen > 1 && (
                  <span className="flex items-center gap-1 text-[11px] text-violet-500 font-medium tabular-nums">
                    <Eye className="h-3 w-3" />
                    {item.times_seen}
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground hidden sm:inline">
                  {ITEM_TYPE_CONFIG[item.item_type]?.short}
                </span>
              </div>
            </button>
          );
        })}

        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nada calza con eso.
          </p>
        )}
      </div>

      {selected && (
        <ItemDetailModal
          item={selected}
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

// ── Detalle de una expresión ────────────────────────────────

function ItemDetailModal({
  item,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
}: {
  item: LearningItem;
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
        description={ITEM_TYPE_CONFIG[item.item_type]?.label}
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
          {/* Dominio */}
          <div className="flex flex-wrap gap-1.5">
            {MASTERY_ORDER.map((m) => {
              const config = MASTERY_CONFIG[m];
              const isActive = item.mastery === m;
              return (
                <button
                  key={m}
                  onClick={() => onUpdate({ id: item.id, mastery: m })}
                  className={cn(
                    "px-3 py-2 rounded-xl text-xs font-medium border transition-all",
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

          {/* Ficha */}
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

          {/* Dónde la has visto — lo interesante */}
          {sightings.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  Dónde apareció
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
                    {/* Línea de tiempo */}
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
