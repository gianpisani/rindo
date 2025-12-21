import { Bell, BellOff, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function PushNotificationToggle() {
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications();

  // Detectar si es iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            Notificaciones no disponibles
          </CardTitle>
          <CardDescription>
            Tu navegador no soporta notificaciones push
          </CardDescription>
        </CardHeader>
        {isIOS && !isStandalone && (
          <CardContent>
            <Alert>
              <Smartphone className="h-4 w-4" />
              <AlertDescription>
                En iOS, debes instalar la app en tu pantalla de inicio para recibir notificaciones.
                Toca el botón de compartir y selecciona "Añadir a pantalla de inicio".
              </AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notificaciones Push
        </CardTitle>
        <CardDescription>
          Recibe alertas de transacciones, límites de categorías y sincronizaciones
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={isSubscribed ? unsubscribe : subscribe}
          disabled={isLoading}
          variant={isSubscribed ? 'outline' : 'default'}
          className="w-full"
        >
          {isLoading ? (
            'Procesando...'
          ) : isSubscribed ? (
            <>
              <BellOff className="mr-2 h-4 w-4" />
              Desactivar notificaciones
            </>
          ) : (
            <>
              <Bell className="mr-2 h-4 w-4" />
              Activar notificaciones
            </>
          )}
        </Button>

        {isSubscribed && (
          <Alert className="bg-green-500/10 border-green-500/20">
            <Bell className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-green-500">
              Las notificaciones están activas en este dispositivo
            </AlertDescription>
          </Alert>
        )}

        {isIOS && !isStandalone && (
          <Alert>
            <Smartphone className="h-4 w-4" />
            <AlertDescription className="text-xs">
              💡 Para iOS: Instala la app en tu pantalla de inicio para recibir notificaciones
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

