import { 
  ChevronsUpDown,
  LogOut,
  User2,
  Eye,
  EyeOff,
  Moon,
  Sun,
  Monitor,
  Plus,
  Calculator,
  Variable,
  Bell,
  BellOff,
  DollarSign,
  TrendingUp,
  Calendar,
  CheckCircle
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { sendPushNotification, NotificationTemplates } from "@/lib/notifications";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useIsMobile } from "@/hooks/use-mobile";
import { getMainRoutes, getToolRoutes } from "@/lib/routes-config";

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
const cmdKey = isMac ? "⌘" : "Ctrl";

interface AppSidebarProps {
  onAddTransaction?: () => void;
  onConciliate?: () => void;
}

export function AppSidebar({ onAddTransaction, onConciliate }: AppSidebarProps = {}) {
  const location = useLocation();
  const { isPrivacyMode, togglePrivacyMode } = usePrivacyMode();
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications();
  const { theme, setTheme } = useTheme();
  const isMobile = useIsMobile();
  
  const mainNavItems = getMainRoutes();
  const secondaryNavItems = getToolRoutes();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Sesión cerrada exitosamente");
  };

  const handleTestNotification = async (template: ReturnType<typeof NotificationTemplates[keyof typeof NotificationTemplates]>, name: string) => {
    const result = await sendPushNotification(template);
    if (result.success) {
      toast.success(`${name} enviada`);
    } else {
      toast.error("No se pudo enviar la notificación");
    }
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
                  <img src="/icon-512x512-removebg-preview.png" alt="Rindo" className="size-8 rounded-full" />
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Rindo<span className="text-primary">.</span></span>
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
                            <Kbd className="text-[10px] px-1 py-0.5">{cmdKey}</Kbd>
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
                            <Kbd className="text-[10px] px-1 py-0.5">{cmdKey}</Kbd>
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
                      <Kbd className="text-[10px] px-1 py-0.5">{cmdKey}</Kbd>
                      <Kbd className="text-[10px] px-1 py-0.5">K</Kbd>
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
                      <Kbd className="text-[10px] px-1 py-0.5">{cmdKey}</Kbd>
                      <Kbd className="text-[10px] px-1 py-0.5">B</Kbd>
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
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <User2 className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Mi Cuenta</span>
                    <span className="truncate text-xs text-sidebar-foreground/70">Ver opciones</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                {isSupported && (
                  <>
                    <DropdownMenuItem
                      onClick={isSubscribed ? unsubscribe : subscribe}
                      disabled={isLoading}
                      className="gap-2 p-2 cursor-pointer"
                    >
                      {isSubscribed ? (
                        <BellOff className="size-4" />
                      ) : (
                        <Bell className="size-4" />
                      )}
                      <div className="font-medium">
                        {isLoading ? "Procesando..." : isSubscribed ? "Desactivar notificaciones" : "Activar notificaciones"}
                      </div>
                    </DropdownMenuItem>
                    {isSubscribed && (
                      <>
                        <DropdownMenuItem
                          onClick={() => handleTestNotification(
                            NotificationTemplates.newTransaction(50000, 'Comida', 'Gasto'),
                            'Nueva transacción'
                          )}
                          className="gap-2 p-2 cursor-pointer"
                        >
                          <DollarSign className="size-4" />
                          <div className="font-medium">Nueva transacción</div>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleTestNotification(
                            NotificationTemplates.categoryLimitReached('Comida', 90),
                            'Límite alcanzado'
                          )}
                          className="gap-2 p-2 cursor-pointer"
                        >
                          <TrendingUp className="size-4" />
                          <div className="font-medium">Límite alcanzado</div>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleTestNotification(
                            NotificationTemplates.fintualSyncComplete(1500000),
                            'Sync Fintual'
                          )}
                          className="gap-2 p-2 cursor-pointer"
                        >
                          <CheckCircle className="size-4" />
                          <div className="font-medium">Sync Fintual</div>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleTestNotification(
                            NotificationTemplates.weeklyReport(500000, 300000),
                            'Resumen semanal'
                          )}
                          className="gap-2 p-2 cursor-pointer"
                        >
                          <Calendar className="size-4" />
                          <div className="font-medium">Resumen semanal</div>
                        </DropdownMenuItem>
                      </>
                    )}
                  </>
                )}
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="gap-2 p-2 text-destructive focus:text-destructive cursor-pointer"
                >
                  <LogOut className="size-4" />
                  <div className="font-medium">Cerrar sesión</div>
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
