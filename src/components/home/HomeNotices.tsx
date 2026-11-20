import { AlertCircle, ChevronRight, X, type LucideIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { cn } from "@/lib/utils";

export interface HomeNotice {
  id: string;
  icon: LucideIcon;
  label: string;
  detail: string;
  tone: "primary" | "warning";
  onClick?: () => void;
  onDismiss?: () => void;
}

const MAX_PILLS = 2;

const tones = {
  primary: {
    pill: "",
    icon: "text-muted-foreground",
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
        "shrink-0 transition-colors hover:text-foreground",
        className
      )}
    >
      <X className="h-3 w-3" />
    </button>
  );
}

function NoticePill({ notice }: { notice: HomeNotice }) {
  const tone = tones[notice.tone];
  return (
    <div
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-full border pl-2 pr-2 transition-colors",
        tone.pill
      )}
    >
      <button
        type="button"
        onClick={notice.onClick}
        title={notice.detail}
        className="flex min-w-0 items-center gap-1.5"
      >
        <notice.icon className={cn("h-3.5 w-3.5 shrink-0", tone.icon)} />
        <span className="truncate text-xs font-medium">{notice.label}</span>
      </button>
      {notice.onDismiss && <DismissButton onDismiss={notice.onDismiss} />}
    </div>
  );
}

function NoticeRow({ notice }: { notice: HomeNotice }) {
  const tone = tones[notice.tone];
  return (
    <div className="flex items-start gap-2 rounded-card px-2 py-2 transition-colors">
      <button
        type="button"
        onClick={notice.onClick}
        className="flex min-w-0 flex-1 items-start gap-2 text-left"
      >
        <notice.icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone.icon)} />
        <span className="min-w-0">
          <span className="block text-sm font-medium leading-snug">
            {notice.label}
          </span>
          <span className="block text-xs leading-snug text-muted-foreground">
            {notice.detail}
          </span>
        </span>
        {notice.onClick && (
          <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        )}
      </button>
      {notice.onDismiss && (
        <DismissButton onDismiss={notice.onDismiss} className="mt-1" />
      )}
    </div>
  );
}

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
            "flex h-7 items-center gap-1.5 rounded-full border px-2 transition-colors",
            tones[tone].pill,
            className
          )}
        >
          <AlertCircle className={cn("h-3.5 w-3.5", tones[tone].icon)} />
          <span className="text-xs font-medium tabular-nums">
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
