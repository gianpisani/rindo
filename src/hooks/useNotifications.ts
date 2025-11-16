import { useEffect, useState } from "react";
import { useToast } from "./use-toast";

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const { toast } = useToast();

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (!("Notification" in window)) {
      toast({
        title: "No soportado",
        description: "Tu navegador no soporta notificaciones",
        variant: "destructive",
      });
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === "granted") {
        toast({
          title: "¡Perfecto!",
          description: "Las notificaciones están activadas",
        });
        return true;
      } else {
        toast({
          title: "Permiso denegado",
          description: "No podrás recibir notificaciones",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      return false;
    }
  };

  const sendNotification = (title: string, options?: NotificationOptions) => {
    if (permission === "granted" && "Notification" in window) {
      new Notification(title, {
        icon: "/icon-192x192.png",
        badge: "/icon-192x192.png",
        ...options,
      });
    }
  };

  return {
    permission,
    requestPermission,
    sendNotification,
    isSupported: "Notification" in window,
  };
}
