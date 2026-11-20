import type { CSSProperties } from "react";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import type { InlineEdit } from "@/hooks/useInlineEdit";
import { EmptyState } from "@/components/shared/EmptyState";
import type { limitUsage } from "@/lib/category-spending";
import { tint } from "@/lib/category-color";
import { clp } from "@/lib/format";
import { cn } from "@/lib/utils";

interface OverLimitsListProps {
  hasLimits: boolean;
  overLimits: ReturnType<typeof limitUsage>;
  edit: Pick<InlineEdit, "colorOf" | "emojiOf">;
  onOpenCategory: (category: string) => void;
  onSeeAll: () => void;
}

export function OverLimitsList({ hasLimits, overLimits, edit, onOpenCategory, onSeeAll }: OverLimitsListProps) {
  const { isPrivacyMode } = usePrivacyMode();
  const { colorOf, emojiOf } = edit;

  if (!hasLimits) {
    return (
      <EmptyState action={{ label: "Poner un límite", onClick: onSeeAll }}>
        Aún no pones límites
      </EmptyState>
    );
  }
  if (overLimits.length === 0) return <EmptyState>Vas bien en todos tus límites</EmptyState>;

  return (
    <>
      {overLimits.map((cat, index) => {
        const { limit } = cat;
        return (
          <button key={cat.category} onClick={() => onOpenCategory(cat.category)} className="inicio-lim">
            <span className="inicio-ico" style={tint(colorOf(cat.category))}>{emojiOf(cat.category)}</span>
            <span className="n">{cat.category}</span>
            <span className="pct">{Math.round(cat.usage)}%</span>
            <span className="inicio-track">
              <i style={{ width: "100%", background: "oklch(var(--destructive))", "--i": index } as CSSProperties} />
            </span>
            <span className={cn("of", isPrivacyMode && "privacy-blur")}>
              <span>{clp(cat.spent)} de {clp(limit)}</span>
              <span className="extra">+{clp(cat.spent - limit)}</span>
            </span>
          </button>
        );
      })}
    </>
  );
}
