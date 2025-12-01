import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from "./ui/drawer";
import { X, Plus, Trash2, Users } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Checkbox } from "./ui/checkbox";

interface Debtor {
  name: string;
  amount: number;
}

interface SharedExpenseDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalAmount: number;
  onConfirm: (debtors: Debtor[]) => void;
}

export default function SharedExpenseDrawer({ 
  open, 
  onOpenChange, 
  totalAmount,
  onConfirm 
}: SharedExpenseDrawerProps) {
  const [splitMode, setSplitMode] = useState<"equal" | "manual">("equal");
  const [includeMe, setIncludeMe] = useState(true);
  const [debtors, setDebtors] = useState<Debtor[]>([
    { name: "", amount: 0 },
  ]);

  const handleAddDebtor = () => {
    setDebtors([...debtors, { name: "", amount: 0 }]);
  };

  const handleRemoveDebtor = (index: number) => {
    if (debtors.length > 1) {
      setDebtors(debtors.filter((_, i) => i !== index));
    }
  };

  const handleDebtorNameChange = (index: number, name: string) => {
    const updated = [...debtors];
    updated[index].name = name;
    setDebtors(updated);
  };

  const handleDebtorAmountChange = (index: number, amount: number) => {
    const updated = [...debtors];
    updated[index].amount = amount;
    setDebtors(updated);
  };

  const calculateEqualSplit = () => {
    const validDebtors = debtors.filter(d => d.name.trim() !== "").length;
    const totalPeople = includeMe ? validDebtors + 1 : validDebtors;
    if (totalPeople === 0) return 0;
    return Math.round(totalAmount / totalPeople);
  };

  const handleConfirm = () => {
    let finalDebtors: Debtor[];

    if (splitMode === "equal") {
      const amountPerPerson = calculateEqualSplit();
      finalDebtors = debtors
        .filter(d => d.name.trim() !== "")
        .map(d => ({ ...d, amount: amountPerPerson }));
    } else {
      finalDebtors = debtors.filter(d => d.name.trim() !== "" && d.amount > 0);
    }

    if (finalDebtors.length === 0) return;

    onConfirm(finalDebtors);
    onOpenChange(false);
    
    // Reset
    setDebtors([{ name: "", amount: 0 }]);
    setSplitMode("equal");
    setIncludeMe(true);
  };

  const validDebtorsCount = debtors.filter(d => d.name.trim() !== "").length;
  const totalSplit = splitMode === "equal" 
    ? calculateEqualSplit() * validDebtorsCount
    : debtors.reduce((sum, d) => sum + d.amount, 0);

  const myShare = includeMe ? (splitMode === "equal" ? calculateEqualSplit() : totalAmount - totalSplit) : 0;

  const isValid = 
    debtors.some(d => d.name.trim() !== "") &&
    (splitMode === "equal" || (includeMe ? Math.abs(totalSplit + myShare - totalAmount) < 1 : Math.abs(totalSplit - totalAmount) < 1));

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="sm:w-[60vw] mx-auto">
        <DrawerHeader className="pb-2 flex-shrink-0">
          <DrawerTitle className="flex items-center justify-center gap-2 text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
            <Users className="h-5 w-5 text-purple-400" />
            Gasto Compartido
          </DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4 space-y-6" style={{ 
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain'
        }}>
          {/* Total */}
          <div className="bg-primary/10 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground">Total del gasto</p>
            <p className="text-3xl font-bold text-primary">
              ${new Intl.NumberFormat("es-CL").format(totalAmount)}
            </p>
          </div>

          {/* Include Me */}
          <div className="flex items-center justify-between p-4 rounded-lg border-2 border-primary/20 bg-primary/5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <Label htmlFor="includeMe" className="font-semibold cursor-pointer">
                  Yo también participo
                </Label>
                <p className="text-xs text-muted-foreground">
                  {includeMe ? "Te incluiremos en la división" : "Solo dividir entre otros"}
                </p>
              </div>
            </div>
            <Checkbox 
              id="includeMe" 
              checked={includeMe}
              onCheckedChange={(checked) => setIncludeMe(checked as boolean)}
            />
          </div>

          {/* Split Mode */}
          <div className="space-y-3">
            <Label>¿Cómo dividir?</Label>
            <RadioGroup value={splitMode} onValueChange={(v) => setSplitMode(v as "equal" | "manual")}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="equal" id="equal" />
                <Label htmlFor="equal" className="font-normal cursor-pointer">
                  Partes iguales
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="manual" id="manual" />
                <Label htmlFor="manual" className="font-normal cursor-pointer">
                  Montos personalizados
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Debtors List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Personas que deben</Label>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={handleAddDebtor}
              >
                <Plus className="h-4 w-4 mr-1" />
                Agregar
              </Button>
            </div>

            {debtors.map((debtor, index) => (
              <div key={index} className="flex gap-2 items-start">
                <div className="flex-1 space-y-1">
                  <Input
                    placeholder="Nombre"
                    value={debtor.name}
                    onChange={(e) => handleDebtorNameChange(index, e.target.value)}
                  />
                </div>

                {splitMode === "manual" && (
                  <div className="w-32 space-y-1">
                    <Input
                      type="number"
                      placeholder="Monto"
                      value={debtor.amount || ""}
                      onChange={(e) => handleDebtorAmountChange(index, parseFloat(e.target.value) || 0)}
                    />
                  </div>
                )}

                {splitMode === "equal" && debtor.name.trim() && (
                  <div className="w-32 flex items-center justify-center h-10 text-sm text-muted-foreground bg-muted rounded-md">
                    ${new Intl.NumberFormat("es-CL").format(calculateEqualSplit())}
                  </div>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveDebtor(index)}
                  disabled={debtors.length === 1}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          {/* My Share Display */}
          {includeMe && (
            <div className="bg-blue-500/10 text-blue-600 dark:text-blue-400 p-3 rounded-lg">
              <div className="flex justify-between items-center text-sm">
                <span>Tu parte:</span>
                <span className="font-bold">
                  ${new Intl.NumberFormat("es-CL").format(myShare)}
                </span>
              </div>
            </div>
          )}

          {/* Validation */}
          {splitMode === "manual" && (
            <div className={`text-sm p-3 rounded-lg ${
              (includeMe ? Math.abs(totalSplit + myShare - totalAmount) < 1 : Math.abs(totalSplit - totalAmount) < 1)
                ? "bg-green-500/10 text-green-600 dark:text-green-400" 
                : "bg-destructive/10 text-destructive"
            }`}>
              <div className="flex justify-between items-center">
                <span>Total repartido:</span>
                <span className="font-bold">
                  ${new Intl.NumberFormat("es-CL").format(includeMe ? totalSplit + myShare : totalSplit)}
                </span>
              </div>
              {(includeMe ? Math.abs(totalSplit + myShare - totalAmount) >= 1 : Math.abs(totalSplit - totalAmount) >= 1) && (
                <p className="mt-1 text-xs">
                  Falta ${new Intl.NumberFormat("es-CL").format(includeMe ? totalAmount - totalSplit - myShare : totalAmount - totalSplit)}
                </p>
              )}
            </div>
          )}
        </div>

        <DrawerFooter className="flex-row gap-2 flex-shrink-0">
          <DrawerClose asChild>
            <Button variant="outline" className="flex-1">
              Cancelar
            </Button>
          </DrawerClose>
          <Button 
            onClick={handleConfirm} 
            disabled={!isValid}
            className="flex-1"
          >
            Confirmar
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

