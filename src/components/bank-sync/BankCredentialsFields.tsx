import { Eye, EyeOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Bank } from "@/lib/banks";
import type { BankSyncFormState } from "@/hooks/useBankSyncForm";

interface BankCredentialsFieldsProps {
  bank: Bank;
  form: BankSyncFormState;
}

export function BankCredentialsFields({ bank, form }: BankCredentialsFieldsProps) {
  const { rut, handleRutChange, setRutTouched, showRutError, password, setPassword, showPassword, setShowPassword } = form;

  return (
    <div className="relative">
      <div className="absolute -inset-[1px] rounded-card opacity-40" style={{ background: `linear-gradient(135deg, ${bank.color}50, transparent 50%, ${bank.color}20)` }} />
      <div className="relative rounded-card backdrop-blur-xl p-4 space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-full" style={{ backgroundColor: `${bank.color}15` }}>
            <Lock className="h-3.5 w-3.5" style={{ color: bank.color }} />
          </div>
          <div>
            <p className="text-sm font-medium">Credenciales de acceso</p>
            <p className="text-xs text-muted-foreground">Encriptadas de extremo a extremo</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bank-rut" className="text-sm">RUT</Label>
          <Input
            id="bank-rut"
            placeholder="20799959-8"
            value={rut}
            onChange={handleRutChange}
            onBlur={() => setRutTouched(true)}
            required
            autoComplete="username"
            className={cn("rounded-card h-10 bg-transparent border-border", showRutError && "border-destructive focus-visible:ring-destructive")}
          />
          {showRutError && <p className="text-xs text-destructive">RUT inválido</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bank-password" className="text-sm">Clave de internet</Label>
          <div className="relative">
            <Input
              id="bank-password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="rounded-card pr-10 h-10 bg-transparent border-border"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent cursor-pointer"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
