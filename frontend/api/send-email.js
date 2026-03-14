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
  const action = isNew ? 'Un nouveau document est disponible' : 'Un document a été mis à jour'

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:30px 16px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background:#ffffff;border:1px solid #dddddd;border-radius:8px;">
        <tr>
          <td style="background:#2c5c26;padding:20px 28px;border-radius:8px 8px 0 0;">
            <span style="font-size:18px;font-weight:bold;color:#ffffff;">Planning Viewer</span>
            <span style="font-size:10px;color:#aaaaaa;margin-left:10px;">SOIGNON · EURIAL · AGRIAL</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 8px;font-size:14px;color:#333333;">${greeting}</p>
            <p style="margin:0 0 20px;font-size:14px;color:#333333;">${action} :</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#f9f9f9;border:1px solid #dddddd;border-radius:6px;padding:16px;">
                  <p style="margin:0 0 6px;font-size:15px;font-weight:bold;color:#1e2a1a;">${document.title}</p>
                  ${document.description ? `<p style="margin:0 0 8px;font-size:13px;color:#666666;">${document.description}</p>` : ''}
                  ${document.folder_name ? `<p style="margin:0;font-size:12px;color:#3d7a35;font-weight:bold;">${document.folder_name}</p>` : ''}
                </td>
              </tr>
            </table>
            <p style="margin:24px 0 0;font-size:14px;color:#333333;">
              Consultez le document ici : <a href="${APP_URL}/dashboard" style="color:#2c5c26;">${APP_URL}/dashboard</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px;border-top:1px solid #eeeeee;">
            <p style="margin:0;font-size:11px;color:#999999;">Vous recevez cet email car vous avez un compte sur Planning Viewer. Acces reserve.</p>
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
        const textContent = type === 'new_document'
          ? `Bonjour ${firstName || ''},\n\nUn nouveau document est disponible : ${document.title}${document.folder_name ? ' (' + document.folder_name + ')' : ''}${document.description ? '\n' + document.description : ''}\n\nConsultez-le ici : ${APP_URL}/dashboard\n\nPlanning Viewer`
          : `Bonjour ${firstName || ''},\n\nLe document suivant a ete mis a jour : ${document.title}${document.folder_name ? ' (' + document.folder_name + ')' : ''}\n\nConsultez-le ici : ${APP_URL}/dashboard\n\nPlanning Viewer`
        const msgId = `<planning-viewer-${Date.now()}-${Math.random().toString(36).slice(2)}@gmail.com>`
        await transporter.sendMail({
          from: `Planning Viewer <${process.env.SMTP_USER}>`,
          to: user.email,
          subject,
          text: textContent,
          messageId: msgId,
          headers: {
            'X-Mailer': 'Planning Viewer Notification',
            'X-Priority': '3',
            'Precedence': 'bulk',
          }
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
