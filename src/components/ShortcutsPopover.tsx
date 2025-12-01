import { useState, useEffect } from "react";
import { Kbd } from "@/components/ui/kbd";
import { 
  Home,
  TrendingUp,
  ArrowLeftRight,
  Tag,
  UsersRound,
  Plus,
  Calculator,
  Zap,
  ArrowLeft,
  ArrowRight,
  Command,
  Lightbulb
} from "lucide-react";
import { cn } from "@/lib/utils";

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
const cmdKey = isMac ? "⌘" : "Ctrl";

interface ShortcutsPopoverProps {
  isVisible: boolean;
  isFirstTime?: boolean;
  onClose?: () => void;
}

const shortcuts = [
  {
    category: "Acciones Rápidas",
    color: "text-blue",
    items: [
      {
        keys: [cmdKey, "C"],
        description: "Nueva transacción",
        icon: Plus,
      },
      {
        keys: [cmdKey, "R"],
        description: "Conciliar balance",
        icon: Calculator,
      },
      {
        keys: [cmdKey, "K"],
        description: "Abrir barra de comandos",
        icon: Command,
      }
    ]
  },
  {
    category: "Navegación",
    color: "text-purple-500",
    items: [
      {
        keys: [cmdKey, "←"],
        description: "Pestaña anterior",
        icon: ArrowLeft,
      },
      {
        keys: [cmdKey, "→"],
        description: "Pestaña siguiente",
        icon: ArrowRight,
      },
    ]
  },
  {
    category: "Ir a Sección",
    icon: Home,
    color: "text-green-500",
    items: [
      {
        keys: [cmdKey, "1"],
        description: "Inicio",
        icon: Home,
      },
      {
        keys: [cmdKey, "2"],
        description: "Análisis",
        icon: TrendingUp,
      },
      {
        keys: [cmdKey, "3"],
        description: "Movimientos",
        icon: ArrowLeftRight,
      },
      {
        keys: [cmdKey, "4"],
        description: "Categorías",
        icon: Tag,
      },
      {
        keys: [cmdKey, "5"],
        description: "Deudas",
        icon: UsersRound,
      },
    ]
  },
];

export function ShortcutsPopover({ isVisible, isFirstTime = false, onClose }: ShortcutsPopoverProps) {
  return (
    <>
      {/* Flecha apuntando arriba - Solo primera vez */}
      {isFirstTime && isVisible && (
        <div
          className="absolute top-8 left-1/2 -translate-x-1/2 animate-pulse"
        >
          <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-b-[10px] border-l-transparent border-r-transparent border-b-primary drop-shadow-lg"></div>
        </div>
      )}

      {/* Popover simple con animación suave */}
      <div
        className={cn(
          "absolute top-full right-0 mt-3 w-80 bg-card/95 backdrop-blur-xl border rounded-xl shadow-2xl overflow-hidden transition-all duration-500 ease-out z-50",
          isVisible 
            ? "opacity-100 translate-y-0 pointer-events-auto animate-in slide-in-from-top-1 fade-in" 
            : "opacity-0 -translate-y-2 pointer-events-none"
        )}
      >
      <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Command className="h-4 w-4" />
            </div>
            <h3 className="font-bold text-sm">Atajos de Teclado</h3>
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
                  return (
                    <div
                      key={itemIdx}
                      className="group flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors cursor-default"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="p-1 rounded bg-muted/50 group-hover:bg-muted transition-colors shrink-0">
                          <ItemIcon className="h-3 w-3 text-muted-foreground" />
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
          <div className="flex items-center gap-2 p-2 bg-gradient-to-r from-primary/5 to-blue/5 rounded-lg">
            <Lightbulb className="h-4 w-4 text-muted-foreground" />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              {isMac 
                ? "Usa Command (⌘) + K para abrir la barra de comandos" 
                : "Usa Ctrl + K para abrir la barra de comandos"}
            </p>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
