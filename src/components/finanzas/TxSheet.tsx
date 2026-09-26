import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { TxRow } from "@/components/TxRow";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Transaction } from "@/hooks/useTransactions";
import type { InlineEdit } from "@/hooks/useInlineEdit";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { byNewest } from "@/hooks/useTransactions";
import { cn } from "@/lib/utils";

export interface TxSheetData {
  title: string;
  icon?: string;
  color?: string | null;
  /** Resumen bajo el título, ya formateado ("$251.100 · 18 movimientos"). */
  summary: string;
  transactions: Transaction[];
  /** Día (listas de un mes) o mes (listas de varios meses). */
  groupBy: "day" | "month";
}

/**
 * Los movimientos detrás de una barra o una categoría, editables igual que
 * en el inicio. A la derecha en web, desde abajo en el celular.
 */
export function TxSheet({ data, edit, onClose }: { data: TxSheetData | null; edit: InlineEdit; onClose: () => void }) {
  const isMobile = useIsMobile();
  const { isPrivacyMode } = usePrivacyMode();
  const sorted = [...(data?.transactions ?? [])].sort(byNewest);
  const groups = new Map<string, Transaction[]>();
  for (const t of sorted) {
    const key = format(new Date(t.date), data?.groupBy === "month" ? "yyyy-MM" : "yyyy-MM-dd");
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  const label = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d ?? 1);
    return format(date, data?.groupBy === "month" ? "MMMM yyyy" : "EEEE d", { locale: es });
  };

  return (
    <Sheet open={data !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn("inicio fin-sheet", isMobile ? "h-[82dvh] rounded-t-[22px]" : "w-full sm:max-w-md")}
        // Abrir no debe dejar una fila "seleccionada": el foco va al panel.
        onOpenAutoFocus={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).focus(); }}
      >
        {data && (
          <>
            <div className="fin-sheet-head">
              {data.icon && (
                <span className="inicio-ico" style={{ background: `color-mix(in oklch, ${data.color || "var(--muted-foreground)"} 22%, transparent)` }}>
                  {data.icon}
                </span>
              )}
              <div className="min-w-0">
                <SheetTitle asChild><h2 className="capitalize">{data.title}</h2></SheetTitle>
                <SheetDescription asChild><p className={cn(isPrivacyMode && "privacy-blur")}>{data.summary}</p></SheetDescription>
              </div>
            </div>
            <div className="inicio-scroll">
              {sorted.length === 0 ? (
                <div className="fin-empty">Sin movimientos</div>
              ) : (
                [...groups].map(([key, rows]) => (
                  <div key={key}>
                    <div className="inicio-day capitalize">{label(key)}<span>{rows.length}</span></div>
                    {rows.map((t) => <TxRow key={t.id} t={t} edit={edit} when={data.groupBy === "month" ? "date" : "time"} />)}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
