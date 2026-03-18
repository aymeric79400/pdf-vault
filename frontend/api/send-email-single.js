// Vercel API Route — /api/send-email-single
// Envoie un email de test à un seul utilisateur

import nodemailer from 'nodemailer'

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { to, full_name, type, document } = req.body
    if (!to || !document) return res.status(400).json({ error: 'Missing params' })

    const firstName = full_name?.trim().split(/\s+/).pop() || null
    const subject = `[Planning Viewer] Test - ${document.title}`
    const textContent = `Bonjour ${firstName || ''},\n\n[MAIL DE TEST]\n\n${document.title}${document.folder_name ? ' - ' + document.folder_name : ''} est disponible sur Planning Viewer.\n\n--\nPlanning Viewer`

    await transporter.sendMail({
      from: `Planning Viewer <${process.env.SMTP_USER}>`,
      to,
      subject,
      text: textContent,
    })

    return res.status(200).json({ success: true })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
