import { readdirSync, readFileSync, statSync } from 'node:fs'
import fs from 'node:fs/promises'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { app } from '../app'
import { prisma } from '../lib/prisma'
import {
  sendEmailChangedNotice,
  sendEmailVerificationCode,
  sendPasswordChangedNotice,
  sendPasswordResetEmail,
} from '../services/mailService'

vi.mock('../services/mailService', () => ({
  sendEmailChangedNotice: vi.fn().mockResolvedValue(undefined),
  sendEmailVerificationCode: vi.fn().mockResolvedValue(undefined),
  sendPasswordChangedNotice: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}))

const password = 'secret123'

async function registerUser(username: string) {
  return request(app).post('/api/auth/register').send({
    username,
    password,
    confirmPassword: password,
  })
}

async function login(identifier: string, loginPassword = password) {
  return request(app).post('/api/auth/login').send({
    identifier,
    password: loginPassword,
  })
}

async function bindEmail(token: string, email: string) {
  const requestResponse = await request(app)
    .post('/api/auth/email/bind/request')
    .set('authorization', `Bearer ${token}`)
    .send({
      email,
      currentPassword: password,
    })

  expect(requestResponse.status).toBe(200)

  const verificationCall = vi.mocked(sendEmailVerificationCode).mock.calls.at(-1)

  expect(verificationCall).toBeDefined()

  const code = verificationCall?.[0].code ?? ''
  const challengeId = requestResponse.body.data.challengeId as string

  const confirmResponse = await request(app)
    .post('/api/auth/email/bind/confirm')
    .set('authorization', `Bearer ${token}`)
    .send({
      challengeId,
      code,
    })

  expect(confirmResponse.status).toBe(200)
  return confirmResponse
}

beforeAll(() => {
  const databaseUrl = process.env.DATABASE_URL ?? ''
  const databasePath = databaseUrl.startsWith('file:')
    ? databaseUrl.slice('file:'.length)
    : databaseUrl
  const database = new Database(databasePath)
  const migrationsRoot = join(process.cwd(), 'prisma', 'migrations')

  for (const migrationDir of readdirSync(migrationsRoot).sort()) {
    if (!statSync(join(migrationsRoot, migrationDir)).isDirectory()) {
      continue
    }

    const migrationPath = join(migrationsRoot, migrationDir, 'migration.sql')
    const migrationSql = readFileSync(migrationPath, 'utf8')

    database.exec(migrationSql)
  }

  database.close()
})

beforeEach(async () => {
  await prisma.authChallenge.deleteMany()
  await prisma.user.deleteMany()
  vi.clearAllMocks()
})

afterAll(async () => {
  await prisma.$disconnect()

  const databaseUrl = process.env.DATABASE_URL ?? ''
  const databasePath = databaseUrl.startsWith('file:')
    ? databaseUrl.slice('file:'.length)
    : ''

  if (databasePath) {
    await fs.rm(databasePath, { force: true })
    await fs.rm(`${databasePath}-journal`, { force: true })
  }
})

describe('auth email recovery flows', () => {
  it('rejects email-shaped usernames and logs in with username', async () => {
    const invalidRegisterResponse = await registerUser('alice@example.com')

    expect(invalidRegisterResponse.status).toBe(400)

    const registerResponse = await registerUser('alice')

    expect(registerResponse.status).toBe(201)
    expect(registerResponse.body.data.user.email).toBeNull()

    const loginResponse = await login('alice')

    expect(loginResponse.status).toBe(200)
    expect(loginResponse.body.data.token).toEqual(expect.any(String))
  })

  it('binds a verified email and allows email login', async () => {
    await registerUser('alice')

    const loginResponse = await login('alice')
    const token = loginResponse.body.data.token as string
    const confirmResponse = await bindEmail(token, 'Alice@Example.COM')

    expect(confirmResponse.body.data.user.email).toBe('alice@example.com')
    expect(confirmResponse.body.data.user.emailVerifiedAt).toEqual(
      expect.any(String),
    )

    const emailLoginResponse = await login('ALICE@example.com')

    expect(emailLoginResponse.status).toBe(200)
    expect(emailLoginResponse.body.data.user.username).toBe('alice')
  })

  it('prevents binding the same email to another account', async () => {
    await registerUser('alice')
    await registerUser('bob')

    const aliceToken = (await login('alice')).body.data.token as string
    const bobToken = (await login('bob')).body.data.token as string

    await bindEmail(aliceToken, 'shared@example.com')

    const duplicateResponse = await request(app)
      .post('/api/auth/email/bind/request')
      .set('authorization', `Bearer ${bobToken}`)
      .send({
        email: 'shared@example.com',
        currentPassword: password,
      })

    expect(duplicateResponse.status).toBe(409)
  })

  it('resets a password by email and invalidates old JWTs', async () => {
    await registerUser('alice')

    const initialLoginResponse = await login('alice')
    const token = initialLoginResponse.body.data.token as string

    await bindEmail(token, 'alice@example.com')

    const oldToken = (await login('alice')).body.data.token as string

    const forgotResponse = await request(app)
      .post('/api/auth/password/forgot')
      .send({ identifier: 'alice@example.com' })

    expect(forgotResponse.status).toBe(200)

    const resetCall = vi.mocked(sendPasswordResetEmail).mock.calls.at(-1)

    expect(resetCall).toBeDefined()

    const { challengeId, token: resetToken } = resetCall?.[0] ?? {
      challengeId: '',
      token: '',
    }

    const resetResponse = await request(app)
      .post('/api/auth/password/reset')
      .send({
        challengeId,
        token: resetToken,
        newPassword: 'newsecret123',
        confirmPassword: 'newsecret123',
      })

    expect(resetResponse.status).toBe(200)
    expect(vi.mocked(sendPasswordChangedNotice)).toHaveBeenCalledWith(
      'alice@example.com',
    )

    const oldSessionResponse = await request(app)
      .get('/api/auth/me')
      .set('authorization', `Bearer ${oldToken}`)

    expect(oldSessionResponse.status).toBe(401)
    expect((await login('alice', password)).status).toBe(401)
    expect((await login('alice', 'newsecret123')).status).toBe(200)
  })

  it('invalidates old JWTs after logged-in password change', async () => {
    await registerUser('alice')

    const loginResponse = await login('alice')
    const token = loginResponse.body.data.token as string

    await bindEmail(token, 'alice@example.com')

    const passwordResponse = await request(app)
      .put('/api/auth/password')
      .set('authorization', `Bearer ${token}`)
      .send({
        currentPassword: password,
        newPassword: 'updated123',
        confirmPassword: 'updated123',
      })

    expect(passwordResponse.status).toBe(200)
    expect(vi.mocked(sendPasswordChangedNotice)).toHaveBeenCalledWith(
      'alice@example.com',
    )

    const staleSessionResponse = await request(app)
      .get('/api/auth/me')
      .set('authorization', `Bearer ${token}`)

    expect(staleSessionResponse.status).toBe(401)
    expect((await login('alice', 'updated123')).status).toBe(200)
  })

  it('keeps password reset requests generic for unknown identifiers', async () => {
    const response = await request(app)
      .post('/api/auth/password/forgot')
      .send({ identifier: 'missing@example.com' })

    expect(response.status).toBe(200)
    expect(sendPasswordResetEmail).not.toHaveBeenCalled()
  })

  it('notifies the old mailbox when a verified email changes', async () => {
    await registerUser('alice')

    const token = (await login('alice')).body.data.token as string

    await bindEmail(token, 'old@example.com')
    await bindEmail(token, 'new@example.com')

    expect(vi.mocked(sendEmailChangedNotice)).toHaveBeenCalledWith({
      to: 'old@example.com',
      newEmail: 'new@example.com',
    })
  })
})
