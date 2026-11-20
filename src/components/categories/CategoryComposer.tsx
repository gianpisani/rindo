import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { EmojiPicker } from "@/components/categories/EmojiPicker";
import { WhisperComposer, WhisperShortcuts, WhisperStaticType, WhisperSubmit } from "@/components/shared/whisper/WhisperComposer";
import { WhisperOptions, WhisperOptionsToggle } from "@/components/shared/whisper/WhisperOptions";
import { WhisperSwatches } from "@/components/shared/whisper/WhisperSwatches";
import { useComposerSubmit } from "@/hooks/useComposerSubmit";
import { TRANSACTION_TYPES, type TransactionType } from "@/lib/ledger";
import { cn } from "@/lib/utils";
import { WHISPER_TYPES } from "@/lib/whisper";

export interface CategoryValues {
  name: string;
  type: TransactionType;
  color: string;
  icon: string;
  description: string;
  is_active: boolean;
}

interface CategoryComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: { [K in keyof CategoryValues]?: CategoryValues[K] | null } | null;
  initialName?: string;
  fixedType?: TransactionType;
  initialType?: TransactionType;
  withContext?: boolean;
  pending?: boolean;
  onSave: (values: CategoryValues) => Promise<void>;
}

const TYPE_ACCENT = Object.fromEntries(WHISPER_TYPES.map((t) => [t.type, t.color])) as Record<TransactionType, string>;

const DEFAULT_COLORS = [
  "#10b981", "#059669", "#34d399", "#6ee7b7",
  "#f97316", "#0ea5e9", "#a855f7", "#ec4899",
  "#8b5cf6", "#6366f1", "#14b8a6", "#ef4444",
  "#f59e0b", "#64748b", "#78716c", "#3b82f6",
];
const DEFAULT_COLOR = "#ef4444";
const DEFAULT_ICON = "🏷️";

export function CategoryComposer({
  open,
  onOpenChange,
  category,
  initialName = "",
  fixedType,
  initialType,
  withContext = false,
  pending = false,
  onSave,
}: CategoryComposerProps) {
  const reducedMotion = useReducedMotion();
  const [name, setName] = useState("");
  const [type, setType] = useState<TransactionType>("Gasto");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [icon, setIcon] = useState(DEFAULT_ICON);
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { error, setError, guardedSubmit } = useComposerSubmit();
  const inputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!category;
  const ready = name.trim().length > 0 && !pending;
  const isCustomColor = !DEFAULT_COLORS.includes(color);

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? initialName);
    setType(fixedType ?? category?.type ?? initialType ?? "Gasto");
    setColor(category?.color || DEFAULT_COLOR);
    setIcon(category?.icon || DEFAULT_ICON);
    setDescription(category?.description ?? "");
    setIsActive(category?.is_active !== false);
    setEmojiOpen(false);
    setExpanded(false);
    setError("");
  }, [open, category, initialName, fixedType, initialType, setError]);

  const submit = guardedSubmit(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Ponle un nombre a la categoría.");
      inputRef.current?.focus();
      return;
    }
    await onSave({ name: trimmed, type, color, icon, description, is_active: isActive });
    onOpenChange(false);
  }, "No se guardó la categoría. Intenta de nuevo.");

  return (
    <WhisperComposer
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Editar categoría" : "Nueva categoría"}
      description="Escribe el nombre. Abajo eliges el tipo, el color y, tocando la vista previa, el emoji. En más opciones está qué incluye y si sigue en uso."
      accent={color}
      focusOnOpen={() => inputRef.current?.focus()}
      onSubmit={submit}
    >
      <WhisperStaticType>{isEditing ? "Editar categoría" : "Nueva categoría"}</WhisperStaticType>
      <div className="whisper-entry">
        <input
          ref={inputRef}
          aria-label="Nombre de la categoría"
          aria-describedby={error ? "cat-error cat-shortcuts" : "cat-shortcuts"}
          aria-invalid={!!error}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={60}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError("");
          }}
          placeholder="Supermercado"
          className="whisper-input"
        />
        <div className="whisper-preview">
          <button
            type="button"
            className="whisper-cat-preview"
            aria-expanded={emojiOpen}
            aria-label={`Emoji ${icon}, tocar para cambiarlo`}
            onClick={() => setEmojiOpen(!emojiOpen)}
          >
            <span className="whisper-cat-preview-emoji" aria-hidden="true">{icon}</span>
            <span>{name.trim() || "Nombre"}</span>
            <span className="whisper-cat-preview-type">· {type}</span>
            <ChevronDown size={11} aria-hidden="true" className={cn(emojiOpen && "rotate-180")} />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {emojiOpen && (
          <motion.div
            className="dark whisper-cat-emoji"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.18 }}
          >
            <EmojiPicker
              value={icon}
              onSelect={(emoji) => {
                setIcon(emoji);
                setEmojiOpen(false);
                inputRef.current?.focus();
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="whisper-category-space">
        {!fixedType && (
          <div className="whisper-categories" role="group" aria-label="Tipo">
            {TRANSACTION_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                className="whisper-category"
                aria-pressed={type === t}
                style={{ "--whisper-accent": TYPE_ACCENT[t] } as React.CSSProperties}
                onClick={() => {
                  setType(t);
                  inputRef.current?.focus();
                }}
              >
                <span className="whisper-category-dot" aria-hidden="true" />
                {t}
                {type === t && <Check size={12} aria-hidden="true" />}
              </button>
            ))}
          </div>
        )}
        <WhisperSwatches colors={DEFAULT_COLORS} value={color} onChange={setColor} label="Color" className="whisper-cat-swatches">
          <span
            className="whisper-swatch whisper-cat-custom"
            role="radio"
            aria-checked={isCustomColor}
            style={{ "--swatch": color } as React.CSSProperties}
            title="Otro color"
          >
            <input type="color" aria-label="Otro color" value={color} onChange={(e) => setColor(e.target.value)} />
          </span>
        </WhisperSwatches>
        <p className="whisper-caption" aria-live="polite">
          {fixedType
            ? `Se crea como categoría de ${fixedType.toLowerCase()}`
            : isActive
              ? "Aparece al anotar y Jev puede elegirla"
              : "Archivada: no aparece al anotar ni la elige Jev. Sus movimientos anteriores se mantienen"}
        </p>
      </div>

      {withContext && (
        <WhisperOptions open={expanded} className="whisper-cat-options">
          <label>
            Qué incluye
            <textarea
              className="whisper-cat-textarea"
              value={description}
              maxLength={600}
              rows={3}
              placeholder="Qué gastos van aquí y cuáles no. Ayuda a categorizar mejor."
              onChange={(e) => setDescription(e.target.value)}
              aria-label="Qué incluye"
            />
          </label>
          <label className="whisper-check">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            En uso
          </label>
        </WhisperOptions>
      )}

      {error && (
        <p id="cat-error" role="alert" className="whisper-error">
          {error}
        </p>
      )}

      <div className="whisper-actions">
        {withContext && <WhisperOptionsToggle expanded={expanded} onToggle={() => setExpanded(!expanded)} />}
        <WhisperSubmit label="Guardar categoría" disabled={!ready}>
          {pending ? "Guardando…" : isEditing ? "Guardar cambios" : "Crear categoría"}
        </WhisperSubmit>
      </div>
      <WhisperShortcuts id="cat-shortcuts" items={[["↵", "guardar"], ["Esc", "cerrar"]]} />
    </WhisperComposer>
  );
}
