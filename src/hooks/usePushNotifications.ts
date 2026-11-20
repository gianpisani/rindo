import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { requireUserId } from "@/integrations/supabase/session";
import { toast } from "sonner";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function base64UrlToBytes(base64Url: string) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(window.atob(base64), (char) => char.charCodeAt(0));
}

async function currentSubscription() {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export function usePushNotifications() {
  const [isSupported] = useState(pushSupported);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isSupported) return;
    currentSubscription()
      .then((subscription) => setIsSubscribed(!!subscription))
      .catch((error) => console.error("No se pudo leer la suscripción push", error));
  }, [isSupported]);

  const subscribe = async () => {
    if (!isSupported) {
      toast.error("Tu navegador no soporta notificaciones push");
      return;
    }
    if (!VAPID_PUBLIC_KEY) {
      toast.error("Las notificaciones no están configuradas");
      return;
    }

    setIsLoading(true);
    try {
      if ((await Notification.requestPermission()) !== "granted") {
        toast.error("Debes permitir las notificaciones");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY),
      });
      const { endpoint, keys } = subscription.toJSON();
      const { error } = await supabase
        .from("push_subscriptions")
        .upsert(
          { user_id: await requireUserId(), endpoint: endpoint!, p256dh: keys!.p256dh!, auth: keys!.auth! },
          { onConflict: "user_id,endpoint" },
        );
      if (error) throw error;
      setIsSubscribed(true);
      toast.success("Notificaciones activadas");
    } catch (error) {
      console.error("Error al activar notificaciones", error);
      toast.error("Error al activar notificaciones");
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribe = async () => {
    setIsLoading(true);
    try {
      const subscription = await currentSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        const { error } = await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", await requireUserId())
          .eq("endpoint", subscription.endpoint);
        if (error) throw error;
      }
      setIsSubscribed(false);
      toast.success("Notificaciones desactivadas");
    } catch (error) {
      console.error("Error al desactivar notificaciones", error);
      toast.error("Error al desactivar notificaciones");
    } finally {
      setIsLoading(false);
    }
  };

  return { isSupported, isSubscribed, isLoading, subscribe, unsubscribe };
}
