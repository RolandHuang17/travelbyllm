import { randomUUID } from 'crypto'
import fs from 'fs/promises'
import multer from 'multer'
import { Router, type Request, type Response } from 'express'
import { rateLimit } from 'express-rate-limit'
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../middleware/authMiddleware'
import {
  AuthError,
  changeUserPassword,
  confirmEmailBinding,
  loginUser,
  removeUserAvatar,
  registerUser,
  requestEmailBinding,
  requestPasswordReset,
  resetPassword,
  updateUserAvatar,
  updateUserProfile,
} from '../services/authService'
import { sendError, sendSuccess } from '../utils/apiResponse'
import { signAuthToken } from '../utils/jwt'
import {
  avatarUploadsDir,
  getAvatarFilePath,
  getAvatarUrl,
} from '../utils/uploads'

const authRouter = Router()
const MAX_AVATAR_FILE_SIZE = 2 * 1024 * 1024
const AVATAR_FILE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const authActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  handler(_request, response) {
    return sendError(response, 429, '请求过于频繁，请稍后重试')
  },
})

type AvatarUploadRequest = Request & {
  file?: Express.Multer.File
}

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_AVATAR_FILE_SIZE,
  },
  fileFilter(_request, file, callback) {
    if (AVATAR_FILE_EXTENSIONS[file.mimetype]) {
      callback(null, true)
      return
    }

    callback(new AuthError(400, '头像仅支持 JPG、PNG 或 WebP 格式'))
  },
})

function runAvatarUpload(request: Request, response: Response) {
  return new Promise<void>((resolve, reject) => {
    avatarUpload.single('avatar')(request, response, (error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

async function saveAvatarFile(userId: number, file: Express.Multer.File) {
  const extension = AVATAR_FILE_EXTENSIONS[file.mimetype]

  if (!extension) {
    throw new AuthError(400, '头像仅支持 JPG、PNG 或 WebP 格式')
  }

  await fs.mkdir(avatarUploadsDir, { recursive: true })

  const filename = `user-${userId}-${randomUUID()}.${extension}`

  await fs.writeFile(`${avatarUploadsDir}/${filename}`, file.buffer)

  return getAvatarUrl(filename)
}

async function deleteAvatarFile(avatarUrl: string | null | undefined) {
  if (!avatarUrl) {
    return
  }

  const filePath = getAvatarFilePath(avatarUrl)

  if (!filePath) {
    return
  }

  try {
    await fs.unlink(filePath)
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException

    if (nodeError.code !== 'ENOENT') {
      console.warn(`头像文件删除失败：${filePath}`, error)
    }
  }
}

function handleAvatarError(response: Response, error: unknown) {
  if (error instanceof AuthError) {
    return sendError(response, error.statusCode, error.message)
  }

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return sendError(response, 400, '头像文件不能超过 2MB')
    }

    return sendError(response, 400, '头像上传失败，请重新选择图片')
  }

  console.error(error)
  return sendError(response, 500, '头像更新失败，请稍后重试')
}

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
    const result = await loginUser(request.body)
    const token = signAuthToken(result.user.id, result.tokenVersion)

    return sendSuccess(response, '登录成功', { user: result.user, token })
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

authRouter.put('/profile', requireAuth, async (request, response) => {
  const { authUser } = request as AuthenticatedRequest

  try {
    const user = await updateUserProfile(authUser.id, request.body)

    return sendSuccess(response, '资料已更新', { user })
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(response, error.statusCode, error.message)
    }

    console.error(error)
    return sendError(response, 500, '资料更新失败，请稍后重试')
  }
})

authRouter.post(
  '/email/bind/request',
  authActionLimiter,
  requireAuth,
  async (request, response) => {
    const { authUser } = request as AuthenticatedRequest

    try {
      const result = await requestEmailBinding(authUser.id, request.body)

      return sendSuccess(response, '验证码已发送', result)
    } catch (error) {
      if (error instanceof AuthError) {
        return sendError(response, error.statusCode, error.message)
      }

      console.error(error)
      return sendError(response, 500, '验证码发送失败，请稍后重试')
    }
  },
)

authRouter.post(
  '/email/bind/confirm',
  authActionLimiter,
  requireAuth,
  async (request, response) => {
    const { authUser } = request as AuthenticatedRequest

    try {
      const user = await confirmEmailBinding(authUser.id, request.body)

      return sendSuccess(response, '邮箱绑定成功', { user })
    } catch (error) {
      if (error instanceof AuthError) {
        return sendError(response, error.statusCode, error.message)
      }

      console.error(error)
      return sendError(response, 500, '邮箱验证失败，请稍后重试')
    }
  },
)

authRouter.post('/avatar', requireAuth, async (request, response) => {
  const { authUser } = request as AuthenticatedRequest
  let savedAvatarUrl: string | null = null

  try {
    await runAvatarUpload(request, response)

    const { file } = request as AvatarUploadRequest

    if (!file) {
      throw new AuthError(400, '请选择要上传的头像')
    }

    savedAvatarUrl = await saveAvatarFile(authUser.id, file)

    const user = await updateUserAvatar(authUser.id, savedAvatarUrl)

    await deleteAvatarFile(authUser.avatarUrl)

    return sendSuccess(response, '头像已更新', { user })
  } catch (error) {
    await deleteAvatarFile(savedAvatarUrl)

    return handleAvatarError(response, error)
  }
})

authRouter.delete('/avatar', requireAuth, async (request, response) => {
  const { authUser } = request as AuthenticatedRequest

  try {
    const user = await removeUserAvatar(authUser.id)

    await deleteAvatarFile(authUser.avatarUrl)

    return sendSuccess(response, '头像已移除', { user })
  } catch (error) {
    return handleAvatarError(response, error)
  }
})

authRouter.put('/password', requireAuth, async (request, response) => {
  const { authUser } = request as AuthenticatedRequest

  try {
    await changeUserPassword(authUser.id, request.body)

    return sendSuccess(response, '密码已更新', {})
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(response, error.statusCode, error.message)
    }

    console.error(error)
    return sendError(response, 500, '密码更新失败，请稍后重试')
  }
})

authRouter.post(
  '/password/forgot',
  authActionLimiter,
  async (request, response) => {
    try {
      await requestPasswordReset(request.body)
    } catch (error) {
      console.error('处理密码找回请求失败', error)
    }

    return sendSuccess(
      response,
      '如果该账号存在且已绑定邮箱，重置邮件将发送至绑定邮箱',
      {},
    )
  },
)

authRouter.post(
  '/password/reset',
  authActionLimiter,
  async (request, response) => {
    try {
      await resetPassword(request.body)

      return sendSuccess(response, '密码已重置，请重新登录', {})
    } catch (error) {
      if (error instanceof AuthError) {
        return sendError(response, error.statusCode, error.message)
      }

      console.error(error)
      return sendError(response, 500, '密码重置失败，请稍后重试')
    }
  },
)

export { authRouter }
