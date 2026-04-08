import {
  Home,
  Tag,
  UsersRound,
  LucideIcon,
  Target,
  ChartNoAxesCombined,
  Coins,
  TrendingUp,
  CreditCard,
  CalendarDays,
  Dumbbell,
  GraduationCap,
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
    title: "Movimientos",
    url: "/transactions",
    icon: Coins,
    shortcut: "2",
    group: "main",
  },
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: ChartNoAxesCombined,
    shortcut: "3",
    group: "main",
  },
  {
    title: "Resumen",
    url: "/monthly-summary",
    icon: CalendarDays,
    shortcut: "4",
    group: "main",
  },

  // Herramientas
  {
    title: "Categorías",
    url: "/categories",
    icon: Tag,
    shortcut: "5",
    group: "tools",
  },
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
    title: "Presupuesto",
    url: "/budget",
    icon: Target,
    shortcut: "8",
    group: "tools",
  },
  {
    title: "Fintual",
    url: "/fintual",
    icon: "/isotipo-fintual.png",
    shortcut: "9",
    group: "tools",
    customIcon: true,
  },
  {
    title: "Mis clases",
    url: "/tutoring",
    icon: GraduationCap,
    group: "tools",
  },
  {
    title: "Entrenamiento",
    url: "/training",
    icon: Dumbbell,
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
