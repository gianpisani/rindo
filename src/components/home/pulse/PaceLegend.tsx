import type { PaceVerdict } from "@/lib/month-pace";
import { TONE } from "./tone";

export function PaceLegend({ verdict }: { verdict: PaceVerdict }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 rounded-full" style={{ background: TONE[verdict] }} /> Tú
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-4 border-t-[1.5px] border-dashed border-muted-foreground" /> Tu mes típico
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-4 rounded-full" style={{ background: "color-mix(in oklch, var(--muted-foreground) 15%, transparent)" }} /> Tu rango normal
      </span>
    </div>
  );
}
