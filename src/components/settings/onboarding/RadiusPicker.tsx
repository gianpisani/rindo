import { Circle } from "lucide-react";
import { Slider } from "@/components/ui/slider";

export function RadiusPicker({
  radius,
  onChange,
}: {
  radius: number;
  onChange: (radius: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Circle className="size-3.5" />
          <span className="text-xs font-medium text-muted-foreground">
            Redondez
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="w-7 h-5 border-2 transition-all duration-150"
            style={{ borderRadius: `${radius * 0.6}rem` }}
          />
          <div
            className="w-10 h-5 border-2 transition-all duration-150"
            style={{ borderRadius: `${radius}rem` }}
          />
        </div>
      </div>
      <Slider
        value={[radius]}
        onValueChange={([v]) => onChange(v)}
        min={0}
        max={1.5}
        step={0.05}
      />
      <div className="flex justify-between mt-1.5 text-xs">
        <span>Cuadrado</span>
        <span>Redondeado</span>
      </div>
    </div>
  );
}
