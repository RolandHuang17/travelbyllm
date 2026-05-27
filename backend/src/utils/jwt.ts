import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken'

type AuthTokenPayload = JwtPayload & {
  userId: number
  tokenVersion?: number
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET

  if (!secret) {
    throw new Error('JWT_SECRET is not configured')
  }

  return secret
}

export function signAuthToken(userId: number, tokenVersion: number) {
  const expiresIn = (process.env.JWT_EXPIRES_IN ??
    '7d') as SignOptions['expiresIn']
  const options: SignOptions = {
    expiresIn,
  }

  return jwt.sign({ userId, tokenVersion }, getJwtSecret(), options)
}

export function verifyAuthToken(token: string) {
  const payload = jwt.verify(token, getJwtSecret())

  if (
    typeof payload !== 'object' ||
    payload === null ||
    typeof (payload as AuthTokenPayload).userId !== 'number' ||
    ((payload as AuthTokenPayload).tokenVersion !== undefined &&
      typeof (payload as AuthTokenPayload).tokenVersion !== 'number')
  ) {
    throw new Error('Invalid token payload')
  }

  return payload as AuthTokenPayload
}
