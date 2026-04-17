import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import Index from "./pages/Index";
import Overview from "./pages/Overview";
import Transactions from "./pages/Transactions";
import Categories from "./pages/Categories";
import Fintual from "./pages/Fintual";
import CategoryInsights from "./pages/CategoryInsights";
import PendingDebts from "./pages/PendingDebts";
import CreditCards from "./pages/CreditCards";
import Training from "./pages/Training";
import TutoringClasses from "./pages/TutoringClasses";
import NotFound from "./pages/NotFound";
import Auth from "./components/Auth";
import { OnboardingModal } from "./components/OnboardingModal";
import { useCustomTheme } from "./hooks/useCustomTheme";
import { useUserProfile } from "./hooks/useUserProfile";

const queryClient = new QueryClient();

/** Dismiss the HTML splash screen with a smooth fade-out */
function dismissSplash() {
  const splash = document.getElementById("splash");
  if (!splash) return;
  splash.style.opacity = "0";
  splash.style.pointerEvents = "none";
  splash.addEventListener("transitionend", () => splash.remove(), { once: true });
}

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const minDelay = new Promise((r) => setTimeout(r, 2500));
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      await minDelay;
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
    // HTML splash is still visible — render nothing to avoid double loading screen
    return null;
  }

  if (!session) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <div className="app-enter">
            <Toaster />
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
          <Toaster />
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
    <>
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
          <Route path="/fintual" element={<Fintual />} />
          <Route path="/budget" element={<CategoryInsights />} />
          <Route path="/pending-debts" element={<PendingDebts />} />
          <Route path="/credit-cards" element={<CreditCards />} />
          <Route path="/tutoring" element={<TutoringClasses />} />
          <Route path="/training" element={<Training />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
