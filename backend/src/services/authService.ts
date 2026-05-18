import { prisma } from '../lib/prisma'
import { hashPassword, verifyPassword } from '../utils/password'

export type AuthUser = {
  id: number
  username: string
  createdAt: Date
}

type RegisterInput = {
  username: unknown
  password: unknown
  confirmPassword: unknown
}

type LoginInput = {
  username: unknown
  password: unknown
}

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

function normalizePassword(password: unknown) {
  return typeof password === 'string' ? password : ''
}

function toAuthUser(user: AuthUser) {
  return {
    id: user.id,
    username: user.username,
    createdAt: user.createdAt,
  }
}

export async function registerUser(input: RegisterInput) {
  const username = normalizeUsername(input.username)
  const password = normalizePassword(input.password)
  const confirmPassword = normalizePassword(input.confirmPassword)

  if (username.length < 3 || username.length > 30) {
    throw new AuthError(400, '用户名长度需要在 3 到 30 个字符之间')
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
    select: {
      id: true,
      username: true,
      createdAt: true,
    },
  })

  return toAuthUser(user)
}

export async function loginUser(input: LoginInput) {
  const username = normalizeUsername(input.username)
  const password = normalizePassword(input.password)

  if (!username || !password) {
    throw new AuthError(400, '用户名和密码不能为空')
  }

  const user = await prisma.user.findUnique({
    where: {
      username,
    },
    select: {
      id: true,
      username: true,
      passwordHash: true,
      createdAt: true,
    },
  })

  if (!user) {
    throw new AuthError(401, '用户名或密码错误')
  }

  const isPasswordValid = await verifyPassword(password, user.passwordHash)

  if (!isPasswordValid) {
    throw new AuthError(401, '用户名或密码错误')
  }

  return toAuthUser(user)
}

export async function getAuthUserById(id: number) {
  const user = await prisma.user.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      username: true,
      createdAt: true,
    },
  })

  return user ? toAuthUser(user) : null
}
