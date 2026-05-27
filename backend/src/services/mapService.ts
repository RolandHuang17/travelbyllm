type DriveRoutePreviewInput = {
  departureCity: unknown
  destinationCity: unknown
  waypointCities: unknown
}

type NormalizedDriveRoutePreviewInput = {
  departureCity: string
  destinationCity: string
  waypointCities: string[]
}

type AmapGeocodeResponse = {
  status?: string
  info?: string
  geocodes?: Array<{
    formatted_address?: string
    location?: string
  }>
}

type AmapDrivingResponse = {
  status?: string
  info?: string
  route?: {
    paths?: Array<{
      distance?: string
      duration?: string
      steps?: Array<{
        polyline?: string
      }>
    }>
  }
}

export type MapCoordinate = {
  longitude: number
  latitude: number
}

export type MapLocationPoint = {
  label: string
  address: string
  formattedAddress: string
  location: MapCoordinate
}

export type DriveRoutePreview = {
  origin: MapLocationPoint
  destination: MapLocationPoint
  waypoints: MapLocationPoint[]
  route: {
    distance: number
    duration: number
    coordinates: MapCoordinate[]
  }
}

export class MapError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message)
  }
}

const geocodeCache = new Map<string, Promise<MapLocationPoint>>()
const amapRequestSpacingMs = 350
const amapRetryDelayMs = 650

function normalizeRequiredString(value: unknown, fieldLabel: string) {
  if (typeof value !== 'string') {
    throw new MapError(400, `${fieldLabel}不能为空`)
  }

  const normalizedValue = value.trim()

  if (!normalizedValue) {
    throw new MapError(400, `${fieldLabel}不能为空`)
  }

  return normalizedValue
}

function normalizeWaypointCities(value: unknown) {
  if (value === null || value === undefined) {
    return []
  }

  if (!Array.isArray(value)) {
    throw new MapError(400, '途经城市格式不正确')
  }

  return value.map((item) => normalizeRequiredString(item, '途经城市'))
}

function normalizeDriveRoutePreviewInput(
  input: unknown,
): NormalizedDriveRoutePreviewInput {
  if (!input || typeof input !== 'object') {
    throw new MapError(400, '请求体格式不正确')
  }

  const driveRoutePreviewInput = input as DriveRoutePreviewInput

  return {
    departureCity: normalizeRequiredString(
      driveRoutePreviewInput.departureCity,
      '出发城市',
    ),
    destinationCity: normalizeRequiredString(
      driveRoutePreviewInput.destinationCity,
      '目的城市',
    ),
    waypointCities: normalizeWaypointCities(
      driveRoutePreviewInput.waypointCities,
    ),
  }
}

function getAmapWebServiceKey() {
  const key = process.env.AMAP_WEB_SERVICE_KEY?.trim()

  if (!key) {
    throw new MapError(503, '未配置高德地图 Web 服务 Key')
  }

  return key
}

function buildAmapUrl(
  path: string,
  params: Record<string, string | number | undefined | null>,
) {
  const url = new URL(`https://restapi.amap.com${path}`)
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue
    }

    searchParams.set(key, String(value))
  }

  url.search = searchParams.toString()
  return url
}

async function requestAmapJson<T extends { status?: string; info?: string }>(
  path: string,
  params: Record<string, string | number | undefined | null>,
  fallbackMessage: string,
) {
  const url = buildAmapUrl(path, {
    ...params,
    key: getAmapWebServiceKey(),
    output: 'json',
  })

  let response: Response

  try {
    response = await fetch(url)
  } catch {
    throw new MapError(502, '无法连接高德地图服务')
  }

  let body: T

  try {
    body = (await response.json()) as T
  } catch {
    throw new MapError(502, '高德地图服务返回格式异常')
  }

  if (!response.ok || body.status !== '1') {
    const message = body.info?.trim() || fallbackMessage
    throw new MapError(502, message)
  }

  return body
}

function normalizeAddressForCache(address: string) {
  return address.trim().replace(/\s+/g, '')
}

function parseCoordinate(value: string) {
  const [longitudeText, latitudeText] = value.split(',')
  const longitude = Number(longitudeText)
  const latitude = Number(latitudeText)

  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    throw new MapError(502, '高德地图坐标格式异常')
  }

  return {
    longitude,
    latitude,
  }
}

function parseDistance(value?: string) {
  const distance = Number(value ?? 0)
  return Number.isFinite(distance) && distance >= 0 ? distance : 0
}

function parseDuration(value?: string) {
  const duration = Number(value ?? 0)
  return Number.isFinite(duration) && duration >= 0 ? duration : 0
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function isAmapQuotaError(message: string) {
  return /CUQPS_HAS_EXCEEDED_THE_LIMIT|OVER_QUERY_LIMIT|OVER_QUOTA|SERVICE_DAILY_QUERY_OVER_LIMIT/i.test(
    message,
  )
}

async function requestAmapJsonWithRetry<T extends { status?: string; info?: string }>(
  path: string,
  params: Record<string, string | number | undefined | null>,
  fallbackMessage: string,
  attemptCount = 3,
) {
  let lastError: unknown = null

  for (let attempt = 0; attempt < attemptCount; attempt += 1) {
    try {
      if (attempt > 0) {
        await sleep(amapRetryDelayMs * attempt)
      }

      return await requestAmapJson<T>(path, params, fallbackMessage)
    } catch (error) {
      lastError = error

      if (
        !(error instanceof MapError) ||
        !isAmapQuotaError(error.message) ||
        attempt === attemptCount - 1
      ) {
        throw error
      }
    }
  }

  throw lastError
}

function collectRouteCoordinates(steps: Array<{ polyline?: string }>) {
  const coordinates: MapCoordinate[] = []
  const seen = new Set<string>()

  for (const step of steps) {
    const polyline = step.polyline?.trim()

    if (!polyline) {
      continue
    }

    for (const point of polyline.split(';')) {
      let coordinate: MapCoordinate | null = null

      try {
        coordinate = parseCoordinate(point)
      } catch {
        continue
      }

      if (!coordinate) {
        continue
      }

      const key = `${coordinate.longitude.toFixed(6)},${coordinate.latitude.toFixed(6)}`

      if (seen.has(key)) {
        continue
      }

      seen.add(key)
      coordinates.push(coordinate)
    }
  }

  return coordinates
}

async function geocodeAddress(address: string) {
  const cacheKey = normalizeAddressForCache(address)
  const cached = geocodeCache.get(cacheKey)

  if (cached) {
    return cached
  }

  const promise = (async () => {
    await sleep(amapRequestSpacingMs)

    const response = await requestAmapJsonWithRetry<AmapGeocodeResponse>(
      '/v3/geocode/geo',
      {
        address,
      },
      `地址「${address}」未找到对应坐标`,
    )

    const geocode = response.geocodes?.[0]

    if (!geocode?.location) {
      throw new MapError(404, `地址「${address}」未找到对应坐标`)
    }

    const location = parseCoordinate(geocode.location)

    return {
      label: address,
      address,
      formattedAddress: geocode.formatted_address?.trim() || address,
      location,
    }
  })()

  const guardedPromise = promise.catch((error) => {
    geocodeCache.delete(cacheKey)
    throw error
  })

  geocodeCache.set(cacheKey, guardedPromise)
  return guardedPromise
}

export async function createDriveRoutePreview(input: unknown) {
  const normalizedInput = normalizeDriveRoutePreviewInput(input)
  const origin = await geocodeAddress(normalizedInput.departureCity)
  await sleep(amapRequestSpacingMs)
  const destination = await geocodeAddress(normalizedInput.destinationCity)
  const waypoints: MapLocationPoint[] = []

  for (const city of normalizedInput.waypointCities) {
    await sleep(amapRequestSpacingMs)
    waypoints.push(await geocodeAddress(city))
  }

  const routeParams: Record<string, string | number> = {
    origin: `${origin.location.longitude},${origin.location.latitude}`,
    destination: `${destination.location.longitude},${destination.location.latitude}`,
    extensions: 'all',
  }

  if (waypoints.length > 0) {
    routeParams.waypoints = waypoints
      .map(
        (waypoint) =>
          `${waypoint.location.longitude},${waypoint.location.latitude}`,
      )
      .join(';')
  }

  await sleep(amapRequestSpacingMs)

  const routeResponse = await requestAmapJsonWithRetry<AmapDrivingResponse>(
    '/v3/direction/driving',
    routeParams,
    '高德驾车路线规划失败',
  )

  const path = routeResponse.route?.paths?.[0]

  if (!path) {
    throw new MapError(404, '未找到可用路线')
  }

  return {
    origin,
    destination,
    waypoints,
    route: {
      distance: parseDistance(path.distance),
      duration: parseDuration(path.duration),
      coordinates: collectRouteCoordinates(path.steps ?? []),
    },
  } satisfies DriveRoutePreview
}
