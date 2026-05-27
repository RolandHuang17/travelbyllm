import type { DrivePlanInput } from './plan'

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

export type FavoritePlaceCategory =
  | '景点'
  | '美食'
  | '住宿'
  | '交通'
  | '购物'
  | '其他'

export type FavoritePlace = {
  id: number
  userId: number
  placeKey: string
  amapPoiId: string | null
  name: string
  address: string
  cityName: string | null
  district: string | null
  longitude: number
  latitude: number
  category: FavoritePlaceCategory
  note: string | null
  createdAt: string
  updatedAt: string
}

export type FavoritePlaceInput = {
  amapPoiId: string | null
  name: string
  address: string
  cityName: string | null
  district: string | null
  longitude: number
  latitude: number
  category: FavoritePlaceCategory
  note: string | null
}

export type FavoritePlaceUpdateInput = {
  category: FavoritePlaceCategory
  note: string | null
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

type ApiResponse<T> = {
  code: number
  message: string
  data: T | null
}

type DriveRoutePreviewResponse = DriveRoutePreview

type FavoritePlacesResponse = {
  favoritePlaces: FavoritePlace[]
}

type FavoritePlaceResponse = {
  favoritePlace: FavoritePlace
}

type DeleteFavoritePlaceResponse = {
  id: number
}

export class MapApiError extends Error {
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
    throw new MapApiError(response.status, '服务返回格式异常')
  }

  if (!response.ok || body.code !== 0 || !body.data) {
    throw new MapApiError(
      response.status,
      body.message || '请求失败，请稍后重试',
    )
  }

  return body.data
}

async function requestMap<T>(
  url: string,
  token: string,
  options: RequestInit = {},
) {
  let response: Response

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        'content-type': 'application/json',
        ...getAuthHeaders(token),
        ...options.headers,
      },
    })
  } catch {
    throw new MapApiError(0, '无法连接到后端服务')
  }

  return parseApiResponse<T>(response)
}

export async function fetchDriveRoutePreview(
  token: string,
  input: DrivePlanInput,
) {
  return requestMap<DriveRoutePreviewResponse>('/api/map/drive-preview', token, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function fetchFavoritePlaces(token: string) {
  return requestMap<FavoritePlacesResponse>('/api/map/favorites', token)
}

export async function createFavoritePlace(
  token: string,
  input: FavoritePlaceInput,
) {
  return requestMap<FavoritePlaceResponse>('/api/map/favorites', token, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateFavoritePlace(
  token: string,
  id: number,
  input: FavoritePlaceUpdateInput,
) {
  return requestMap<FavoritePlaceResponse>(`/api/map/favorites/${id}`, token, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteFavoritePlace(token: string, id: number) {
  return requestMap<DeleteFavoritePlaceResponse>(
    `/api/map/favorites/${id}`,
    token,
    {
      method: 'DELETE',
    },
  )
}
