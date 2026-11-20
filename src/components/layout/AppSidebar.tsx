import { Link, useLocation, useNavigate } from "react-router-dom";
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
} from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/sidebar-context";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RindoLogo } from "./RindoLogo";
import { AccountMenu } from "./AccountMenu";
import { cn } from "@/lib/utils";
import { APP_ROUTES, type RouteConfig } from "@/lib/routes-config";

export function AppSidebar() {
  const location = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <Link
              to="/"
              aria-label="Rindo, ir a Inicio"
              className="flex items-center gap-2 w-full px-2 py-2 text-sm group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center"
            >
              <div className="flex aspect-square size-8 items-center justify-center shrink-0">
                <RindoLogo size={28} className="text-foreground" />
              </div>
              <span className="truncate font-medium group-data-[collapsible=icon]:hidden">
                rindo<span className="text-primary">.</span>
              </span>
            </Link>
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

      <SidebarFooter className="pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <SidebarMenu>
          <SidebarMenuItem>
            <AccountMenu />
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
  const label = route.shortcut ? `${route.title} (${route.shortcut})` : route.title;

  const item = (
    <div
      className={cn(
        "relative flex items-center rounded-card text-sm transition-[background-color] duration-150",
        isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
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
        <Icon className={cn("size-4", isActive && "text-primary")} />
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
