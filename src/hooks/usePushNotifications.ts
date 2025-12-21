import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsSupported(
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }, []);

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribe = async () => {
    if (!isSupported) {
      toast.error('Tu navegador no soporta notificaciones push');
      return;
    }

    if (!VAPID_PUBLIC_KEY) {
      toast.error('VAPID key no configurada');
      console.error('VITE_VAPID_PUBLIC_KEY no está definida');
      return;
    }

    setIsLoading(true);
    try {
      // Pedir permiso
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('Debes permitir las notificaciones');
        setIsLoading(false);
        return;
      }

      // Registrar service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Suscribirse a push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      // Guardar en Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const subscriptionJSON = subscription.toJSON();
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: subscriptionJSON.endpoint!,
          p256dh: subscriptionJSON.keys!.p256dh!,
          auth: subscriptionJSON.keys!.auth!,
        }, {
          onConflict: 'user_id,endpoint'
        });

      if (error) throw error;

      setIsSubscribed(true);
      toast.success('Notificaciones activadas');
    } catch (error) {
      console.error('Error al suscribirse:', error);
      toast.error('Error al activar notificaciones');
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribe = async () => {
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        
        // Eliminar de Supabase
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', user.id)
            .eq('endpoint', subscription.endpoint);
        }
      }

      setIsSubscribed(false);
      toast.success('Notificaciones desactivadas');
    } catch (error) {
      console.error('Error al desuscribirse:', error);
      toast.error('Error al desactivar notificaciones');
    } finally {
      setIsLoading(false);
    }
  };

  const checkSubscription = async () => {
    if (!isSupported) return;
    
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  useEffect(() => {
    checkSubscription();
  }, [isSupported]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    checkSubscription,
  };
}

