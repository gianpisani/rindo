import { Check, Type } from "lucide-react";
import { FONT_OPTIONS } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { SectionLabel } from "./SectionLabel";

export function FontPicker({
  selectedFont,
  onChange,
}: {
  selectedFont: string;
  onChange: (fontId: string) => void;
}) {
  return (
    <div>
      <SectionLabel icon={Type}>Fuente</SectionLabel>
      <div className="grid grid-cols-2 gap-2">
        {FONT_OPTIONS.map((font) => (
          <button
            key={font.id}
            type="button"
            aria-pressed={selectedFont === font.id}
            onClick={() => onChange(font.id)}
            className={cn(
              "relative flex flex-col items-start px-3 py-2 rounded-card border text-left transition-[border-color,transform] duration-150",
              selectedFont === font.id ? "border-foreground" : "hover:border-muted-foreground active:scale-[0.98]"
            )}
          >
            {selectedFont === font.id && <Check className="absolute top-2 right-2 size-3.5" />}
            <span
              className="text-sm font-medium leading-tight"
              style={{ fontFamily: font.family }}
            >
              {font.name}
            </span>
            <span
              className="text-xs text-muted-foreground mt-0.5"
              style={{ fontFamily: font.family }}
            >
              Hola mundo $1.234
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
