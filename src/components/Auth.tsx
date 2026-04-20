import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { AnimatePresence, motion } from "framer-motion";
import { RindoLogo } from "./RindoLogo";

// ── Email domain helpers ────────────────────────────────────────────────────

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

// ── Rotating words ──────────────────────────────────────────────────────────

const ROTATING_WORDS = [
  "Ordena tus finanzas",
  "Sincroniza tu banco",
  "Controla tu presupuesto",
  "Proyecta tu futuro",
  "Maneja tus deudas",
  "Trackea cada peso",
];

function RotatingText() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % ROTATING_WORDS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-7 overflow-hidden relative">
      <AnimatePresence mode="wait">
        <motion.p
          key={index}
          initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -16, filter: "blur(4px)" }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="text-sm text-white/30 font-light tracking-wide absolute inset-0 text-center"
        >
          {ROTATING_WORDS[index]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

// ── Floating shortcut badges ────────────────────────────────────────────────

const SHORTCUTS = [
  { keys: "N", label: "nuevo gasto", x: "8%", y: "18%" },
  { keys: "R", label: "conciliar", x: "78%", y: "22%" },
  { keys: "P", label: "presupuesto", x: "5%", y: "75%" },
  { keys: "⌘K", label: "buscar", x: "82%", y: "70%" },
];

function FloatingShortcuts() {
  return (
    <>
      {SHORTCUTS.map((s, i) => (
        <motion.div
          key={s.keys}
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 0.12, 0.08, 0.12],
            y: [0, -6, 0, 6, 0],
          }}
          transition={{
            opacity: { duration: 2, delay: 1.5 + i * 0.3 },
            y: { duration: 8 + i * 2, repeat: Infinity, ease: "easeInOut" },
          }}
          className="absolute hidden lg:flex items-center gap-1.5 pointer-events-none select-none"
          style={{ left: s.x, top: s.y }}
        >
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded border border-white/10 bg-white/[0.03] text-white/40">
            {s.keys}
          </kbd>
          <span className="text-[10px] text-white/20">{s.label}</span>
        </motion.div>
      ))}
    </>
  );
}

// ── Ambient orbs ────────────────────────────────────────────────────────────

function AmbientBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Radial gradient center glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/[0.012] blur-[120px]" />
      {/* Subtle primary accent */}
      <motion.div
        animate={{ opacity: [0.015, 0.03, 0.015] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full blur-[100px]"
        style={{ backgroundColor: "hsl(var(--primary))" }}
      />
      {/* Noise texture */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

// ── Form transition variants ────────────────────────────────────────────────

const formVariants = {
  enter: { opacity: 0, y: 20, filter: "blur(2px)" },
  center: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -20, filter: "blur(2px)" },
};

// ── Main component ──────────────────────────────────────────────────────────

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [animationStage, setAnimationStage] = useState(0);

  useEffect(() => {
    if (emailSent) {
      setAnimationStage(1);
      setTimeout(() => setAnimationStage(2), 800);
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
    <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
      <AmbientBackground />
      <FloatingShortcuts />

      <div className="relative z-10 w-full max-w-[360px] px-6">
        {/* ── Logo + Brand ────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center mb-10"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-5"
          >
            <RindoLogo size={56} className="text-white mx-auto" />
          </motion.div>

          <h1 className="text-3xl font-bold text-white tracking-tight">
            rindo<span className="text-primary">.</span>
          </h1>

          {/* Rotating capabilities */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="mt-3"
          >
            <RotatingText />
          </motion.div>
        </motion.div>

        {/* ── Separator line ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6, ease: "easeOut" }}
          className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent mb-8"
        />

        {/* ── Form / Email Sent ───────────────────────────────────────────── */}
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
                <Label htmlFor="email" className="text-[10px] font-medium text-white/25 uppercase tracking-widest">
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
                    className="h-12 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/15 rounded-xl focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/15 focus-visible:bg-white/[0.05] transition-all duration-300"
                    required
                    autoComplete="email"
                  />
                  {showDomainUI && ghostText && (
                    <div className="hidden lg:flex absolute inset-0 pointer-events-none items-center px-3">
                      <span className="text-transparent text-sm">{email}</span>
                      <span className="text-white/15 text-sm">{ghostText}</span>
                    </div>
                  )}
                </div>
                {showDomainUI && ghostText && (
                  <p className="hidden lg:block text-[10px] text-white/15 ml-1">
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
                        className="px-2.5 py-1 text-[11px] rounded-full bg-white/[0.04] border border-white/[0.08] text-white/30 hover:bg-white/[0.08] hover:text-white/50 active:bg-white/[0.1] active:text-white/60 transition-colors"
                      >
                        @{domain}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[10px] font-medium text-white/25 uppercase tracking-widest">
                  Contraseña
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/15 rounded-xl focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/15 focus-visible:bg-white/[0.05] transition-all duration-300"
                  required
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  minLength={6}
                />
                {!isLogin && (
                  <p className="text-[10px] text-white/15 ml-1">Mínimo 6 caracteres</p>
                )}
              </div>

              {/* Submit */}
              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full h-12 font-medium rounded-xl transition-all duration-300 bg-white text-black hover:bg-white/90 hover:shadow-[0_0_40px_rgba(255,255,255,0.15)]"
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
              initial={{ opacity: 0, scale: 0.95, filter: "blur(6px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="min-h-[260px] flex items-center justify-center"
            >
              <div className="text-center space-y-6 py-8">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.2, type: "spring" }}
                >
                  <CheckCircleIcon className="h-16 w-16 text-white/80 mx-auto" />
                </motion.div>

                <div className="space-y-3">
                  <motion.h3
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.4 }}
                    className="text-xl font-bold text-white"
                  >
                    Revisa tu correo
                  </motion.h3>
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.5 }}
                  >
                    <p className="text-white/25 text-sm mb-2">Te enviamos un link de confirmación a</p>
                    <p className="font-medium text-white/70">{email}</p>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.7 }}
                    className="pt-4 space-y-3"
                  >
                    <div className="flex items-start gap-2 text-xs text-white/25 text-left bg-white/[0.03] border border-white/[0.06] p-3 rounded-xl">
                      <CheckCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0 text-white/40" />
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
                      className="w-full h-11 rounded-xl border-white/[0.08] text-white/30 hover:text-white/60 hover:border-white/15 bg-transparent"
                    >
                      Volver al inicio de sesión
                    </Button>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Toggle ──────────────────────────────────────────────────────── */}
        {!emailSent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center mt-8"
          >
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-xs text-white/15 hover:text-white/30 transition-colors duration-300"
            >
              {isLogin ? (
                <>¿No tienes cuenta? <span className="text-white/30 hover:text-white/50">Regístrate</span></>
              ) : (
                <>¿Ya tienes cuenta? <span className="text-white/30 hover:text-white/50">Inicia sesión</span></>
              )}
            </button>
          </motion.div>
        )}

        {/* ── Bottom tagline ──────────────────────────────────────────────── */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 1 }}
          className="text-center text-[10px] text-white/10 mt-12 font-light tracking-wider"
        >
          Tu banco no te juzga. Yo sí.
        </motion.p>
      </div>
    </div>
  );
}
