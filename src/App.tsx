import { useEffect, useState } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/integrations/query-client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import { useUserProfile } from "./hooks/useUserProfile";
import { useSession } from "./hooks/useSession";
import { BankSyncProvider } from "./contexts/BankSyncContext";
import { useUndoShortcuts } from "./hooks/useUndoShortcuts";

function dismissSplash() {
  const splash = document.getElementById("splash");
  if (!splash) return;
  splash.style.opacity = "0";
  splash.style.pointerEvents = "none";
  splash.addEventListener("transitionend", () => splash.remove(), { once: true });
}

const App = () => {
  const { session, loading } = useSession();

  useEffect(() => {
    if (!loading) dismissSplash();
  }, [loading]);

  if (loading) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="app-enter">
          <Sonner />
          {session ? <AuthenticatedApp /> : <Auth />}
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

function AuthenticatedApp() {
  useCustomTheme();
  useUndoShortcuts();
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
