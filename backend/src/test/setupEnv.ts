import { join } from 'node:path'
import { tmpdir } from 'node:os'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-jwt-secret'
process.env.AUTH_CHALLENGE_SECRET = 'test-auth-challenge-secret'
process.env.PUBLIC_WEB_URL = 'http://localhost:5173'
process.env.DATABASE_URL = `file:${join(
  tmpdir(),
  `travelbyllm-auth-test-${process.pid}.db`,
)}`
