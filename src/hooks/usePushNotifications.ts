import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { requireUserId } from "@/integrations/supabase/session";
import { errorMessage } from "@/lib/errors";
import { optimistic } from "./optimistic";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;
const PUSH_KEY = ["push-subscription"];

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

async function subscribeDevice() {
  if (!VAPID_PUBLIC_KEY) throw new Error("Las notificaciones no están configuradas");
  if ((await Notification.requestPermission()) !== "granted") {
    throw new Error("Permite las notificaciones en tu navegador para activarlas");
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
}

async function unsubscribeDevice() {
  const subscription = await currentSubscription();
  if (!subscription) return;
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", await requireUserId())
    .eq("endpoint", subscription.endpoint);
  if (error) throw error;
  await subscription.unsubscribe();
}

export function usePushNotifications() {
  const queryClient = useQueryClient();
  const isSupported = pushSupported();

  const { data: isSubscribed = false, isPending: isChecking } = useQuery({
    queryKey: PUSH_KEY,
    queryFn: async () => !!(await currentSubscription()),
    enabled: isSupported,
    staleTime: Infinity,
  });

  const sync = optimistic<boolean, boolean>(queryClient, PUSH_KEY, (_current, next) => next);
  const setSubscribed = useMutation({
    mutationFn: (next: boolean) => (next ? subscribeDevice() : unsubscribeDevice()),
    meta: { handlesOwnError: true },
    ...sync,
    onError: (error, next, snapshot) => {
      sync.onError(error, next, snapshot);
      console.error("No se pudo cambiar la suscripción push", error);
      toast.error(errorMessage(error), { id: "push-subscription" });
    },
  });

  return {
    isSupported,
    isSubscribed,
    isBusy: (isSupported && isChecking) || setSubscribed.isPending,
    setSubscribed: (next: boolean) => setSubscribed.mutate(next),
  };
}
