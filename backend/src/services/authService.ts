import { prisma } from '../lib/prisma'
import {
  CHALLENGE_RESEND_COOLDOWN_MS,
  EMAIL_CODE_EXPIRES_MS,
  generateEmailCode,
  generateResetToken,
  hashChallengeSecret,
  matchesChallengeSecret,
  MAX_CHALLENGE_ATTEMPTS,
  RESET_TOKEN_EXPIRES_MS,
} from '../utils/authChallenge'
import { hashPassword, verifyPassword } from '../utils/password'
import {
  sendEmailChangedNotice,
  sendEmailVerificationCode,
  sendPasswordChangedNotice,
  sendPasswordResetEmail,
} from './mailService'

export type AuthUser = {
  id: number
  username: string
  email: string | null
  emailVerifiedAt: Date | null
  nickname: string | null
  avatarPreset: string | null
  avatarUrl: string | null
  loginCount: number
  lastLoginAt: Date | null
  createdAt: Date
}

type AuthUserRecord = AuthUser

const AVATAR_PRESETS = [
  'sky',
  'forest',
  'sunset',
  'ocean',
  'stone',
  'rose',
] as const

type RegisterInput = {
  username: unknown
  password: unknown
  confirmPassword: unknown
}

type LoginInput = {
  identifier: unknown
  username?: unknown
  password: unknown
}

type UpdateProfileInput = {
  nickname: unknown
  avatarPreset: unknown
}

type ChangePasswordInput = {
  currentPassword: unknown
  newPassword: unknown
  confirmPassword: unknown
}

type RequestEmailBindingInput = {
  email: unknown
  currentPassword: unknown
}

type ConfirmEmailBindingInput = {
  challengeId: unknown
  code: unknown
}

type ForgotPasswordInput = {
  identifier: unknown
}

type ResetPasswordInput = {
  challengeId: unknown
  token: unknown
  newPassword: unknown
  confirmPassword: unknown
}

const EMAIL_BIND_PURPOSE = 'EMAIL_BIND'
const PASSWORD_RESET_PURPOSE = 'PASSWORD_RESET'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const authUserSelect = {
  id: true,
  username: true,
  email: true,
  emailVerifiedAt: true,
  nickname: true,
  avatarPreset: true,
  avatarUrl: true,
  loginCount: true,
  lastLoginAt: true,
  createdAt: true,
} as const

const authSessionSelect = {
  ...authUserSelect,
  tokenVersion: true,
} as const

export class AuthError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message)
  }
}

function normalizeUsername(username: unknown) {
  return typeof username === 'string' ? username.trim() : ''
}

function normalizeIdentifier(identifier: unknown) {
  return typeof identifier === 'string' ? identifier.trim() : ''
}

function normalizeEmail(email: unknown) {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

function normalizePassword(password: unknown) {
  return typeof password === 'string' ? password : ''
}

function normalizeNickname(nickname: unknown) {
  if (typeof nickname !== 'string') {
    return null
  }

  const normalizedNickname = nickname.trim()

  return normalizedNickname ? normalizedNickname : null
}

function normalizeAvatarPreset(avatarPreset: unknown) {
  if (typeof avatarPreset !== 'string') {
    return null
  }

  const normalizedAvatarPreset = avatarPreset.trim()

  if (!normalizedAvatarPreset) {
    return null
  }

  if (
    !AVATAR_PRESETS.includes(
      normalizedAvatarPreset as (typeof AVATAR_PRESETS)[number],
    )
  ) {
    throw new AuthError(400, '头像预设无效')
  }

  return normalizedAvatarPreset
}

function toAuthUser(user: AuthUserRecord) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt,
    nickname: user.nickname,
    avatarPreset: user.avatarPreset,
    avatarUrl: user.avatarUrl,
    loginCount: user.loginCount,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  }
}

function hasEmailFormat(value: string) {
  return EMAIL_PATTERN.test(value)
}

function normalizeChallengeValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function validateNewPassword(newPassword: string, confirmPassword: string) {
  if (!newPassword || !confirmPassword) {
    throw new AuthError(400, '新密码和确认密码不能为空')
  }

  if (newPassword.length < 6) {
    throw new AuthError(400, '新密码长度至少需要 6 位')
  }

  if (newPassword !== confirmPassword) {
    throw new AuthError(400, '两次输入的新密码不一致')
  }
}

function getRemainingCooldownSeconds(createdAt: Date) {
  const remaining =
    CHALLENGE_RESEND_COOLDOWN_MS - (Date.now() - createdAt.getTime())

  return remaining > 0 ? Math.ceil(remaining / 1000) : 0
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  )
}

async function notifyPasswordChange(email: string | null) {
  if (!email) {
    return
  }

  try {
    await sendPasswordChangedNotice(email)
  } catch (error) {
    console.warn('密码修改通知邮件发送失败', error)
  }
}

export async function registerUser(input: RegisterInput) {
  const username = normalizeUsername(input.username)
  const password = normalizePassword(input.password)
  const confirmPassword = normalizePassword(input.confirmPassword)

  if (username.length < 3 || username.length > 30) {
    throw new AuthError(400, '用户名长度需要在 3 到 30 个字符之间')
  }

  if (hasEmailFormat(username)) {
    throw new AuthError(400, '用户名不能使用邮箱格式')
  }

  if (password.length < 6) {
    throw new AuthError(400, '密码长度至少需要 6 位')
  }

  if (password !== confirmPassword) {
    throw new AuthError(400, '两次输入的密码不一致')
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      username,
    },
    select: {
      id: true,
    },
  })

  if (existingUser) {
    throw new AuthError(409, '用户名已存在')
  }

  const passwordHash = await hashPassword(password)

  const user = await prisma.user.create({
    data: {
      username,
      passwordHash,
    },
    select: authUserSelect,
  })

  return toAuthUser(user)
}

export async function loginUser(input: LoginInput) {
  const identifier = normalizeIdentifier(input.identifier ?? input.username)
  const password = normalizePassword(input.password)

  if (!identifier || !password) {
    throw new AuthError(400, '用户名或邮箱和密码不能为空')
  }

  const user = await prisma.user.findFirst({
    where: hasEmailFormat(identifier)
      ? {
          email: normalizeEmail(identifier),
          emailVerifiedAt: {
            not: null,
          },
        }
      : {
          username: identifier,
        },
    select: {
      ...authSessionSelect,
      passwordHash: true,
    },
  })

  if (!user) {
    throw new AuthError(401, '用户名或密码错误')
  }

  const isPasswordValid = await verifyPassword(password, user.passwordHash)

  if (!isPasswordValid) {
    throw new AuthError(401, '用户名或密码错误')
  }

  const loggedInUser = await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      loginCount: {
        increment: 1,
      },
      lastLoginAt: new Date(),
    },
    select: authSessionSelect,
  })

  return {
    user: toAuthUser(loggedInUser),
    tokenVersion: loggedInUser.tokenVersion,
  }
}

export async function getAuthSessionById(id: number) {
  const user = await prisma.user.findUnique({
    where: {
      id,
    },
    select: authSessionSelect,
  })

  return user
    ? {
        user: toAuthUser(user),
        tokenVersion: user.tokenVersion,
      }
    : null
}

export async function updateUserProfile(
  userId: number,
  input: UpdateProfileInput,
) {
  const nickname = normalizeNickname(input.nickname)
  const avatarPreset = normalizeAvatarPreset(input.avatarPreset)

  if (nickname && nickname.length > 30) {
    throw new AuthError(400, '昵称长度不能超过 30 个字符')
  }

  const user = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      nickname,
      avatarPreset,
    },
    select: authUserSelect,
  })

  return toAuthUser(user)
}

export async function updateUserAvatar(userId: number, avatarUrl: string) {
  const user = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      avatarUrl,
    },
    select: authUserSelect,
  })

  return toAuthUser(user)
}

export async function removeUserAvatar(userId: number) {
  const user = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      avatarUrl: null,
    },
    select: authUserSelect,
  })

  return toAuthUser(user)
}

export async function changeUserPassword(
  userId: number,
  input: ChangePasswordInput,
) {
  const currentPassword = normalizePassword(input.currentPassword)
  const newPassword = normalizePassword(input.newPassword)
  const confirmPassword = normalizePassword(input.confirmPassword)

  if (!currentPassword) {
    throw new AuthError(400, '当前密码不能为空')
  }

  validateNewPassword(newPassword, confirmPassword)

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      passwordHash: true,
      email: true,
      emailVerifiedAt: true,
    },
  })

  if (!user) {
    throw new AuthError(404, '用户不存在')
  }

  const isCurrentPasswordValid = await verifyPassword(
    currentPassword,
    user.passwordHash,
  )

  if (!isCurrentPasswordValid) {
    throw new AuthError(400, '当前密码不正确')
  }

  const passwordHash = await hashPassword(newPassword)

  await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      passwordHash,
      tokenVersion: {
        increment: 1,
      },
    },
  })

  await notifyPasswordChange(user.emailVerifiedAt ? user.email : null)
}

async function markChallengeAttemptFailed(
  challengeId: string,
  attemptCount: number,
) {
  await prisma.authChallenge.update({
    where: {
      id: challengeId,
    },
    data: {
      attemptCount: {
        increment: 1,
      },
      ...(attemptCount + 1 >= MAX_CHALLENGE_ATTEMPTS
        ? { usedAt: new Date() }
        : {}),
    },
  })
}

export async function requestEmailBinding(
  userId: number,
  input: RequestEmailBindingInput,
) {
  const email = normalizeEmail(input.email)
  const currentPassword = normalizePassword(input.currentPassword)

  if (!hasEmailFormat(email) || email.length > 254) {
    throw new AuthError(400, '请输入有效的邮箱地址')
  }

  if (!currentPassword) {
    throw new AuthError(400, '请输入当前密码')
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      passwordHash: true,
    },
  })

  if (!user) {
    throw new AuthError(404, '用户不存在')
  }

  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new AuthError(400, '当前密码不正确')
  }

  if (user.email === email) {
    throw new AuthError(400, '该邮箱已绑定到当前账号')
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })

  if (existingUser && existingUser.id !== userId) {
    throw new AuthError(409, '该邮箱已被其他账号绑定')
  }

  const latestChallenge = await prisma.authChallenge.findFirst({
    where: {
      userId,
      purpose: EMAIL_BIND_PURPOSE,
      usedAt: null,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })
  const remainingSeconds = latestChallenge
    ? getRemainingCooldownSeconds(latestChallenge.createdAt)
    : 0

  if (remainingSeconds) {
    throw new AuthError(429, `请在 ${remainingSeconds} 秒后重新发送验证码`)
  }

  const code = generateEmailCode()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + EMAIL_CODE_EXPIRES_MS)

  await prisma.authChallenge.updateMany({
    where: {
      userId,
      purpose: EMAIL_BIND_PURPOSE,
      usedAt: null,
    },
    data: {
      usedAt: now,
    },
  })

  const challenge = await prisma.authChallenge.create({
    data: {
      userId,
      purpose: EMAIL_BIND_PURPOSE,
      targetEmail: email,
      secretHash: hashChallengeSecret(code),
      expiresAt,
    },
  })

  try {
    await sendEmailVerificationCode({ to: email, code })
  } catch (error) {
    await prisma.authChallenge.update({
      where: { id: challenge.id },
      data: { usedAt: new Date() },
    })
    console.error('邮箱验证码发送失败', error)
    throw new AuthError(503, '验证码发送失败，请稍后重试')
  }

  return {
    challengeId: challenge.id,
    expiresAt,
    retryAfterSeconds: CHALLENGE_RESEND_COOLDOWN_MS / 1000,
  }
}

export async function confirmEmailBinding(
  userId: number,
  input: ConfirmEmailBindingInput,
) {
  const challengeId = normalizeChallengeValue(input.challengeId)
  const code = normalizeChallengeValue(input.code)

  if (!challengeId || !/^\d{6}$/.test(code)) {
    throw new AuthError(400, '请输入有效的 6 位验证码')
  }

  const challenge = await prisma.authChallenge.findUnique({
    where: { id: challengeId },
  })

  if (
    !challenge ||
    challenge.userId !== userId ||
    challenge.purpose !== EMAIL_BIND_PURPOSE ||
    challenge.usedAt
  ) {
    throw new AuthError(400, '验证码无效或已使用')
  }

  if (challenge.expiresAt.getTime() <= Date.now()) {
    await prisma.authChallenge.update({
      where: { id: challenge.id },
      data: { usedAt: new Date() },
    })
    throw new AuthError(400, '验证码已过期，请重新获取')
  }

  if (
    challenge.attemptCount >= MAX_CHALLENGE_ATTEMPTS ||
    !matchesChallengeSecret(code, challenge.secretHash)
  ) {
    await markChallengeAttemptFailed(challenge.id, challenge.attemptCount)
    throw new AuthError(400, '验证码错误')
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  })

  if (!currentUser) {
    throw new AuthError(404, '用户不存在')
  }

  let updatedUser

  try {
    updatedUser = await prisma.$transaction(async (transaction) => {
      const now = new Date()

      await transaction.authChallenge.update({
        where: { id: challenge.id },
        data: { usedAt: now },
      })
      await transaction.authChallenge.updateMany({
        where: {
          userId,
          purpose: PASSWORD_RESET_PURPOSE,
          usedAt: null,
        },
        data: { usedAt: now },
      })

      return transaction.user.update({
        where: { id: userId },
        data: {
          email: challenge.targetEmail,
          emailVerifiedAt: now,
        },
        select: authUserSelect,
      })
    })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AuthError(409, '该邮箱已被其他账号绑定')
    }

    throw error
  }

  if (currentUser.email && currentUser.email !== challenge.targetEmail) {
    try {
      await sendEmailChangedNotice({
        to: currentUser.email,
        newEmail: challenge.targetEmail,
      })
    } catch (error) {
      console.warn('旧邮箱换绑通知发送失败', error)
    }
  }

  return toAuthUser(updatedUser)
}

export async function requestPasswordReset(input: ForgotPasswordInput) {
  const identifier = normalizeIdentifier(input.identifier)

  if (!identifier) {
    return
  }

  const user = await prisma.user.findFirst({
    where: hasEmailFormat(identifier)
      ? {
          email: normalizeEmail(identifier),
          emailVerifiedAt: { not: null },
        }
      : {
          username: identifier,
          emailVerifiedAt: { not: null },
        },
    select: {
      id: true,
      email: true,
    },
  })

  if (!user?.email) {
    return
  }

  const latestChallenge = await prisma.authChallenge.findFirst({
    where: {
      userId: user.id,
      purpose: PASSWORD_RESET_PURPOSE,
      usedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  })

  if (
    latestChallenge &&
    getRemainingCooldownSeconds(latestChallenge.createdAt) > 0
  ) {
    return
  }

  const now = new Date()
  const token = generateResetToken()

  await prisma.authChallenge.updateMany({
    where: {
      userId: user.id,
      purpose: PASSWORD_RESET_PURPOSE,
      usedAt: null,
    },
    data: { usedAt: now },
  })

  const challenge = await prisma.authChallenge.create({
    data: {
      userId: user.id,
      purpose: PASSWORD_RESET_PURPOSE,
      targetEmail: user.email,
      secretHash: hashChallengeSecret(token),
      expiresAt: new Date(now.getTime() + RESET_TOKEN_EXPIRES_MS),
    },
  })

  try {
    await sendPasswordResetEmail({
      to: user.email,
      challengeId: challenge.id,
      token,
    })
  } catch (error) {
    await prisma.authChallenge.update({
      where: { id: challenge.id },
      data: { usedAt: new Date() },
    })
    console.error('密码重置邮件发送失败', error)
  }
}

export async function resetPassword(input: ResetPasswordInput) {
  const challengeId = normalizeChallengeValue(input.challengeId)
  const token = normalizeChallengeValue(input.token)
  const newPassword = normalizePassword(input.newPassword)
  const confirmPassword = normalizePassword(input.confirmPassword)

  if (!challengeId || !token) {
    throw new AuthError(400, '重置链接无效')
  }

  validateNewPassword(newPassword, confirmPassword)

  const challenge = await prisma.authChallenge.findUnique({
    where: { id: challengeId },
    include: {
      user: {
        select: {
          email: true,
          emailVerifiedAt: true,
        },
      },
    },
  })

  if (
    !challenge ||
    challenge.purpose !== PASSWORD_RESET_PURPOSE ||
    challenge.usedAt ||
    challenge.user.email !== challenge.targetEmail ||
    !challenge.user.emailVerifiedAt
  ) {
    throw new AuthError(400, '重置链接无效或已使用')
  }

  if (challenge.expiresAt.getTime() <= Date.now()) {
    await prisma.authChallenge.update({
      where: { id: challenge.id },
      data: { usedAt: new Date() },
    })
    throw new AuthError(400, '重置链接已过期，请重新申请')
  }

  if (
    challenge.attemptCount >= MAX_CHALLENGE_ATTEMPTS ||
    !matchesChallengeSecret(token, challenge.secretHash)
  ) {
    await markChallengeAttemptFailed(challenge.id, challenge.attemptCount)
    throw new AuthError(400, '重置链接无效或已使用')
  }

  const passwordHash = await hashPassword(newPassword)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: challenge.userId },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 },
      },
    }),
    prisma.authChallenge.update({
      where: { id: challenge.id },
      data: { usedAt: new Date() },
    }),
  ])

  await notifyPasswordChange(challenge.user.email)
}
