import { useState, useCallback, ComponentType } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { Plus, X, RotateCcw, Sparkles, Eye, EyeOff, GripVertical } from "lucide-react";
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

  // Local state for mobile tabs (commit on close)
  const [localTabs, setLocalTabs] = useState<string[]>(mobileTabs);

  // Sync local state when drawer opens
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        setLocalTabs(mobileTabs);
      } else {
        setMobileTabs(localTabs);
      }
      onOpenChange(isOpen);
    },
    [mobileTabs, localTabs, setMobileTabs, onOpenChange]
  );

  const availableRoutes = APP_ROUTES.filter(
    (r) => !localTabs.includes(r.url)
  );

  // Ordered routes for the sections list
  const orderedRoutes = sidebarOrder
    .map((url) => APP_ROUTES.find((r) => r.url === url))
    .filter(Boolean) as RouteConfig[];
  // Add any routes not yet in order
  for (const route of APP_ROUTES) {
    if (!sidebarOrder.includes(route.url)) {
      orderedRoutes.push(route);
    }
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

  const handleReorderSections = useCallback(
    (newOrder: string[]) => {
      setSidebarOrder(newOrder);
      playSelect();
    },
    [setSidebarOrder, playSelect]
  );

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="mobile-drawer-content max-h-[85vh]">
        <DrawerTitle className="sr-only">Personalizar navegación</DrawerTitle>

        <div className="px-4 pt-4 pb-2 overflow-y-auto" data-scrollable>
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Sparkles className="size-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Personalizar</h3>
                <p className="text-[11px] text-muted-foreground">Tu app, tu orden</p>
              </div>
            </div>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg hover:bg-muted/50 active:bg-muted transition-colors"
            >
              <RotateCcw className="size-3" />
              Reset
            </button>
          </div>

          {/* ═══════════════ SECTION 1: Mobile bottom bar ═══════════════ */}
          <div className="mb-5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 px-1">
              Barra inferior ({localTabs.length}/3)
            </p>

            {/* Selected tabs - reorderable */}
            <Reorder.Group
              as="div"
              axis="x"
              values={localTabs}
              onReorder={(newOrder) => {
                setLocalTabs(newOrder);
                playSelect();
              }}
              className="flex gap-2 mb-3"
            >
              {localTabs.map((url) => {
                const route = APP_ROUTES.find((r) => r.url === url);
                if (!route) return null;
                return (
                  <Reorder.Item
                    as="div"
                    key={url}
                    value={url}
                    className="flex-1"
                  >
                    <motion.div
                      layout
                      className="relative flex flex-col items-center gap-1.5 p-3 rounded-xl bg-primary/5 border border-primary/20 cursor-grab active:cursor-grabbing"
                      whileDrag={{ scale: 1.05, boxShadow: "0 8px 25px -5px rgba(0,0,0,0.15)" }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveTab(url);
                        }}
                        className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-destructive/90 text-destructive-foreground flex items-center justify-center shadow-sm"
                      >
                        <X className="size-3" />
                      </button>
                      <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <RouteIcon route={route} className="size-5 text-primary" />
                      </div>
                      <span className="text-[11px] font-medium text-center leading-tight">
                        {route.title}
                      </span>
                    </motion.div>
                  </Reorder.Item>
                );
              })}

              {/* Empty slots */}
              {Array.from({ length: 3 - localTabs.length }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 border-dashed border-muted-foreground/20"
                >
                  <div className="size-9 rounded-lg bg-muted/30 flex items-center justify-center">
                    <Plus className="size-4 text-muted-foreground/40" />
                  </div>
                  <span className="text-[11px] text-muted-foreground/40">Vacío</span>
                </div>
              ))}
            </Reorder.Group>

            {/* Available to add */}
            {localTabs.length < 3 && (
              <div className="flex gap-1.5 flex-wrap">
                <AnimatePresence mode="popLayout">
                  {availableRoutes.map((route) => (
                    <motion.button
                      key={route.url}
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.15 }}
                      onClick={() => handleAddTab(route.url)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/40 active:bg-muted active:scale-95 transition-all"
                    >
                      <RouteIcon route={route} className="size-3.5 text-muted-foreground" />
                      <span className="text-[11px] font-medium text-foreground/70">{route.title}</span>
                      <Plus className="size-3 text-muted-foreground/50" />
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="my-4 mx-2 h-px bg-border/40" />

          {/* ═══════════════ SECTION 2: All sections order + visibility ═══════════════ */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 px-1">
              Secciones y orden
            </p>
            <p className="text-[11px] text-muted-foreground mb-3 px-1">
              Arrastra para reordenar. Oculta las que no uses.
            </p>

            <Reorder.Group
              as="div"
              axis="y"
              values={sidebarOrder}
              onReorder={handleReorderSections}
              className="space-y-1"
            >
              {orderedRoutes.map((route) => {
                const isHidden = hiddenRoutes.includes(route.url);
                return (
                  <Reorder.Item
                    as="div"
                    key={route.url}
                    value={route.url}
                  >
                    <motion.div
                      layout
                      className={cn(
                        "flex items-center gap-2 px-2 py-2 rounded-xl cursor-grab active:cursor-grabbing transition-colors",
                        isHidden ? "opacity-40" : "opacity-100",
                      )}
                      whileDrag={{
                        scale: 1.02,
                        boxShadow: "0 8px 25px -5px rgba(0,0,0,0.12)",
                        backgroundColor: "hsl(var(--sidebar-accent))",
                      }}
                    >
                      {/* Drag handle */}
                      <GripVertical className="size-4 text-muted-foreground/40 shrink-0" />

                      {/* Icon + name */}
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className={cn(
                          "size-8 rounded-lg flex items-center justify-center shrink-0",
                          isHidden ? "bg-muted/30" : "bg-muted/50"
                        )}>
                          <RouteIcon
                            route={route}
                            className={cn(
                              "size-4",
                              isHidden ? "text-muted-foreground/40" : "text-foreground/70"
                            )}
                          />
                        </div>
                        <span className={cn(
                          "text-sm font-medium truncate",
                          isHidden && "text-muted-foreground/50 line-through decoration-muted-foreground/30"
                        )}>
                          {route.title}
                        </span>
                      </div>

                      {/* Visibility toggle */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRouteVisibility(route.url);
                          if (isHidden) playToggleOn(); else playToggleOff();
                        }}
                        className={cn(
                          "size-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                          isHidden
                            ? "text-muted-foreground/30 active:bg-primary/10"
                            : "text-primary/60 active:bg-primary/10"
                        )}
                      >
                        {isHidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </motion.div>
                  </Reorder.Item>
                );
              })}
            </Reorder.Group>
          </div>
        </div>

        {/* Safe area spacer */}
        <div style={{ height: "env(safe-area-inset-bottom, 8px)", minHeight: 8 }} />
      </DrawerContent>
    </Drawer>
  );
}
