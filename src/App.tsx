import { useEffect, useState } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/integrations/query-client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import Index from "./pages/Index";
import Overview from "./pages/Overview";
import Transactions from "./pages/Transactions";
import Categories from "./pages/Categories";
import Meta from "./pages/Meta";
import PendingDebts from "./pages/PendingDebts";
import CreditCards from "./pages/CreditCards";
import NotFound from "./pages/NotFound";
import Auth from "./components/auth/Auth";
import { OnboardingModal } from "./components/settings/OnboardingModal";
import { useCustomTheme } from "./hooks/useCustomTheme";
import { useUserProfile, userProfileQuery } from "./hooks/useUserProfile";
import { transactionsQuery } from "./hooks/useTransactions";
import { categoriesQuery } from "./hooks/useCategories";
import { categoryLimitsQuery } from "./hooks/useCategoryLimits";
import { BankSyncProvider } from "./contexts/BankSyncContext";

function dismissSplash() {
  const splash = document.getElementById("splash");
  if (!splash) return;
  splash.style.opacity = "0";
  splash.style.pointerEvents = "none";
  splash.addEventListener("transitionend", () => splash.remove(), { once: true });
}

function prefetchAppData() {
  return Promise.allSettled([
    queryClient.prefetchQuery(userProfileQuery),
    queryClient.prefetchQuery(transactionsQuery),
    queryClient.prefetchQuery(categoriesQuery),
    queryClient.prefetchQuery(categoryLimitsQuery),
  ]);
}

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const minDelay = new Promise((r) => setTimeout(r, 1200));

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);

      if (session) {
        await Promise.all([minDelay, prefetchAppData()]);
      } else {
        await minDelay;
      }

      setLoading(false);
      dismissSplash();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return null;
  }

  if (!session) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <div className="app-enter">
            <Sonner />
            <Auth />
          </div>
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="app-enter">
          <Sonner />
          <AuthenticatedApp />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

function AuthenticatedApp() {
  useCustomTheme();
  const { profile, isLoading } = useUserProfile();
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && profile && !profile.onboarding_completed) {
      setOnboardingOpen(true);
    }
  }, [isLoading, profile]);

  return (
    <BankSyncProvider>
      <OnboardingModal
        open={onboardingOpen}
        onOpenChange={setOnboardingOpen}
        mode="onboarding"
      />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/overview" element={<Overview />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/budget" element={<Meta />} />
          <Route path="/pending-debts" element={<PendingDebts />} />
          <Route path="/credit-cards" element={<CreditCards />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </BankSyncProvider>
  );
}

export default App;
