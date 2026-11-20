import { useState, type CSSProperties } from "react";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import type { InlineEdit } from "@/hooks/useInlineEdit";
import { EmptyState } from "@/components/shared/EmptyState";
import { percentOf, totalSpend, type CategorySpend } from "@/lib/home-summary";
import { clp } from "@/lib/format";
import { cn } from "@/lib/utils";

const TOP_CATEGORIES = 5;

interface SpendCardProps {
  breakdown: CategorySpend[];
  monthExpenses: number;
  edit: Pick<InlineEdit, "colorOf" | "emojiOf">;
  onOpenCategory: (category: string) => void;
}

export function SpendCard({ breakdown, monthExpenses, edit, onOpenCategory }: SpendCardProps) {
  const { isPrivacyMode } = usePrivacyMode();
  const [showAll, setShowAll] = useState(false);
  const { colorOf, emojiOf } = edit;
  const shown = showAll ? breakdown : breakdown.slice(0, TOP_CATEGORIES);
  const hidden = breakdown.length - shown.length;
  const topSpend = breakdown[0]?.effectiveAmount || 1;
  const pctOf = (amount: number) => percentOf(amount, monthExpenses);
  const stackRest = monthExpenses - totalSpend(shown);
  const canToggle = hidden > 0 || showAll;
  const toggle = () => setShowAll((v) => !v);

  return (
    <section className="inicio-card inicio-spend">
      <span className="inicio-title">Por categoría</span>
      {breakdown.length === 0 ? (
        <EmptyState>Sin gastos este mes</EmptyState>
      ) : (
        <>
          {shown.map((cat, index) => (
            <button key={cat.category} onClick={() => onOpenCategory(cat.category)} className="inicio-cat">
              <span className="n">{emojiOf(cat.category)} {cat.category}</span>
              <span className={cn("v", isPrivacyMode && "privacy-blur")}>{clp(cat.effectiveAmount)}</span>
              <span className="p">{pctOf(cat.effectiveAmount)}%</span>
              <span className="inicio-track">
                <i style={{ width: `${Math.max((cat.effectiveAmount / topSpend) * 100, 1.5)}%`, background: colorOf(cat.category) || "var(--muted-foreground)", "--i": index } as CSSProperties} />
              </span>
            </button>
          ))}
          {canToggle && (
            <button onClick={toggle} className="inicio-more">
              {showAll ? "Ver menos" : `+${hidden} categoría${hidden === 1 ? "" : "s"} más`}
            </button>
          )}
          <div className="inicio-stack">
            {shown.map((cat) => (
              <i key={cat.category} style={{ flex: cat.effectiveAmount, background: colorOf(cat.category) || "var(--muted-foreground)" }} />
            ))}
            {stackRest > 0 && <i style={{ flex: stackRest, background: "var(--border)" }} />}
          </div>
          <div className="inicio-legend">
            {shown.map((cat) => (
              <button key={cat.category} onClick={() => onOpenCategory(cat.category)}>
                {emojiOf(cat.category)} {cat.category} <b>{pctOf(cat.effectiveAmount)}%</b>
              </button>
            ))}
            {canToggle && (
              <button onClick={toggle}>{showAll ? "menos" : `+${hidden}`}</button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
