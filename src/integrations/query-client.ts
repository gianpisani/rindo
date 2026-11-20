import { MutationCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors";

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: { handlesOwnError?: boolean };
  }
}

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.meta?.handlesOwnError) return;
      const message = errorMessage(error);
      toast.error(message, { id: message });
    },
  }),
});
