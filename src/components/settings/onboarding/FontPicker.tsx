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
            onClick={() => onChange(font.id)}
            className={cn(
              "relative flex flex-col items-start px-3 py-2 rounded-card border transition-all duration-200 text-left",
              selectedFont !== font.id &&
                "hover:border-border active:scale-[0.97]"
            )}
          >
            {selectedFont === font.id && (
              <div className="absolute top-2 right-2 size-4 rounded-full flex items-center justify-center">
                <Check className="size-2.5 text-foreground" />
              </div>
            )}
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
