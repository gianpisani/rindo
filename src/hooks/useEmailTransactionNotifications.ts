import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNotifications } from "./useNotifications";
import { Transaction } from "./useTransactions";

export function useEmailTransactionNotifications() {
  const { sendNotification } = useNotifications();

  useEffect(() => {
    const channel = supabase
      .channel('email-transactions')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions'
        },
        (payload) => {
          const newTransaction = payload.new as Transaction;
          
          // Check if this transaction came from email (has the 📧 emoji)
          if (newTransaction.detail?.includes('📧')) {
            const isIngreso = newTransaction.type === 'Ingreso';
            const icon = isIngreso ? '💰' : '💳';
            const typeText = isIngreso ? 'Ingreso' : 'Gasto';
            
            sendNotification(
              `${icon} Nuevo ${typeText} desde Email`,
              {
                body: `$${newTransaction.amount.toLocaleString()} - ${newTransaction.detail.replace('📧 ', '')}`,
                tag: 'email-transaction',
                requireInteraction: true,
              }
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sendNotification]);
}
