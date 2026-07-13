import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
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
}

/**
 * Selector de categoría con búsqueda. En desktop es un popover tipo
 * combobox; en mobile es un bottom sheet con targets grandes y scroll
 * nativo (el Select de Radix dentro de un Dialog no scrollea en iOS).
 */
export function CategorySelect({
  value,
  options,
  onChange,
  placeholder = "Seleccionar",
  searchPlaceholder = "Buscar categoría...",
  className,
}: CategorySelectProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  // Igual que BaseModal: activar el contexto de scroll de iOS WebKit
  // para que react-remove-scroll permita scrollear la lista una vez
  // terminada la animación de entrada.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      const el = listRef.current;
      if (!el) return;
      el.scrollTop = 1;
      el.scrollTop = 0;
    }, 350);
    return () => clearTimeout(timer);
  }, [open]);

  const trigger = (
    <button
      type="button"
      role="combobox"
      aria-expanded={open}
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-xl border border-input bg-background px-3 text-sm",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        !selected && "text-muted-foreground",
        className
      )}
    >
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
    </button>
  );

  const optionsList = (
    <Command>
      <CommandInput placeholder={searchPlaceholder} className={cn(isMobile ? "h-12 text-base" : "h-9 text-sm")} />
      <CommandList
        ref={listRef}
        className={cn("overscroll-contain", isMobile ? "max-h-[50vh]" : "max-h-[280px]")}
        style={{ touchAction: "pan-y", WebkitOverflowScrolling: "touch" }}
      >
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
              className={cn(
                "flex cursor-pointer items-center gap-2.5",
                isMobile ? "px-3 py-3 text-base" : "py-2 text-sm"
              )}
            >
              {option.emoji && (
                <span className={cn("shrink-0 leading-none", isMobile ? "text-xl" : "text-base")}>
                  {option.emoji}
                </span>
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
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent className="max-h-[75vh]">
          <DrawerHeader className="pb-1 pt-3">
            <DrawerTitle className="text-sm font-medium text-muted-foreground">
              Categoría
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-2 pb-safe mb-2">{optionsList}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[220px] rounded-xl border-border/60 p-0 shadow-lg shadow-black/10 dark:shadow-black/30"
        align="start"
        sideOffset={4}
      >
        {optionsList}
      </PopoverContent>
    </Popover>
  );
}
