import { useState, useEffect } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { CreditCard, Wallet, AlertTriangle, CheckCircle2, PencilRuler, TrendingUp, TrendingDown } from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useSoundFX } from "@/hooks/useSoundFX";

interface ReconciliationCardProps {
  onSuccess?: () => void;
}

export function ReconciliationCard({ onSuccess }: ReconciliationCardProps = {}) {
  const { transactions, addTransaction } = useTransactions();
  const { categories } = useCategories();
  const { playCelebration } = useSoundFX();
  const [cuentaCorriente, setCuentaCorriente] = useState<string>("");
  const [tarjetaCredito, setTarjetaCredito] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

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

  const formatNumber = (value: string) => {
    if (!value) return "";
    return new Intl.NumberFormat("es-CL").format(Number(value));
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
        date: new Date().toISOString(),
        detail: `Conciliación automática - Ajuste de ${formatCurrency(Math.abs(diferencia))}`,
        category_name: categoryName,
        type: type,
        amount: Math.abs(diferencia),
      });
      
      // Limpiar inputs después de conciliar
      setCuentaCorriente("");
      setTarjetaCredito("");
      setShowPreview(false);

      playCelebration();

      // Llamar callback si existe
      if (onSuccess) {
        onSuccess();
      }
    } finally {
      setIsCreating(false);
    }
  };

  const hasInputs = cuentaCorrienteNum > 0 || tarjetaCreditoNum > 0;

  return (
    <div className="space-y-4">
      {/* Inputs */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="cuenta-corriente" className="flex items-center gap-2 text-sm font-medium">
            <Wallet className="h-4 w-4 text-success" />
            Cuenta Corriente
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
            <Input
              id="cuenta-corriente"
              type="text"
              placeholder="0"
              value={formatNumber(cuentaCorriente)}
              onChange={(e) => handleInputChange(e, setCuentaCorriente)}
              className="pl-7 h-11"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tarjeta-credito" className="flex items-center gap-2 text-sm font-medium">
            <CreditCard className="h-4 w-4 text-destructive" />
            Tarjeta de Crédito (Deuda)
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
            <Input
              id="tarjeta-credito"
              type="text"
              placeholder="0"
              value={formatNumber(tarjetaCredito)}
              onChange={(e) => handleInputChange(e, setTarjetaCredito)}
              className="pl-7 h-11"
            />
          </div>
        </div>
      </div>

      {/* Results */}
      {hasInputs && (
        <div className="space-y-3 pt-4 border-t">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Balance Real</span>
            <span className={`text-lg font-semibold font-mono tabular-nums ${balanceReal >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(balanceReal)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Balance App</span>
            <span className={`text-lg font-semibold font-mono tabular-nums ${balanceApp >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(balanceApp)}
            </span>
          </div>

          {/* Diferencia */}
          <div className={`rounded-lg p-4 mt-2 ${
            !needsReconciliation 
              ? "bg-success/10 border border-success/20" 
              : "bg-destructive/10 border border-destructive/20"
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {!needsReconciliation ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                )}
                <span className="text-sm font-medium">
                  {!needsReconciliation ? "Balances Conciliados ✓" : "Diferencia Detectada"}
                </span>
              </div>
              <span className={`text-xl font-bold font-mono tabular-nums ${diferenciaColor}`}>
                {formatCurrency(Math.abs(diferencia))}
              </span>
            </div>
            
            {needsReconciliation && !showPreview && (
              <Button
                onClick={() => setShowPreview(true)}
                className="w-full"
              >
                <PencilRuler className="h-4 w-4 mr-2" />
                Crear Transacción de Ajuste
              </Button>
            )}

            {needsReconciliation && showPreview && (() => {
              const type = diferencia > 0 ? "Ingreso" : "Gasto";
              const conciliacionCategory = categories.find(c =>
                c.name.toLowerCase().includes("conciliación") ||
                c.name.toLowerCase().includes("ajuste")
              );
              const categoryName = conciliacionCategory?.name || "Otros";

              return (
                <div className="space-y-3 mt-2 rounded-lg border bg-background p-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preview de transacción</p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Tipo</span>
                      <span className="flex items-center gap-1.5 font-medium">
                        {type === "Ingreso" ? <TrendingUp className="h-3.5 w-3.5 text-success" /> : <TrendingDown className="h-3.5 w-3.5 text-destructive" />}
                        {type}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Monto</span>
                      <span className="font-bold font-mono tabular-nums">{formatCurrency(Math.abs(diferencia))}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Categoría</span>
                      <span className="font-medium">{categoryName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Detalle</span>
                      <span className="text-xs truncate max-w-[160px]">Conciliación automática</span>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPreview(false)}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleCreateReconciliation}
                      disabled={isCreating}
                      className="flex-1"
                    >
                      {isCreating ? (
                        <>
                          <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1.5" />
                          Creando...
                        </>
                      ) : (
                        "Confirmar"
                      )}
                    </Button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

export default ReconciliationCard;
