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
  UserPen,
  CalendarRange,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
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
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
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
import { RindoLogo } from "./RindoLogo";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useGlobalDrawers } from "@/hooks/useGlobalDrawers";
import { usePeriodConfig } from "@/hooks/usePeriodConfig";
import { periodShortLabel } from "@/lib/period";
import { cn } from "@/lib/utils";
import { APP_ROUTES, type RouteConfig } from "@/lib/routes-config";

export function AppSidebar() {
  const location = useLocation();
  const { isPrivacyMode, togglePrivacyMode } = usePrivacyMode();
  const { soundEnabled, toggleSound } = useSoundPreferences();
  const { playToggleOn, playToggleOff } = useSoundFX();
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications();
  const { theme, setTheme } = useTheme();

  const { profile, avatarUrl } = useUserProfile();
  const { openProfileEdit, openPeriodSettings } = useGlobalDrawers();
  const { startDay } = usePeriodConfig();

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

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 w-full rounded-md px-2 py-2 text-sm hover:bg-sidebar-accent transition-colors data-[state=open]:bg-sidebar-accent group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center">
                  <div className="flex aspect-square size-8 items-center justify-center shrink-0">
                    <RindoLogo size={28} className="text-foreground" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-semibold">rindo<span className="text-primary">.</span></span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 text-muted-foreground/50 group-data-[collapsible=icon]:hidden" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl"
                align="start"
                side="bottom"
                sideOffset={4}
              >
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  onClick={togglePrivacyMode}
                  className="gap-2 p-2 cursor-pointer"
                >
                  {isPrivacyMode ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                  <div className="font-medium">
                    {isPrivacyMode ? "Desactivar" : "Activar"} privacidad
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  onClick={() => setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light")}
                  className="gap-2 p-2 cursor-pointer"
                >
                  {getThemeIcon()}
                  <div className="font-medium flex-1">{getThemeLabel()}</div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
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
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {APP_ROUTES.map((route) => (
                <SidebarMenuItem key={route.url}>
                  <NavItem route={route} isActive={location.pathname === route.url} />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 w-full rounded-md px-2 py-2 text-sm hover:bg-sidebar-accent transition-colors data-[state=open]:bg-sidebar-accent sm:mb-0 mb-4 group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center"
                >
                  <div className="rounded-full p-[2px] accent-gradient-bg shrink-0">
                    <Avatar className="size-7">
                      {avatarUrl && <AvatarImage src={avatarUrl} className="object-cover" />}
                      <AvatarFallback className="bg-sidebar text-primary text-[10px] font-semibold">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-semibold">{displayName}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {userEmail ?? "Cargando..."}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 text-muted-foreground/50 group-data-[collapsible=icon]:hidden" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl max-h-[calc(var(--radix-dropdown-menu-content-available-height)-16px)] overflow-y-auto"
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
                <DropdownMenuItem
                  onClick={() => openProfileEdit()}
                  className="gap-2 px-3 py-2 cursor-pointer"
                >
                  <UserPen className="size-4 text-muted-foreground" />
                  Editar perfil
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => openPeriodSettings()}
                  className="gap-2 px-3 py-2 cursor-pointer"
                >
                  <CalendarRange className="size-4 text-muted-foreground" />
                  <span className="flex-1">Mes financiero</span>
                  <span className="text-xs text-muted-foreground">{periodShortLabel(startDay)}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {/* Theme picker */}
                <div className="px-3 py-2">
                  <span className="text-xs font-medium text-muted-foreground">Tema</span>
                  <div className="flex items-center gap-1 mt-1.5 p-1 rounded-lg bg-muted/50">
                    {([
                      { value: "light", icon: Sun },
                      { value: "dark", icon: Moon },
                      { value: "system", icon: Monitor },
                    ] as const).map(({ value, icon: Icon }) => (
                      <button
                        key={value}
                        onClick={() => setTheme(value)}
                        className={cn(
                          "flex-1 flex items-center justify-center rounded-md py-1.5 transition-all",
                          theme === value
                            ? "bg-primary/15 text-primary shadow-sm ring-1 ring-primary/30"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                      >
                        <Icon className="size-4" />
                      </button>
                    ))}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  onClick={togglePrivacyMode}
                  className="gap-2 px-3 py-2 cursor-pointer"
                >
                  {isPrivacyMode ? <Eye className="size-4 text-muted-foreground" /> : <EyeOff className="size-4 text-muted-foreground" />}
                  {isPrivacyMode ? "Desactivar" : "Activar"} privacidad
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  onClick={() => {
                    toggleSound();
                    if (soundEnabled) playToggleOff(); else playToggleOn();
                  }}
                  className="gap-2 px-3 py-2 cursor-pointer"
                >
                  {soundEnabled ? <Volume2 className="size-4 text-muted-foreground" /> : <VolumeOff className="size-4 text-muted-foreground" />}
                  {soundEnabled ? "Desactivar" : "Activar"} sonidos
                </DropdownMenuItem>
                {isSupported && (
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
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
                )}
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


function NavItem({ route, isActive }: { route: RouteConfig; isActive: boolean }) {
  const navigate = useNavigate();
  const { state: sidebarState, isMobile: isSidebarMobile } = useSidebar();
  const isCollapsed = sidebarState === "collapsed" && !isSidebarMobile;
  const Icon = route.icon;
  // El atajo no se muestra en la lista: vive en el tooltip.
  const label = route.shortcut ? `${route.title} (${route.shortcut})` : route.title;

  const item = (
    <div
      className={cn(
        "relative flex items-center rounded-md text-sm transition-[background-color] duration-150",
        isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50",
        isCollapsed && "justify-center",
      )}
    >
      <button
        onClick={() => navigate(route.url)}
        title={isCollapsed ? undefined : label}
        className={cn(
          "flex items-center gap-2 flex-1 px-2 py-1.5 min-h-[32px] text-left cursor-pointer",
          isCollapsed && "justify-center px-0 flex-initial",
        )}
      >
        <Icon className="size-4" />
        {!isCollapsed && <span className="truncate">{route.title}</span>}
      </button>
    </div>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{item}</TooltipTrigger>
        <TooltipContent side="right" align="center">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return item;
}
