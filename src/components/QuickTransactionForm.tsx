import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { TrendingUp, TrendingDown, PiggyBank } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import { useTransactions } from "@/hooks/useTransactions";
import { format } from "date-fns";

const typeConfig = {
  Ingreso: { icon: TrendingUp, color: "bg-success text-success-foreground" },
  Gasto: { icon: TrendingDown, color: "bg-destructive text-destructive-foreground" },
  Inversión: { icon: PiggyBank, color: "bg-info text-info-foreground" },
};

export default function QuickTransactionForm() {
  const [amount, setAmount] = useState("");
  const [selectedType, setSelectedType] = useState<"Ingreso" | "Gasto" | "Inversión" | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [detail, setDetail] = useState("");

  const { categories } = useCategories();
  const { addTransaction } = useTransactions();

  const filteredCategories = categories.filter((cat) => cat.type === selectedType);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType || !selectedCategory || !amount) return;

    await addTransaction.mutateAsync({
      amount: parseFloat(amount),
      type: selectedType,
      category_name: selectedCategory,
      detail: detail || null,
      date: format(new Date(), "yyyy-MM-dd"),
    });

    // Reset form
    setAmount("");
    setSelectedType(null);
    setSelectedCategory("");
    setDetail("");
  };

  const formatCurrency = (value: string) => {
    const number = value.replace(/\D/g, "");
    if (!number) return "";
    const formatted = new Intl.NumberFormat("es-CL").format(parseInt(number));
    return `$${formatted}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agregar Transacción Rápida</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-lg">
              Monto
            </Label>
            <Input
              id="amount"
              type="text"
              placeholder="$0"
              value={amount}
              onChange={(e) => {
                const formatted = formatCurrency(e.target.value);
                setAmount(formatted);
              }}
              className="text-3xl h-16 text-center font-bold"
              autoFocus
            />
          </div>

          <div className="space-y-3">
            <Label className="text-lg">Tipo</Label>
            <div className="grid grid-cols-3 gap-3">
              {(Object.keys(typeConfig) as Array<keyof typeof typeConfig>).map((type) => {
                const { icon: Icon, color } = typeConfig[type];
                return (
                  <Button
                    key={type}
                    type="button"
                    variant={selectedType === type ? "default" : "outline"}
                    className={`h-20 flex flex-col gap-2 ${
                      selectedType === type ? color : ""
                    }`}
                    onClick={() => {
                      setSelectedType(type);
                      setSelectedCategory("");
                    }}
                  >
                    <Icon className="h-6 w-6" />
                    <span className="text-sm">{type}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {selectedType && (
            <div className="space-y-3 animate-fade-in">
              <Label className="text-lg">Categoría</Label>
              <div className="flex flex-wrap gap-2">
                {filteredCategories.map((category) => (
                  <Badge
                    key={category.id}
                    variant={selectedCategory === category.name ? "default" : "outline"}
                    className="cursor-pointer px-4 py-2 text-sm"
                    style={
                      selectedCategory === category.name && category.color
                        ? { backgroundColor: category.color, borderColor: category.color }
                        : {}
                    }
                    onClick={() => setSelectedCategory(category.name)}
                  >
                    {category.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {selectedCategory && (
            <div className="space-y-2 animate-fade-in">
              <Label htmlFor="detail">Detalle (opcional)</Label>
              <Input
                id="detail"
                placeholder="Describe la transacción..."
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
              />
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-12 text-lg"
            disabled={!amount || !selectedType || !selectedCategory || addTransaction.isPending}
          >
            {addTransaction.isPending ? "Guardando..." : "Agregar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}