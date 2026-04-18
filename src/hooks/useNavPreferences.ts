import { create } from "zustand";
import { persist } from "zustand/middleware";
import { APP_ROUTES, type RouteConfig } from "@/lib/routes-config";

// ─── Types ───────────────────────────────────────────────────
export interface NavPreferences {
  sidebarOrder: string[]; // route urls in display order (both groups merged)
  hiddenRoutes: string[]; // route urls hidden from sidebar
  mobileTabs: string[]; // 3 route urls for bottom bar
}

interface NavPreferencesState extends NavPreferences {
  // Sidebar actions
  setSidebarOrder: (order: string[]) => void;
  toggleRouteVisibility: (url: string) => void;
  showRoute: (url: string) => void;
  hideRoute: (url: string) => void;

  // Mobile actions
  setMobileTabs: (tabs: string[]) => void;
  addMobileTab: (url: string) => void;
  removeMobileTab: (url: string) => void;
  swapMobileTab: (oldUrl: string, newUrl: string) => void;

  // Reset
  resetToDefaults: () => void;

  // Computed helpers
  getVisibleRoutes: () => RouteConfig[];
  getOrderedRoutes: () => RouteConfig[];
  getMobileTabs: () => RouteConfig[];
  getAvailableForMobile: () => RouteConfig[];
  getDynamicShortcut: (url: string) => string | undefined;
}

// ─── Defaults ────────────────────────────────────────────────
const DEFAULT_SIDEBAR_ORDER = APP_ROUTES.map((r) => r.url);
const DEFAULT_MOBILE_TABS = ["/", "/transactions", "/overview"];

function getDefaults(): NavPreferences {
  return {
    sidebarOrder: DEFAULT_SIDEBAR_ORDER,
    hiddenRoutes: [],
    mobileTabs: DEFAULT_MOBILE_TABS,
  };
}

// ─── Store ───────────────────────────────────────────────────
export const useNavPreferences = create<NavPreferencesState>()(
  persist(
    (set, get) => ({
      ...getDefaults(),

      // ── Sidebar ──────────────────────────────────────────
      setSidebarOrder: (order) => set({ sidebarOrder: order }),

      toggleRouteVisibility: (url) =>
        set((s) => ({
          hiddenRoutes: s.hiddenRoutes.includes(url)
            ? s.hiddenRoutes.filter((u) => u !== url)
            : [...s.hiddenRoutes, url],
        })),

      showRoute: (url) =>
        set((s) => ({
          hiddenRoutes: s.hiddenRoutes.filter((u) => u !== url),
        })),

      hideRoute: (url) =>
        set((s) => ({
          hiddenRoutes: s.hiddenRoutes.includes(url)
            ? s.hiddenRoutes
            : [...s.hiddenRoutes, url],
        })),

      // ── Mobile ───────────────────────────────────────────
      setMobileTabs: (tabs) =>
        set({ mobileTabs: tabs.slice(0, 3) }),

      addMobileTab: (url) =>
        set((s) => {
          if (s.mobileTabs.length >= 3 || s.mobileTabs.includes(url)) return s;
          return { mobileTabs: [...s.mobileTabs, url] };
        }),

      removeMobileTab: (url) =>
        set((s) => ({
          mobileTabs: s.mobileTabs.filter((u) => u !== url),
        })),

      swapMobileTab: (oldUrl, newUrl) =>
        set((s) => ({
          mobileTabs: s.mobileTabs.map((u) => (u === oldUrl ? newUrl : u)),
        })),

      // ── Reset ────────────────────────────────────────────
      resetToDefaults: () => set(getDefaults()),

      // ── Computed ─────────────────────────────────────────
      getOrderedRoutes: () => {
        const { sidebarOrder } = get();
        const routeMap = new Map(APP_ROUTES.map((r) => [r.url, r]));

        // Ordered routes from preferences
        const ordered: RouteConfig[] = [];
        for (const url of sidebarOrder) {
          const route = routeMap.get(url);
          if (route) ordered.push(route);
        }

        // Add any new routes not yet in preferences
        for (const route of APP_ROUTES) {
          if (!sidebarOrder.includes(route.url)) {
            ordered.push(route);
          }
        }

        return ordered;
      },

      getVisibleRoutes: () => {
        const { hiddenRoutes } = get();
        return get()
          .getOrderedRoutes()
          .filter((r) => !hiddenRoutes.includes(r.url));
      },

      getMobileTabs: () => {
        const { mobileTabs } = get();
        const routeMap = new Map(APP_ROUTES.map((r) => [r.url, r]));
        return mobileTabs
          .map((url) => routeMap.get(url))
          .filter(Boolean) as RouteConfig[];
      },

      getAvailableForMobile: () => {
        const { mobileTabs } = get();
        return APP_ROUTES.filter((r) => !mobileTabs.includes(r.url));
      },

      getDynamicShortcut: (url) => {
        const visible = get().getVisibleRoutes();
        const index = visible.findIndex((r) => r.url === url);
        if (index >= 0 && index < 9) return String(index + 1);
        return undefined;
      },
    }),
    {
      name: "nav-preferences-storage",
      version: 1,
    }
  )
);

// ─── Selector hooks for common patterns ──────────────────────
export const useVisibleRoutes = () => useNavPreferences((s) => s.getVisibleRoutes());
export const useOrderedRoutes = () => useNavPreferences((s) => s.getOrderedRoutes());
export const useMobileTabs = () => useNavPreferences((s) => s.getMobileTabs());
export const useDynamicShortcut = (url: string) =>
  useNavPreferences((s) => s.getDynamicShortcut(url));
