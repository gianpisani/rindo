import { motion } from "framer-motion";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { EmailField } from "./EmailField";
import { AUTH_INPUT_CLASS } from "./auth-input-class";

const formVariants = {
  enter: { opacity: 0, y: 20, filter: "blur(2px)" },
  center: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -20, filter: "blur(2px)" },
};

interface CredentialsFormProps {
  isLogin: boolean;
  email: string;
  onEmailChange: (email: string) => void;
  password: string;
  onPasswordChange: (password: string) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function CredentialsForm({
  isLogin,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  loading,
  onSubmit,
}: CredentialsFormProps) {
  return (
    <motion.form
      variants={formVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.3, ease: "easeInOut" }}
      onSubmit={onSubmit}
      className="space-y-4"
    >
      <EmailField email={email} onEmailChange={onEmailChange} />

      <div className="space-y-2">
        <Label htmlFor="password" className="text-xs font-medium text-white/25">
          Contraseña
        </Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          className={AUTH_INPUT_CLASS}
          required
          autoComplete={isLogin ? "current-password" : "new-password"}
          minLength={6}
        />
        {!isLogin && (
          <p className="text-xs text-white/15 ml-1">Mínimo 6 caracteres</p>
        )}
      </div>

      <div className="pt-2">
        <Button
          type="submit"
          className="w-full h-12 font-medium transition-all duration-300 bg-white text-black hover:bg-white/90"
          disabled={loading}
        >
          {loading
            ? "Cargando..."
            : isLogin
              ? "Iniciar sesión"
              : "Crear cuenta"}
        </Button>
      </div>
    </motion.form>
  );
}
