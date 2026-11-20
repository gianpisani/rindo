import webpush from 'npm:web-push@3.6.7'
import { fail, json, preflight } from '../_shared/http.ts'
import { isServiceRole, serviceClient } from '../_shared/supabase.ts'

const DEFAULT_ICON = '/icon-192x192.png'

interface PushSubscription {
  endpoint: string
  p256dh: string
  auth: string
}

interface NotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  requireInteraction?: boolean
}

async function sendWebPush(subscription: PushSubscription, payload: NotificationPayload): Promise<boolean> {
  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      JSON.stringify(payload),
    )
    return true
  } catch (error) {
    console.error('Error sending web push:', error)
    return false
  }
}

Deno.serve(async (req) => {
  const preflightResponse = preflight(req)
  if (preflightResponse) return preflightResponse
  if (!isServiceRole(req)) return fail(401, 'No autorizado')

  try {
    const { userId, notification } = await req.json()
    if (!userId || !notification) return fail(400, 'Missing userId or notification data')

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error('VAPID keys not configured')
      return fail(500, 'VAPID keys not configured')
    }
    webpush.setVapidDetails('mailto:notifications@yourapp.com', vapidPublicKey, vapidPrivateKey)

    const { data: subscriptions, error } = await serviceClient()
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)
    if (error) {
      console.error('Error fetching subscriptions:', error)
      return fail(500, 'Failed to fetch subscriptions')
    }

    if (!subscriptions?.length) {
      console.log('No push subscriptions found for user:', userId)
      return json({ success: true, sent: 0, message: 'No subscriptions found' })
    }

    const results = await Promise.all(subscriptions.map((sub) => sendWebPush(
      { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
      {
        title: notification.title,
        body: notification.body,
        icon: notification.icon || DEFAULT_ICON,
        badge: notification.badge || DEFAULT_ICON,
        tag: notification.tag || 'default',
        requireInteraction: notification.requireInteraction || false,
      },
    )))
    const sent = results.filter(Boolean).length
    console.log(`✅ Push notifications sent: ${sent}/${subscriptions.length}`)
    return json({ success: true, sent, total: subscriptions.length })
  } catch (error) {
    console.error('❌ Error in send-push-notification:', error)
    return fail(500, 'No se pudo enviar la notificación')
  }
})
