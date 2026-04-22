import { useState, useCallback, useRef, useEffect, ComponentType } from "react";
import { Reorder } from "framer-motion";
import { Plus, X, RotateCcw, Eye, EyeOff, GripVertical, PanelBottom, ListOrdered } from "lucide-react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavPreferences } from "@/hooks/useNavPreferences";
import { APP_ROUTES, type RouteConfig } from "@/lib/routes-config";
import { useSoundFX } from "@/hooks/useSoundFX";
import { toast } from "sonner";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer";

function RouteIcon({ route, className }: { route: RouteConfig; className?: string }) {
  if (route.customIcon) {
    return <img src={route.icon as string} alt={route.title} className={className} />;
  }
  const Icon = route.icon as LucideIcon | ComponentType<{ className?: string }>;
  return <Icon className={className} />;
}

type Tab = "bar" | "sections";

interface CustomizeNavDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomizeNavDrawer({ open, onOpenChange }: CustomizeNavDrawerProps) {
  const {
    mobileTabs,
    sidebarOrder,
    hiddenRoutes,
    setMobileTabs,
    setSidebarOrder,
    toggleRouteVisibility,
    resetToDefaults,
  } = useNavPreferences();
  const { playSelect, playToggleOn, playToggleOff } = useSoundFX();

  const [activeTab, setActiveTab] = useState<Tab>("bar");
  const [localTabs, setLocalTabs] = useState<string[]>(mobileTabs);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        setLocalTabs(mobileTabs);
        setActiveTab("bar");
      } else {
        setMobileTabs(localTabs);
      }
      onOpenChange(isOpen);
    },
    [mobileTabs, localTabs, setMobileTabs, onOpenChange]
  );

  const availableRoutes = APP_ROUTES.filter((r) => !localTabs.includes(r.url));

  const orderedRoutes: RouteConfig[] = [];
  for (const url of sidebarOrder) {
    const route = APP_ROUTES.find((r) => r.url === url);
    if (route) orderedRoutes.push(route);
  }
  for (const route of APP_ROUTES) {
    if (!sidebarOrder.includes(route.url)) orderedRoutes.push(route);
  }

  const handleAddTab = useCallback(
    (url: string) => {
      if (localTabs.length >= 3) return;
      setLocalTabs((prev) => [...prev, url]);
      playToggleOn();
    },
    [localTabs.length, playToggleOn]
  );

  const handleRemoveTab = useCallback(
    (url: string) => {
      setLocalTabs((prev) => prev.filter((u) => u !== url));
      playToggleOff();
    },
    [playToggleOff]
  );

  const handleReset = useCallback(() => {
    resetToDefaults();
    setLocalTabs(["/", "/transactions", "/overview"]);
    playSelect();
    toast.success("Todo restaurado");
  }, [resetToDefaults, playSelect]);

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="mobile-drawer-content">
        <DrawerTitle className="sr-only">Personalizar navegación</DrawerTitle>

        <div className="px-5 pt-3 pb-1">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold">Personalizar</h3>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs text-muted-foreground active:text-foreground px-2.5 py-1.5 rounded-lg active:bg-muted transition-colors"
            >
              <RotateCcw className="size-3" />
              Resetear
            </button>
          </div>

          {/* Segmented control with sliding pill */}
          <SegmentedControl activeTab={activeTab} onChange={(tab) => { setActiveTab(tab); playSelect(); }} />

          {/* Tab content */}
          {activeTab === "bar" ? (
            <BarTab
              localTabs={localTabs}
              setLocalTabs={setLocalTabs}
              availableRoutes={availableRoutes}
              onAdd={handleAddTab}
              onRemove={handleRemoveTab}
              playSelect={playSelect}
            />
          ) : (
            <SectionsTab
              sidebarOrder={sidebarOrder}
              orderedRoutes={orderedRoutes}
              hiddenRoutes={hiddenRoutes}
              onReorder={(newOrder) => { setSidebarOrder(newOrder); playSelect(); }}
              onToggleVisibility={(url) => {
                const isHidden = hiddenRoutes.includes(url);
                toggleRouteVisibility(url);
                if (isHidden) playToggleOn(); else playToggleOff();
              }}
            />
          )}
        </div>

        <div style={{ height: "env(safe-area-inset-bottom, 8px)", minHeight: 8 }} />
      </DrawerContent>
    </Drawer>
  );
}

// ─── Animated Segmented Control ──────────────────────────────
function SegmentedControl({ activeTab, onChange }: { activeTab: Tab; onChange: (tab: Tab) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLButtonElement>(null);
  const sectionsRef = useRef<HTMLButtonElement>(null);
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const activeRef = activeTab === "bar" ? barRef : sectionsRef;
    const el = activeRef.current;
    const container = containerRef.current;
    if (!el || !container) return;

    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    setPillStyle({
      left: elRect.left - containerRect.left,
      width: elRect.width,
    });
  }, [activeTab]);

  return (
    <div ref={containerRef} className="relative flex bg-muted/50 rounded-lg p-1 mb-4">
      {/* Sliding pill */}
      <div
        className="absolute top-1 bottom-1 bg-background rounded-md shadow-sm transition-all duration-250 ease-out"
        style={{ left: pillStyle.left, width: pillStyle.width }}
      />

      <button
        ref={barRef}
        onClick={() => onChange("bar")}
        className={cn(
          "relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors duration-200",
          activeTab === "bar" ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <PanelBottom className="size-3.5" />
        Barra inferior
      </button>
      <button
        ref={sectionsRef}
        onClick={() => onChange("sections")}
        className={cn(
          "relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors duration-200",
          activeTab === "sections" ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <ListOrdered className="size-3.5" />
        Secciones
      </button>
    </div>
  );
}

// ─── Bar Tab ─────────────────────────────────────────────────
function BarTab({
  localTabs,
  setLocalTabs,
  availableRoutes,
  onAdd,
  onRemove,
  playSelect,
}: {
  localTabs: string[];
  setLocalTabs: (tabs: string[]) => void;
  availableRoutes: RouteConfig[];
  onAdd: (url: string) => void;
  onRemove: (url: string) => void;
  playSelect: () => void;
}) {
  const isFull = localTabs.length >= 3;

  return (
    <div>
      <p className="text-[11px] text-muted-foreground mb-3">
        Elige hasta 3 accesos para tu barra inferior.
      </p>

      {/* Selected slots */}
      <Reorder.Group
        as="div"
        axis="x"
        values={localTabs}
        onReorder={(newOrder) => { setLocalTabs(newOrder); playSelect(); }}
        className="flex gap-2.5 mb-4"
      >
        {localTabs.map((url) => {
          const route = APP_ROUTES.find((r) => r.url === url);
          if (!route) return null;
          return (
            <Reorder.Item
              as="div"
              key={url}
              value={url}
              className="flex-1 relative flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl bg-primary/5 border border-primary/20 cursor-grab active:cursor-grabbing"
              whileDrag={{ scale: 1.04, boxShadow: "0 4px 16px -4px rgba(0,0,0,0.12)" }}
            >
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(url); }}
                className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-destructive/90 text-destructive-foreground flex items-center justify-center shadow-sm"
              >
                <X className="size-3" />
              </button>
              <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <RouteIcon route={route} className="size-4 text-primary" />
              </div>
              <span className="text-[11px] font-medium text-center leading-tight">{route.title}</span>
            </Reorder.Item>
          );
        })}
        {Array.from({ length: 3 - localTabs.length }).map((_, i) => (
          <div key={`empty-${i}`} className="flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 border-dashed border-muted-foreground/15">
            <div className="size-8 rounded-lg bg-muted/20 flex items-center justify-center">
              <Plus className="size-3.5 text-muted-foreground/30" />
            </div>
            <span className="text-[11px] text-muted-foreground/30">Vacío</span>
          </div>
        ))}
      </Reorder.Group>

      {/* Available chips */}
      <div className="flex gap-1.5 flex-wrap">
        {availableRoutes.map((route) => (
          <button
            key={route.url}
            onClick={() => onAdd(route.url)}
            disabled={isFull}
            className={cn(
              "flex items-center gap-1.5 pl-2 pr-1.5 py-1.5 rounded-lg bg-muted/40 active:bg-muted active:scale-[0.97] transition-all",
              isFull && "opacity-30 pointer-events-none"
            )}
          >
            <RouteIcon route={route} className="size-3.5 text-muted-foreground" />
            <span className="text-[11px] font-medium text-foreground/70">{route.title}</span>
            <Plus className="size-3 text-primary/40" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Sections Tab ────────────────────────────────────────────
function SectionsTab({
  sidebarOrder,
  orderedRoutes,
  hiddenRoutes,
  onReorder,
  onToggleVisibility,
}: {
  sidebarOrder: string[];
  orderedRoutes: RouteConfig[];
  hiddenRoutes: string[];
  onReorder: (newOrder: string[]) => void;
  onToggleVisibility: (url: string) => void;
}) {
  // Compute visible index for shortcut numbers
  let visibleIndex = 0;

  return (
    <div>
      <p className="text-[11px] text-muted-foreground mb-3">
        Arrastra para reordenar. El número es tu atajo de teclado.
      </p>

      <Reorder.Group
        as="div"
        axis="y"
        values={sidebarOrder}
        onReorder={onReorder}
        className="space-y-0.5"
      >
        {orderedRoutes.map((route) => {
          const isHidden = hiddenRoutes.includes(route.url);
          const shortcutNum = !isHidden && visibleIndex < 9 ? ++visibleIndex : null;

          return (
            <Reorder.Item
              as="div"
              key={route.url}
              value={route.url}
              className={cn(
                "flex items-center gap-2 pl-1 pr-1 py-1.5 rounded-xl cursor-grab active:cursor-grabbing transition-opacity duration-150",
                isHidden ? "opacity-30" : "opacity-100",
              )}
              whileDrag={{
                scale: 1.02,
                boxShadow: "0 4px 12px -2px rgba(0,0,0,0.1)",
              }}
            >
              <GripVertical className="size-3.5 text-muted-foreground/30 shrink-0" />

              {/* Shortcut number */}
              <div className={cn(
                "size-5 rounded text-[10px] font-mono font-semibold flex items-center justify-center shrink-0 tabular-nums",
                isHidden
                  ? "text-transparent"
                  : shortcutNum
                    ? "text-primary/50 bg-primary/8"
                    : "text-muted-foreground/20"
              )}>
                {shortcutNum ?? "·"}
              </div>

              <div className={cn(
                "size-7 rounded-lg flex items-center justify-center shrink-0",
                isHidden ? "bg-muted/20" : "bg-muted/50"
              )}>
                <RouteIcon
                  route={route}
                  className={cn("size-3.5", isHidden ? "text-muted-foreground/30" : "text-foreground/60")}
                />
              </div>
              <span className={cn(
                "text-[13px] font-medium truncate flex-1",
                isHidden && "text-muted-foreground/40 line-through decoration-muted-foreground/20"
              )}>
                {route.title}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onToggleVisibility(route.url); }}
                className={cn(
                  "size-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                  isHidden
                    ? "text-muted-foreground/25 active:bg-muted/50"
                    : "text-primary/50 active:bg-primary/10"
                )}
              >
                {isHidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </Reorder.Item>
          );
        })}
      </Reorder.Group>
    </div>
  );
}
