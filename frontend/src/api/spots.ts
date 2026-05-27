export type HomeScenicSpotHeightVariant = 'short' | 'medium' | 'tall'

export type HomeScenicSpotDetail = {
  overview: string
  averageTemperature: string
  visitRecommendation: string
  photoSpots: string[]
  ticketPrice: string
  openingHours: string
}

export type HomeScenicSpot = {
  id: string
  name: string
  city: string
  province: string
  imageUrl: string
  description: string
  tags: string[]
  heightVariant: HomeScenicSpotHeightVariant
  detail: HomeScenicSpotDetail
}

type ApiResponse<T> = {
  code: number
  message: string
  data: T | null
}

type HomeScenicSpotsResponse = {
  spots: HomeScenicSpot[]
}

export class SpotsApiError extends Error {
  readonly statusCode: number

  constructor(statusCode: number, message: string) {
    super(message)
    this.statusCode = statusCode
  }
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  let body: ApiResponse<T> | null = null

  try {
    body = (await response.json()) as ApiResponse<T>
  } catch {
    throw new SpotsApiError(response.status, '服务返回格式异常')
  }

  if (!response.ok || body.code !== 0 || !body.data) {
    throw new SpotsApiError(
      response.status,
      body.message || '请求失败，请稍后重试',
    )
  }

  return body.data
}

export async function fetchHomeScenicSpots() {
  let response: Response

  try {
    response = await fetch('/api/spots/home')
  } catch {
    throw new SpotsApiError(0, '无法连接到后端服务')
  }

  const data = await parseApiResponse<HomeScenicSpotsResponse>(response)

  if (!Array.isArray(data.spots)) {
    throw new SpotsApiError(response.status, '景点数据格式异常')
  }

  return data.spots
}
