import {
  Home,
  Tag,
  UsersRound,
  LucideIcon,
  Target,
  ChartNoAxesCombined,
  Coins,
  CreditCard,
} from "lucide-react";
import { ComponentType } from "react";

export interface RouteConfig {
  title: string;
  url: string;
  icon: LucideIcon | ComponentType<{ className?: string }>;
  shortcut?: string; // El número del shortcut (1-6)
  group: "main" | "tools";
}

export const APP_ROUTES: RouteConfig[] = [
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
    title: "Finanzas",
    url: "/overview",
    icon: ChartNoAxesCombined,
    shortcut: "3",
    group: "main",
  },

  {
    title: "Categorías",
    url: "/categories",
    icon: Tag,
    shortcut: "4",
    group: "tools",
  },
  {
    title: "Tarjetas",
    url: "/credit-cards",
    icon: CreditCard,
    shortcut: "5",
    group: "tools",
  },
  {
    title: "Deudas",
    url: "/pending-debts",
    icon: UsersRound,
    shortcut: "6",
    group: "tools",
  },
  {
    title: "Meta",
    url: "/budget",
    icon: Target,
    shortcut: "7",
    group: "tools",
  },
];

export const getMainRoutes = () => APP_ROUTES.filter(r => r.group === "main");
export const getToolRoutes = () => APP_ROUTES.filter(r => r.group === "tools");
export const getAllRoutePaths = () => APP_ROUTES.map(r => r.url);
