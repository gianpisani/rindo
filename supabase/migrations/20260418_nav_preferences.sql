-- ============================================================
-- Navigation Preferences (sidebar order, hidden routes, mobile tabs)
-- ============================================================

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS nav_preferences JSONB DEFAULT NULL;

COMMENT ON COLUMN public.user_profiles.nav_preferences IS 'User navigation layout preferences: { sidebarOrder: string[], hiddenRoutes: string[], mobileTabs: string[] }';
