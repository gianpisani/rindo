import { supabase } from "./client";

export async function requireUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Tu sesión expiró. Vuelve a entrar.");
  return data.user.id;
}
