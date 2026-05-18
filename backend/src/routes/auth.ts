import { Router } from 'express'
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../middleware/authMiddleware'
import { AuthError, loginUser, registerUser } from '../services/authService'
import { sendError, sendSuccess } from '../utils/apiResponse'
import { signAuthToken } from '../utils/jwt'

const authRouter = Router()

authRouter.post('/register', async (request, response) => {
  try {
    const user = await registerUser(request.body)

    return sendSuccess(response, '注册成功', { user }, 201)
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(response, error.statusCode, error.message)
    }

    console.error(error)
    return sendError(response, 500, '注册失败，请稍后重试')
  }
})

authRouter.post('/login', async (request, response) => {
  try {
    const user = await loginUser(request.body)
    const token = signAuthToken(user.id)

    return sendSuccess(response, '登录成功', { user, token })
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(response, error.statusCode, error.message)
    }

    console.error(error)
    return sendError(response, 500, '登录失败，请稍后重试')
  }
})

authRouter.get('/me', requireAuth, (request, response) => {
  const { authUser } = request as AuthenticatedRequest

  return sendSuccess(response, 'ok', { user: authUser })
})

export { authRouter }
