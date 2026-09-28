import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUp, Check, ChevronDown, X } from "lucide-react";
import { EmojiPicker } from "@/components/EmojiPicker";
import { TRANSACTION_TYPES, type TransactionType } from "@/lib/ledger";
import { cn } from "@/lib/utils";
import "./whisper.css";

/**
 * Nueva o editar categoría al estilo Whisper: el nombre en la línea grande,
 * abajo la categoría tal como se verá (emoji + nombre + tipo; tocarla abre
 * el emoji), el tipo en pastillas, el color en bolitas. "Qué incluye" y
 * "En uso" viven en "Más opciones". El composer se tiñe del color elegido.
 * Lo usan Categorías y el atajo de la tabla de movimientos.
 */

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
  /** Categoría que se edita; sin ella, se crea una nueva. */
  category?: Partial<CategoryValues> | null;
  /** Nombre con el que abre al crear (lo que se tecleó buscando). */
  initialName?: string;
  /** Con tipo fijo la categoría nace de ese tipo y no se ofrece cambiarlo. */
  fixedType?: TransactionType;
  /** Muestra "Qué incluye" y "En uso" (solo si el perfil ya usa ese contexto). */
  withContext?: boolean;
  pending?: boolean;
  /** Guarda. Si lanza, el composer se queda abierto con el error. */
  onSave: (values: CategoryValues) => Promise<void>;
}

// Los mismos colores que el Whisper le da a cada tipo.
const TYPE_ACCENT: Record<TransactionType, string> = {
  Gasto: "#f87171",
  Ingreso: "#4ade80",
  Inversión: "#60a5fa",
  Rescate: "#22d3ee",
  Rendimiento: "#a78bfa",
  Reembolso: "#fbbf24",
};

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
  const [error, setError] = useState("");
  const saving = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!category;
  const ready = name.trim().length > 0 && !pending;
  const isCustomColor = !DEFAULT_COLORS.includes(color);

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? initialName);
    setType(fixedType ?? category?.type ?? "Gasto");
    setColor(category?.color || DEFAULT_COLOR);
    setIcon(category?.icon || DEFAULT_ICON);
    setDescription(category?.description ?? "");
    setIsActive(category?.is_active !== false);
    setEmojiOpen(false);
    setExpanded(false);
    setError("");
  }, [open, category, initialName, fixedType]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving.current) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Ponle un nombre a la categoría.");
      inputRef.current?.focus();
      return;
    }
    saving.current = true;
    try {
      await onSave({ name: trimmed, type, color, icon, description, is_active: isActive });
      onOpenChange(false);
    } catch {
      setError("No se guardó la categoría. Intenta de nuevo.");
    } finally {
      saving.current = false;
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="whisper-backdrop" />
        <Dialog.Content
          data-scrollable
          className="whisper-composer"
          style={{ "--whisper-accent": color } as React.CSSProperties}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <Dialog.Title className="sr-only">{isEditing ? "Editar categoría" : "Nueva categoría"}</Dialog.Title>
          <Dialog.Description className="sr-only">
            Escribe el nombre. Abajo eliges el tipo, el color y, tocando la vista previa, el emoji. En más opciones está qué incluye y si sigue en uso.
          </Dialog.Description>
          <Dialog.Close className="whisper-close" aria-label="Cerrar">
            <X size={16} />
          </Dialog.Close>

          <form onSubmit={submit} className="whisper-form">
            <div className="whisper-type" data-static>
              <span className="whisper-dot" aria-hidden="true" />
              <span>{isEditing ? "Editar categoría" : "Nueva categoría"}</span>
            </div>

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
              <div className="whisper-swatches whisper-cat-swatches" role="radiogroup" aria-label="Color">
                {DEFAULT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={color === c}
                    aria-label={`Color ${c}`}
                    className="whisper-swatch"
                    style={{ "--swatch": c } as React.CSSProperties}
                    onClick={() => setColor(c)}
                  />
                ))}
                <span
                  className="whisper-swatch whisper-cat-custom"
                  role="radio"
                  aria-checked={isCustomColor}
                  style={{ "--swatch": color } as React.CSSProperties}
                  title="Otro color"
                >
                  <input type="color" aria-label="Otro color" value={color} onChange={(e) => setColor(e.target.value)} />
                </span>
              </div>
              <p className="whisper-caption" aria-live="polite">
                {fixedType
                  ? `Se crea como categoría de ${fixedType.toLowerCase()}`
                  : isActive
                    ? "Aparece al anotar y Jev puede elegirla"
                    : "Archivada: no aparece al anotar ni la elige Jev. Sus movimientos anteriores se mantienen"}
              </p>
            </div>

            {withContext && (
              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.div
                    className="whisper-options whisper-cat-options"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: reducedMotion ? 0 : 0.18 }}
                  >
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
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            {error && (
              <p id="cat-error" role="alert" className="whisper-error">
                {error}
              </p>
            )}

            <div className="whisper-actions">
              {withContext && (
                <button type="button" className="whisper-options-toggle" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
                  {expanded ? "Menos opciones" : "Más opciones"}
                  <ChevronDown size={12} className={cn(expanded && "rotate-180")} />
                </button>
              )}
              <button type="submit" className="whisper-submit" disabled={!ready} aria-label="Guardar categoría">
                {pending ? "Guardando…" : isEditing ? "Guardar cambios" : "Crear categoría"}
                <span className="hidden sm:inline" aria-hidden="true">↵</span>
                <ArrowUp size={14} className="sm:hidden" aria-hidden="true" />
              </button>
            </div>
            <p id="cat-shortcuts" className="whisper-shortcuts">
              <span>
                <kbd>↵</kbd> guardar
              </span>
              <span>
                <kbd>Esc</kbd> cerrar
              </span>
            </p>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
