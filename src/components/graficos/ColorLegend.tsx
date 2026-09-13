import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
const swatches = [
  "#e11d48",
  "#f59e0b",
  "#10b981",
  "#0ea5e9",
  "#2563eb",
  "#8b5cf6",
  "#ec4899",
  "#64748b",
];
export function ColorLegend({
  items,
  onChange,
  onInspect,
}: {
  items: { key: string; label: string; color: string; ids: string[] }[];
  onChange?: (key: string, color: string) => void;
  onInspect?: (ids: string[], label: string) => void;
}) {
  return (
    <div className="flex max-h-24 shrink-0 flex-wrap justify-center gap-x-3 gap-y-1 overflow-auto py-2">
      {items.map((item) => {
        const label = (
          <>
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: item.color }}
            />
            <span className="max-w-40 truncate">{item.label}</span>
          </>
        );
        return onChange ? (
          <Popover key={item.key}>
            <PopoverTrigger asChild>
              <button
                aria-label={`Color de ${item.label}`}
                title="Cambiar color"
                className="flex items-center gap-1.5 rounded px-1 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {label}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 space-y-3" side="top">
              <p className="text-xs font-medium">Color de {item.label}</p>
              <div className="flex flex-wrap gap-2">
                {swatches.map((color) => (
                  <button
                    key={color}
                    aria-label={`${item.label}: ${color}`}
                    onClick={() => onChange(item.key, color)}
                    className="h-7 w-7 rounded-full border-2 border-transparent focus-visible:ring-2 focus-visible:ring-ring"
                    style={{ background: color }}
                  />
                ))}
              </div>
              <label className="flex items-center justify-between text-xs">
                Personalizado
                <input
                  aria-label={`Color personalizado de ${item.label}`}
                  type="color"
                  value={
                    /^#[0-9a-f]{6}$/i.test(item.color) ? item.color : "#e11d48"
                  }
                  onInput={(e) => onChange(item.key, e.currentTarget.value)}
                  onChange={(e) => onChange(item.key, e.target.value)}
                  className="h-8 w-10 cursor-pointer bg-transparent"
                />
              </label>
            </PopoverContent>
          </Popover>
        ) : (
          <button
            key={item.key}
            className="flex items-center gap-1.5 py-1 text-[11px] text-muted-foreground"
            onClick={() => onInspect?.(item.ids, item.label)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
