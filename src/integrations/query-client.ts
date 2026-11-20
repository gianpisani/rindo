import { MutationCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors";

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error) => {
      const message = errorMessage(error);
      toast.error(message, { id: message });
    },
  }),
});
