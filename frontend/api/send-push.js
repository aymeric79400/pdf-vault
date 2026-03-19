// Vercel API Route — /api/send-push
// Envoie des notifications push Web à tous les abonnés

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
    const { type, document, service_ids } = req.body
    if (!type || !document) return res.status(400).json({ error: 'Missing params' })

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Déterminer les user_ids autorisés selon les services du document
    let authorizedUserIds = null
    if (service_ids && service_ids.length > 0) {
      const { data: userServices } = await supabase
        .from('user_services')
        .select('user_id')
        .in('service_id', service_ids)
      if (userServices) {
        authorizedUserIds = userServices.map(r => r.user_id)
      }
    }

    // Récupérer les souscriptions push — filtrées par service si applicable
    let query = supabase.from('push_subscriptions').select('endpoint, p256dh, auth, user_id')
    if (authorizedUserIds !== null) {
      if (authorizedUserIds.length === 0) return res.status(200).json({ message: 'No authorized users' })
      query = query.in('user_id', authorizedUserIds)
    }
    const { data: subs, error } = await query

    if (error || !subs?.length) {
      return res.status(200).json({ message: 'No subscriptions' })
    }

    const isNew = type === 'new_document'
    const payload = JSON.stringify({
      title: isNew ? 'Nouveau document disponible' : 'Document mis à jour',
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
        results.push({ endpoint: sub.endpoint.slice(-20), status: 'sent' })
      } catch (err) {
        // Supprimer les souscriptions expirées
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        }
        results.push({ endpoint: sub.endpoint.slice(-20), status: 'failed', error: err.message })
      }
    }

    return res.status(200).json({ success: true, sent: results.filter(r => r.status === 'sent').length, results })

  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
