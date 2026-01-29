import { 
  Home, 
  Tag, 
  UsersRound,
  LucideIcon,
  Brain,
  ChartNoAxesCombined,
  Coins,
  TrendingUp,
  CreditCard,
} from "lucide-react";
import { ComponentType } from "react";

export interface RouteConfig {
  title: string;
  url: string;
  icon: LucideIcon | ComponentType<{ className?: string }> | string;
  shortcut?: string; // El número del shortcut (1-6)
  group: "main" | "tools";
  customIcon?: boolean; // Flag para indicar que es un icono custom (imagen)
}

// Configuración central de todas las rutas
// El orden aquí define el orden en el sidebar, command bar, y navegación con flechas
export const APP_ROUTES: RouteConfig[] = [
  // Rutas principales
  {
    title: "Inicio",
    url: "/",
    icon: Home,
    shortcut: "1",
    group: "main",
  },
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: ChartNoAxesCombined,
    shortcut: "2",
    group: "main",
  },
  {
    title: "Movimientos",
    url: "/transactions",
    icon: Coins,
    shortcut: "3",
    group: "main",
  },
  {
    title: "Categorías",
    url: "/categories",
    icon: Tag,
    shortcut: "4",
    group: "main",
  },
  {
    title: "Fintual",
    url: "/fintual",
    icon: "/isotipo-fintual.png",
    shortcut: "5",
    group: "main",
    customIcon: true,
  },
  
  // Herramientas
  {
    title: "Tarjetas",
    url: "/credit-cards",
    icon: CreditCard,
    shortcut: "6",
    group: "tools",
  },
  {
    title: "Deudas",
    url: "/pending-debts",
    icon: UsersRound,
    shortcut: "7",
    group: "tools",
  },
  {
    title: "Insights",
    url: "/category-insights",
    icon: Brain,
    shortcut: "8",
    group: "tools",
  },
];

// Helper functions
export const getMainRoutes = () => APP_ROUTES.filter(r => r.group === "main");
export const getToolRoutes = () => APP_ROUTES.filter(r => r.group === "tools");
export const getAllRoutePaths = () => APP_ROUTES.map(r => r.url);
export const getRouteByPath = (path: string) => APP_ROUTES.find(r => r.url === path);
export const getMaxShortcutNumber = () => {
  const shortcuts = APP_ROUTES.map(r => r.shortcut).filter(Boolean).map(Number);
  return Math.max(...shortcuts, 0);
};
