import { resolve } from 'node:path'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient
}

const databaseUrl = process.env.DATABASE_URL ?? 'file:./prisma/dev.db'
const sqlitePath = databaseUrl.startsWith('file:')
  ? databaseUrl.slice('file:'.length)
  : databaseUrl
const adapter = new PrismaBetterSqlite3({
  url:
    sqlitePath === ':memory:'
      ? ':memory:'
      : resolve(process.cwd(), sqlitePath),
})

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
