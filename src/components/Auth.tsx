import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card } from "./ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  ChartBarIcon, 
  CurrencyDollarIcon, 
  ClipboardDocumentCheckIcon, 
  BoltIcon, 
  BanknotesIcon,
  CheckBadgeIcon,
  CursorArrowRaysIcon,
  FaceSmileIcon
} from "@heroicons/react/24/outline";
import { CommandIcon } from "lucide-react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadLinksPreset } from "@tsparticles/preset-links";
import type { Engine } from "@tsparticles/engine";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [particlesInit, setParticlesInit] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    initParticlesEngine(async (engine: Engine) => {
      await loadLinksPreset(engine);
    }).then(() => {
      setParticlesInit(true);
    });
  }, []);

  const particlesOptions = useMemo(
    () => ({
      preset: "links",
      background: {
        color: {
          value: "transparent",
        },
      },
      particles: {
        color: {
          value: "#3b82f6",
        },
        links: {
          color: "#3b82f6",
          distance: 150,
          enable: true,
          opacity: 0.3,
          width: 1,
        },
        move: {
          enable: true,
          speed: 1,
        },
        number: {
          value: 80,
        },
        opacity: {
          value: 0.5,
        },
        size: {
          value: { min: 1, max: 3 },
        },
      },
    }),
    []
  );

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast({
          title: "¡Bienvenido de vuelta!",
          description: "Has iniciado sesión correctamente",
        });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        toast({
          title: "¡Cuenta creada!",
          description: "Tu cuenta ha sido creada exitosamente. Verifica tu correo.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col lg:flex-row">
      {/* Left Panel - Brand & Value Proposition (Hidden on mobile) */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-black via-gray-950 to-black p-12 flex-col justify-between relative overflow-hidden">
        {/* tsParticles Background */}
        {particlesInit && (
          <Particles
            className="absolute inset-0"
            options={particlesOptions}
          />
        )}

        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-16">
            <img src="/icon-512x512.png" alt="Rindo" className="h-12 w-12" />
            <div>
              <h1 className="text-3xl font-bold text-white">
                Rindo<span className="text-blue">.</span>
              </h1>
              <p className="text-xs text-gray-400 uppercase tracking-widest">Finanzas Personales</p>
            </div>
          </div>

          {/* Value Props */}
          <div className="space-y-8">
            <div className="flex gap-4">
              <div className="p-3 rounded-xl bg-blue/10 border border-blue/20 h-fit">
                <CommandIcon className="h-6 w-6 text-blue" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Atajos de teclado</h3>
                <p className="text-gray-400 text-sm">Cmd+K para todo. Cero fricción.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="p-3 rounded-xl bg-blue/10 border border-blue/20 h-fit">
                <BanknotesIcon className="h-6 w-6 text-blue" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Análisis en tiempo real</h3>
                <p className="text-gray-400 text-sm">Proyecciones automáticas basadas en tus patrones de gasto</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="p-3 rounded-xl bg-blue/10 border border-blue/20 h-fit">
                <CheckBadgeIcon className="h-6 w-6 text-blue" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Reconciliación bancaria</h3>
                <p className="text-gray-400 text-sm">Compara tus transacciones con extractos reales</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="p-3 rounded-xl bg-blue/10 border border-blue/20 h-fit">
                <CursorArrowRaysIcon className="h-6 w-6 text-blue" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Categorización inteligente</h3>
                <p className="text-gray-400 text-sm">ML que aprende de tus hábitos. Lo configurás una vez y listo.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-gray-500 text-sm">
            Hecho para que no sea tan personal
          </p>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-white dark:bg-background">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center space-y-4 mb-8">
            <img src="/icon-512x512.png" alt="Rindo" className="h-16 w-16 mx-auto rounded-full" />
            <div>
              <h1 className="text-3xl font-bold">
                Rindo<span className="text-blue">.</span>
              </h1>
              <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">
                Finanzas Personales
              </p>
            </div>
          </div>

          {/* Header */}
          <div className="text-center lg:text-left space-y-2">
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight">
              {isLogin ? "Bienvenido de vuelta" : "Empecemos"}
            </h2>
            <p className="text-muted-foreground">
              {isLogin
                ? "Registra. Analiza. Optimiza."
                : "Finanzas personales pero no tan personales"}
            </p>
          </div>

          {/* Form */}
          <Card className="p-6 lg:p-8 shadow-card">
            <form onSubmit={handleAuth} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Correo electrónico
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 transition-all"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Contraseña
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 transition-all"
                  required
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  minLength={6}
                />
                {!isLogin && (
                  <p className="text-xs text-muted-foreground">
                    Mínimo 6 caracteres
                  </p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full h-11 font-medium shadow-sm hover:shadow-md transition-all" 
                disabled={loading}
              >
                {loading ? "Cargando..." : isLogin ? "Iniciar Sesión" : "Crear Cuenta"}
              </Button>
            </form>
          </Card>

          {/* Toggle Auth Mode */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              {isLogin ? (
                <>
                  ¿No tienes cuenta? <span className="text-blue">Regístrate aquí</span>
                </>
              ) : (
                <>
                  ¿Ya tienes cuenta? <span className="text-blue">Inicia sesión</span>
                </>
              )}
            </button>
          </div>

          {/* Mobile Value Props */}
          <div className="lg:hidden pt-8 space-y-4 border-t border-border">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue/10">
                <FaceSmileIcon className="h-4 w-4 text-blue" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold mb-0.5">Registra tus gastos en segundos</h4>
                <p className="text-xs text-muted-foreground">Toca, escribe, listo. Sin fricciones.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue/10">
                <BanknotesIcon className="h-4 w-4 text-blue" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold mb-0.5">Categorización automática</h4>
                <p className="text-xs text-muted-foreground">Aprendizaje automático que mejora con el uso</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue/10">
                <CheckBadgeIcon className="h-4 w-4 text-blue" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold mb-0.5">Proyecciones inteligentes</h4>
                <p className="text-xs text-muted-foreground">Predicciones basadas en tu comportamiento histórico</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}