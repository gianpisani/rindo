import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ColorMode } from "@/hooks/useThemeDraft";

const COLOR_MODES = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
] as const;

export function ColorModeToggle({
  colorMode,
  onChange,
}: {
  colorMode: string;
  onChange: (mode: ColorMode) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1 p-1 rounded-full bg-muted">
      {COLOR_MODES.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={cn(
            "flex h-9 items-center justify-center gap-2 rounded-full text-sm font-medium transition-colors",
            colorMode === value
              ? "bg-card text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="size-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
