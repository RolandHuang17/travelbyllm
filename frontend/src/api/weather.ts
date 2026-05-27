import type { WeatherSnapshot } from '../types/weather'

export type WeatherQueryInput = {
  cities: string[]
  startDate: string | null
  days: number
}

type ApiResponse<T> = {
  code: number
  message: string
  data: T | null
}

type WeatherSnapshotResponse = {
  weatherSnapshot: WeatherSnapshot
}

export class WeatherApiError extends Error {
  readonly statusCode: number

  constructor(statusCode: number, message: string) {
    super(message)
    this.statusCode = statusCode
  }
}

function getAuthHeaders(token: string) {
  return {
    authorization: `Bearer ${token}`,
  }
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  let body: ApiResponse<T> | null = null

  try {
    body = (await response.json()) as ApiResponse<T>
  } catch {
    throw new WeatherApiError(response.status, '服务返回格式异常')
  }

  if (!response.ok || body.code !== 0 || !body.data) {
    throw new WeatherApiError(
      response.status,
      body.message || '请求失败，请稍后重试',
    )
  }

  return body.data
}

function normalizeDays(days: number) {
  return Number.isInteger(days) && days > 0 ? Math.min(days, 7) : 3
}

export async function fetchWeatherSnapshot(
  token: string,
  input: WeatherQueryInput,
) {
  const cities = input.cities.map((city) => city.trim()).filter(Boolean)
  const searchParams = new URLSearchParams()

  if (cities.length === 1) {
    searchParams.set('city', cities[0])
  } else {
    searchParams.set('cities', cities.join(','))
  }

  if (input.startDate) {
    searchParams.set('startDate', input.startDate)
  }

  searchParams.set('days', String(normalizeDays(input.days)))

  let response: Response

  try {
    response = await fetch(`/api/weather?${searchParams.toString()}`, {
      headers: getAuthHeaders(token),
    })
  } catch {
    throw new WeatherApiError(0, '无法连接到后端服务')
  }

  return parseApiResponse<WeatherSnapshotResponse>(response)
}
