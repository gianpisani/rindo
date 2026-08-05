import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmojiPicker } from "@/components/EmojiPicker";
import { cn } from "@/lib/utils";

export const CATEGORY_FORM_ID = "category-create-form";

const DEFAULT_COLORS = [
  "#10b981", "#059669", "#34d399", "#6ee7b7",
  "#f97316", "#0ea5e9", "#a855f7", "#ec4899",
  "#8b5cf6", "#6366f1", "#14b8a6", "#ef4444",
  "#f59e0b", "#64748b", "#78716c", "#3b82f6",
];

type CategoryType = "Ingreso" | "Gasto" | "Inversión" | "Reembolso";

interface CategoryCreateInlineProps {
  /** Nombre inicial, típicamente lo que el usuario escribió al buscar. */
  initialName?: string;
  /** Tipo de la transacción en curso: la categoría nace con ese tipo. */
  type: CategoryType;
  onBack: () => void;
  /** "Volver" cuando se vuelve a un paso previo, "Cancelar" en un modal propio. */
  backLabel?: string;
  /** Crea la categoría. Al resolver, el llamador decide qué hacer. */
  onSubmit: (category: {
    name: string;
    type: CategoryType;
    color: string;
    icon: string;
  }) => Promise<void>;
}

/**
 * Formulario inline para crear una categoría sin salir del modal de
 * transacción. Igual que CategoryPickerInline, se renderiza en el flujo
 * del modal (sin overlays anidados, que rompen el scroll en iOS).
 */
export function CategoryCreateInline({
  initialName = "",
  type,
  onBack,
  backLabel = "Volver",
  onSubmit,
}: CategoryCreateInlineProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState("🏷️");
  const [color, setColor] = useState("#ef4444");

  // Mismo nudge que CategoryPickerInline: al montar, el contenido del
  // modal crece y hay que reactivar el contexto de scroll de iOS WebKit.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      let el: HTMLElement | null = rootRef.current?.parentElement ?? null;
      while (el) {
        const overflowY = getComputedStyle(el).overflowY;
        if (overflowY === "auto" || overflowY === "scroll") {
          el.scrollTop = 1;
          el.scrollTop = 0;
          break;
        }
        el = el.parentElement;
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    await onSubmit({ name: trimmed, type, color, icon });
  };

  return (
    <div ref={rootRef} className="pt-1">
      <button
        type="button"
        onClick={onBack}
        className="mb-2 flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </button>

      <form id={CATEGORY_FORM_ID} onSubmit={handleSubmit} className="space-y-5">
        {/* Preview */}
        <div className="flex justify-center">
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
            style={{ backgroundColor: color + "22", color }}
          >
            <span>{icon}</span>
            <span>{name || "Nombre"}</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Nombre</Label>
          <Input
            placeholder="ej. Supermercado"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-11 rounded-full px-5"
            required
            autoFocus
          />
          <p className="px-2 text-xs text-muted-foreground">
            Se crea como categoría de tipo {type.toLowerCase()}.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Emoji</Label>
          <EmojiPicker value={icon} onSelect={setIcon} />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Color</Label>
          <div className="grid grid-cols-8 gap-2">
            {DEFAULT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={cn(
                  "h-8 w-8 rounded-full border-2 transition-all duration-150",
                  color === c
                    ? "scale-110 border-foreground shadow-md"
                    : "border-transparent hover:scale-105"
                )}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>
      </form>
    </div>
  );
}
