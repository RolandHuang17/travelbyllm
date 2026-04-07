import { Router } from 'express'
import { prisma } from '../lib/prisma'

const healthRouter = Router()

healthRouter.get('/health', async (_request, response) => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1')

    response.json({
      status: 'ok',
      service: 'backend',
      database: 'ok',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    response.status(500).json({
      status: 'error',
      message:
        error instanceof Error ? error.message : 'Database connection failed',
    })
  }
})

export { healthRouter }
