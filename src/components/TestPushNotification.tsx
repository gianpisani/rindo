import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { sendPushNotification, NotificationTemplates } from '@/lib/notifications';
import { toast } from 'sonner';
import { Bell, DollarSign, TrendingUp, Calendar } from 'lucide-react';

export function TestPushNotification() {
  const testNotifications = [
    {
      label: 'Nueva transacción',
      icon: DollarSign,
      action: () => sendPushNotification(
        NotificationTemplates.newTransaction(50000, 'Comida', 'Gasto')
      )
    },
    {
      label: 'Límite alcanzado',
      icon: TrendingUp,
      action: () => sendPushNotification(
        NotificationTemplates.categoryLimitReached('Comida', 90)
      )
    },
    {
      label: 'Sync Fintual',
      icon: Bell,
      action: () => sendPushNotification(
        NotificationTemplates.fintualSyncComplete(1500000)
      )
    },
    {
      label: 'Resumen semanal',
      icon: Calendar,
      action: () => sendPushNotification(
        NotificationTemplates.weeklyReport(500000, 300000)
      )
    },
  ];

  const handleTest = async (testFn: () => Promise<any>, label: string) => {
    toast.loading(`Enviando ${label}...`);
    const result = await testFn();
    
    if (result.success) {
      toast.success(`${label} enviada`);
    } else {
      toast.error(`Error al enviar ${label}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Probar Notificaciones
        </CardTitle>
        <CardDescription>
          Envía notificaciones de prueba para verificar que todo funciona
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        {testNotifications.map((test, index) => {
          const Icon = test.icon;
          return (
            <Button
              key={index}
              variant="outline"
              size="sm"
              onClick={() => handleTest(test.action, test.label)}
              className="flex items-center gap-2"
            >
              <Icon className="h-4 w-4" />
              {test.label}
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}

