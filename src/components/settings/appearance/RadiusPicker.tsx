import { Circle } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { SectionLabel } from "./SectionLabel";

export function RadiusPicker({
  radius,
  onChange,
}: {
  radius: number;
  onChange: (radius: number) => void;
}) {
  return (
    <div>
      <SectionLabel icon={Circle}>Redondez</SectionLabel>
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="size-5 shrink-0 border-2 border-muted-foreground transition-[border-radius] duration-150"
          style={{ borderRadius: `${radius * 0.5}rem` }}
        />
        <Slider
          value={[radius]}
          onValueChange={([v]) => onChange(v)}
          min={0}
          max={1.5}
          step={0.05}
          aria-label="Redondez"
        />
      </div>
    </div>
  );
}
