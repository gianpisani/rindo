import { useMemo } from "react";
import { Kbd } from "@/components/ui/kbd";
import {
  Plus,
  Calculator,
  ArrowUp,
  ArrowDown,
  Command,
  Home,
  Lightbulb,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_ROUTES } from "@/lib/routes-config";

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
const cmdKey = isMac ? "⌘" : "Ctrl";

interface ShortcutsPopoverProps {
  isVisible: boolean;
  onClose?: () => void;
}

const useShortcuts = () => {
  return useMemo(() => [
    {
      category: "Acciones Rápidas",
      color: "text-primary",
      items: [
        {
          keys: [cmdKey, "K"],
          description: "Paleta de comandos",
          icon: Command,
        },
        {
          keys: ["N"],
          description: "Nueva transacción",
          icon: Plus,
        },
        {
          keys: ["R"],
          description: "Conciliar balance",
          icon: Calculator,
        },
        {
          keys: ["P"],
          description: "Toggle privacidad",
          icon: EyeOff,
        },
      ]
    },
    {
      category: "Navegación",
      color: "text-primary",
      items: [
        {
          keys: ["↑"],
          description: "Pestaña anterior",
          icon: ArrowUp,
        },
        {
          keys: ["↓"],
          description: "Pestaña siguiente",
          icon: ArrowDown,
        },
      ]
    },
    {
      category: "Ir a Sección",
      icon: Home,
      color: "text-primary",
      items: APP_ROUTES.filter(route => route.shortcut).map(route => ({
        keys: [route.shortcut!],
        description: route.title,
        icon: route.icon,
      }))
    },
  ], []);
};

export function ShortcutsPopover({ isVisible, onClose }: ShortcutsPopoverProps) {
  const shortcuts = useShortcuts();
  return (
    <div
      className={cn(
        "absolute top-full right-0 mt-3 w-80 bg-card/95 backdrop-blur-xl border rounded-xl shadow-2xl overflow-hidden transition-all duration-500 ease-out z-50",
        isVisible
          ? "opacity-100 translate-y-0 pointer-events-auto animate-in slide-in-from-top-1 fade-in"
          : "opacity-0 -translate-y-2 pointer-events-none"
      )}
    >
      <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto bg-background">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Command className="h-4 w-4" />
            </div>
            <h3 className="font-bold text-sm">Atajos del teclado</h3>
          </div>
        </div>

        {shortcuts.map((section, idx) => {
          return (
            <div key={idx} className="space-y-2">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {section.category}
                </h4>
              </div>
              <div className="space-y-1">
                {section.items.map((item, itemIdx) => {
                  const ItemIcon = item.icon;
                  const isCustomIcon = typeof ItemIcon === 'string';
                  return (
                    <div
                      key={itemIdx}
                      className="group flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors cursor-default"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="p-1 rounded bg-muted/50 group-hover:bg-muted transition-colors shrink-0">
                          {isCustomIcon ? (
                            <img src={ItemIcon} alt="" className="h-3 w-3" />
                          ) : (
                            <ItemIcon className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                        <span className="text-xs font-medium truncate">{item.description}</span>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {item.keys.map((key, keyIdx) => (
                          <Kbd key={keyIdx} className="text-[10px] px-1.5 py-0.5">
                            {key}
                          </Kbd>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="pt-3 border-t border-border">
          <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-lg">
            <Lightbulb className="h-4 w-4 text-muted-foreground" />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Presiona <Kbd className="text-[9px] px-1 py-0">?</Kbd> para mostrar/ocultar este panel
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
