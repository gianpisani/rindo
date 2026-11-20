import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function useUserEmail() {
  const { data } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user;
    },
    staleTime: Infinity,
  });
  return data?.email ?? null;
}

export function useSignOut() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
    onSuccess: () => toast.success("Sesión cerrada exitosamente"),
  });
}

type Credentials = { email: string; password: string };

export function useSignIn() {
  return useMutation({
    mutationFn: async (credentials: Credentials) => {
      const { error } = await supabase.auth.signInWithPassword(credentials);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Has iniciado sesión correctamente"),
  });
}

export function useSignUp() {
  return useMutation({
    mutationFn: async (credentials: Credentials) => {
      const { error } = await supabase.auth.signUp(credentials);
      if (error) throw error;
    },
  });
}
