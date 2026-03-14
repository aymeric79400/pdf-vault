// Vercel API Route — /api/send-push-single
// Envoie une notification push de test à un seul utilisateur

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

webpush.setVapidDetails(
  'mailto:' + process.env.SMTP_USER,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { user_id, type, document } = req.body
    if (!user_id || !document) return res.status(400).json({ error: 'Missing params' })

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

    // Récupérer uniquement les souscriptions de cet utilisateur
    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', user_id)

    if (error || !subs?.length) {
      return res.status(200).json({ sent: 0, message: 'No subscriptions for this user' })
    }

    const payload = JSON.stringify({
      title: '[Test] Nouveau document disponible',
      body: `${document.title}${document.folder_name ? ' - ' + document.folder_name : ''}`,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      url: '/dashboard'
    })

    const results = []
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
        results.push({ status: 'sent' })
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        }
        results.push({ status: 'failed', error: err.message })
      }
    }

    return res.status(200).json({ success: true, sent: results.filter(r => r.status === 'sent').length })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
