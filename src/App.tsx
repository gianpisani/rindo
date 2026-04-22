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
import TutoringClasses from "./pages/TutoringClasses";
import NotFound from "./pages/NotFound";
import Auth from "./components/Auth";
import { OnboardingModal } from "./components/OnboardingModal";
import { useCustomTheme } from "./hooks/useCustomTheme";
import { useUserProfile } from "./hooks/useUserProfile";
import { BankSyncProvider } from "./contexts/BankSyncContext";

const queryClient = new QueryClient();

/** Dismiss the HTML splash screen with a smooth fade-out */
function dismissSplash() {
  const splash = document.getElementById("splash");
  if (!splash) return;
  splash.style.opacity = "0";
  splash.style.pointerEvents = "none";
  splash.addEventListener("transitionend", () => splash.remove(), { once: true });
}

/** Pre-fetch critical data so the app renders with content, not empty shells */
async function prefetchAppData() {
  const fetchProfile = queryClient.prefetchQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No user");
      const { data, error } = await supabase
        .from("user_profiles").select("*")
        .eq("user_id", userData.user.id).single();
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const fetchTransactions = queryClient.prefetchQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions").select("*").order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const fetchCategories = queryClient.prefetchQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories").select("*")
        .order("type", { ascending: true }).order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const fetchLimits = queryClient.prefetchQuery({
    queryKey: ["category_limits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("category_limits").select("*").order("category_name");
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  // Wait for all, but don't let one failure block the rest
  await Promise.allSettled([fetchProfile, fetchTransactions, fetchCategories, fetchLimits]);
}

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Minimum time for the logo animation to look good
    const minDelay = new Promise((r) => setTimeout(r, 1200));

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);

      if (session) {
        // Pre-fetch all critical data while splash is still showing
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
          <Route path="/fintual" element={<Fintual />} />
          <Route path="/budget" element={<CategoryInsights />} />
          <Route path="/pending-debts" element={<PendingDebts />} />
          <Route path="/credit-cards" element={<CreditCards />} />
          <Route path="/tutoring" element={<TutoringClasses />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </BankSyncProvider>
  );
}

export default App;
