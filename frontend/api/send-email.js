// Vercel API Route — /api/send-email
// Envoi SMTP via nodemailer + Outlook

import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
})

const APP_URL = process.env.APP_URL || 'https://pdf-vault-chi.vercel.app'

function buildEmailHtml(type, document, recipientName) {
  const isNew = type === 'new_document'
  const greeting = recipientName ? `Bonjour ${recipientName},` : 'Bonjour,'
  const actionLabel = isNew ? 'Nouveau document disponible' : 'Document mis à jour'
  const intro = isNew
    ? 'Un nouveau document a été publié et est disponible dans votre espace :'
    : 'Un document a été mis à jour et est disponible dans votre espace :'
  const emoji = isNew ? '&#x1F4C4;' : '&#x1F504;'

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0ebe0;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ebe0;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#3d7a35,#2c5c26);padding:28px 32px;border-radius:18px 18px 0 0;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td>
                <div style="font-size:20px;font-weight:700;color:white;">Planning Viewer</div>
                <div style="font-size:10px;color:rgba(255,255,255,0.45);letter-spacing:0.1em;margin-top:3px;">SOIGNON · EURIAL · AGRIAL</div>
              </td>
              <td align="right"><div style="font-size:22px;">${emoji}</div></td>
            </tr></table>
            <div style="height:3px;background:linear-gradient(90deg,#c8261c,#e03020 55%,#d4a84b);border-radius:2px;margin-top:20px;"></div>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:36px 32px;">
            <p style="margin:0 0 6px;font-size:15px;color:#4a5e44;">${greeting}</p>
            <h2 style="margin:0 0 20px;font-size:22px;color:#1e2a1a;font-weight:700;">${actionLabel}</h2>
            <p style="margin:0 0 20px;font-size:14px;color:#7a9070;line-height:1.6;">${intro}</p>
            <div style="background:#faf6ef;border:1.5px solid rgba(61,122,53,0.15);border-radius:12px;padding:20px 24px;margin-bottom:28px;">
              <div style="font-size:16px;font-weight:700;color:#1e2a1a;margin-bottom:6px;">${document.title}</div>
              ${document.description ? `<div style="font-size:13px;color:#7a9070;line-height:1.5;">${document.description}</div>` : ''}
              ${document.folder_name ? `<div style="display:inline-block;margin-top:10px;background:#e8f2e6;color:#2c5c26;font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px;">${document.folder_name}</div>` : ''}
            </div>
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="background:#c8261c;border-radius:10px;box-shadow:0 4px 14px rgba(200,38,28,0.3);">
                <a href="${APP_URL}/dashboard" style="display:inline-block;padding:13px 28px;color:white;text-decoration:none;font-size:14px;font-weight:700;">Consulter le document →</a>
              </td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td style="background:#f5f0e6;padding:20px 32px;border-radius:0 0 18px 18px;border-top:1px solid rgba(61,122,53,0.1);">
            <p style="margin:0;font-size:11px;color:#a8b8a0;line-height:1.6;">
              Vous recevez cet email car vous avez un compte sur Planning Viewer.<br>
              Accès réservé — Ne pas transférer ce message.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {





    const { type, document } = req.body
    if (!type || !document) return res.status(400).json({ error: 'Missing type or document' })

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    const { data: users, error } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('is_active', true)
      .not('email', 'is', null)
      .neq('email', '')
    if (error || !users?.length) {
      return res.status(400).json({ error: 'No recipients', detail: error })
    }

    const subject = type === 'new_document'
      ? `[Planning Viewer] Nouveau document : ${document.title}`
      : `[Planning Viewer] Document mis a jour : ${document.title}`

    const results = []
    for (const user of users) {
      const firstName = user.full_name?.trim().split(/\s+/).pop() || null
      const html = buildEmailHtml(type, document, firstName)
      try {
        await transporter.sendMail({
          from: `Planning Viewer <${process.env.SMTP_USER}>`,
          to: user.email,
          subject,
          text: `Bonjour ${firstName || ''},\n\nUn nouveau document est disponible : ${document.title}\n\nConsultez-le ici : ${APP_URL}/dashboard\n\nPlanning Viewer`,
          html,
        })
        results.push({ email: user.email, status: 'sent' })
      } catch (err) {
        results.push({ email: user.email, status: 'failed', error: err.message })
      }
    }

    return res.status(200).json({
      success: true,
      sent: results.filter(r => r.status === 'sent').length,
      results,
    })

  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
