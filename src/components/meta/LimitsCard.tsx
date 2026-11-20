import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { LimitRow } from "@/components/meta/LimitRow";
import { NewLimitRow } from "@/components/meta/NewLimitRow";
import { useCategories } from "@/hooks/useCategories";
import { useLimitEditor } from "@/hooks/useLimitEditor";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import type { LimitRowUsage } from "@/hooks/useLimitUsage";
import { getCategoryIcon } from "@/lib/category-icon";
import { clp } from "@/lib/format";
import { cn } from "@/lib/utils";

export function LimitsCard({ rows, total }: { rows: LimitRowUsage[]; total: number }) {
  const { isPrivacyMode } = usePrivacyMode();
  const { categories } = useCategories();
  const { edit, add } = useLimitEditor();

  const categoryOf = (name: string) => categories.find((c) => c.name === name);

  return (
    <section className="meta-card meta-limits">
      <div className="meta-card-head">
        <span className="meta-label">Límites</span>
        {rows.length > 0 && (
          <span className={cn("meta-count", isPrivacyMode && "privacy-blur")}>
            <b>{clp(total)}</b> al mes
          </span>
        )}
      </div>
      <div className="meta-lim-list" data-scrollable>
        {rows.length === 0 && !add.active && (
          <EmptyState className="col-span-full">Ponle un techo a una categoría y acá ves cómo vas</EmptyState>
        )}
        {rows.map((row, index) => (
          <LimitRow
            key={row.category}
            row={row}
            index={index}
            emoji={categoryOf(row.category)?.icon || getCategoryIcon(row.category)}
            categoryColor={categoryOf(row.category)?.color ?? null}
            edit={edit}
          />
        ))}
        {add.active ? (
          <NewLimitRow add={add} />
        ) : (
          <Button variant="ghost" size="sm" className="self-start justify-self-start max-md:mx-3 max-md:mt-1" onClick={add.start} disabled={add.options.length === 0}>
            <Plus /> Límite
          </Button>
        )}
      </div>
    </section>
  );
}
