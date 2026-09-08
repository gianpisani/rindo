import { AlertCircle, ChevronRight, X, type LucideIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn } from "@/lib/utils";

/**
 * Los avisos del inicio viven en la fila del saludo, no en el flujo.
 *
 * El inicio es una pantalla exacta: el alto de las cards se mide contra lo
 * que hay arriba. Un banner insertado en el flujo empuja todo y rompe el
 * fold, y el próximo aviso lo rompe de nuevo. Acá el aire vacío al lado de
 * "Buenas tardes" es el que los recibe: por muchos que haya, la fila ya
 * existía y el alto de la vista no cambia nunca.
 *
 * Con uno o dos se leen enteros. Con tres —o en pantalla angosta, donde el
 * saludo se come el ancho— colapsan a un contador que los abre en un popover.
 * El corte lo hace CSS, no un hook de ancho: medir en JS deja un frame con
 * las pastillas puestas antes de corregirse.
 */

export interface HomeNotice {
  id: string;
  icon: LucideIcon;
  /** Texto corto: el que entra en la pastilla. */
  label: string;
  /** La frase completa, para el popover. */
  detail: string;
  tone: "primary" | "warning";
  /** A dónde lleva el aviso. */
  onClick?: () => void;
  /** Si no lo entregas, el aviso no se puede cerrar (se va solo). */
  onDismiss?: () => void;
}

/** Cuántos avisos se muestran enteros antes de colapsar al contador. */
const MAX_PILLS = 2;

const tones = {
  primary: {
    pill: "border-primary/25 bg-primary/[0.06] hover:bg-primary/10",
    icon: "text-primary",
  },
  warning: {
    pill: "border-amber-500/30 bg-amber-500/[0.06] hover:bg-amber-500/10",
    icon: "text-amber-500",
  },
} as const;

function DismissButton({
  onDismiss,
  className,
}: {
  onDismiss: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onDismiss();
      }}
      aria-label="Cerrar aviso"
      className={cn(
        "shrink-0 text-muted-foreground/60 transition-colors hover:text-foreground",
        className
      )}
    >
      <X className="h-3 w-3" />
    </button>
  );
}

/** Un aviso entero, para cuando hay espacio. */
function NoticePill({ notice }: { notice: HomeNotice }) {
  const tone = tones[notice.tone];
  return (
    <div
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-full border pl-2.5 pr-2 transition-colors",
        tone.pill
      )}
    >
      <button
        type="button"
        onClick={notice.onClick}
        title={notice.detail}
        className="flex min-w-0 items-center gap-1.5 focus-visible:outline-none"
      >
        <notice.icon className={cn("h-3.5 w-3.5 shrink-0", tone.icon)} />
        <span className="truncate text-[11px] font-medium">{notice.label}</span>
      </button>
      {notice.onDismiss && <DismissButton onDismiss={notice.onDismiss} />}
    </div>
  );
}

/** La lista completa, dentro del popover del contador. */
function NoticeRow({ notice }: { notice: HomeNotice }) {
  const tone = tones[notice.tone];
  return (
    <div className="flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50">
      <button
        type="button"
        onClick={notice.onClick}
        className="flex min-w-0 flex-1 items-start gap-2.5 text-left focus-visible:outline-none"
      >
        <notice.icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone.icon)} />
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold leading-snug">
            {notice.label}
          </span>
          <span className="block text-[11px] leading-snug text-muted-foreground">
            {notice.detail}
          </span>
        </span>
        {notice.onClick && (
          <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
        )}
      </button>
      {notice.onDismiss && (
        <DismissButton onDismiss={notice.onDismiss} className="mt-1" />
      )}
    </div>
  );
}

/** El contador: los avisos completos viven en su popover. */
function NoticeCounter({
  notices,
  className,
}: {
  notices: HomeNotice[];
  className?: string;
}) {
  const tone = notices.some((n) => n.tone === "warning") ? "warning" : "primary";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${notices.length} ${notices.length === 1 ? "aviso" : "avisos"}`}
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-full border px-2.5 transition-colors",
            tones[tone].pill,
            className
          )}
        >
          <AlertCircle className={cn("h-3.5 w-3.5", tones[tone].icon)} />
          <span className="font-mono text-[11px] font-semibold tabular-nums">
            {notices.length}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[290px] p-1.5">
        <div className="space-y-0.5">
          {notices.map((notice) => (
            <NoticeRow key={notice.id} notice={notice} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function HomeNotices({
  notices,
  className,
}: {
  notices: HomeNotice[];
  className?: string;
}) {
  if (notices.length === 0) return null;

  // Muchos avisos no caben enteros en ningún ancho: van al contador siempre.
  if (notices.length > MAX_PILLS) {
    return <NoticeCounter notices={notices} className={className} />;
  }

  return (
    <>
      <div className={cn("hidden items-center gap-1.5 md:flex", className)}>
        {notices.map((notice) => (
          <NoticePill key={notice.id} notice={notice} />
        ))}
      </div>
      <NoticeCounter notices={notices} className={cn("md:hidden", className)} />
    </>
  );
}

export default HomeNotices;
