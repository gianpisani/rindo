import { getPreferenceValues, LocalStorage } from "@raycast/api";
import { createClient, Session } from "@supabase/supabase-js";

interface Preferences {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

const SESSION_KEY = "rindo-supabase-session";

export function getSupabaseClient() {
  const { supabaseUrl, supabaseAnonKey } = getPreferenceValues<Preferences>();
  return createClient(supabaseUrl, supabaseAnonKey);
}

export async function saveSession(session: Session): Promise<void> {
  await LocalStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function getSession(): Promise<Session | null> {
  const raw = await LocalStorage.getItem<string>(SESSION_KEY);
  if (!raw) return null;

  try {
    const session = JSON.parse(raw) as Session;

    // Check if token is expired
    const expiresAt = session.expires_at;
    if (expiresAt && expiresAt * 1000 < Date.now()) {
      // Try to refresh
      const client = getSupabaseClient();
      const { data, error } = await client.auth.refreshSession({
        refresh_token: session.refresh_token,
      });

      if (error || !data.session) {
        await clearSession();
        return null;
      }

      await saveSession(data.session);
      return data.session;
    }

    return session;
  } catch {
    await clearSession();
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await LocalStorage.removeItem(SESSION_KEY);
}

export async function getAuthenticatedClient() {
  const session = await getSession();
  if (!session) return null;

  const { supabaseUrl, supabaseAnonKey } = getPreferenceValues<Preferences>();

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    },
  });

  return { client, session, userId: session.user.id };
}
