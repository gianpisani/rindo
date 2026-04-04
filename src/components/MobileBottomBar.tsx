import { useCallback, useState, ComponentType } from "react";
import { Link, useLocation } from "react-router-dom";
import { Plus, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useGlobalDrawers } from "@/hooks/useGlobalDrawers";
import { useSoundFX } from "@/hooks/useSoundFX";
import { getMainRoutes, getToolRoutes, type RouteConfig } from "@/lib/routes-config";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer";
import { LucideIcon } from "lucide-react";

function RouteIcon({ route, className }: { route: RouteConfig; className?: string }) {
  if (route.customIcon) {
    return <img src={route.icon as string} alt={route.title} className={className} />;
  }
  const Icon = route.icon as LucideIcon | ComponentType<{ className?: string }>;
  return <Icon className={className} />;
}

export function MobileBottomBar() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const { openQuickAdd } = useGlobalDrawers();
  const { playToggleOn } = useSoundFX();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const mainRoutes = getMainRoutes();
  const toolRoutes = getToolRoutes();

  const handleQuickAdd = useCallback(() => {
    playToggleOn();
    openQuickAdd();
    setDrawerOpen(false);
  }, [playToggleOn, openQuickAdd]);

  if (!isMobile) return null;

  return (
    <>
      {/* Bottom Tab Bar */}
      <nav
        className="fixed bottom-0 inset-x-0 z-50 md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mobile-tab-bar">
          {/* Main 4 tabs */}
          {mainRoutes.map((route) => {
            const isActive = location.pathname === route.url;
            return (
              <Link
                key={route.url}
                to={route.url}
                className={cn(
                  "mobile-tab-item",
                  isActive && "mobile-tab-active"
                )}
              >
                <div className={cn(
                  "mobile-tab-icon-wrap",
                  isActive && "mobile-tab-icon-active"
                )}>
                  <RouteIcon
                    route={route}
                    className={cn(
                      "h-[22px] w-[22px] transition-all duration-300",
                      isActive
                        ? "text-primary scale-110"
                        : "text-muted-foreground"
                    )}
                  />
                </div>
                <span
                  className={cn(
                    "text-[10px] font-medium tracking-wide transition-all duration-300 mt-0.5",
                    isActive
                      ? "text-primary opacity-100"
                      : "text-muted-foreground/70 opacity-80"
                  )}
                >
                  {route.title}
                </span>
              </Link>
            );
          })}

          {/* More button - opens drawer */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="mobile-tab-item"
          >
            <div className="mobile-tab-icon-wrap">
              <ChevronUp
                className="h-[22px] w-[22px] text-muted-foreground transition-all duration-300"
              />
            </div>
            <span className="text-[10px] font-medium tracking-wide text-muted-foreground/70 opacity-80 mt-0.5">
              Más
            </span>
          </button>
        </div>
      </nav>

      {/* Swipe-up Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="mobile-drawer-content">
          <DrawerTitle className="sr-only">Menú</DrawerTitle>

          <div className="px-2 pt-4 pb-2">
            {/* Quick Add - Centered hero */}
            <div className="flex flex-col items-center py-4">
              <button
                onClick={handleQuickAdd}
                className="mobile-drawer-quickadd-btn group"
              >
                <div className="mobile-drawer-quickadd-ring">
                  <div className="mobile-drawer-quickadd-icon">
                    <Plus className="h-6 w-6 text-primary-foreground" strokeWidth={2.5} />
                  </div>
                </div>
              </button>
              <span className="text-[13px] font-semibold text-foreground mt-3 tracking-tight">
                Agregar movimiento
              </span>
              <span className="text-[11px] text-muted-foreground/60 mt-0.5">
                Ingreso o gasto rápido
              </span>
            </div>

            {/* Divider */}
            <div className="my-2 mx-6 h-px bg-border/40" />

            {/* Tool routes - Grid layout */}
            <div className="mobile-drawer-grid">
              {toolRoutes.map((route) => {
                const isActive = location.pathname === route.url;
                return (
                  <Link
                    key={route.url}
                    to={route.url}
                    onClick={() => setDrawerOpen(false)}
                    className={cn(
                      "mobile-drawer-item",
                      isActive && "mobile-drawer-item-active"
                    )}
                  >
                    <div className={cn(
                      "mobile-drawer-item-icon",
                      isActive
                        ? "bg-primary/15 text-primary"
                        : "bg-muted/50 text-muted-foreground"
                    )}>
                      <RouteIcon route={route} className="h-5 w-5" />
                    </div>
                    <span className={cn(
                      "text-xs font-medium",
                      isActive ? "text-primary" : "text-foreground/80"
                    )}>
                      {route.title}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Safe area spacer */}
          <div style={{ height: "env(safe-area-inset-bottom, 8px)", minHeight: 8 }} />
        </DrawerContent>
      </Drawer>
    </>
  );
}
