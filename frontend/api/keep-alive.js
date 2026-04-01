// Vercel API Route — /api/keep-alive
// Appelée automatiquement par le Cron Vercel toutes les 3 jours
// pour éviter la mise en pause du projet Supabase (plan Free)

import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  // Sécurité basique — vérifier que c'est bien Vercel qui appelle
  const authHeader = req.headers.authorization
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Requête légère — juste compter les services
    const { count, error } = await supabase
      .from('services')
      .select('*', { count: 'exact', head: true })

    if (error) throw error

    console.log(`[keep-alive] ping OK — ${count} services — ${new Date().toISOString()}`)
    return res.status(200).json({ ok: true, ping: new Date().toISOString() })

  } catch (err) {
    console.error('[keep-alive] error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
