import cors from 'cors'
import express from 'express'
import { uploadsRoot } from './utils/uploads'
import { amapProxyRouter } from './routes/amapProxy'
import { authRouter } from './routes/auth'
import { cardsRouter } from './routes/cards'
import { healthRouter } from './routes/health'
import { mapRouter } from './routes/map'
import { historyRouter } from './routes/history'
import { planRouter } from './routes/plan'
import { spotsRouter } from './routes/spots'
import { weatherRouter } from './routes/weather'

const app = express()

const allowedOrigins = new Set([
  process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
  'http://127.0.0.1:5173',
])

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true)
        return
      }

      callback(new Error('Origin not allowed by CORS'))
    },
  }),
)

app.use('/_AMapService', amapProxyRouter)
app.use('/uploads', express.static(uploadsRoot))
app.use(express.json())
app.use('/api', healthRouter)
app.use('/api/auth', authRouter)
app.use('/api/cards', cardsRouter)
app.use('/api/map', mapRouter)
app.use('/api/history', historyRouter)
app.use('/api/plan', planRouter)
app.use('/api/spots', spotsRouter)
app.use('/api/weather', weatherRouter)

export { app }
