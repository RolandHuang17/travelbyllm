import type { NextFunction, Request, Response } from 'express'
import { getAuthSessionById, type AuthUser } from '../services/authService'
import { sendError } from '../utils/apiResponse'
import { verifyAuthToken } from '../utils/jwt'

export type AuthenticatedRequest = Request & {
  authUser: AuthUser
}

function parseBearerToken(authorizationHeader: string | undefined) {
  if (!authorizationHeader) {
    return null
  }

  const [scheme, token] = authorizationHeader.split(' ')

  if (scheme !== 'Bearer' || !token) {
    return null
  }

  return token
}

export async function requireAuth(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const token = parseBearerToken(request.header('authorization'))

  if (!token) {
    return sendError(response, 401, '请先登录')
  }

  try {
    const payload = verifyAuthToken(token)
    const session = await getAuthSessionById(payload.userId)

    if (!session) {
      return sendError(response, 401, '登录状态无效，请重新登录')
    }

    const tokenVersion = payload.tokenVersion ?? 0

    if (tokenVersion !== session.tokenVersion) {
      return sendError(response, 401, '登录状态无效，请重新登录')
    }

    ;(request as AuthenticatedRequest).authUser = session.user
    return next()
  } catch (_error) {
    return sendError(response, 401, '登录状态无效，请重新登录')
  }
}
