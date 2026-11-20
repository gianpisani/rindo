import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { queryClient } from "@/integrations/query-client";
import { userProfileQuery } from "./useUserProfile";
import { transactionsQuery } from "./useTransactions";
import { categoriesQuery } from "./useCategories";
import { categoryLimitsQuery } from "./useCategoryLimits";
import { clearEditHistory, loadEditHistory } from "./useEditHistory";

const SPLASH_MIN_MS = 1200;

function prefetchAppData() {
  return Promise.allSettled([
    queryClient.prefetchQuery(userProfileQuery),
    queryClient.prefetchQuery(transactionsQuery),
    queryClient.prefetchQuery(categoriesQuery),
    queryClient.prefetchQuery(categoryLimitsQuery),
  ]);
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const minDelay = new Promise((resolve) => setTimeout(resolve, SPLASH_MIN_MS));

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) loadEditHistory(session.user.id);
      setSession(session);
      await Promise.all([minDelay, session ? prefetchAppData() : null]);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        queryClient.clear();
        clearEditHistory();
      }
      if (session) loadEditHistory(session.user.id);
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { session, loading };
}
