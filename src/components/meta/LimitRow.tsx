import type { CSSProperties } from "react";
import { Check, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AmountField } from "@/components/meta/AmountField";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import type { LimitRowUsage } from "@/hooks/useLimitUsage";
import type { LimitEditor } from "@/hooks/useLimitEditor";
import { tint } from "@/lib/category-color";
import { clp } from "@/lib/format";
import { cn } from "@/lib/utils";

export function LimitRow({
  row,
  index,
  emoji,
  categoryColor,
  edit,
}: {
  row: LimitRowUsage;
  index: number;
  emoji: string;
  categoryColor: string | null;
  edit: LimitEditor["edit"];
}) {
  const { isPrivacyMode } = usePrivacyMode();
  const isEditing = edit.category === row.category;
  const { projection } = row;
  const willPass = projection !== null && projection > 100;
  const color =
    row.state === "over" ? "oklch(var(--destructive))" : row.state === "near" ? "var(--meta-amber)" : categoryColor || "var(--muted-foreground)";

  return (
    <div
      className="meta-lim"
      data-state={row.state}
      data-editing={isEditing || undefined}
      role={isEditing ? undefined : "button"}
      tabIndex={isEditing ? undefined : 0}
      onClick={isEditing ? undefined : () => edit.start(row.category, row.limit)}
      onKeyDown={isEditing ? undefined : (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          edit.start(row.category, row.limit);
        }
      }}
    >
      <span className="meta-ico" style={tint(categoryColor)}>{emoji}</span>
      <span className="n">{row.category}</span>
      <span className="pct">
        {willPass && <small className="proj">→ {Math.round(projection as number)}%</small>}
        {Math.round(row.usage)}%
      </span>
      <span className="meta-lim-track" title={projection !== null ? `A este ritmo cierras el mes en ${Math.round(projection)}%` : undefined}>
        <i style={{ width: row.usage > 0 ? `max(3px, ${Math.min(row.usage, 100)}%)` : "0%", background: color, "--i": index } as CSSProperties} />
        {projection !== null && projection > row.usage && (
          <i
            className="meta-ghost"
            style={{
              left: `${row.usage}%`,
              width: `${Math.min(projection, 100) - Math.min(row.usage, 100)}%`,
              background: willPass ? "var(--meta-amber)" : color,
              "--i": index,
            } as CSSProperties}
          />
        )}
      </span>
      {isEditing ? (
        <span className="meta-lim-edit" onClick={(e) => e.stopPropagation()}>
          <AmountField
            value={edit.draft}
            onChange={edit.setDraft}
            onSave={edit.save}
            onCancel={edit.cancel}
            autoFocus
            placeholder="100.000"
            label={`Límite mensual de ${row.category}`}
          />
          <Button variant="ghost" size="icon" className="size-9" onClick={edit.save} disabled={!edit.canSave} aria-label="Guardar límite">
            <Check />
          </Button>
          <Button variant="ghost" size="icon" className="size-9" onClick={edit.cancel} aria-label="Cancelar">
            <X />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto size-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => edit.remove(row.category)}
            aria-label="Quitar límite"
          >
            <Trash2 />
          </Button>
        </span>
      ) : (
        <span className={cn("of", isPrivacyMode && "privacy-blur")}>
          <span>{clp(row.spent)} de {clp(row.limit)}</span>
          {row.state === "over" ? (
            <span className="extra">+{clp(row.spent - row.limit)}</span>
          ) : (
            <span>quedan {clp(row.limit - row.spent)}</span>
          )}
        </span>
      )}
    </div>
  );
}
