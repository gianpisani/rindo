import * as React from "react";
import { CalendarRange, X } from "lucide-react";
import { DateRange } from "react-day-picker";
import {
  format,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  subDays,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface DateRangeValue {
  from?: Date;
  to?: Date;
}

interface Preset {
  label: string;
  getRange: () => DateRangeValue;
}

const PRESETS: Preset[] = [
  { label: "Hoy", getRange: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  {
    label: "Ayer",
    getRange: () => ({ from: startOfDay(subDays(new Date(), 1)), to: endOfDay(subDays(new Date(), 1)) }),
  },
  {
    label: "Últimos 7 días",
    getRange: () => ({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) }),
  },
  {
    label: "Últimos 30 días",
    getRange: () => ({ from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) }),
  },
  {
    label: "Esta semana",
    getRange: () => ({
      from: startOfWeek(new Date(), { weekStartsOn: 1 }),
      to: endOfWeek(new Date(), { weekStartsOn: 1 }),
    }),
  },
  { label: "Este mes", getRange: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  {
    label: "Mes pasado",
    getRange: () => ({
      from: startOfMonth(subMonths(new Date(), 1)),
      to: endOfMonth(subMonths(new Date(), 1)),
    }),
  },
];

function formatRangeLabel(value: DateRangeValue): string {
  if (!value.from && !value.to) return "Fecha";
  if (value.from && value.to) {
    if (value.from.toDateString() === value.to.toDateString()) {
      return format(value.from, "dd MMM yyyy", { locale: es });
    }
    return `${format(value.from, "dd MMM", { locale: es })} – ${format(value.to, "dd MMM yyyy", { locale: es })}`;
  }
  if (value.from) return `Desde ${format(value.from, "dd MMM yyyy", { locale: es })}`;
  return `Hasta ${format(value.to!, "dd MMM yyyy", { locale: es })}`;
}

interface DateRangeFilterProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  className?: string;
}

export function DateRangeFilter({ value, onChange, className }: DateRangeFilterProps) {
  const [open, setOpen] = React.useState(false);
  const hasValue = Boolean(value.from || value.to);

  const calendarRange: DateRange | undefined = value.from || value.to
    ? { from: value.from, to: value.to }
    : undefined;

  const handleSelect = (range: DateRange | undefined) => {
    onChange({
      from: range?.from ? startOfDay(range.from) : undefined,
      to: range?.to ? endOfDay(range.to) : undefined,
    });
  };

  const handlePreset = (preset: Preset) => {
    onChange(preset.getRange());
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({});
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-10 gap-2 justify-start font-normal w-[160px] sm:w-[200px]",
            !hasValue && "text-muted-foreground",
            className
          )}
        >
          <CalendarRange className="h-4 w-4 shrink-0" />
          <span className="truncate">{formatRangeLabel(value)}</span>
          {hasValue && (
            <span
              role="button"
              onClick={handleClear}
              className="ml-auto shrink-0 rounded-sm p-0.5 hover:bg-muted-foreground/20"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col sm:flex-row">
          <div className="flex flex-col gap-0.5 border-b sm:border-b-0 sm:border-r p-2 sm:w-40">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handlePreset(preset)}
                className="text-left text-sm px-2 py-1.5 rounded-md hover:bg-muted transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="flex flex-col">
            <Calendar
              mode="range"
              selected={calendarRange}
              onSelect={handleSelect}
              locale={es}
              initialFocus
              numberOfMonths={1}
            />
            <div className="flex items-center justify-between p-2 border-t">
              <Button variant="ghost" size="sm" onClick={handleClear} disabled={!hasValue}>
                Limpiar
              </Button>
              <Button size="sm" onClick={() => setOpen(false)}>
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
