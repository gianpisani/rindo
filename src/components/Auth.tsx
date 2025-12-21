import { useState, useEffect, useMemo, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card } from "./ui/card";
import { toast } from "sonner";
import {
  BanknotesIcon,
  CheckBadgeIcon,
  CursorArrowRaysIcon,
  FaceSmileIcon,
  EnvelopeIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  CheckCircleIcon
} from "@heroicons/react/24/outline";
import { CommandIcon } from "lucide-react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadLinksPreset } from "@tsparticles/preset-links";
import type { Engine } from "@tsparticles/engine";

// Memoizar las partículas para evitar re-renders
const MemoizedParticles = memo(({ options }: { options: any }) => (
  <Particles className="absolute inset-0" options={options} />
));

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [particlesInit, setParticlesInit] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [animationStage, setAnimationStage] = useState(0); // 0: idle, 1: sending, 2: sent, 3: done

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
          value: "#e11d48",
        },
        links: {
          color: "#e11d48",
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

  useEffect(() => {
    if (emailSent) {
      // Animation sequence
      setAnimationStage(1);
      setTimeout(() => setAnimationStage(2), 1000);
      setTimeout(() => setAnimationStage(3), 2500);
    }
  }, [emailSent]);

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
        toast.success("Has iniciado sesión correctamente");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        // Trigger email sent animation instead of toast
        setEmailSent(true);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error desconocido");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-sidebar flex flex-col lg:flex-row relative overflow-hidden">
      {/* tsParticles Background - Mobile (full screen) */}
      {particlesInit && (
        <div className=" absolute inset-0 pointer-events-none">
          <MemoizedParticles options={particlesOptions} />
        </div>
      )}
      
      {/* Left Panel - Brand & Value Proposition (Hidden on mobile) */}
      <div className="hidden lg:flex lg:flex-1 bg-sidebar p-12 flex-col justify-between relative overflow-hidden">
        {/* tsParticles Background */}
        {particlesInit && <MemoizedParticles options={particlesOptions} />}

        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-16">
            <div className="flex items-center gap-3">
              <img src="/icon-512x512-removebg-preview.png" alt="Rindo" className="size-12 rounded-full" />
              <div className="flex flex-col">
                <h1 className="text-3xl font-bold text-sidebar-foreground">
                  Rindo<span className="text-primary">.</span>
                </h1>
                <p className="text-xs text-sidebar-foreground/70 uppercase tracking-widest">Finanzas Personales</p>
              </div>
            </div>
          </div>

          {/* Value Props */}
          <div className="space-y-8">
            <div className="flex gap-4">
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 h-fit">
                <CommandIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-sidebar-foreground font-semibold mb-1">Atajos de teclado</h3>
                <p className="text-sidebar-foreground/70 text-sm">Cmd+K para todo. Cero fricción.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 h-fit">
                <BanknotesIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-sidebar-foreground font-semibold mb-1">Análisis en tiempo real</h3>
                <p className="text-sidebar-foreground/70 text-sm">Proyecciones automáticas basadas en tus patrones de gasto</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 h-fit">
                <CheckBadgeIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-sidebar-foreground font-semibold mb-1">Reconciliación bancaria</h3>
                <p className="text-sidebar-foreground/70 text-sm">Compara tus transacciones con extractos reales</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 h-fit">
                <CursorArrowRaysIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-sidebar-foreground font-semibold mb-1">Categorización inteligente</h3>
                <p className="text-sidebar-foreground/70 text-sm">ML que aprende de tus hábitos. Lo configurás una vez y listo.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 h-fit">
                <img src="/isotipo-fintual.png" alt="Fintual" className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sidebar-foreground font-semibold mb-1">Integración con Fintual</h3>
                <p className="text-sidebar-foreground/70 text-sm">Sincroniza tus inversiones y ten todo centralizado</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-muted-foreground text-sm">
            Hecho para trackear tus finanzas
          </p>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-background">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden text-left space-y-4 mb-8">
            <div className="flex items-center justify-center gap-3">
              <img src="/icon-512x512-removebg-preview.png" alt="Rindo" className="size-12 rounded-full" />
              <div className="flex flex-col">
                <h1 className="text-3xl font-bold">
                  Rindo<span className="text-primary">.</span>
                </h1>
                <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">
                  Finanzas Personales
                </p>
              </div>
            </div>
          </div>

          {/* Header */}
          <div className="text-center lg:text-left space-y-2">
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight">
              {isLogin ? "Bienvenido de vuelta" : "Empecemos"}
            </h2>
            <p className="text-muted-foreground">
              {isLogin
                ? "A ver cómo va la cosa"
                : "Para que no andes volando bajo"}
            </p>
          </div>

          {/* Form */}
          <Card className="p-6 lg:p-8 shadow-card relative overflow-hidden">
            {!emailSent ? (
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
            ) : (
              <div className="min-h-[320px] flex items-center justify-center">
                {/* Email Sent Animation */}
                <div className="text-center space-y-6 py-8">
                  {/* Animated envelope */}
                  <div className="relative mx-auto w-32 h-32">
                    {/* Background glow effect */}
                    <div className={`absolute inset-0 bg-primary/20 rounded-full blur-2xl transition-all duration-1000 ${animationStage >= 2 ? 'scale-150 opacity-0' : 'scale-100 opacity-100'}`} />
                    
                    {/* Envelope container */}
                    <div className="relative">
                      {/* Paper plane animation */}
                      <div className={`absolute inset-0 flex items-center justify-center transition-all duration-1000 ${
                        animationStage >= 2 
                          ? 'translate-x-32 -translate-y-32 opacity-0 rotate-45 scale-50' 
                          : 'translate-x-0 translate-y-0 opacity-0 scale-100'
                      }`}>
                        <PaperAirplaneIcon className="h-16 w-16 text-primary" />
                      </div>

                      {/* Envelope icon */}
                      <div className={`flex items-center justify-center transition-all duration-700 ${
                        animationStage === 1 
                          ? 'scale-110 rotate-12' 
                          : animationStage >= 2 
                            ? 'scale-90 opacity-0' 
                            : 'scale-100'
                      }`}>
                        <EnvelopeIcon className="h-20 w-20 text-primary" />
                      </div>

                      {/* Check circle when done */}
                      <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
                        animationStage >= 3 
                          ? 'scale-100 opacity-100' 
                          : 'scale-50 opacity-0'
                      }`}>
                        <CheckCircleIcon className="h-24 w-24 text-primary" />
                      </div>

                      {/* Sparkles */}
                      {animationStage >= 2 && (
                        <>
                          <SparklesIcon className={`absolute -top-4 -right-4 h-8 w-8 text-warning transition-all duration-500 ${
                            animationStage >= 3 ? 'opacity-0 scale-0' : 'opacity-100 scale-100 animate-pulse'
                          }`} />
                          <SparklesIcon className={`absolute -bottom-4 -left-4 h-6 w-6 text-primary transition-all duration-700 ${
                            animationStage >= 3 ? 'opacity-0 scale-0' : 'opacity-100 scale-100 animate-pulse'
                          }`} style={{ animationDelay: '150ms' }} />
                          <SparklesIcon className={`absolute top-0 -left-6 h-5 w-5 text-primary transition-all duration-600 ${
                            animationStage >= 3 ? 'opacity-0 scale-0' : 'opacity-100 scale-100 animate-pulse'
                          }`} style={{ animationDelay: '300ms' }} />
                        </>
                      )}
                    </div>
                  </div>

                  {/* Text content with transitions */}
                  <div className="space-y-3">
                    <h3 className={`text-2xl font-bold transition-all duration-500 ${
                      animationStage >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                    }`}>
                      {animationStage >= 3 ? '¡Revisa tu correo!' : 'Enviando...'}
                    </h3>
                    
                    <div className={`transition-all duration-500 delay-100 ${
                      animationStage >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                    }`}>
                      <p className="text-muted-foreground mb-2">
                        Te enviamos un link de confirmación a
                      </p>
                      <p className="font-semibold text-primary">{email}</p>
                    </div>

                    <div className={`pt-4 space-y-3 transition-all duration-500 delay-200 ${
                      animationStage >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                    }`}>
                      <div className="flex items-start gap-2 text-xs text-muted-foreground text-left bg-muted/50 p-3 rounded-lg">
                        <CheckCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                        <span>Revisa tu bandeja de entrada (y spam por si acaso)</span>
                      </div>
                      
                      <Button
                        onClick={() => {
                          setEmailSent(false);
                          setAnimationStage(0);
                          setIsLogin(true);
                          setLoading(false);
                        }}
                        variant="outline"
                        className="w-full"
                      >
                        Volver al inicio de sesión
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Toggle Auth Mode */}
          {!emailSent && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                {isLogin ? (
                  <>
                    ¿No tienes cuenta? <span className="text-primary">Regístrate aquí</span>
                  </>
                ) : (
                  <>
                    ¿Ya tienes cuenta? <span className="text-primary">Inicia sesión</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Mobile Value Props */}
          <div className="lg:hidden pt-8 space-y-4 border-t border-border">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FaceSmileIcon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold mb-0.5">Registra tus gastos en segundos</h4>
                <p className="text-xs text-muted-foreground">Toca, escribe, listo. Sin fricciones.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <BanknotesIcon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold mb-0.5">Categorización automática</h4>
                <p className="text-xs text-muted-foreground">Aprendizaje automático que mejora con el uso</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <CheckBadgeIcon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold mb-0.5">Proyecciones inteligentes</h4>
                <p className="text-xs text-muted-foreground">Predicciones basadas en tu comportamiento histórico</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <img src="/isotipo-fintual.png" alt="Fintual" className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold mb-0.5">Conecta tus inversiones Fintual</h4>
                <p className="text-xs text-muted-foreground">Sincroniza automáticamente tus objetivos de inversión</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}