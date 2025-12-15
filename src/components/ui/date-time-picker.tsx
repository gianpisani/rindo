"use client";

import * as React from "react";
import { CalendarIcon, Clock } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DateTimePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  showTime?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DateTimePicker({
  value,
  onChange,
  showTime = true,
  placeholder = "Seleccionar fecha",
  className,
  disabled = false,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [internalDate, setInternalDate] = React.useState<Date | undefined>(value);
  const [time, setTime] = React.useState(() => {
    if (value) {
      return format(value, "HH:mm");
    }
    return format(new Date(), "HH:mm");
  });

  React.useEffect(() => {
    setInternalDate(value);
    if (value) {
      setTime(format(value, "HH:mm"));
    }
  }, [value]);

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      const [hours, minutes] = time.split(":").map(Number);
      selectedDate.setHours(hours || 0, minutes || 0, 0, 0);
      setInternalDate(selectedDate);
      onChange?.(selectedDate);
      if (!showTime) {
        setOpen(false);
      }
    }
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    setTime(newTime);
    
    if (internalDate && newTime) {
      const [hours, minutes] = newTime.split(":").map(Number);
      const newDate = new Date(internalDate);
      newDate.setHours(hours || 0, minutes || 0, 0, 0);
      setInternalDate(newDate);
      onChange?.(newDate);
    }
  };

  const handleApply = () => {
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "justify-start text-left font-normal",
            !internalDate && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
          {internalDate ? (
            <span>
              {format(internalDate, showTime ? "dd MMM yyyy, HH:mm" : "dd MMM yyyy", { locale: es })}
            </span>
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col">
          <Calendar
            mode="single"
            selected={internalDate}
            onSelect={handleDateSelect}
            locale={es}
            initialFocus
            className="rounded-t-md border-b"
          />
          {showTime && (
            <div className="p-3 border-t bg-muted/30">
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={time}
                  onChange={handleTimeChange}
                  className="w-auto bg-background"
                />
                <Button size="sm" onClick={handleApply} className="ml-auto">
                  Aplicar
                </Button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Versión compacta para tablas
interface InlineDateTimePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  showTime?: boolean;
  disabled?: boolean;
}

export function InlineDateTimePicker({
  value,
  onChange,
  showTime = true,
  disabled = false,
}: InlineDateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [internalDate, setInternalDate] = React.useState<Date>(value);
  const [time, setTime] = React.useState(format(value, "HH:mm"));

  React.useEffect(() => {
    setInternalDate(value);
    setTime(format(value, "HH:mm"));
  }, [value]);

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      const [hours, minutes] = time.split(":").map(Number);
      selectedDate.setHours(hours || 0, minutes || 0, 0, 0);
      setInternalDate(selectedDate);
    }
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    setTime(newTime);
    
    if (internalDate && newTime) {
      const [hours, minutes] = newTime.split(":").map(Number);
      const newDate = new Date(internalDate);
      newDate.setHours(hours || 0, minutes || 0, 0, 0);
      setInternalDate(newDate);
    }
  };

  const handleApply = () => {
    onChange(internalDate);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setInternalDate(value);
      setTime(format(value, "HH:mm"));
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={disabled}
          className={cn(
            "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-sm font-medium",
            "hover:bg-muted/80 transition-colors cursor-pointer",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
            "group"
          )}
        >
          <span>{format(value, "dd MMM yyyy", { locale: es })}</span>
          {showTime && (
            <span className="text-muted-foreground text-xs">
              {format(value, "HH:mm")}
            </span>
          )}
          <CalendarIcon className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-0" 
        align="start"
        onKeyDown={handleKeyDown}
      >
        <div className="flex flex-col">
          <Calendar
            mode="single"
            selected={internalDate}
            onSelect={handleDateSelect}
            locale={es}
            initialFocus
            className="rounded-t-md"
          />
          {showTime && (
            <div className="p-3 border-t bg-muted/30">
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={time}
                  onChange={handleTimeChange}
                  className="w-auto bg-background"
                />
                <Button size="sm" onClick={handleApply} className="ml-auto">
                  Aplicar
                </Button>
              </div>
            </div>
          )}
          {!showTime && (
            <div className="p-2 border-t">
              <Button size="sm" onClick={handleApply} className="w-full">
                Aplicar
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

