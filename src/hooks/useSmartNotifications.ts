import { useEffect } from "react";
import { useNotifications } from "./useNotifications";
import { Transaction } from "./useTransactions";
import { startOfDay, startOfWeek, differenceInDays, format } from "date-fns";
import { es } from "date-fns/locale";

interface NotificationSchedule {
  lastDailyReminder?: string;
  lastWeeklySummary?: string;
  lastTransactionDate?: string;
}

export function useSmartNotifications(transactions: Transaction[]) {
  const { sendNotification, permission } = useNotifications();

  useEffect(() => {
    if (permission !== "granted" || transactions.length === 0) return;

    const schedule = getNotificationSchedule();
    const now = new Date();
    const today = startOfDay(now);

    // 1. Recordatorio diario (9 AM)
    if (now.getHours() === 9 && !schedule.lastDailyReminder) {
      const lastTransaction = transactions[0];
      const daysSinceLastTransaction = differenceInDays(
        now,
        new Date(lastTransaction.date)
      );

      if (daysSinceLastTransaction > 1) {
        sendNotification("💰 Recordatorio financiero", {
          body: `Hace ${daysSinceLastTransaction} días que no registras transacciones. ¿Todo al día?`,
          tag: "daily-reminder",
        });
        updateSchedule({ lastDailyReminder: today.toISOString() });
      }
    }

    // 2. Resumen semanal (Lunes 10 AM)
    if (now.getDay() === 1 && now.getHours() === 10) {
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      if (!schedule.lastWeeklySummary || new Date(schedule.lastWeeklySummary) < weekStart) {
        const weekTransactions = transactions.filter(
          (t) => new Date(t.date) >= weekStart
        );
        
        const gastos = weekTransactions
          .filter((t) => t.type === "Gasto")
          .reduce((sum, t) => sum + t.amount, 0);
        
        const ingresos = weekTransactions
          .filter((t) => t.type === "Ingreso")
          .reduce((sum, t) => sum + t.amount, 0);

        sendNotification("📊 Resumen semanal", {
          body: `Esta semana: +$${ingresos.toLocaleString()} ingresos, -$${gastos.toLocaleString()} gastos`,
          tag: "weekly-summary",
        });
        updateSchedule({ lastWeeklySummary: today.toISOString() });
      }
    }

    // 3. Alerta de gasto grande (inmediata)
    const recentTransaction = transactions[0];
    if (recentTransaction && schedule.lastTransactionDate !== recentTransaction.created_at) {
      if (recentTransaction.type === "Gasto") {
        const avgExpense = calculateAverageExpense(transactions);
        
        if (recentTransaction.amount > avgExpense * 2) {
          sendNotification("⚠️ Gasto importante detectado", {
            body: `$${recentTransaction.amount.toLocaleString()} en ${recentTransaction.category_name}. Es ${Math.round(
              recentTransaction.amount / avgExpense
            )}x tu gasto promedio.`,
            tag: "large-expense",
          });
        }
      }
      updateSchedule({ lastTransactionDate: recentTransaction.created_at });
    }

    // 4. Alerta de presupuesto mensual (cuando se supera el promedio)
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthTransactions = transactions.filter(
      (t) => new Date(t.date) >= currentMonth
    );
    
    const monthExpenses = monthTransactions
      .filter((t) => t.type === "Gasto")
      .reduce((sum, t) => sum + t.amount, 0);
    
    const avgMonthlyExpense = calculateAverageMonthlyExpense(transactions);
    
    if (monthExpenses > avgMonthlyExpense && now.getDate() > 15) {
      const key = `budget-alert-${format(now, "yyyy-MM")}`;
      if (!localStorage.getItem(key)) {
        sendNotification("📈 Alerta de presupuesto", {
          body: `Ya gastaste $${monthExpenses.toLocaleString()} este mes (promedio: $${Math.round(avgMonthlyExpense).toLocaleString()})`,
          tag: "budget-alert",
        });
        localStorage.setItem(key, "sent");
      }
    }
  }, [transactions, permission, sendNotification]);
}

function getNotificationSchedule(): NotificationSchedule {
  const data = localStorage.getItem("notification-schedule");
  return data ? JSON.parse(data) : {};
}

function updateSchedule(updates: Partial<NotificationSchedule>) {
  const current = getNotificationSchedule();
  localStorage.setItem(
    "notification-schedule",
    JSON.stringify({ ...current, ...updates })
  );
}

function calculateAverageExpense(transactions: Transaction[]): number {
  const expenses = transactions.filter((t) => t.type === "Gasto");
  if (expenses.length === 0) return 0;
  return expenses.reduce((sum, t) => sum + t.amount, 0) / expenses.length;
}

function calculateAverageMonthlyExpense(transactions: Transaction[]): number {
  const monthsMap = new Map<string, number>();
  
  transactions
    .filter((t) => t.type === "Gasto")
    .forEach((t) => {
      const monthKey = format(new Date(t.date), "yyyy-MM");
      monthsMap.set(monthKey, (monthsMap.get(monthKey) || 0) + t.amount);
    });
  
  if (monthsMap.size === 0) return 0;
  const total = Array.from(monthsMap.values()).reduce((sum, val) => sum + val, 0);
  return total / monthsMap.size;
}
