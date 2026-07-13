import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export interface CategorySelectOption {
  value: string;
  label: string;
  emoji?: string;
}

interface CategorySelectProps {
  value: string;
  options: CategorySelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  /** En mobile, en vez de abrir un popover, delega la apertura (p. ej.
   * para mostrar un picker inline dentro del modal, que scrollea con
   * el contenedor del modal y evita overlays anidados). */
  onOpenMobile?: () => void;
}

/**
 * Selector de categoría con búsqueda. En desktop es un combobox
 * (popover); en mobile delega a un picker inline vía onOpenMobile.
 */
export function CategorySelect({
  value,
  options,
  onChange,
  placeholder = "Seleccionar",
  searchPlaceholder = "Buscar categoría...",
  className,
  onOpenMobile,
}: CategorySelectProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  const selected = options.find((o) => o.value === value);

  const triggerContent = (
    <>
      <span className="truncate">
        {selected ? (
          <>
            {selected.emoji && <span className="mr-1.5">{selected.emoji}</span>}
            {selected.label}
          </>
        ) : (
          placeholder
        )}
      </span>
      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
    </>
  );

  const triggerClasses = cn(
    "flex h-10 w-full items-center justify-between rounded-xl border border-input bg-background px-3 text-sm",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:cursor-not-allowed disabled:opacity-50",
    !selected && "text-muted-foreground",
    className
  );

  if (isMobile && onOpenMobile) {
    return (
      <button type="button" className={triggerClasses} onClick={onOpenMobile}>
        {triggerContent}
      </button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <button type="button" role="combobox" aria-expanded={open} className={triggerClasses}>
          {triggerContent}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[220px] rounded-xl border-border/60 p-0 shadow-lg shadow-black/10 dark:shadow-black/30"
        align="start"
        sideOffset={4}
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="h-9 text-sm" />
          <CommandList className="max-h-[280px] overscroll-contain">
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
              Sin resultados
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className="flex cursor-pointer items-center gap-2.5 py-2 text-sm"
                >
                  {option.emoji && (
                    <span className="shrink-0 text-base leading-none">{option.emoji}</span>
                  )}
                  <span className="truncate">{option.label}</span>
                  {option.value === value && (
                    <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface CategoryPickerInlineProps {
  value: string;
  options: CategorySelectOption[];
  onSelect: (value: string) => void;
  onBack: () => void;
  searchPlaceholder?: string;
}

/**
 * Picker inline para mobile: se renderiza en el flujo normal del modal
 * (sin portal ni overlay), así la lista scrollea con el contenedor del
 * modal, que sí funciona en iOS. La lista no tiene scroll propio.
 */
export function CategoryPickerInline({
  value,
  options,
  onSelect,
  onBack,
  searchPlaceholder = "Buscar categoría...",
}: CategoryPickerInlineProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  // El nudge de BaseModal corre solo al abrir el modal, cuando el form
  // suele caber sin scroll. Al montar el picker el contenido crece, así
  // que hay que reactivar el contexto de scroll de iOS WebKit en el
  // ancestro scrolleable para que react-remove-scroll permita el touch.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      let el: HTMLElement | null = rootRef.current?.parentElement ?? null;
      while (el) {
        const overflowY = getComputedStyle(el).overflowY;
        if (overflowY === "auto" || overflowY === "scroll") {
          el.scrollTop = 1;
          el.scrollTop = 0;
          break;
        }
        el = el.parentElement;
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={rootRef} className="pt-1">
      <button
        type="button"
        onClick={onBack}
        className="mb-2 flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </button>
      <Command className="bg-transparent">
        <CommandInput placeholder={searchPlaceholder} className="h-11 text-base" />
        {/* max-h-full (parent altura auto) = sin tope: la lista crece y
            scrollea el contenedor del modal, no ella misma. Ojo: la
            versión de tailwind-merge del proyecto NO resuelve el
            conflicto max-h-[300px] vs max-h-none, por eso max-h-full. */}
        <CommandList className="max-h-full pt-1">
          <CommandEmpty className="py-8 text-center text-sm text-muted-foreground">
            Sin resultados
          </CommandEmpty>
          <CommandGroup>
            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={option.label}
                onSelect={() => onSelect(option.value)}
                className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-base"
              >
                {option.emoji && (
                  <span className="shrink-0 text-xl leading-none">{option.emoji}</span>
                )}
                <span className="truncate">{option.label}</span>
                {option.value === value && (
                  <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );
}
