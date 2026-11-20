import { AnimatePresence, motion } from "framer-motion";
import { useAuthForm } from "@/hooks/useAuthForm";
import { AmbientBackground } from "./AmbientBackground";
import { AuthBrand } from "./AuthBrand";
import { BankStrip } from "./BankStrip";
import { CredentialsForm } from "./CredentialsForm";
import { EmailSentNotice } from "./EmailSentNotice";
import { FloatingActivity } from "./FloatingActivity";

export default function Auth() {
  const form = useAuthForm();

  return (
    <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
      <AmbientBackground />
      <FloatingActivity />

      <div className="relative z-10 w-full max-w-[360px] px-6">
        <AuthBrand />

        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6, ease: "easeOut" }}
          className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent mb-8"
        />

        <AnimatePresence mode="wait">
          {!form.emailSent ? (
            <CredentialsForm
              key={form.isLogin ? "login" : "signup"}
              isLogin={form.isLogin}
              email={form.email}
              onEmailChange={form.setEmail}
              password={form.password}
              onPasswordChange={form.setPassword}
              loading={form.loading}
              onSubmit={form.submit}
            />
          ) : (
            <EmailSentNotice key="email-sent" email={form.email} onBackToLogin={form.backToLogin} />
          )}
        </AnimatePresence>

        {!form.emailSent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center mt-8"
          >
            <button
              type="button"
              onClick={form.toggleMode}
              className="text-xs text-white/15 hover:text-white/30 transition-colors duration-300"
            >
              {form.isLogin ? (
                <>¿No tienes cuenta? <span className="text-white/30 hover:text-white/50">Regístrate</span></>
              ) : (
                <>¿Ya tienes cuenta? <span className="text-white/30 hover:text-white/50">Inicia sesión</span></>
              )}
            </button>
          </motion.div>
        )}

        <div className="mt-8">
          <BankStrip />
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8, duration: 1 }}
          className="text-center text-xs text-white/10 mt-6"
        >
          Tu banco no te juzga. Yo sí.
        </motion.p>
      </div>
    </div>
  );
}
