import { useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSharedExpenses } from "@/hooks/useSharedExpenses";
import { Users, CheckCircle2, Clock, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function PendingDebts() {
  const { 
    pendingByDebtor, 
    sharedExpensesWithTransaction, 
    markAsPaid, 
    deleteSharedExpense,
    isLoading 
  } = useSharedExpenses();

  const [expandedDebtor, setExpandedDebtor] = useState<string | null>(null);
  const [confirmPaid, setConfirmPaid] = useState<{ id: string; name: string; amount: number; detail?: string } | null>(null);

  const toggleDebtor = (name: string) => {
    setExpandedDebtor(expandedDebtor === name ? null : name);
  };

  const handleMarkAsPaid = async () => {
    if (!confirmPaid) return;
    await markAsPaid.mutateAsync({
      sharedExpenseId: confirmPaid.id,
      debtorName: confirmPaid.name,
      amount: confirmPaid.amount,
      transactionDetail: confirmPaid.detail,
    });
    setConfirmPaid(null);
  };

  const getExpensesForDebtor = (debtorName: string) => {
    return sharedExpensesWithTransaction.filter(
      (exp) => exp.debtor_name === debtorName && !exp.paid
    );
  };

  const paidExpenses = sharedExpensesWithTransaction.filter((exp) => exp.paid);

  if (isLoading) {
    return (
      <Layout>
        <LoadingScreen fullScreen={false} size="md" />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold mb-1">Cuentas Pendientes</h1>
            <p className="text-sm text-muted-foreground">
              Gestiona los gastos compartidos con tus amigos
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Pendiente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                ${new Intl.NumberFormat("es-CL").format(
                  pendingByDebtor.reduce((sum, d) => sum + d.total_owed, 0)
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Personas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {pendingByDebtor.length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Gastos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {pendingByDebtor.reduce((sum, d) => sum + d.count_expenses, 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Debts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Pendientes
            </CardTitle>
            <CardDescription>
              Gastos compartidos que aún no han sido pagados
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingByDebtor.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No hay deudas pendientes</p>
                <p className="text-sm mt-1">¡Todos están al día! 🎉</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingByDebtor.map((debtor) => {
                  const isExpanded = expandedDebtor === debtor.debtor_name;
                  const expenses = getExpensesForDebtor(debtor.debtor_name);

                  return (
                    <div key={debtor.debtor_name} className="border rounded-lg overflow-hidden">
                      {/* Debtor Header */}
                      <div 
                        className="flex items-center justify-between p-4 bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => toggleDebtor(debtor.debtor_name)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold">{debtor.debtor_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {debtor.count_expenses} {debtor.count_expenses === 1 ? 'gasto' : 'gastos'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-base font-bold">
                            ${new Intl.NumberFormat("es-CL").format(debtor.total_owed)}
                          </Badge>
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>

                      {/* Expenses Detail */}
                      {isExpanded && (
                        <div className="p-4 space-y-3 bg-background">
                          {expenses.map((expense) => (
                            <div key={expense.id} className="flex items-start justify-between p-3 rounded-lg border">
                              <div className="flex-1">
                                <p className="font-medium">
                                  {expense.transaction_detail || "Sin detalle"}
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {new Date(expense.transaction_date).toLocaleDateString("es-CL", {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                  })}
                                </p>
                                <Badge variant="secondary" className="mt-2">
                                  {expense.transaction_category}
                                </Badge>
                              </div>
                              <div className="flex flex-col items-end gap-2 ml-4">
                                <p className="font-bold text-lg">
                                  ${new Intl.NumberFormat("es-CL").format(expense.amount_owed)}
                                </p>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      setConfirmPaid({
                                        id: expense.id,
                                        name: expense.debtor_name,
                                        amount: expense.amount_owed,
                                        detail: expense.transaction_detail || undefined,
                                      })
                                    }
                                  >
                                    <CheckCircle2 className="h-4 w-4 mr-1" />
                                    Pagado
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => deleteSharedExpense.mutate(expense.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Paid History */}
        {paidExpenses.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Pagados
              </CardTitle>
              <CardDescription>
                Historial de gastos compartidos ya pagados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {paidExpenses.slice(0, 10).map((expense) => (
                  <div key={expense.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:shadow-lg transition-shadow">
                    <div>
                      <p className="font-medium">{expense.debtor_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {expense.transaction_detail || "Sin detalle"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Pagado: {new Date(expense.paid_at!).toLocaleDateString("es-CL")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">
                        ${new Intl.NumberFormat("es-CL").format(expense.amount_owed)}
                      </p>
                      <Badge variant="outline" className="mt-1 text-green-600 border-green-600">
                        Pagado
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Confirm Paid Dialog */}
      <AlertDialog open={!!confirmPaid} onOpenChange={() => setConfirmPaid(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar pago?</AlertDialogTitle>
            <AlertDialogDescription>
              Se creará automáticamente un ingreso de{" "}
              <span className="font-bold">
                ${confirmPaid && new Intl.NumberFormat("es-CL").format(confirmPaid.amount)}
              </span>{" "}
              por el pago de <span className="font-bold">{confirmPaid?.name}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkAsPaid}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

