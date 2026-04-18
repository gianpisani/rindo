import { useState, useCallback, ComponentType } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { Check, Plus, X, RotateCcw, Sparkles } from "lucide-react";
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
    setMobileTabs,
    resetToDefaults,
  } = useNavPreferences();
  const { playSelect, playToggleOn, playToggleOff } = useSoundFX();

  // Local state for editing (commit on close)
  const [localTabs, setLocalTabs] = useState<string[]>(mobileTabs);

  // Sync local state when drawer opens
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        setLocalTabs(mobileTabs);
      } else {
        // Commit changes
        setMobileTabs(localTabs);
      }
      onOpenChange(isOpen);
    },
    [mobileTabs, localTabs, setMobileTabs, onOpenChange]
  );

  const selectedRoutes = localTabs
    .map((url) => APP_ROUTES.find((r) => r.url === url))
    .filter(Boolean) as RouteConfig[];

  const availableRoutes = APP_ROUTES.filter(
    (r) => !localTabs.includes(r.url)
  );

  const handleAdd = useCallback(
    (url: string) => {
      if (localTabs.length >= 3) return;
      setLocalTabs((prev) => [...prev, url]);
      playToggleOn();
    },
    [localTabs.length, playToggleOn]
  );

  const handleRemove = useCallback(
    (url: string) => {
      setLocalTabs((prev) => prev.filter((u) => u !== url));
      playToggleOff();
    },
    [playToggleOff]
  );

  const handleReset = useCallback(() => {
    setLocalTabs(["/", "/transactions", "/overview"]);
    playSelect();
    toast.success("Barra restaurada");
  }, [playSelect]);

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="mobile-drawer-content">
        <DrawerTitle className="sr-only">Personalizar barra</DrawerTitle>

        <div className="px-4 pt-4 pb-2">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Sparkles className="size-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Personalizar barra</h3>
                <p className="text-[11px] text-muted-foreground">Elige 3 accesos rápidos</p>
              </div>
            </div>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted/50 transition-colors"
            >
              <RotateCcw className="size-3" />
              Reset
            </button>
          </div>

          {/* Selected tabs - reorderable */}
          <div className="mb-4">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">
              Tu barra ({localTabs.length}/3)
            </p>
            <Reorder.Group
              as="div"
              axis="x"
              values={localTabs}
              onReorder={(newOrder) => {
                setLocalTabs(newOrder);
                playSelect();
              }}
              className="flex gap-2"
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
                          handleRemove(url);
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
          </div>

          {/* Divider */}
          <div className="my-3 mx-2 h-px bg-border/40" />

          {/* Available routes */}
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">
              Disponibles
            </p>
            <div className="grid grid-cols-4 gap-2">
              <AnimatePresence mode="popLayout">
                {availableRoutes.map((route) => {
                  const isDisabled = localTabs.length >= 3;
                  return (
                    <motion.button
                      key={route.url}
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.2 }}
                      onClick={() => handleAdd(route.url)}
                      disabled={isDisabled}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-colors",
                        isDisabled
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:bg-muted/50 active:bg-muted active:scale-95"
                      )}
                    >
                      <div className={cn(
                        "size-9 rounded-lg flex items-center justify-center",
                        isDisabled ? "bg-muted/30" : "bg-muted/50"
                      )}>
                        <RouteIcon
                          route={route}
                          className="size-5 text-muted-foreground"
                        />
                      </div>
                      <span className="text-[11px] font-medium text-foreground/80 text-center leading-tight">
                        {route.title}
                      </span>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Safe area spacer */}
        <div style={{ height: "env(safe-area-inset-bottom, 8px)", minHeight: 8 }} />
      </DrawerContent>
    </Drawer>
  );
}
