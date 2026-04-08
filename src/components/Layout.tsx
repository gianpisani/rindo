import { ReactNode, useCallback, useEffect, useState } from "react";
import { CommandBar } from "./CommandBar";
import { QuickAddDrawer } from "./QuickAddDrawer";
import { ReconciliationDrawer } from "./ReconciliationDrawer";
import { WhisperInput } from "./WhisperInput";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "./ui/button";
import { Bell, BellOff, Eye, EyeOff, Keyboard, Volume2, VolumeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { useGlobalDrawers } from "@/hooks/useGlobalDrawers";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useAtmosphere } from "@/hooks/useAtmosphere";
import { useSoundPreferences } from "@/hooks/useSoundPreferences";
import { useSoundFX } from "@/hooks/useSoundFX";
import { initSounds } from "@/lib/snd";
import { ShortcutsPopover } from "@/components/ShortcutsPopover";
import { RindoLogo } from "./RindoLogo";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { MobileBottomBar } from "./MobileBottomBar";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { isPrivacyMode, togglePrivacyMode } = usePrivacyMode();
  const { soundEnabled, toggleSound } = useSoundPreferences();
  const { playToggleOn, playToggleOff } = useSoundFX();
  const {
    quickAddOpen,
    setQuickAddOpen,
    quickAddDefaultType,
    reconciliationOpen,
    setReconciliationOpen,
    openQuickAdd,
    openReconciliation,
  } = useGlobalDrawers();

  const { isSupported: pushSupported, isSubscribed: pushSubscribed, isLoading: pushLoading, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushNotifications();
  const isMobile = useIsMobile();
  const [commandBarOpen, setCommandBarOpen] = useState(false);
  const [showShortcutsPopover, setShowShortcutsPopover] = useState(false);
  const [whisperOpen, setWhisperOpen] = useState(false);
  // Initialize sound system once
  useEffect(() => {
    initSounds().catch(() => {});
  }, []);

  // Atmospheric UI - subliminal mood system
  const atmosphere = useAtmosphere();

  const toggleCommandBar = useCallback(() => {
    setCommandBarOpen((prev) => !prev);
  }, []);

  const toggleShortcutsPopover = useCallback(() => {
    setShowShortcutsPopover((prev) => !prev);
  }, []);

  const toggleWhisper = useCallback(() => {
    setWhisperOpen((prev) => !prev);
  }, []);

  // Register all keyboard shortcuts
  useKeyboardShortcuts({
    onToggleCommandBar: toggleCommandBar,
    onToggleShortcutsPopover: toggleShortcutsPopover,
    onToggleWhisper: toggleWhisper,
  });

  // Close popover when clicking outside
  useEffect(() => {
    if (!showShortcutsPopover) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest("[data-shortcuts-popover]") ||
        target.closest("[data-shortcuts-trigger]")
      ) {
        return;
      }
      setShowShortcutsPopover(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showShortcutsPopover]);

  // Prevent zoom on iOS with double-tap and optimize scroll
  useEffect(() => {
    let lastTouchEnd = 0;
    const preventZoom = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };

    document.addEventListener("touchend", preventZoom, { passive: false });

    const preventPullToRefresh = (e: TouchEvent) => {
      const element = e.target as HTMLElement;
      const scrollable = element.closest("[data-scrollable]");

      if (!scrollable && window.scrollY === 0) {
        e.preventDefault();
      }
    };

    document.addEventListener("touchmove", preventPullToRefresh, {
      passive: false,
    });

    return () => {
      document.removeEventListener("touchend", preventZoom);
      document.removeEventListener("touchmove", preventPullToRefresh);
    };
  }, []);

  return (
    <TooltipProvider delayDuration={300}>
      <SidebarProvider>
        {/* Command Bar - Global (controlled) */}
        <CommandBar
          open={commandBarOpen}
          onOpenChange={setCommandBarOpen}
          onAddTransaction={() => openQuickAdd()}
          onConciliate={() => openReconciliation()}
        />

        {/* Quick Add Drawer - Global */}
        <QuickAddDrawer
          open={quickAddOpen}
          onOpenChange={(open) => {
            if (open) playToggleOn(); else playToggleOff();
            setQuickAddOpen(open);
          }}
          defaultType={quickAddDefaultType}
        />

        {/* Reconciliation Drawer - Global */}
        <ReconciliationDrawer
          open={reconciliationOpen}
          onOpenChange={(open) => {
            if (open) playToggleOn(); else playToggleOff();
            setReconciliationOpen(open);
          }}
        />

        {/* Whisper Mode - Ultra-minimal transaction input */}
        <WhisperInput
          open={whisperOpen}
          onOpenChange={(open) => {
            if (open) playToggleOn(); else playToggleOff();
            setWhisperOpen(open);
          }}
        />

        {/* Desktop Sidebar */}
        <AppSidebar />

        <SidebarInset>
          {/* Atmospheric glow - subliminal mood indicator */}
          <div className="atmospheric-glow active" />

          {/* Top Bar with Trigger and Actions */}
          <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
            {!isMobile && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarTrigger className="-ml-1" />
                </TooltipTrigger>
                <TooltipContent side="right">Toggle sidebar</TooltipContent>
              </Tooltip>
            )}
            <div className="flex flex-1 items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight">
                  rindo<span className="text-primary">.</span>
                </span>
              </div>
              <div className="flex items-center gap-3">
                {pushSupported && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => {
                          if (pushSubscribed) pushUnsubscribe(); else pushSubscribe();
                        }}
                        disabled={pushLoading}
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "rounded-full h-8 w-8 p-0 transition-all duration-200",
                          pushSubscribed
                            ? "bg-primary/20 text-primary hover:bg-primary/30"
                            : "bg-muted/10 text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        {pushSubscribed ? (
                          <Bell className="h-4 w-4" />
                        ) : (
                          <BellOff className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {pushSubscribed
                        ? "Desactivar notificaciones"
                        : "Activar notificaciones"}
                    </TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => {
                        toggleSound();
                        if (soundEnabled) playToggleOff(); else playToggleOn();
                      }}
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "rounded-full h-8 w-8 p-0 transition-all duration-200",
                        soundEnabled
                          ? "bg-muted/10 text-muted-foreground hover:bg-muted hover:text-foreground"
                          : "bg-primary/20 text-primary hover:bg-primary/30"
                      )}
                    >
                      {soundEnabled ? (
                        <Volume2 className="h-4 w-4" />
                      ) : (
                        <VolumeOff className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {soundEnabled
                      ? "Desactivar sonidos"
                      : "Activar sonidos"}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={togglePrivacyMode}
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "rounded-full h-8 w-8 p-0 transition-all duration-200",
                        isPrivacyMode
                          ? "bg-primary/20 text-primary hover:bg-primary/30"
                          : "bg-muted/10 text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {isPrivacyMode ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isPrivacyMode
                      ? "Desactivar modo privado (P)"
                      : "Activar modo privado (P)"}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative cursor-default">
                      <div
                        className="h-2.5 w-2.5 rounded-full transition-all duration-[3s] ease-in-out ring-2 ring-background"
                        style={{
                          backgroundColor: `hsl(${Math.round(atmosphere.mood * 120)}, ${Math.round(40 + atmosphere.mood * 30)}%, ${Math.round(45 + atmosphere.mood * 15)}%)`,
                        }}
                      />
                      <div
                        className="absolute inset-0 rounded-full animate-ping"
                        style={{
                          backgroundColor: `hsl(${Math.round(atmosphere.mood * 120)}, ${Math.round(40 + atmosphere.mood * 30)}%, ${Math.round(45 + atmosphere.mood * 15)}%)`,
                          opacity: 0.2,
                          animationDuration: '3s',
                        }}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[260px] p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{
                          backgroundColor: `hsl(${Math.round(atmosphere.mood * 120)}, ${Math.round(40 + atmosphere.mood * 30)}%, ${Math.round(45 + atmosphere.mood * 15)}%)`,
                        }}
                      />
                      <p className="text-xs font-semibold">Atmósfera: {atmosphere.label}</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {atmosphere.description}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 leading-relaxed border-t border-border/50 pt-1.5">
                      El color de fondo de la app cambia sutilmente según tu salud financiera del mes. Verde = ingresos superan gastos, rojo = gastos superan ingresos.
                    </p>
                  </TooltipContent>
                </Tooltip>
                <div className="hidden lg:block relative">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        data-shortcuts-trigger
                        className="h-7 select-none items-center gap-1 rounded bg-muted px-2 font-mono text-[11px] font-medium border border-border inline-flex cursor-pointer hover:bg-muted/80 transition-all"
                        onClick={toggleShortcutsPopover}
                      >
                        <Keyboard className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Atajos del teclado (?)</TooltipContent>
                  </Tooltip>
                  <div data-shortcuts-popover>
                    <ShortcutsPopover
                      isVisible={showShortcutsPopover}
                      onClose={() => setShowShortcutsPopover(false)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main
            className={cn(
              "flex flex-1 flex-col gap-4 p-6 sm:p-6",
              isMobile && "pb-28"
            )}
            data-scrollable
          >
            {children}
          </main>
        </SidebarInset>

        {/* Mobile Bottom Navigation */}
        <MobileBottomBar />
      </SidebarProvider>
    </TooltipProvider>
  );
}
