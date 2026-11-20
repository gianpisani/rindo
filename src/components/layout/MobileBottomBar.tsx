import { useCallback, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Plus, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useGlobalDrawers } from "@/hooks/useGlobalDrawers";
import { useSoundFX } from "@/hooks/useSoundFX";
import { getMainRoutes, getToolRoutes, type RouteConfig } from "@/lib/routes-config";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer";
import { AccountSection } from "./AccountMenu";

const DRAWER_CLOSE_MS = 300;

function RouteIcon({ route, className }: { route: RouteConfig; className?: string }) {
  const Icon = route.icon;
  return <Icon className={className} />;
}

const rowClass =
  "flex w-full items-center gap-3 px-3 py-2 rounded-card text-left transition-colors";
const rowIconClass =
  "size-8 rounded-full grid place-items-center shrink-0 text-muted-foreground";

export function MobileBottomBar() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const { openQuickAdd } = useGlobalDrawers();
  const { playToggleOn } = useSoundFX();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const closeThen = useCallback((open: () => void) => {
    setDrawerOpen(false);
    setTimeout(open, DRAWER_CLOSE_MS);
  }, []);

  const tabRoutes = getMainRoutes();
  const drawerRoutes = getToolRoutes();

  const handleQuickAdd = useCallback(() => {
    playToggleOn();
    openQuickAdd();
    setDrawerOpen(false);
  }, [playToggleOn, openQuickAdd]);

  if (!isMobile) return null;

  return (
    <>
      <nav
        className="fixed bottom-0 inset-x-0 z-50 md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 4px)" }}
      >
        <div className="mobile-tab-bar">
          {tabRoutes.map((route) => {
            const isActive = location.pathname === route.url;
            return (
              <Link
                key={route.url}
                to={route.url}
                aria-current={isActive ? "page" : undefined}
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
                    "text-xs font-medium transition-all duration-300 mt-0.5",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  {route.title}
                </span>
              </Link>
            );
          })}

          <button
            onClick={() => setDrawerOpen(true)}
            className="mobile-tab-item"
          >
            <div className="mobile-tab-icon-wrap">
              <ChevronUp
                className="h-[22px] w-[22px] text-muted-foreground transition-all duration-300"
              />
            </div>
            <span className="text-xs font-medium text-muted-foreground mt-0.5">
              Más
            </span>
          </button>
        </div>
      </nav>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="mobile-drawer-content">
          <DrawerTitle className="sr-only">Menú</DrawerTitle>

          <div className="px-3 pt-3 pb-2 min-h-0 overflow-y-auto">
            <button onClick={handleQuickAdd} className={rowClass}>
              <div className={rowIconClass}>
                <Plus className="size-4" />
              </div>
              <span className="text-sm font-medium">Agregar movimiento</span>
            </button>

            {drawerRoutes.map((route) => {
              const isActive = location.pathname === route.url;
              return (
                <Link
                  key={route.url}
                  to={route.url}
                  onClick={() => setDrawerOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  className={rowClass}
                >
                  <div className={cn(rowIconClass, isActive && "text-primary")}>
                    <RouteIcon route={route} className="size-4" />
                  </div>
                  <span className={cn("text-sm font-medium", isActive && "text-primary")}>
                    {route.title}
                  </span>
                </Link>
              );
            })}

            <div className="mx-3 my-2 h-px bg-border" />

            <AccountSection onOpen={closeThen} />
          </div>

          <div style={{ height: "env(safe-area-inset-bottom, 8px)", minHeight: 8 }} />
        </DrawerContent>
      </Drawer>
    </>
  );
}
