import { useState } from 'react'
import { BaseModal } from './BaseModal'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Loader2, Shield, Eye, EyeOff } from 'lucide-react'
import { Alert, AlertDescription } from './ui/alert'

interface FintualConnectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConnect: (email: string, password: string) => Promise<boolean>
  isLoading: boolean
}

export function FintualConnectionModal({
  open,
  onOpenChange,
  onConnect,
  isLoading,
}: FintualConnectionModalProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const success = await onConnect(email, password)
    if (success) {
      setEmail('')
      setPassword('')
      onOpenChange(false)
    }
  }

  return (
    <BaseModal
      open={open}
      onOpenChange={onOpenChange}
      title=""
      description="Sincroniza tus inversiones de Fintual"
      maxWidth="md"
      variant="investment"
    >
      {isLoading ? (
        // Loading personalizado de Fintual
        <div className="flex flex-col items-center justify-center py-12 space-y-6">
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl animate-pulse" />
            
            {/* Anillo giratorio */}
            <div className="absolute -inset-2 rounded-full border-2 border-transparent border-t-blue-500/40 animate-spin [animation-duration:2s]" />
            
            {/* Logo de Fintual */}
            <img
              src="/isotipo-fintual.png"
              alt="Fintual"
              className="relative z-10 h-16 w-16 animate-breathe drop-shadow-lg"
            />
            
            {/* Puntos orbitando */}
            <div className="absolute inset-0 animate-spin [animation-duration:1.5s]">
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-blue-500" />
            </div>
            <div className="absolute inset-0 animate-spin [animation-duration:2s] [animation-direction:reverse]">
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-blue-400" />
            </div>
          </div>
          
          <div className="text-center space-y-2">
            <p className="text-lg font-semibold">Conectando con Fintual</p>
            <p className="text-sm text-muted-foreground">Obteniendo tus inversiones...</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Logo de Fintual */}
          <div className="flex justify-center">
            <img 
              src="/logo-fintual.png" 
              alt="Fintual" 
              className="h-12 opacity-90"
            />
          </div>
        <Alert className="border-blue-500/30 bg-blue-500/5">
          <Shield className="h-4 w-4 text-blue-500" />
          <AlertDescription className="text-sm text-muted-foreground ml-2">
            <strong className="text-foreground">100% seguro:</strong> Solo obtenemos un token de lectura.
            Tu contraseña nunca se guarda, solo se usa para obtener acceso a tus metas de inversión.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fintual-email">Email de Fintual</Label>
            <Input
              id="fintual-email"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fintual-password">Contraseña de Fintual</Label>
            <div className="relative">
              <Input
                id="fintual-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="current-password"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isLoading || !email || !password}
            className="flex-1 bg-blue-500 hover:bg-blue-600"
          >
            Conectar
          </Button>
        </div>
      </form>
      )}
    </BaseModal>
  )
}
