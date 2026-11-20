import { useState } from "react";
import { useSignIn, useSignUp } from "@/hooks/useAccount";

export function useAuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const signIn = useSignIn();
  const signUp = useSignUp();
  const loading = signIn.isPending || signUp.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) signIn.mutate({ email, password });
    else signUp.mutate({ email, password }, { onSuccess: () => setEmailSent(true) });
  };

  const toggleMode = () => setIsLogin(!isLogin);

  const backToLogin = () => {
    setEmailSent(false);
    setIsLogin(true);
  };

  return {
    isLogin,
    email,
    setEmail,
    password,
    setPassword,
    emailSent,
    loading,
    submit,
    toggleMode,
    backToLogin,
  };
}
