import nodemailer from 'nodemailer'

type MailMessage = {
  to: string
  subject: string
  text: string
  html: string
}

type VerificationEmailInput = {
  to: string
  code: string
}

type PasswordResetEmailInput = {
  to: string
  challengeId: string
  token: string
}

type EmailChangeNoticeInput = {
  to: string
  newEmail: string
}

let transporter: nodemailer.Transporter | null = null

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function getTransporter() {
  if (transporter) {
    return transporter
  }

  const host = process.env.SMTP_HOST?.trim()
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.trim()

  if (!host || !user || !pass) {
    throw new Error('SMTP configuration is incomplete')
  }

  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: (process.env.SMTP_SECURE ?? 'true') === 'true',
    auth: {
      user,
      pass,
    },
  })

  return transporter
}

function getFromAddress() {
  const from = process.env.MAIL_FROM?.trim() || process.env.SMTP_USER?.trim()

  if (!from) {
    throw new Error('MAIL_FROM is not configured')
  }

  return from
}

function getPublicWebUrl() {
  const rawUrl = process.env.PUBLIC_WEB_URL?.trim()

  if (!rawUrl) {
    throw new Error('PUBLIC_WEB_URL is not configured')
  }

  return new URL(rawUrl)
}

async function sendMail(message: MailMessage) {
  await getTransporter().sendMail({
    from: getFromAddress(),
    ...message,
  })
}

export async function sendEmailVerificationCode({
  to,
  code,
}: VerificationEmailInput) {
  const safeCode = escapeHtml(code)

  await sendMail({
    to,
    subject: 'TravelByLLM 邮箱验证码',
    text: `你的邮箱验证码是 ${code}。验证码 10 分钟内有效，请勿转发给他人。`,
    html: `<p>你的邮箱验证码是：</p><p style="font-size:24px;font-weight:600;letter-spacing:4px">${safeCode}</p><p>验证码 10 分钟内有效，请勿转发给他人。</p>`,
  })
}

export async function sendPasswordResetEmail({
  to,
  challengeId,
  token,
}: PasswordResetEmailInput) {
  const resetUrl = new URL('/auth/reset-password', getPublicWebUrl())

  resetUrl.searchParams.set('challengeId', challengeId)
  resetUrl.searchParams.set('token', token)

  const resetLink = resetUrl.toString()
  const safeResetLink = escapeHtml(resetLink)

  await sendMail({
    to,
    subject: 'TravelByLLM 重置密码',
    text: `请在 30 分钟内访问以下链接重置密码：${resetLink}。如非本人操作，请忽略此邮件。`,
    html: `<p>请在 30 分钟内点击以下链接重置密码：</p><p><a href="${safeResetLink}">重置密码</a></p><p>如非本人操作，请忽略此邮件。</p>`,
  })
}

export async function sendEmailChangedNotice({
  to,
  newEmail,
}: EmailChangeNoticeInput) {
  await sendMail({
    to,
    subject: 'TravelByLLM 绑定邮箱已变更',
    text: `你的 TravelByLLM 账号绑定邮箱已变更为 ${newEmail}。如非本人操作，请尽快修改密码。`,
    html: `<p>你的 TravelByLLM 账号绑定邮箱已变更为 <strong>${escapeHtml(newEmail)}</strong>。</p><p>如非本人操作，请尽快修改密码。</p>`,
  })
}

export async function sendPasswordChangedNotice(to: string) {
  await sendMail({
    to,
    subject: 'TravelByLLM 密码已修改',
    text: '你的 TravelByLLM 账号密码已修改。如非本人操作，请立即通过绑定邮箱重置密码。',
    html: '<p>你的 TravelByLLM 账号密码已修改。</p><p>如非本人操作，请立即通过绑定邮箱重置密码。</p>',
  })
}
