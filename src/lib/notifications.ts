import { supabase } from '@/integrations/supabase/client';

interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
}

/**
 * Envía una notificación push al usuario actual
 */
export async function sendPushNotification(notification: NotificationPayload) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('No user authenticated');
      return { success: false, error: 'No user authenticated' };
    }

    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        userId: user.id,
        notification: {
          ...notification,
          icon: notification.icon || '/icon-192x192.png',
          badge: notification.badge || '/icon-192x192.png',
        }
      }
    });

    if (error) {
      console.error('Error sending push notification:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error in sendPushNotification:', error);
    return { success: false, error };
  }
}

/**
 * Notificaciones predefinidas para eventos comunes
 */
export const NotificationTemplates = {
  newTransaction: (amount: number, category: string, type: string) => ({
    title: `Nueva transacción`,
    body: `${type} de $${amount.toLocaleString('es-CL')} en ${category}`,
    tag: 'transaction',
  }),

  categoryLimitReached: (category: string, percentage: number) => ({
    title: `Límite de categoría`,
    body: `Has alcanzado el ${percentage}% del límite en ${category}`,
    tag: 'category-limit',
    requireInteraction: true,
  }),

  fintualSyncComplete: (totalAmount: number) => ({
    title: 'Sincronización completada',
    body: `Fintual sincronizado: $${totalAmount.toLocaleString('es-CL')}`,
    tag: 'fintual-sync',
  }),

  reconciliationNeeded: (count: number) => ({
    title: 'Reconciliación pendiente',
    body: `Tienes ${count} transacciones por reconciliar`,
    tag: 'reconciliation',
  }),

  weeklyReport: (balance: number, expenses: number) => ({
    title: 'Resumen semanal',
    body: `Balance: $${balance.toLocaleString('es-CL')} | Gastos: $${expenses.toLocaleString('es-CL')}`,
    tag: 'weekly-report',
  }),

  monthlyReport: (income: number, expenses: number, savings: number) => ({
    title: 'Resumen mensual',
    body: `Ingresos: $${income.toLocaleString('es-CL')} | Gastos: $${expenses.toLocaleString('es-CL')} | Ahorro: $${savings.toLocaleString('es-CL')}`,
    tag: 'monthly-report',
    requireInteraction: true,
  }),
};

