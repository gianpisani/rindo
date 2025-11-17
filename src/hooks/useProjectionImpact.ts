import { Transaction } from "./useTransactions";
import { startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, isBefore } from "date-fns";

export function calculateProjectionImpact(
  transactions: Transaction[],
  newTransaction?: Transaction
): { currentProjection: number; newProjection: number; impact: number } {
  const allTransactions = newTransaction 
    ? [...transactions, newTransaction]
    : transactions;

  // Calcular patrimonio acumulado mes a mes (últimos 12 meses)
  const last12Months = eachMonthOfInterval({
    start: subMonths(new Date(), 11),
    end: new Date(),
  });

  const monthlyPatrimonio = last12Months.map((month) => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);

    const transactionsUntilMonth = allTransactions.filter((t) => {
      const date = new Date(t.date);
      return isBefore(date, monthEnd) || date.getTime() === monthEnd.getTime();
    });

    const income = transactionsUntilMonth
      .filter((t) => t.type === "Ingreso")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const expenses = transactionsUntilMonth
      .filter((t) => t.type === "Gasto")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const patrimonio = income - expenses;

    const monthTransactions = allTransactions.filter((t) => {
      const date = new Date(t.date);
      return date >= monthStart && date <= monthEnd;
    });
    
    const hasIncome = monthTransactions.some((t) => t.type === "Ingreso");

    return {
      patrimonio,
      hasIncome,
    };
  });

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const completeMonths = monthlyPatrimonio.filter((m, index) => {
    const monthDate = last12Months[index];
    const isCurrentMonth = monthDate.getMonth() === currentMonth && monthDate.getFullYear() === currentYear;
    
    if (isCurrentMonth) {
      return m.hasIncome;
    }
    
    return m.hasIncome;
  });
  
  const recentCompleteMonths = completeMonths.slice(-Math.min(6, completeMonths.length));
  
  let avgMonthlyGrowth = 0;
  if (recentCompleteMonths.length >= 2) {
    const growths = [];
    for (let i = 1; i < recentCompleteMonths.length; i++) {
      const growth = recentCompleteMonths[i].patrimonio - recentCompleteMonths[i - 1].patrimonio;
      growths.push(growth);
    }
    avgMonthlyGrowth = growths.reduce((sum, g) => sum + g, 0) / growths.length;
  }

  const currentPatrimonio = monthlyPatrimonio[monthlyPatrimonio.length - 1]?.patrimonio || 0;
  
  // Proyección a 3 meses
  const projection = currentPatrimonio + (avgMonthlyGrowth * 3);

  // Calcular sin la nueva transacción para comparar
  if (newTransaction) {
    const oldResult = calculateProjectionImpact(transactions);
    return {
      currentProjection: oldResult.newProjection,
      newProjection: projection,
      impact: projection - oldResult.newProjection,
    };
  }

  return {
    currentProjection: projection,
    newProjection: projection,
    impact: 0,
  };
}
