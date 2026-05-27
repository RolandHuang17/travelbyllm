type WeatherSnapshotStatus =
  | 'success'
  | 'partial'
  | 'disabled'
  | 'unavailable'

type WeatherCityStatus = 'success' | 'out-of-range' | 'unavailable'

type AmapGeocodeResponse = {
  status?: string
  info?: string
  geocodes?: Array<{
    adcode?: string
    city?: string | string[]
    district?: string | string[]
    province?: string
    formatted_address?: string
  }>
}

type AmapWeatherResponse = {
  status?: string
  info?: string
  forecasts?: Array<{
    city?: string
    adcode?: string
    province?: string
    reporttime?: string
    casts?: Array<{
      date?: string
      week?: string
      dayweather?: string
      nightweather?: string
      daytemp?: string
      nighttemp?: string
      daywind?: string
      nightwind?: string
      daypower?: string
      nightpower?: string
    }>
  }>
}

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

export type WeatherSnapshotInput = {
  cities: string[]
  startDate?: Date | string | null
  days?: number | null
  weatherMode?: string | null
}

const amapWeatherRequestSpacingMs = 250

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function getAmapWebServiceKey() {
  return process.env.AMAP_WEB_SERVICE_KEY?.trim() || null
}

function normalizeCityName(city: string) {
  return city.trim().replace(/\s+/g, '')
}

function uniqueCities(cities: string[]) {
  const seen = new Set<string>()
  const result: string[] = []

  for (const city of cities) {
    const normalizedCity = normalizeCityName(city)

    if (!normalizedCity || seen.has(normalizedCity)) {
      continue
    }

    seen.add(normalizedCity)
    result.push(normalizedCity)
  }

  return result
}

function shouldUseWeather(weatherMode?: string | null) {
  const normalizedMode = weatherMode?.trim()

  return !normalizedMode || !normalizedMode.includes('不参考')
}

function toDateKey(value?: Date | string | null) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10)
  }

  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return null
  }

  const date = new Date(trimmedValue)

  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

function normalizeRequestedDays(days?: number | null) {
  return Number.isInteger(days) && days && days > 0 ? Math.min(days, 7) : 3
}

function buildAmapUrl(
  path: string,
  params: Record<string, string | number | undefined | null>,
) {
  const url = new URL(`https://restapi.amap.com${path}`)

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue
    }

    url.searchParams.set(key, String(value))
  }

  return url
}

async function requestAmapJson<T extends { status?: string; info?: string }>(
  path: string,
  params: Record<string, string | number | undefined | null>,
  fallbackMessage: string,
) {
  const apiKey = getAmapWebServiceKey()

  if (!apiKey) {
    throw new Error('未配置高德地图 Web 服务 Key')
  }

  const url = buildAmapUrl(path, {
    ...params,
    key: apiKey,
    output: 'json',
  })

  let response: Response

  try {
    response = await fetch(url)
  } catch {
    throw new Error('无法连接高德天气服务')
  }

  let body: T

  try {
    body = (await response.json()) as T
  } catch {
    throw new Error('高德天气服务返回格式异常')
  }

  if (!response.ok || body.status !== '1') {
    throw new Error(body.info?.trim() || fallbackMessage)
  }

  return body
}

function readAmapText(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.find((item) => item.trim())?.trim() ?? ''
  }

  return value?.trim() ?? ''
}

async function resolveCityAdcode(city: string) {
  const response = await requestAmapJson<AmapGeocodeResponse>(
    '/v3/geocode/geo',
    {
      address: city,
    },
    `城市「${city}」解析失败`,
  )
  const geocode = response.geocodes?.[0]

  if (!geocode?.adcode) {
    throw new Error(`城市「${city}」未找到对应行政区划编码`)
  }

  return {
    adcode: geocode.adcode,
    city:
      readAmapText(geocode.city) ||
      readAmapText(geocode.district) ||
      geocode.formatted_address?.trim() ||
      city,
    province: geocode.province?.trim() || null,
  }
}

function normalizeForecastDay(
  forecast: NonNullable<
    NonNullable<AmapWeatherResponse['forecasts']>[number]['casts']
  >[number],
): WeatherForecastDay | null {
  if (!forecast.date?.trim()) {
    return null
  }

  return {
    date: forecast.date.trim(),
    week: forecast.week?.trim() || null,
    dayWeather: forecast.dayweather?.trim() || '未知',
    nightWeather: forecast.nightweather?.trim() || '未知',
    dayTemp: forecast.daytemp?.trim() || '--',
    nightTemp: forecast.nighttemp?.trim() || '--',
    dayWind: forecast.daywind?.trim() || '未知',
    nightWind: forecast.nightwind?.trim() || '未知',
    dayPower: forecast.daypower?.trim() || '未知',
    nightPower: forecast.nightpower?.trim() || '未知',
  }
}

function selectForecastDays(
  forecasts: WeatherForecastDay[],
  startDate: string | null,
  requestedDays: number,
) {
  if (!startDate) {
    return forecasts.slice(0, requestedDays)
  }

  const startIndex = forecasts.findIndex((forecast) => forecast.date === startDate)

  if (startIndex < 0) {
    return []
  }

  return forecasts.slice(startIndex, startIndex + requestedDays)
}

function buildOutOfRangeWeatherMessage(startDate: string, city: string) {
  return `出行日期 ${startDate} 超出高德近期预报范围，以下展示${city}当前可用近期天气参考`
}

async function fetchCityWeather(
  requestedCity: string,
  startDate: string | null,
  requestedDays: number,
): Promise<WeatherCitySnapshot> {
  try {
    const resolvedCity = await resolveCityAdcode(requestedCity)

    await sleep(amapWeatherRequestSpacingMs)

    const response = await requestAmapJson<AmapWeatherResponse>(
      '/v3/weather/weatherInfo',
      {
        city: resolvedCity.adcode,
        extensions: 'all',
      },
      `城市「${requestedCity}」天气查询失败`,
    )
    const forecast = response.forecasts?.[0]
    const allForecasts =
      forecast?.casts
        ?.map(normalizeForecastDay)
        .filter((item): item is WeatherForecastDay => Boolean(item)) ?? []
    const selectedForecasts = selectForecastDays(
      allForecasts,
      startDate,
      requestedDays,
    )

    if (!selectedForecasts.length) {
      const cityName = forecast?.city?.trim() || resolvedCity.city

      return {
        requestedCity,
        city: cityName,
        province: forecast?.province?.trim() || resolvedCity.province,
        adcode: forecast?.adcode?.trim() || resolvedCity.adcode,
        reportTime: forecast?.reporttime?.trim() || null,
        status: startDate ? 'out-of-range' : 'unavailable',
        message: startDate
          ? buildOutOfRangeWeatherMessage(startDate, cityName)
          : '暂无可用天气预报',
        forecasts: startDate ? allForecasts : allForecasts.slice(0, requestedDays),
      }
    }

    return {
      requestedCity,
      city: forecast?.city?.trim() || resolvedCity.city,
      province: forecast?.province?.trim() || resolvedCity.province,
      adcode: forecast?.adcode?.trim() || resolvedCity.adcode,
      reportTime: forecast?.reporttime?.trim() || null,
      status: 'success',
      message: null,
      forecasts: selectedForecasts,
    }
  } catch (error) {
    return {
      requestedCity,
      city: requestedCity,
      province: null,
      adcode: null,
      reportTime: null,
      status: 'unavailable',
      message: error instanceof Error ? error.message : '天气查询失败',
      forecasts: [],
    }
  }
}

function buildDisabledCitySnapshot(city: string): WeatherCitySnapshot {
  return {
    requestedCity: city,
    city,
    province: null,
    adcode: null,
    reportTime: null,
    status: 'unavailable',
    message: '用户选择不参考天气',
    forecasts: [],
  }
}

function buildUnavailableCitySnapshot(city: string, message: string) {
  return {
    requestedCity: city,
    city,
    province: null,
    adcode: null,
    reportTime: null,
    status: 'unavailable' as const,
    message,
    forecasts: [],
  }
}

function buildWeatherSummary(
  cities: WeatherCitySnapshot[],
  enabled: boolean,
  startDate: string | null,
) {
  if (!enabled) {
    return '未启用天气参考：用户选择不参考天气。'
  }

  const successCities = cities.filter((city) => city.status === 'success')
  const outOfRangeCities = cities.filter(
    (city) => city.status === 'out-of-range' && city.forecasts.length,
  )

  if (!successCities.length) {
    if (outOfRangeCities.length) {
      const cityNames = outOfRangeCities.map((city) => city.city).join('、')

      return startDate
        ? `出行日期 ${startDate} 超出高德近期预报范围，以下展示${cityNames}当前可用近期天气参考。`
        : `以下展示${cityNames}当前可用近期天气参考。`
    }

    const firstMessage = cities.find((city) => city.message)?.message

    return `天气暂不可用：${firstMessage ?? '未获取到可用天气预报'}。`
  }

  const citySummaries = successCities.map((city) => {
    const firstForecast = city.forecasts[0]

    if (!firstForecast) {
      return `${city.city}暂无逐日预报`
    }

    return `${city.city}${startDate ? ` ${firstForecast.date}` : ''}白天${firstForecast.dayWeather}，夜间${firstForecast.nightWeather}，${firstForecast.nightTemp}-${firstForecast.dayTemp}℃`
  })
  const unavailableCount = cities.length - successCities.length
  const suffix =
    unavailableCount > 0 ? `；另有 ${unavailableCount} 个城市天气未完整获取` : ''

  return `真实天气参考：${citySummaries.join('；')}${suffix}。`
}

function resolveSnapshotStatus(
  enabled: boolean,
  cities: WeatherCitySnapshot[],
): WeatherSnapshotStatus {
  if (!enabled) {
    return 'disabled'
  }

  if (cities.every((city) => city.status === 'success')) {
    return 'success'
  }

  if (cities.some((city) => city.status === 'success')) {
    return 'partial'
  }

  return 'unavailable'
}

export async function buildWeatherSnapshot({
  cities,
  startDate,
  days,
  weatherMode,
}: WeatherSnapshotInput): Promise<WeatherSnapshot> {
  const normalizedCities = uniqueCities(cities)
  const requestedDays = normalizeRequestedDays(days)
  const normalizedStartDate = toDateKey(startDate)
  const enabled = shouldUseWeather(weatherMode)

  if (!normalizedCities.length) {
    const snapshotCities: WeatherCitySnapshot[] = []

    return {
      version: 1,
      provider: 'amap',
      enabled,
      status: enabled ? 'unavailable' : 'disabled',
      summary: enabled
        ? '天气暂不可用：未提供可查询城市。'
        : '未启用天气参考：用户选择不参考天气。',
      startDate: normalizedStartDate,
      requestedDays,
      generatedAt: new Date().toISOString(),
      cities: snapshotCities,
    }
  }

  if (!enabled) {
    const snapshotCities = normalizedCities.map(buildDisabledCitySnapshot)

    return {
      version: 1,
      provider: 'amap',
      enabled,
      status: 'disabled',
      summary: buildWeatherSummary(snapshotCities, false, normalizedStartDate),
      startDate: normalizedStartDate,
      requestedDays,
      generatedAt: new Date().toISOString(),
      cities: snapshotCities,
    }
  }

  const apiKey = getAmapWebServiceKey()

  if (!apiKey) {
    const snapshotCities = normalizedCities.map((city) =>
      buildUnavailableCitySnapshot(city, '未配置高德地图 Web 服务 Key'),
    )

    return {
      version: 1,
      provider: 'amap',
      enabled,
      status: 'unavailable',
      summary: buildWeatherSummary(snapshotCities, true, normalizedStartDate),
      startDate: normalizedStartDate,
      requestedDays,
      generatedAt: new Date().toISOString(),
      cities: snapshotCities,
    }
  }

  const snapshotCities: WeatherCitySnapshot[] = []

  for (const city of normalizedCities) {
    await sleep(amapWeatherRequestSpacingMs)
    snapshotCities.push(
      await fetchCityWeather(city, normalizedStartDate, requestedDays),
    )
  }

  return {
    version: 1,
    provider: 'amap',
    enabled,
    status: resolveSnapshotStatus(enabled, snapshotCities),
    summary: buildWeatherSummary(snapshotCities, true, normalizedStartDate),
    startDate: normalizedStartDate,
    requestedDays,
    generatedAt: new Date().toISOString(),
    cities: snapshotCities,
  }
}

export function serializeWeatherSnapshot(snapshot: WeatherSnapshot) {
  return JSON.stringify(snapshot)
}

export function parseWeatherSnapshotJson(value: string | null | undefined) {
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value) as WeatherSnapshot
  } catch {
    return null
  }
}

export function formatWeatherSnapshotForPrompt(snapshot: WeatherSnapshot) {
  const lines = [
    `天气状态：${snapshot.status}`,
    `天气摘要：${snapshot.summary}`,
    `参考日期：${snapshot.startDate ?? '最近可用预报'}`,
  ]

  for (const city of snapshot.cities) {
    lines.push(
      `- ${city.city}：${city.status}${city.message ? `，${city.message}` : ''}`,
    )

    for (const forecast of city.forecasts) {
      lines.push(
        `  ${forecast.date}：白天${forecast.dayWeather} ${forecast.dayTemp}℃ ${forecast.dayWind}风${forecast.dayPower}级；夜间${forecast.nightWeather} ${forecast.nightTemp}℃ ${forecast.nightWind}风${forecast.nightPower}级`,
      )
    }
  }

  return lines.join('\n')
}
