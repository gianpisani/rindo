import { useState, type MouseEvent, type ReactElement } from "react";
import { Slot } from "@radix-ui/react-slot";
import { Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/useIsMobile";
import { tintColor } from "@/lib/category-color";
import type { CategoryOption } from "@/lib/category-options";

export type QuickCategoryOption = CategoryOption;

interface Props {
  value: string;
  options: QuickCategoryOption[];
  onPick: (name: string) => void;
  onCreate?: (name: string) => void;
  title?: string;
  onOpenChange?: (open: boolean) => void;
  children: ReactElement;
}

const SEARCH_FROM = 12;

const plain = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const stop = (e: MouseEvent) => e.stopPropagation();

export function QuickCategoryPicker({ value, options, onPick, onCreate, title, onOpenChange, children }: Props) {
  const isMobile = useIsMobile();
  const [open, setOpenState] = useState(false);
  const [query, setQuery] = useState("");

  const setOpen = (next: boolean) => {
    setOpenState(next);
    if (!next) setQuery("");
    onOpenChange?.(next);
  };

  const shown = query.trim() ? options.filter((o) => plain(o.name).includes(plain(query.trim()))) : options;

  const pick = (name: string) => {
    setOpen(false);
    if (name !== value) onPick(name);
  };

  const body = (
    <div className="flex flex-col gap-3" onClick={stop}>
      {options.length > SEARCH_FROM && (
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && shown[0] && pick(shown[0].name)}
          placeholder="Buscar categoría"
          aria-label="Buscar categoría"
          className="h-8"
        />
      )}
      <div className="flex max-h-72 flex-wrap gap-2 overflow-y-auto">
        {shown.map((option) => {
          const current = option.name === value;
          return (
            <button
              key={option.name}
              type="button"
              aria-pressed={current}
              onClick={() => pick(option.name)}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{
                background: tintColor(option.color, current ? 32 : 14),
                borderColor: tintColor(option.color, current ? 64 : 24),
              }}
            >
              <span className="leading-none">{option.icon}</span>
              {option.name}
            </button>
          );
        })}
        {shown.length === 0 && <span className="text-sm text-muted-foreground">Sin resultados</span>}
      </div>
      {onCreate && (
        <Button
          variant="ghost"
          size="xs"
          className="self-start text-muted-foreground"
          onClick={() => {
            const name = query.trim();
            setOpen(false);
            onCreate(name);
          }}
        >
          <Plus />
          {query.trim() ? `Crear “${query.trim()}”` : "Crear categoría"}
        </Button>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <>
        <Slot
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
            setOpen(true);
          }}
        >
          {children}
        </Slot>
        <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
          <DrawerContent aria-describedby={undefined} className="pb-safe">
            <div className="flex flex-col gap-3 px-4 pb-6 pt-4">
              <DrawerTitle className="truncate text-sm font-normal text-muted-foreground">
                {title || "Cambiar categoría"}
              </DrawerTitle>
              {body}
            </div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onClick={stop}>
        {children}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="quick-picker w-80 p-3"
        onOpenAutoFocus={(e) => {
          if (options.length > SEARCH_FROM) return;
          e.preventDefault();
          (e.currentTarget as HTMLElement).querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
        }}
      >
        {body}
      </PopoverContent>
    </Popover>
  );
}
