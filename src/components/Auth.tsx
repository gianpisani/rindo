import { useState, useEffect, useMemo, useCallback, memo } from "react";
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
  if (!partial) return EMAIL_DOMAINS[0];
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
  enter: { opacity: 0, y: 24, filter: "blur(4px)" },
  center: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -24, filter: "blur(4px)" },
};

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [particlesInit, setParticlesInit] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [animationStage, setAnimationStage] = useState(0);

  useEffect(() => {
    initParticlesEngine(async (engine: Engine) => {
      await loadLinksPreset(engine);
    }).then(() => setParticlesInit(true));
  }, []);

  const particlesOptions = useMemo(
    () => ({
      preset: "links",
      background: { color: { value: "transparent" } },
      particles: {
        color: { value: "#6366f1" },
        links: {
          color: "#6366f1",
          distance: 200,
          enable: true,
          opacity: 0.06,
          width: 0.5,
        },
        move: { enable: true, speed: 0.3 },
        number: { value: 30 },
        opacity: { value: 0.15 },
        size: { value: { min: 0.5, max: 1.5 } },
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
      const pwInput = document.getElementById("password") as HTMLInputElement | null;
      pwInput?.focus();
    },
    [email]
  );

  const ghostText = useMemo(() => {
    if (!showDomainUI || !domainSuggestion) return "";
    const partial = email.slice(email.indexOf("@") + 1);
    return domainSuggestion.slice(partial.length);
  }, [email, showDomainUI, domainSuggestion]);

  return (
    <div className="min-h-screen bg-[#050507] flex items-center justify-center relative overflow-hidden">
      {/* === Atmospheric background layers === */}

      {/* Deep gradient base */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#0a0a1a_0%,_#050507_70%)]" />

      {/* Floating orbs - slow drifting blurred blobs */}
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full opacity-[0.07]"
        style={{
          background: "radial-gradient(circle, #6366f1 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
        animate={{
          x: [0, 60, -30, 0],
          y: [0, -40, 50, 0],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        initial={{ top: "10%", left: "15%" }}
      />
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full opacity-[0.05]"
        style={{
          background: "radial-gradient(circle, #8b5cf6 0%, transparent 70%)",
          filter: "blur(100px)",
        }}
        animate={{
          x: [0, -50, 40, 0],
          y: [0, 60, -30, 0],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
        initial={{ bottom: "10%", right: "10%" }}
      />
      <motion.div
        className="absolute w-[300px] h-[300px] rounded-full opacity-[0.04]"
        style={{
          background: "radial-gradient(circle, #4f46e5 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
        animate={{
          x: [0, 30, -50, 0],
          y: [0, -60, 20, 0],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        initial={{ top: "50%", right: "30%" }}
      />

      {/* Particles - ghostly connections */}
      {particlesInit && (
        <div className="absolute inset-0 pointer-events-none opacity-50">
          <MemoizedParticles options={particlesOptions} />
        </div>
      )}

      {/* Vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(5,5,7,0.8) 100%)",
        }}
      />

      {/* === Content === */}
      <div className="relative z-10 w-full max-w-[380px] px-6">
        {/* Logo + Tagline */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-center mb-10"
        >
          <div className="relative inline-block mb-5">
            {/* Glow behind logo */}
            <div className="absolute inset-0 scale-150 bg-primary/10 rounded-full blur-2xl" />
            <img
              src="/icon-512x512-removebg-preview.png"
              alt="Rindo"
              className="relative size-16 rounded-full"
            />
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">
            Rindo<span className="text-primary">.</span>
          </h1>
          <p className="text-sm text-white/25 mt-2 font-light tracking-wide">
            Tus finanzas. Sin ruido.
          </p>
        </motion.div>

        {/* Header animado */}
        <AnimatePresence mode="wait">
          {!emailSent && (
            <motion.div
              key={isLogin ? "login-h" : "signup-h"}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="text-center mb-7"
            >
              <h2 className="text-xl font-medium text-white/80">
                {isLogin ? "Bienvenido" : "Crear cuenta"}
              </h2>
              <p className="text-xs text-white/30 mt-1">
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
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-medium text-white/40 uppercase tracking-wider">
                  Correo
                </Label>
                <div className="relative group">
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={handleEmailKeyDown}
                    className="h-12 bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/15 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/20 focus-visible:bg-white/[0.05] transition-all duration-300"
                    required
                    autoComplete="email"
                  />
                  {/* Ghost suggestion (desktop) */}
                  {showDomainUI && ghostText && (
                    <div className="hidden lg:flex absolute inset-0 pointer-events-none items-center px-3">
                      <span className="text-transparent text-sm">{email}</span>
                      <span className="text-white/15 text-sm">{ghostText}</span>
                    </div>
                  )}
                </div>
                {showDomainUI && ghostText && (
                  <p className="hidden lg:block text-[10px] text-white/20 ml-1">
                    Tab para completar
                  </p>
                )}
                {showDomainUI && visibleDomains.length > 0 && (
                  <div className="lg:hidden flex flex-wrap gap-1.5 mt-2">
                    {visibleDomains.map((domain) => (
                      <button
                        key={domain}
                        type="button"
                        onClick={() => handleDomainChipClick(domain)}
                        className="px-2.5 py-1 text-[11px] rounded-full bg-white/[0.04] border border-white/[0.08] text-white/40 active:bg-white/[0.08] active:text-white/60 transition-colors"
                      >
                        @{domain}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-medium text-white/40 uppercase tracking-wider">
                  Contraseña
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/15 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/20 focus-visible:bg-white/[0.05] transition-all duration-300"
                  required
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  minLength={6}
                />
                {!isLogin && (
                  <p className="text-[10px] text-white/20 ml-1">Mínimo 6 caracteres</p>
                )}
              </div>

              {/* Submit with glow */}
              <div className="pt-1">
                <Button
                  type="submit"
                  className="w-full h-12 font-medium rounded-xl transition-all duration-300 bg-primary/90 hover:bg-primary hover:shadow-[0_0_30px_rgba(99,102,241,0.25)] hover:shadow-primary/25"
                  disabled={loading}
                >
                  {loading
                    ? "Cargando..."
                    : isLogin
                      ? "Iniciar Sesión"
                      : "Crear Cuenta"}
                </Button>
              </div>
            </motion.form>
          ) : (
            <motion.div
              key="email-sent"
              initial={{ opacity: 0, scale: 0.9, filter: "blur(8px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="min-h-[300px] flex items-center justify-center"
            >
              <div className="text-center space-y-6 py-8">
                <div className="relative mx-auto w-32 h-32">
                  <div
                    className={`absolute inset-0 bg-primary/15 rounded-full blur-2xl transition-all duration-1000 ${animationStage >= 2 ? "scale-150 opacity-0" : "scale-100 opacity-100"}`}
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
                            animationStage >= 3 ? "opacity-0 scale-0" : "opacity-100 scale-100 animate-pulse"
                          }`}
                        />
                        <SparklesIcon
                          className={`absolute -bottom-4 -left-4 h-6 w-6 text-primary transition-all duration-700 ${
                            animationStage >= 3 ? "opacity-0 scale-0" : "opacity-100 scale-100 animate-pulse"
                          }`}
                          style={{ animationDelay: "150ms" }}
                        />
                        <SparklesIcon
                          className={`absolute top-0 -left-6 h-5 w-5 text-primary transition-all duration-500 ${
                            animationStage >= 3 ? "opacity-0 scale-0" : "opacity-100 scale-100 animate-pulse"
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
                      animationStage >= 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                    }`}
                  >
                    {animationStage >= 3 ? "¡Revisa tu correo!" : "Enviando..."}
                  </h3>
                  <div
                    className={`transition-all duration-500 delay-100 ${
                      animationStage >= 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                    }`}
                  >
                    <p className="text-white/30 mb-2">Te enviamos un link de confirmación a</p>
                    <p className="font-semibold text-primary">{email}</p>
                  </div>
                  <div
                    className={`pt-4 space-y-3 transition-all duration-500 delay-200 ${
                      animationStage >= 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                    }`}
                  >
                    <div className="flex items-start gap-2 text-xs text-white/30 text-left bg-white/[0.03] border border-white/[0.06] p-3 rounded-xl">
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
                      className="w-full h-11 rounded-xl border-white/[0.08] text-white/40 hover:text-white/70 hover:border-white/15 bg-transparent"
                    >
                      Volver al inicio de sesión
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toggle */}
        {!emailSent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-center mt-8"
          >
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-xs text-white/20 hover:text-white/40 transition-colors duration-300"
            >
              {isLogin ? (
                <>
                  ¿No tienes cuenta?{" "}
                  <span className="text-primary/50 hover:text-primary/80 transition-colors">
                    Regístrate
                  </span>
                </>
              ) : (
                <>
                  ¿Ya tienes cuenta?{" "}
                  <span className="text-primary/50 hover:text-primary/80 transition-colors">
                    Inicia sesión
                  </span>
                </>
              )}
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
