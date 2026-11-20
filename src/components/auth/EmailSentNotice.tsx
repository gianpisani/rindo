import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";
import { Button } from "../ui/button";

interface EmailSentNoticeProps {
  email: string;
  onBackToLogin: () => void;
}

export function EmailSentNotice({ email, onBackToLogin }: EmailSentNoticeProps) {
  return (
    <motion.div
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
          <CheckCircle className="h-16 w-16 text-white/80 mx-auto" />
        </motion.div>

        <div className="space-y-3">
          <motion.h3
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="text-xl font-medium text-white"
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
            <div className="flex items-start gap-2 text-xs text-white/25 text-left bg-white/[0.03] border border-white/[0.06] p-3 rounded-card">
              <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-white/40" />
              <span>Revisa tu bandeja de entrada (y spam por si acaso)</span>
            </div>
            <Button
              onClick={onBackToLogin}
              variant="ghost"
              className="w-full h-11 border border-white/[0.08] text-white/30 hover:text-white/60 hover:border-white/15 bg-transparent"
            >
              Volver al inicio de sesión
            </Button>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
