import { supabase } from '@/integrations/supabase/client';

interface CategorizationResponse {
  success: boolean;
  applied: boolean;
  category: string;
  method: string;
  decision?: { status: 'accepted' | 'review' | 'unavailable' | 'skipped' };
}

export async function categorizeSavedTransaction(transactionId: string): Promise<CategorizationResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sesión no disponible');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const endpoint = import.meta.env.DEV ? '/__auto-categorize'
      : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auto-categorize`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json', ...(import.meta.env.DEV ? { 'X-Rindo-Jev': '1' } : {}) },
      body: JSON.stringify({ transactionId }), signal: controller.signal,
    });
    if (!response.ok) throw new Error('No se pudo categorizar');
    const result = await response.json();
    if (!result.success) throw new Error('No se pudo categorizar');
    return result;
  } finally { clearTimeout(timeout); }
}
