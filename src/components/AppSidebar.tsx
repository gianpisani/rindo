import {
  ChevronsUpDown,
  LogOut,
  Eye,
  EyeOff,
  Moon,
  Sun,
  Monitor,
  Bell,
  BellOff,
  Volume2,
  VolumeOff,
  Pencil,
  Check,
  RotateCcw,
  UserPen,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { useSoundPreferences } from "@/hooks/useSoundPreferences";
import { useSoundFX } from "@/hooks/useSoundFX";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useTheme } from "next-themes";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { RindoLogo } from "./RindoLogo";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useGlobalDrawers } from "@/hooks/useGlobalDrawers";
import { useNavPreferences } from "@/hooks/useNavPreferences";
import { SortableNavItem, DragOverlayItem } from "./SortableNavItem";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { APP_ROUTES } from "@/lib/routes-config";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isPrivacyMode, togglePrivacyMode } = usePrivacyMode();
  const { soundEnabled, toggleSound } = useSoundPreferences();
  const { playToggleOn, playToggleOff, playSelect } = useSoundFX();
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications();
  const { theme, setTheme } = useTheme();
  const isMobile = useIsMobile();

  const { profile, avatarUrl } = useUserProfile();
  const { openProfileEdit } = useGlobalDrawers();

  const {
    hiddenRoutes,
    sidebarOrder,
    setSidebarOrder,
    toggleRouteVisibility,
    resetToDefaults,
    getOrderedRoutes,
    getVisibleRoutes,
    getDynamicShortcut,
  } = useNavPreferences();

  const [isEditMode, setIsEditMode] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
  }, []);

  const displayName = profile?.nickname || profile?.full_name || "Yo";
  const userInitials = (profile?.nickname || profile?.full_name || userEmail || "U")
    .slice(0, 2)
    .toUpperCase();

  // In edit mode show ALL routes (including hidden, grayed out). Otherwise only visible.
  const orderedRoutes = getOrderedRoutes();
  const visibleRoutes = getVisibleRoutes();
  const displayRoutes = isEditMode ? orderedRoutes : visibleRoutes;

  // Split into groups for display
  const mainRoutes = displayRoutes.filter((r) => r.group === "main");
  const toolRoutes = displayRoutes.filter((r) => r.group === "tools");

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const activeRoute = activeId
    ? APP_ROUTES.find((r) => r.url === activeId) ?? null
    : null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  // Live reorder as you drag over items — this is what makes it feel smooth
  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = sidebarOrder.indexOf(active.id as string);
      const newIndex = sidebarOrder.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;

      setSidebarOrder(arrayMove(sidebarOrder, oldIndex, newIndex));
    },
    [sidebarOrder, setSidebarOrder]
  );

  const handleDragEnd = useCallback(
    (_event: DragEndEvent) => {
      if (activeId) playSelect();
      setActiveId(null);
    },
    [activeId, playSelect]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const handleToggleEditMode = useCallback(() => {
    setIsEditMode((prev) => {
      if (prev) playToggleOff();
      else playToggleOn();
      return !prev;
    });
  }, [playToggleOn, playToggleOff]);

  const handleReset = useCallback(() => {
    resetToDefaults();
    playSelect();
    toast.success("Navegación restaurada");
  }, [resetToDefaults, playSelect]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Sesión cerrada exitosamente");
  };

  const getThemeIcon = () => {
    if (theme === "light") return <Sun className="size-4" />;
    if (theme === "dark") return <Moon className="size-4" />;
    return <Monitor className="size-4" />;
  };

  const getThemeLabel = () => {
    if (theme === "light") return "Modo claro";
    if (theme === "dark") return "Modo oscuro";
    return "Sistema";
  };

  const allUrls = orderedRoutes.map((r) => r.url);

  // DnD modifiers
  const modifiers = [restrictToVerticalAxis];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 w-full rounded-md px-2 py-2 text-sm hover:bg-sidebar-accent transition-colors data-[state=open]:bg-sidebar-accent">
                  <div className="flex aspect-square size-8 items-center justify-center">
                    <RindoLogo size={28} className="text-foreground" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight group-data-[state=collapsed]:hidden">
                    <span className="truncate font-semibold">rindo<span className="text-primary">.</span></span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 text-muted-foreground/50 group-data-[state=collapsed]:hidden" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl"
                align="start"
                side="bottom"
                sideOffset={4}
              >
                <DropdownMenuItem
                  onClick={togglePrivacyMode}
                  className="gap-2 p-2 cursor-pointer"
                >
                  {isPrivacyMode ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                  <div className="font-medium">
                    {isPrivacyMode ? "Desactivar" : "Activar"} privacidad
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="gap-2 p-2 cursor-pointer"
                >
                  {getThemeIcon()}
                  <div className="font-medium flex-1">{getThemeLabel()}</div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    toggleSound();
                    if (soundEnabled) playToggleOff(); else playToggleOn();
                  }}
                  className="gap-2 p-2 cursor-pointer"
                >
                  {soundEnabled ? <Volume2 className="size-4" /> : <VolumeOff className="size-4" />}
                  <div className="font-medium">
                    {soundEnabled ? "Desactivar" : "Activar"} sonidos
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
          modifiers={modifiers}
        >
          <SortableContext items={allUrls} strategy={verticalListSortingStrategy}>
            {/* Principal */}
            <SidebarGroup>
              <div className="flex items-center justify-between pr-2">
                <SidebarGroupLabel>Principal</SidebarGroupLabel>
                <div className="flex items-center gap-0.5 group-data-[state=collapsed]:hidden">
                  <AnimatePresence>
                    {isEditMode && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={handleReset}
                              className="size-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
                            >
                              <RotateCcw className="size-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right">Restaurar por defecto</TooltipContent>
                        </Tooltip>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleToggleEditMode}
                        className={cn(
                          "size-6 rounded-md flex items-center justify-center transition-all",
                          isEditMode
                            ? "text-primary bg-primary/10 hover:bg-primary/20"
                            : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                        )}
                      >
                        {isEditMode ? <Check className="size-3" /> : <Pencil className="size-3" />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {isEditMode ? "Listo" : "Personalizar sidebar"}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <SidebarGroupContent>
                <SidebarMenu>
                  {mainRoutes.map((route) => (
                    <SidebarMenuItem key={route.url}>
                      <SortableNavItem
                        route={route}
                        isHidden={hiddenRoutes.includes(route.url)}
                        isEditMode={isEditMode}
                        isActive={location.pathname === route.url}
                        shortcutNumber={getDynamicShortcut(route.url)}
                        onToggleVisibility={() => toggleRouteVisibility(route.url)}
                        onClick={() => navigate(route.url)}
                        isMobile={isMobile}
                      />
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Herramientas */}
            <SidebarGroup>
              <SidebarGroupLabel>Herramientas</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {toolRoutes.map((route) => (
                    <SidebarMenuItem key={route.url}>
                      <SortableNavItem
                        route={route}
                        isHidden={hiddenRoutes.includes(route.url)}
                        isEditMode={isEditMode}
                        isActive={location.pathname === route.url}
                        shortcutNumber={getDynamicShortcut(route.url)}
                        onToggleVisibility={() => toggleRouteVisibility(route.url)}
                        onClick={() => navigate(route.url)}
                        isMobile={isMobile}
                      />
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SortableContext>

          {/* Floating drag preview */}
          <DragOverlay dropAnimation={{
            duration: 200,
            easing: "cubic-bezier(0.25, 1, 0.5, 1)",
          }}>
            {activeRoute ? <DragOverlayItem route={activeRoute} /> : null}
          </DragOverlay>
        </DndContext>

        {/* Empty state when all tools hidden */}
        <AnimatePresence>
          {!isEditMode && toolRoutes.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-4 py-6 text-center group-data-[state=collapsed]:hidden"
            >
              <p className="text-xs text-muted-foreground/60">
                Tus herramientas aparecen acá
              </p>
              <button
                onClick={handleToggleEditMode}
                className="text-xs text-primary hover:underline mt-1"
              >
                Personalizar
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 w-full rounded-md px-2 py-2 text-sm hover:bg-sidebar-accent transition-colors data-[state=open]:bg-sidebar-accent sm:mb-0 mb-4"
                >
                  <div className="rounded-full p-[2px] accent-gradient-bg shrink-0">
                    <Avatar className="size-7">
                      {avatarUrl && <AvatarImage src={avatarUrl} className="object-cover" />}
                      <AvatarFallback className="bg-sidebar text-primary text-[10px] font-semibold">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight group-data-[state=collapsed]:hidden">
                    <span className="truncate font-semibold">{displayName}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {userEmail ?? "Cargando..."}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 text-muted-foreground/50 group-data-[state=collapsed]:hidden" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl"
                side="top"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-3 px-3 py-3">
                    <div className="rounded-full p-[2px] accent-gradient-bg shrink-0">
                      <Avatar className="size-9">
                        {avatarUrl && <AvatarImage src={avatarUrl} className="object-cover" />}
                        <AvatarFallback className="bg-popover text-primary text-sm font-semibold">
                          {userInitials}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{displayName}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {userEmail ?? ""}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isSupported && (
                  <>
                    <DropdownMenuItem
                      onClick={isSubscribed ? unsubscribe : subscribe}
                      disabled={isLoading}
                      className="gap-2 px-3 py-2 cursor-pointer"
                    >
                      {isSubscribed ? (
                        <BellOff className="size-4 text-muted-foreground" />
                      ) : (
                        <Bell className="size-4 text-muted-foreground" />
                      )}
                      {isLoading ? "Procesando..." : isSubscribed ? "Desactivar notificaciones" : "Activar notificaciones"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  onClick={() => openProfileEdit()}
                  className="gap-2 px-3 py-2 cursor-pointer"
                >
                  <UserPen className="size-4 text-muted-foreground" />
                  Editar perfil
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="gap-2 px-3 py-2 text-destructive focus:text-destructive cursor-pointer"
                >
                  <LogOut className="size-4" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
