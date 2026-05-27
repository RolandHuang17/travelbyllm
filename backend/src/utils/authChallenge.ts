import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto'

export const EMAIL_CODE_EXPIRES_MS = 10 * 60 * 1000
export const RESET_TOKEN_EXPIRES_MS = 30 * 60 * 1000
export const CHALLENGE_RESEND_COOLDOWN_MS = 60 * 1000
export const MAX_CHALLENGE_ATTEMPTS = 5

function getChallengeSecret() {
  const secret = process.env.AUTH_CHALLENGE_SECRET?.trim()

  if (!secret) {
    throw new Error('AUTH_CHALLENGE_SECRET is not configured')
  }

  return secret
}

export function generateEmailCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, '0')
}

export function generateResetToken() {
  return randomBytes(32).toString('base64url')
}

export function hashChallengeSecret(secret: string) {
  return createHmac('sha256', getChallengeSecret())
    .update(secret)
    .digest('hex')
}

export function matchesChallengeSecret(secret: string, storedHash: string) {
  const suppliedHash = Buffer.from(hashChallengeSecret(secret), 'hex')
  const expectedHash = Buffer.from(storedHash, 'hex')

  return (
    suppliedHash.length === expectedHash.length &&
    timingSafeEqual(suppliedHash, expectedHash)
  )
}
