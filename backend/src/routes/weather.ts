import { Router, type Response } from 'express'
import { requireAuth } from '../middleware/authMiddleware'
import { buildWeatherSnapshot } from '../services/weatherService'
import { sendError, sendSuccess } from '../utils/apiResponse'

const weatherRouter = Router()

function normalizeQueryString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeQueryInteger(value: unknown) {
  const text = normalizeQueryString(value)

  if (!text) {
    return null
  }

  const numberValue = Number(text)

  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null
}

function normalizeQueryCities(value: unknown): string[] {
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((city) => city.trim())
      .filter(Boolean)
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeQueryCities(item))
  }

  return []
}

function handleWeatherError(response: Response, error: unknown) {
  console.error(error)
  return sendError(response, 500, '天气服务调用失败，请稍后重试')
}

weatherRouter.use(requireAuth)

weatherRouter.get('/', async (request, response) => {
  try {
    const city = normalizeQueryString(request.query.city)
    const cities = normalizeQueryCities(request.query.cities)
    const queryCities = city ? [city, ...cities] : cities

    if (!queryCities.length) {
      return sendError(response, 400, '城市不能为空')
    }

    const snapshot = await buildWeatherSnapshot({
      cities: queryCities,
      startDate: normalizeQueryString(request.query.startDate) || null,
      days: normalizeQueryInteger(request.query.days),
      weatherMode: '参考天气',
    })

    return sendSuccess(response, 'ok', { weatherSnapshot: snapshot })
  } catch (error) {
    return handleWeatherError(response, error)
  }
})

export { weatherRouter }
