export type WeatherSnapshotStatus =
  | 'success'
  | 'partial'
  | 'disabled'
  | 'unavailable'

export type WeatherCityStatus = 'success' | 'out-of-range' | 'unavailable'

export type WeatherForecastDay = {
  date: string
  week: string | null
  dayWeather: string
  nightWeather: string
  dayTemp: string
  nightTemp: string
  dayWind: string
  nightWind: string
  dayPower: string
  nightPower: string
}

export type WeatherCitySnapshot = {
  requestedCity: string
  city: string
  province: string | null
  adcode: string | null
  reportTime: string | null
  status: WeatherCityStatus
  message: string | null
  forecasts: WeatherForecastDay[]
}

export type WeatherSnapshot = {
  version: 1
  provider: 'amap'
  enabled: boolean
  status: WeatherSnapshotStatus
  summary: string
  startDate: string | null
  requestedDays: number
  generatedAt: string
  cities: WeatherCitySnapshot[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function readOptionalString(value: unknown) {
  const text = readString(value)

  return text || null
}

function readStatus(value: unknown): WeatherSnapshotStatus {
  const status = readString(value)

  return status === 'success' ||
    status === 'partial' ||
    status === 'disabled' ||
    status === 'unavailable'
    ? status
    : 'unavailable'
}

function readCityStatus(value: unknown): WeatherCityStatus {
  const status = readString(value)

  return status === 'success' ||
    status === 'out-of-range' ||
    status === 'unavailable'
    ? status
    : 'unavailable'
}

function readPositiveInteger(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value
  }

  if (typeof value === 'string' && /^[1-9]\d*$/.test(value.trim())) {
    return Number(value)
  }

  return fallback
}

function readForecast(value: unknown): WeatherForecastDay | null {
  if (!isRecord(value)) {
    return null
  }

  const date = readString(value.date)

  if (!date) {
    return null
  }

  return {
    date,
    week: readOptionalString(value.week),
    dayWeather: readString(value.dayWeather) || '未知',
    nightWeather: readString(value.nightWeather) || '未知',
    dayTemp: readString(value.dayTemp) || '--',
    nightTemp: readString(value.nightTemp) || '--',
    dayWind: readString(value.dayWind) || '未知',
    nightWind: readString(value.nightWind) || '未知',
    dayPower: readString(value.dayPower) || '未知',
    nightPower: readString(value.nightPower) || '未知',
  }
}

function readCity(value: unknown): WeatherCitySnapshot | null {
  if (!isRecord(value)) {
    return null
  }

  const requestedCity = readString(value.requestedCity)
  const city = readString(value.city) || requestedCity

  if (!city) {
    return null
  }

  return {
    requestedCity: requestedCity || city,
    city,
    province: readOptionalString(value.province),
    adcode: readOptionalString(value.adcode),
    reportTime: readOptionalString(value.reportTime),
    status: readCityStatus(value.status),
    message: readOptionalString(value.message),
    forecasts: Array.isArray(value.forecasts)
      ? value.forecasts
          .map(readForecast)
          .filter((forecast): forecast is WeatherForecastDay =>
            Boolean(forecast),
          )
      : [],
  }
}

export function parseWeatherSnapshot(
  value: string | WeatherSnapshot | null | undefined,
): WeatherSnapshot | null {
  if (!value) {
    return null
  }

  let parsedValue: unknown = value

  if (typeof value === 'string') {
    try {
      parsedValue = JSON.parse(value) as unknown
    } catch {
      return null
    }
  }

  if (!isRecord(parsedValue)) {
    return null
  }

  const cities = Array.isArray(parsedValue.cities)
    ? parsedValue.cities
        .map(readCity)
        .filter((city): city is WeatherCitySnapshot => Boolean(city))
    : []

  return {
    version: 1,
    provider: 'amap',
    enabled: parsedValue.enabled !== false,
    status: readStatus(parsedValue.status),
    summary: readString(parsedValue.summary),
    startDate: readOptionalString(parsedValue.startDate),
    requestedDays: readPositiveInteger(parsedValue.requestedDays, 3),
    generatedAt: readString(parsedValue.generatedAt),
    cities,
  }
}
