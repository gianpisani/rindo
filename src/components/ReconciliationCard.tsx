import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Calculator, CreditCard, Wallet, AlertTriangle, Wand2, CheckCircle2, ArrowRight, PencilRuler } from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";

export default function ReconciliationCard() {
  const { transactions, addTransaction } = useTransactions();
  const { categories } = useCategories();
  const [cuentaCorriente, setCuentaCorriente] = useState<string>("");
  const [tarjetaCredito, setTarjetaCredito] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);

  // Calcular balance de la app automáticamente
  const balanceApp = transactions.reduce((acc, transaction) => {
    if (transaction.type === "Ingreso") {
      return acc + Number(transaction.amount);
    } else if (transaction.type === "Gasto" || transaction.type === "Inversión") {
      return acc - Number(transaction.amount);
    }
    return acc;
  }, 0);

  const cuentaCorrienteNum = parseFloat(cuentaCorriente) || 0;
  const tarjetaCreditoNum = parseFloat(tarjetaCredito) || 0;

  // Balance Real = Cuenta Corriente - Tarjeta de Crédito
  const balanceReal = cuentaCorrienteNum - tarjetaCreditoNum;

  // Diferencia a Conciliar = Balance Real - Balance App
  const diferencia = balanceReal - balanceApp;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
    }).format(amount);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (value: string) => void
  ) => {
    const value = e.target.value.replace(/[^\d]/g, "");
    setter(value);
  };

  // Persistir en localStorage
  useEffect(() => {
    const saved = localStorage.getItem("reconciliation-data");
    if (saved) {
      const { cc, tc } = JSON.parse(saved);
      setCuentaCorriente(cc || "");
      setTarjetaCredito(tc || "");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "reconciliation-data",
      JSON.stringify({ cc: cuentaCorriente, tc: tarjetaCredito })
    );
  }, [cuentaCorriente, tarjetaCredito]);

  const diferenciaColor = 
    Math.abs(diferencia) < 1000 
      ? "text-success" 
      : diferencia > 0 
      ? "text-warning" 
      : "text-destructive";

  const needsReconciliation = Math.abs(diferencia) >= 1000;

  const handleCreateReconciliation = async () => {
    if (!needsReconciliation) return;
    
    setIsCreating(true);
    
    try {
      // Buscar categoría de conciliación o usar "Otros"
      const conciliacionCategory = categories.find(c => 
        c.name.toLowerCase().includes("conciliación") || 
        c.name.toLowerCase().includes("ajuste")
      );
      const categoryName = conciliacionCategory?.name || "Otros";
      
      const type = diferencia > 0 ? "Ingreso" : "Gasto";
      
      await addTransaction.mutateAsync({
        date: new Date().toISOString().split("T")[0],
        detail: `Conciliación automática - Ajuste de ${formatCurrency(Math.abs(diferencia))}`,
        category_name: categoryName,
        type: type,
        amount: Math.abs(diferencia),
      });
      
      // Limpiar inputs después de conciliar
      setCuentaCorriente("");
      setTarjetaCredito("");
    } finally {
      setIsCreating(false);
    }
  };

  const hasInputs = cuentaCorrienteNum > 0 || tarjetaCreditoNum > 0;

  return (
    <Card className="rounded-2xl shadow-elevated border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          <CardTitle className="text-base font-semibold">Conciliación Rápida</CardTitle>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Inputs compactos */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cuenta-corriente" className="flex items-center gap-1.5 text-xs font-medium text-green-600">
              <Wallet className="h-3.5 w-3.5" />
              Cta. Corriente
            </Label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input
                id="cuenta-corriente"
                type="text"
                placeholder="0"
                value={cuentaCorriente}
                onChange={(e) => handleInputChange(e, setCuentaCorriente)}
                className="text-base font-semibold pl-6 h-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tarjeta-credito" className="flex items-center gap-1.5 text-xs font-medium text-red-600">
              <CreditCard className="h-3.5 w-3.5" />
              Tarjeta Crédito (Deuda)
            </Label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input
                id="tarjeta-credito"
                type="text"
                placeholder="0"
                value={tarjetaCredito}
                onChange={(e) => handleInputChange(e, setTarjetaCredito)}
                className="text-base font-semibold pl-6 h-9"
              />
            </div>
          </div>
        </div>

        {/* Results compactos */}
        {hasInputs && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Balance Real</span>
              <span className={`font-semibold ${balanceReal >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(balanceReal)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Balance App</span>
              <span className={`font-semibold ${balanceApp >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(balanceApp)}
              </span>
            </div>

            {/* Diferencia y botón */}
            <div className={`rounded-lg p-2.5 mt-2 ${
              !needsReconciliation 
                ? "bg-green-500/10 border border-green-500/20" 
                : "bg-destructive/10 border border-destructive/20"
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {!needsReconciliation ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  )}
                  <span className="text-xs font-medium">
                    {!needsReconciliation ? "Conciliado" : "Diferencia"}
                  </span>
                </div>
                <span className={`text-lg font-bold ${diferenciaColor}`}>
                  {formatCurrency(Math.abs(diferencia))}
                </span>
              </div>
              
              {needsReconciliation && (
                <Button 
                  onClick={handleCreateReconciliation}
                  disabled={isCreating}
                  className="w-full h-8 text-xs font-semibold mt-2"
                  size="sm"
                >
                  {isCreating ? (
                    <>
                      <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1.5" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <PencilRuler className="h-3.5 w-3.5 mr-1.5" />
                      Conciliar
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

