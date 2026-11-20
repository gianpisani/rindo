import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface WhisperSwatchesProps {
  colors: readonly string[];
  value: string;
  onChange: (color: string) => void;
  label: string;
  className?: string;
  children?: ReactNode;
}

export function WhisperSwatches({ colors, value, onChange, label, className, children }: WhisperSwatchesProps) {
  return (
    <div className={cn("whisper-swatches", className)} role="radiogroup" aria-label={label}>
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={`Color ${color}`}
          className="whisper-swatch"
          style={{ "--swatch": color } as CSSProperties}
          onClick={() => onChange(color)}
        />
      ))}
      {children}
    </div>
  );
}
