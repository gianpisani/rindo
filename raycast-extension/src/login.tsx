import { Action, ActionPanel, Form, showToast, Toast, popToRoot } from "@raycast/api";
import { useState } from "react";
import { getSupabaseClient, saveSession, getSession, clearSession } from "./lib/supabase";

export default function Command() {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleLogin() {
    if (!email || !password) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Campos requeridos",
        message: "Ingresa tu email y contraseña",
      });
      return;
    }

    setIsLoading(true);

    try {
      const client = getSupabaseClient();
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Error al iniciar sesión",
          message: error.message === "Invalid login credentials"
            ? "Email o contraseña incorrectos"
            : error.message,
        });
        setIsLoading(false);
        return;
      }

      if (data.session) {
        await saveSession(data.session);
        await showToast({
          style: Toast.Style.Success,
          title: "¡Sesión iniciada!",
          message: `Bienvenido, ${data.user?.email}`,
        });
        await popToRoot();
      }
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Error de conexión",
        message: "Verifica tu URL de Supabase en las preferencias",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogout() {
    await clearSession();
    await showToast({
      style: Toast.Style.Success,
      title: "Sesión cerrada",
    });
    await popToRoot();
  }

  async function handleCheckSession() {
    const session = await getSession();
    if (session) {
      await showToast({
        style: Toast.Style.Success,
        title: "Sesión activa",
        message: `Conectado como ${session.user.email}`,
      });
    } else {
      await showToast({
        style: Toast.Style.Failure,
        title: "Sin sesión",
        message: "Necesitas iniciar sesión",
      });
    }
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Iniciar Sesión" onSubmit={handleLogin} />
          <Action title="Verificar Sesión" onAction={handleCheckSession} />
          <Action title="Cerrar Sesión" onAction={handleLogout} style={Action.Style.Destructive} />
        </ActionPanel>
      }
    >
      <Form.Description
        title="🟢 Rindo"
        text="Inicia sesión con tu cuenta de Rindo para poder agregar transacciones desde Raycast."
      />
      <Form.TextField
        id="email"
        title="Email"
        placeholder="tu@email.com"
        value={email}
        onChange={setEmail}
      />
      <Form.PasswordField
        id="password"
        title="Contraseña"
        placeholder="Tu contraseña"
        value={password}
        onChange={setPassword}
      />
      <Form.Separator />
      <Form.Description
        title=""
        text="Tu sesión se guarda localmente y se refresca automáticamente. Solo necesitas iniciar sesión una vez."
      />
    </Form>
  );
}
