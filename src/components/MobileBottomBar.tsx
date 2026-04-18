import { useCallback, useState, ComponentType } from "react";
import { Link, useLocation } from "react-router-dom";
import { Plus, ChevronUp, UserPen, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useGlobalDrawers } from "@/hooks/useGlobalDrawers";
import { useSoundFX } from "@/hooks/useSoundFX";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useNavPreferences } from "@/hooks/useNavPreferences";
import { APP_ROUTES, type RouteConfig } from "@/lib/routes-config";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { LucideIcon } from "lucide-react";
import { CustomizeNavDrawer } from "./CustomizeNavDrawer";

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
  const { openQuickAdd, openProfileEdit } = useGlobalDrawers();
  const { playToggleOn } = useSoundFX();
  const { profile, avatarUrl } = useUserProfile();
  const { mobileTabs } = useNavPreferences();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  const displayName = profile?.nickname || profile?.full_name || null;
  const userInitials = (displayName || "U").slice(0, 2).toUpperCase();

  // Get mobile tab routes from preferences
  const tabRoutes = mobileTabs
    .map((url) => APP_ROUTES.find((r) => r.url === url))
    .filter(Boolean) as RouteConfig[];

  // Tool routes for the drawer = all routes NOT in mobile tabs
  const drawerRoutes = APP_ROUTES.filter(
    (r) => !mobileTabs.includes(r.url)
  );

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
        style={{ paddingBottom: "env(safe-area-inset-bottom, 4px)" }}
      >
        <div className="mobile-tab-bar">
          {/* Dynamic tabs from preferences */}
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
                    "text-[11px] font-medium tracking-wide transition-all duration-300 mt-0.5",
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
            <span className="text-[11px] font-medium tracking-wide text-muted-foreground mt-0.5">
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
              <span className="text-[11px] text-muted-foreground mt-0.5">
                Ingreso o gasto rápido
              </span>
            </div>

            {/* Divider */}
            <div className="my-2 mx-6 h-px bg-border/40" />

            {/* Routes not in bottom bar */}
            <div className="mobile-drawer-grid">
              {drawerRoutes.map((route) => {
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

            {/* Divider */}
            <div className="my-2 mx-6 h-px bg-border/40" />

            {/* Customize + Profile */}
            <div className="space-y-1">
              {/* Customize bar button */}
              <button
                onClick={() => {
                  setDrawerOpen(false);
                  setTimeout(() => setCustomizeOpen(true), 300);
                }}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl active:bg-muted/50 transition-colors"
              >
                <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="size-4 text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium">Personalizar barra</p>
                  <p className="text-[11px] text-muted-foreground">Elige tus accesos rápidos</p>
                </div>
              </button>

              {/* Profile */}
              <button
                onClick={() => {
                  setDrawerOpen(false);
                  openProfileEdit();
                }}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl active:bg-muted/50 transition-colors"
              >
                <Avatar className="size-9 ring-1 ring-border/50">
                  {avatarUrl && <AvatarImage src={avatarUrl} className="object-cover" />}
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium">{displayName || "Mi perfil"}</p>
                  <p className="text-[11px] text-muted-foreground">Editar perfil y tema</p>
                </div>
                <UserPen className="size-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Safe area spacer */}
          <div style={{ height: "env(safe-area-inset-bottom, 8px)", minHeight: 8 }} />
        </DrawerContent>
      </Drawer>

      {/* Customize Nav Drawer */}
      <CustomizeNavDrawer
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
      />
    </>
  );
}
