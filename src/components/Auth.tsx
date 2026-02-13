import { useState, useEffect, useMemo, useRef, useCallback, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";
import {
  EnvelopeIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadLinksPreset } from "@tsparticles/preset-links";
import type { Engine } from "@tsparticles/engine";
import { AnimatePresence, motion } from "framer-motion";

const EMAIL_DOMAINS = [
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "yahoo.com",
  "live.com",
];

function getDomainSuggestion(email: string): string | null {
  const atIndex = email.indexOf("@");
  if (atIndex === -1 || atIndex === 0) return null;
  const partial = email.slice(atIndex + 1);
  if (!partial) return EMAIL_DOMAINS[0]; // default: gmail.com
  const match = EMAIL_DOMAINS.find((d) => d.startsWith(partial.toLowerCase()));
  if (match && match !== partial.toLowerCase()) return match;
  return null;
}

function getVisibleDomains(email: string): string[] {
  const atIndex = email.indexOf("@");
  if (atIndex === -1 || atIndex === 0) return [];
  const partial = email.slice(atIndex + 1).toLowerCase();
  if (!partial) return EMAIL_DOMAINS.slice(0, 4);
  return EMAIL_DOMAINS.filter((d) => d.startsWith(partial) && d !== partial).slice(0, 4);
}

const MemoizedParticles = memo(({ options }: { options: any }) => (
  <Particles className="absolute inset-0" options={options} />
));

const formVariants = {
  enter: { opacity: 0, y: 20 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [particlesInit, setParticlesInit] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [animationStage, setAnimationStage] = useState(0);
  const emailInputRef = useRef<HTMLInputElement>(null);

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
      background: { color: { value: "transparent" } },
      particles: {
        color: { value: "#4f46e5" },
        links: {
          color: "#4f46e5",
          distance: 180,
          enable: true,
          opacity: 0.15,
          width: 0.8,
        },
        move: { enable: true, speed: 0.4 },
        number: { value: 40 },
        opacity: { value: 0.25 },
        size: { value: { min: 0.8, max: 2 } },
      },
    }),
    []
  );

  useEffect(() => {
    if (emailSent) {
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
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Has iniciado sesión correctamente");
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setEmailSent(true);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error desconocido");
      setLoading(false);
    }
  };

  const domainSuggestion = getDomainSuggestion(email);
  const visibleDomains = getVisibleDomains(email);
  const showDomainUI = email.includes("@") && email.indexOf("@") > 0;

  const acceptSuggestion = useCallback(() => {
    if (!domainSuggestion) return;
    const atIndex = email.indexOf("@");
    setEmail(email.slice(0, atIndex + 1) + domainSuggestion);
  }, [email, domainSuggestion]);

  const handleEmailKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if ((e.key === "Tab" || e.key === "ArrowRight") && domainSuggestion && showDomainUI) {
        e.preventDefault();
        acceptSuggestion();
      }
    },
    [domainSuggestion, showDomainUI, acceptSuggestion]
  );

  const handleDomainChipClick = useCallback(
    (domain: string) => {
      const atIndex = email.indexOf("@");
      setEmail(email.slice(0, atIndex + 1) + domain);
      // Focus password next
      const pwInput = document.getElementById("password") as HTMLInputElement | null;
      pwInput?.focus();
    },
    [email]
  );

  // Ghost text for desktop: the part the user hasn't typed yet
  const ghostText = useMemo(() => {
    if (!showDomainUI || !domainSuggestion) return "";
    const partial = email.slice(email.indexOf("@") + 1);
    return domainSuggestion.slice(partial.length);
  }, [email, showDomainUI, domainSuggestion]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col lg:flex-row relative overflow-hidden">
      {/* Left Panel - Brand (Desktop) */}
      <div className="hidden lg:flex lg:flex-1 flex-col justify-center items-center relative overflow-hidden">
        {/* Particles */}
        {particlesInit && (
          <div className="absolute inset-0 pointer-events-none opacity-60">
            <MemoizedParticles options={particlesOptions} />
          </div>
        )}

        {/* Gradient overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0f] via-[#0d0d1a] to-[#0a0a0f]" />

        <div className="relative z-10 text-center space-y-6 px-12">
          <img
            src="/icon-512x512-removebg-preview.png"
            alt="Rindo"
            className="size-20 rounded-full mx-auto"
          />
          <div>
            <h1 className="text-5xl font-bold text-white tracking-tight">
              Rindo<span className="text-primary">.</span>
            </h1>
            <p className="text-lg text-white/40 mt-3 font-light">
              Tus finanzas. Sin ruido.
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-[#0e0e16] relative">
        {/* Mobile particles */}
        {particlesInit && (
          <div className="lg:hidden absolute inset-0 pointer-events-none opacity-40">
            <MemoizedParticles options={particlesOptions} />
          </div>
        )}

        {/* Subtle border left on desktop */}
        <div className="hidden lg:block absolute left-0 top-[15%] bottom-[15%] w-px bg-gradient-to-b from-transparent via-primary/20 to-transparent" />

        <div className="w-full max-w-sm relative z-10 space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center gap-3 mb-4">
            <img
              src="/icon-512x512-removebg-preview.png"
              alt="Rindo"
              className="size-14 rounded-full"
            />
            <div className="text-center">
              <h1 className="text-3xl font-bold text-white">
                Rindo<span className="text-primary">.</span>
              </h1>
              <p className="text-xs text-white/40 mt-1 font-light">
                Tus finanzas. Sin ruido.
              </p>
            </div>
          </div>

          {/* Animated header */}
          <AnimatePresence mode="wait">
            {!emailSent && (
              <motion.div
                key={isLogin ? "login-header" : "signup-header"}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="space-y-1"
              >
                <h2 className="text-2xl font-semibold text-white tracking-tight">
                  {isLogin ? "Bienvenido" : "Crear cuenta"}
                </h2>
                <p className="text-sm text-white/40">
                  {isLogin ? "Ingresá para continuar" : "Empecemos en segundos"}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form / Email Sent */}
          <AnimatePresence mode="wait">
            {!emailSent ? (
              <motion.form
                key={isLogin ? "login" : "signup"}
                variants={formVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: "easeInOut" }}
                onSubmit={handleAuth}
                className="space-y-5"
              >
                {/* Email field with autocomplete */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-white/70">
                    Correo electrónico
                  </Label>
                  <div className="relative">
                    <Input
                      ref={emailInputRef}
                      id="email"
                      type="email"
                      placeholder="tu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={handleEmailKeyDown}
                      className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-primary/50 focus-visible:border-primary/30 transition-all"
                      required
                      autoComplete="email"
                    />
                    {/* Ghost suggestion (desktop) */}
                    {showDomainUI && ghostText && (
                      <div className="hidden lg:flex absolute inset-0 pointer-events-none items-center px-3">
                        <span className="text-transparent text-sm">{email}</span>
                        <span className="text-white/20 text-sm">{ghostText}</span>
                      </div>
                    )}
                  </div>
                  {/* Domain hint (desktop) */}
                  {showDomainUI && ghostText && (
                    <p className="hidden lg:block text-xs text-white/25 mt-1">
                      Tab para completar
                    </p>
                  )}
                  {/* Domain chips (mobile) */}
                  {showDomainUI && visibleDomains.length > 0 && (
                    <div className="lg:hidden flex flex-wrap gap-1.5 mt-2">
                      {visibleDomains.map((domain) => (
                        <button
                          key={domain}
                          type="button"
                          onClick={() => handleDomainChipClick(domain)}
                          className="px-2.5 py-1 text-xs rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-white/80 hover:border-primary/30 transition-colors"
                        >
                          @{domain}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Password field */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-white/70">
                    Contraseña
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-primary/50 focus-visible:border-primary/30 transition-all"
                    required
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    minLength={6}
                  />
                  {!isLogin && (
                    <p className="text-xs text-white/25">Mínimo 6 caracteres</p>
                  )}
                </div>

                {/* Submit button with glow */}
                <Button
                  type="submit"
                  className="w-full h-11 font-medium transition-all hover:shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:brightness-110"
                  disabled={loading}
                >
                  {loading
                    ? "Cargando..."
                    : isLogin
                      ? "Iniciar Sesión"
                      : "Crear Cuenta"}
                </Button>
              </motion.form>
            ) : (
              <motion.div
                key="email-sent"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="min-h-[300px] flex items-center justify-center"
              >
                <div className="text-center space-y-6 py-8">
                  {/* Animated envelope */}
                  <div className="relative mx-auto w-32 h-32">
                    <div
                      className={`absolute inset-0 bg-primary/20 rounded-full blur-2xl transition-all duration-1000 ${animationStage >= 2 ? "scale-150 opacity-0" : "scale-100 opacity-100"}`}
                    />
                    <div className="relative">
                      <div
                        className={`absolute inset-0 flex items-center justify-center transition-all duration-1000 ${
                          animationStage >= 2
                            ? "translate-x-32 -translate-y-32 opacity-0 rotate-45 scale-50"
                            : "translate-x-0 translate-y-0 opacity-0 scale-100"
                        }`}
                      >
                        <PaperAirplaneIcon className="h-16 w-16 text-primary" />
                      </div>
                      <div
                        className={`flex items-center justify-center transition-all duration-700 ${
                          animationStage === 1
                            ? "scale-110 rotate-12"
                            : animationStage >= 2
                              ? "scale-90 opacity-0"
                              : "scale-100"
                        }`}
                      >
                        <EnvelopeIcon className="h-20 w-20 text-primary" />
                      </div>
                      <div
                        className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
                          animationStage >= 3
                            ? "scale-100 opacity-100"
                            : "scale-50 opacity-0"
                        }`}
                      >
                        <CheckCircleIcon className="h-24 w-24 text-primary" />
                      </div>
                      {animationStage >= 2 && (
                        <>
                          <SparklesIcon
                            className={`absolute -top-4 -right-4 h-8 w-8 text-yellow-500 transition-all duration-500 ${
                              animationStage >= 3
                                ? "opacity-0 scale-0"
                                : "opacity-100 scale-100 animate-pulse"
                            }`}
                          />
                          <SparklesIcon
                            className={`absolute -bottom-4 -left-4 h-6 w-6 text-primary transition-all duration-700 ${
                              animationStage >= 3
                                ? "opacity-0 scale-0"
                                : "opacity-100 scale-100 animate-pulse"
                            }`}
                            style={{ animationDelay: "150ms" }}
                          />
                          <SparklesIcon
                            className={`absolute top-0 -left-6 h-5 w-5 text-primary transition-all duration-500 ${
                              animationStage >= 3
                                ? "opacity-0 scale-0"
                                : "opacity-100 scale-100 animate-pulse"
                            }`}
                            style={{ animationDelay: "300ms" }}
                          />
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3
                      className={`text-2xl font-bold text-white transition-all duration-500 ${
                        animationStage >= 3
                          ? "opacity-100 translate-y-0"
                          : "opacity-0 translate-y-4"
                      }`}
                    >
                      {animationStage >= 3 ? "¡Revisa tu correo!" : "Enviando..."}
                    </h3>
                    <div
                      className={`transition-all duration-500 delay-100 ${
                        animationStage >= 3
                          ? "opacity-100 translate-y-0"
                          : "opacity-0 translate-y-4"
                      }`}
                    >
                      <p className="text-white/40 mb-2">
                        Te enviamos un link de confirmación a
                      </p>
                      <p className="font-semibold text-primary">{email}</p>
                    </div>
                    <div
                      className={`pt-4 space-y-3 transition-all duration-500 delay-200 ${
                        animationStage >= 3
                          ? "opacity-100 translate-y-0"
                          : "opacity-0 translate-y-4"
                      }`}
                    >
                      <div className="flex items-start gap-2 text-xs text-white/40 text-left bg-white/5 p-3 rounded-lg">
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
                        className="w-full border-white/10 text-white/60 hover:text-white hover:border-white/20 bg-transparent"
                      >
                        Volver al inicio de sesión
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Toggle Auth Mode */}
          {!emailSent && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-white/30 hover:text-white/60 transition-colors font-medium"
              >
                {isLogin ? (
                  <>
                    ¿No tienes cuenta?{" "}
                    <span className="text-primary/70 hover:text-primary">Regístrate</span>
                  </>
                ) : (
                  <>
                    ¿Ya tienes cuenta?{" "}
                    <span className="text-primary/70 hover:text-primary">Inicia sesión</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
