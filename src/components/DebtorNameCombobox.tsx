import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DebtorNameComboboxProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

/**
 * Input de texto libre para nombre de deudor/acreedor, con sugerencias
 * de personas ya registradas. A diferencia de un combobox estricto, no
 * fuerza el valor a uno de la lista: el usuario siempre puede escribir
 * un nombre nuevo.
 */
export function DebtorNameCombobox({
  value,
  onChange,
  suggestions,
  placeholder = "Nombre",
  className,
  autoFocus,
}: DebtorNameComboboxProps) {
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return suggestions.slice(0, 6);
    return suggestions
      .filter((s) => s.toLowerCase().includes(q) && s.toLowerCase() !== q)
      .slice(0, 6);
  }, [value, suggestions]);

  const showDropdown = open && filtered.length > 0;

  return (
    <Popover open={showDropdown} onOpenChange={(o) => !o && setOpen(false)}>
      <PopoverAnchor asChild>
        <Input
          placeholder={placeholder}
          value={value}
          autoFocus={autoFocus}
          className={className}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
        />
      </PopoverAnchor>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-1"
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="max-h-[220px] overflow-y-auto">
          {filtered.map((name) => (
            <button
              key={name}
              type="button"
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm",
                "hover:bg-accent transition-colors"
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(name);
                setOpen(false);
              }}
            >
              <span className="truncate">{name}</span>
              {name.toLowerCase() === value.trim().toLowerCase() && (
                <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-primary" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
