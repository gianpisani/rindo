import { ReactNode, useEffect } from "react";
import { PeriodSettingsDialog } from "@/components/PeriodSettingsDialog";
import { ReconciliationDrawer } from "./ReconciliationDrawer";
import { WhisperInput } from "./WhisperInput";
import { OnboardingModal } from "./OnboardingModal";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "./ui/button";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { useGlobalDrawers } from "@/hooks/useGlobalDrawers";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useSoundFX } from "@/hooks/useSoundFX";
import { initSounds } from "@/lib/snd";
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
  /**
   * Para vistas que son una pantalla exacta y no scrollean: le da altura
   * DEFINIDA al shell (`h-svh`, no `min-h-svh`), que es lo único que
   * permite que un `flex-1` adentro sepa contra qué medirse. Sin esto, un
   * hijo con `overflow-y-auto` no tiene techo y crece con su contenido,
   * estirando a sus vecinos del grid.
   *
   * El alto del header y los paddings los descuenta el flex solo: no hay
   * ningún número que se pueda desincronizar.
   */
  fit?: boolean;
}

export default function Layout({ children, fit = false }: LayoutProps) {
  const { isPrivacyMode, togglePrivacyMode } = usePrivacyMode();
  const { playToggleOn, playToggleOff } = useSoundFX();
  const {
    quickAddOpen,
    setQuickAddOpen,
    quickAddDefaultType,
    quickAddDraft,
    quickAddRevision,
    reconciliationOpen,
    setReconciliationOpen,
    profileEditOpen,
    setProfileEditOpen,
  } = useGlobalDrawers();

  const isMobile = useIsMobile();
  // Initialize sound system once
  useEffect(() => {
    initSounds().catch(() => {});
  }, []);

  // Register all keyboard shortcuts
  useKeyboardShortcuts();

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
    <TooltipProvider delayDuration={200}>
      <SidebarProvider>
        {/* El único composer para anotar a mano. */}
        <WhisperInput
          key={quickAddRevision}
          open={quickAddOpen}
          initialDraft={quickAddDraft}
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

        {/* Mes financiero - Global */}
        <PeriodSettingsDialog />

        {/* Profile Edit Modal - Global */}
        <OnboardingModal
          open={profileEditOpen}
          onOpenChange={setProfileEditOpen}
          mode="edit"
        />

        {/* Desktop Sidebar */}
        <AppSidebar />

        <SidebarInset className={cn(fit && "h-svh")}>
          {/* Top Bar with Trigger and Actions */}
          <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b backdrop-blur px-4">
            {!isMobile && <SidebarTrigger className="-ml-1" />}
            {/* En escritorio el logo ya está arriba de la barra lateral. */}
            {isMobile && (
              <span className="text-xl font-medium">
                rindo<span className="text-primary">.</span>
              </span>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={togglePrivacyMode}
                  variant="ghost"
                  size="sm"
                  aria-label={isPrivacyMode ? "Desactivar modo privado" : "Activar modo privado"}
                  className={cn(
                    "ml-auto rounded-full h-8 w-8 p-0 transition-all duration-200",
                    isPrivacyMode
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
          </header>

          {/* Main Content */}
          <main
            className={cn(
              "flex flex-1 flex-col gap-4 p-4 sm:p-6 overflow-x-clip max-w-full",
              isMobile && "pb-28 pb-safe",
              // Con altura definida el contenido calza justo; si la pantalla
              // es más baja que el mínimo de las cards, scrollea acá adentro
              // en vez de quedar cortado.
              fit && "min-h-0 overflow-y-auto"
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
