import { useCallback, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Plus,
  ChevronUp,
  UserPen,
  LogOut,
  CalendarRange,
  Bell,
  BellOff,
  Volume2,
  VolumeOff,
} from "lucide-react";
import { usePeriodConfig } from "@/hooks/usePeriodConfig";
import { periodShortLabel } from "@/lib/period";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useGlobalDrawers } from "@/hooks/useGlobalDrawers";
import { useSoundFX } from "@/hooks/useSoundFX";
import { useSoundPreferences } from "@/hooks/useSoundPreferences";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useSignOut } from "@/hooks/useAccount";
import { getMainRoutes, getToolRoutes, type RouteConfig } from "@/lib/routes-config";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

function RouteIcon({ route, className }: { route: RouteConfig; className?: string }) {
  const Icon = route.icon;
  return <Icon className={className} />;
}

// Todas las filas de la hoja "Más" se ven igual: ícono chico + texto.
const rowClass =
  "flex w-full items-center gap-3 px-3 py-2 rounded-card text-left transition-colors";
const rowIconClass =
  "size-8 rounded-full grid place-items-center shrink-0 text-muted-foreground";

export function MobileBottomBar() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const { openQuickAdd, openProfileEdit, openPeriodSettings } = useGlobalDrawers();
  const { startDay } = usePeriodConfig();
  const { playToggleOn, playToggleOff } = useSoundFX();
  const { soundEnabled, toggleSound } = useSoundPreferences();
  const {
    isSupported: pushSupported,
    isSubscribed: pushSubscribed,
    isLoading: pushLoading,
    subscribe: pushSubscribe,
    unsubscribe: pushUnsubscribe,
  } = usePushNotifications();
  const { profile, avatarUrl } = useUserProfile();
  const signOut = useSignOut();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const displayName = profile?.nickname || profile?.full_name || null;
  const userInitials = (displayName || "U").slice(0, 2).toUpperCase();

  // Menú fijo: las rutas principales van en la barra, las herramientas en el drawer
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
      {/* Bottom Tab Bar */}
      <nav
        className="fixed bottom-0 inset-x-0 z-50 md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 4px)" }}
      >
        <div className="mobile-tab-bar">
          {/* Fixed tabs */}
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
            <span className="text-xs font-medium text-muted-foreground mt-0.5">
              Más
            </span>
          </button>
        </div>
      </nav>

      {/* Swipe-up Drawer */}
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

            {/* Routes not in bottom bar */}
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

            <div className="my-2 mx-3 h-px" />

            <button
              onClick={() => {
                setDrawerOpen(false);
                setTimeout(() => openPeriodSettings(), 300);
              }}
              className={rowClass}
            >
              <div className={rowIconClass}>
                <CalendarRange className="size-4" />
              </div>
              <span className="flex-1 text-sm font-medium">Mes financiero</span>
              <span className="text-xs text-muted-foreground">{periodShortLabel(startDay)}</span>
            </button>

            {pushSupported && (
              <button
                onClick={() => {
                  if (pushSubscribed) pushUnsubscribe(); else pushSubscribe();
                }}
                disabled={pushLoading}
                className={cn(rowClass, "disabled:opacity-60")}
              >
                <div className={rowIconClass}>
                  {pushSubscribed ? <Bell className="size-4" /> : <BellOff className="size-4" />}
                </div>
                <span className="flex-1 text-sm font-medium">Notificaciones</span>
                <span className="text-xs text-muted-foreground">
                  {pushLoading ? "..." : pushSubscribed ? "Activadas" : "Desactivadas"}
                </span>
              </button>
            )}

            <button
              onClick={() => {
                toggleSound();
                if (soundEnabled) playToggleOff(); else playToggleOn();
              }}
              className={rowClass}
            >
              <div className={rowIconClass}>
                {soundEnabled ? <Volume2 className="size-4" /> : <VolumeOff className="size-4" />}
              </div>
              <span className="flex-1 text-sm font-medium">Sonidos</span>
              <span className="text-xs text-muted-foreground">
                {soundEnabled ? "Activados" : "Desactivados"}
              </span>
            </button>

            <div className="my-2 mx-3 h-px" />

            {/* Profile + Logout */}
            <div className="flex items-center gap-2">
              {/* Profile */}
              <button
                onClick={() => {
                  setDrawerOpen(false);
                  openProfileEdit();
                }}
                className={cn(rowClass, "min-w-0")}
              >
                <Avatar className="size-8 ring-1 shrink-0">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt="" className="object-cover" />}
                  <AvatarFallback className="text-xs font-medium">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{displayName || "Mi perfil"}</p>
                  <p className="text-xs text-muted-foreground">Editar perfil</p>
                </div>
                <UserPen className="size-4 text-muted-foreground shrink-0" />
              </button>

              {/* Logout button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setDrawerOpen(false);
                  signOut.mutate();
                }}
                aria-label="Cerrar sesión"
                className="size-11 shrink-0 active:bg-destructive/10"
              >
                <LogOut className="text-muted-foreground" />
              </Button>
            </div>
          </div>

          {/* Safe area spacer */}
          <div style={{ height: "env(safe-area-inset-bottom, 8px)", minHeight: 8 }} />
        </DrawerContent>
      </Drawer>
    </>
  );
}
