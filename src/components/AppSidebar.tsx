import {
  ChevronsUpDown,
  LogOut,
  Eye,
  EyeOff,
  Moon,
  Sun,
  Monitor,
  Plus,
  Variable,
  Bell,
  BellOff,
  MessageSquare,
  Volume2,
  VolumeOff,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { useSoundPreferences } from "@/hooks/useSoundPreferences";
import { useSoundFX } from "@/hooks/useSoundFX";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
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
import { Kbd } from "@/components/ui/kbd";
import { useIsMobile } from "@/hooks/use-mobile";
import { getMainRoutes, getToolRoutes } from "@/lib/routes-config";

interface AppSidebarProps {
  onAddTransaction?: () => void;
  onConciliate?: () => void;
  onWhisper?: () => void;
}

export function AppSidebar({ onAddTransaction, onConciliate, onWhisper }: AppSidebarProps = {}) {
  const location = useLocation();
  const { isPrivacyMode, togglePrivacyMode } = usePrivacyMode();
  const { soundEnabled, toggleSound } = useSoundPreferences();
  const { playToggleOn, playToggleOff } = useSoundFX();
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications();
  const { theme, setTheme } = useTheme();
  const isMobile = useIsMobile();

  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
  }, []);

  const userInitials = userEmail
    ? userEmail.slice(0, 2).toUpperCase()
    : "U";

  const mainNavItems = getMainRoutes();
  const secondaryNavItems = getToolRoutes();

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
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                  <img src="/icon-512x512-removebg-preview.png" alt="rindo" className="size-8 rounded-full" />
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">rindo<span className="text-primary">.</span></span>
                    <span className="truncate text-xs text-sidebar-foreground/70">Finanzas Personales</span>
                  </div>
                  <ChevronsUpDown className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                align="start"
                side="bottom"
                sideOffset={4}
              >
                <DropdownMenuItem
                  onClick={togglePrivacyMode}
                  className="gap-2 p-2 cursor-pointer"
                >
                  {isPrivacyMode ? (
                    <Eye className="size-4" />
                  ) : (
                    <EyeOff className="size-4" />
                  )}
                  <div className="font-medium">
                    {isPrivacyMode ? "Desactivar" : "Activar"} privacidad
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="gap-2 p-2 cursor-pointer"
                >
                  {getThemeIcon()}
                  <div className="font-medium flex-1">
                    {getThemeLabel()}
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    toggleSound();
                    if (soundEnabled) playToggleOff(); else playToggleOn();
                  }}
                  className="gap-2 p-2 cursor-pointer"
                >
                  {soundEnabled ? (
                    <Volume2 className="size-4" />
                  ) : (
                    <VolumeOff className="size-4" />
                  )}
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
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => {
                const isActive = location.pathname === item.url;
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link to={item.url} className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          {item.customIcon ? (
                            <img src={Icon as string} alt={item.title} className="size-4" />
                          ) : (
                            <Icon className="size-4" />
                          )}
                          <span>{item.title}</span>
                        </div>
                        {!isMobile && item.shortcut && (
                          <div className="flex gap-0.5 opacity-50 group-data-[state=collapsed]:hidden">
                            <Kbd className="text-[10px] px-1 py-0.5">{item.shortcut}</Kbd>
                          </div>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Herramientas</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryNavItems.map((item) => {
                const isActive = location.pathname === item.url;
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link to={item.url} className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          {item.customIcon ? (
                            <img src={Icon as string} alt={item.title} className="size-4" />
                          ) : (
                            <Icon className="size-4" />
                          )}
                          <span>{item.title}</span>
                        </div>
                        {!isMobile && item.shortcut && (
                          <div className="flex gap-0.5 opacity-50 group-data-[state=collapsed]:hidden">
                            <Kbd className="text-[10px] px-1 py-0.5">{item.shortcut}</Kbd>
                          </div>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Acciones Rápidas</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={onAddTransaction}>
                  <Plus className="size-4" />
                  <span>Agregar Gasto</span>
                  {!isMobile && (
                    <div className="flex gap-0.5 opacity-50 ml-auto group-data-[state=collapsed]:hidden">
                      <Kbd className="text-[10px] px-1 py-0.5">N</Kbd>
                    </div>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={onConciliate}>
                  <Variable className="size-4" />
                  <span>Conciliar Balance</span>
                  {!isMobile && (
                    <div className="flex gap-0.5 opacity-50 ml-auto group-data-[state=collapsed]:hidden">
                      <Kbd className="text-[10px] px-1 py-0.5">R</Kbd>
                    </div>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={onWhisper}>
                  <MessageSquare className="size-4" />
                  <span>Whisper</span>
                  {!isMobile && (
                    <div className="flex gap-0.5 opacity-50 ml-auto group-data-[state=collapsed]:hidden">
                      <Kbd className="text-[10px] px-1 py-0.5">W</Kbd>
                    </div>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground sm:mb-0 mb-4"
                >
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-xs font-semibold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Mi Cuenta</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {userEmail ?? "Cargando..."}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 text-muted-foreground/50" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl"
                side="top"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-3 px-3 py-3">
                    <Avatar className="size-9 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-sm font-semibold">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">Mi Cuenta</span>
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
