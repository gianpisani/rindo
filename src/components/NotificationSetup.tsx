import { Bell, BellOff, TestTube } from "lucide-react";
import { Button } from "./ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

export function NotificationSetup() {
  const { permission, requestPermission, sendNotification, isSupported } = useNotifications();
  
  const sendTestNotification = () => {
    sendNotification("🎉 ¡Notificaciones activadas!", {
      body: "Recibirás alertas sobre gastos importantes, recordatorios y resúmenes semanales.",
      tag: "test",
    });
  };

  if (!isSupported) {
    return null;
  }

  if (permission === "granted") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Notificaciones activadas
          </CardTitle>
          <CardDescription>
            Recibirás alertas sobre gastos grandes, recordatorios diarios y resúmenes semanales
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={sendTestNotification} variant="outline" className="w-full">
            <TestTube className="mr-2 h-4 w-4" />
            Enviar notificación de prueba
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellOff className="h-5 w-5" />
          Activa las notificaciones
        </CardTitle>
        <CardDescription>
          Recibe alertas de presupuestos, recordatorios y actualizaciones importantes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={requestPermission} className="w-full">
          <Bell className="mr-2 h-4 w-4" />
          Activar notificaciones
        </Button>
      </CardContent>
    </Card>
  );
}
