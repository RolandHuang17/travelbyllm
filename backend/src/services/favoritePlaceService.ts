import { prisma } from '../lib/prisma'

export const FAVORITE_PLACE_CATEGORIES = [
  '景点',
  '美食',
  '住宿',
  '交通',
  '购物',
  '其他',
] as const

type FavoritePlaceCategory = (typeof FAVORITE_PLACE_CATEGORIES)[number]

type FavoritePlaceInput = {
  amapPoiId: unknown
  name: unknown
  address: unknown
  cityName: unknown
  district: unknown
  longitude: unknown
  latitude: unknown
  category: unknown
  note: unknown
}

type UpdateFavoritePlaceInput = {
  category: unknown
  note: unknown
}

type NormalizedFavoritePlaceInput = {
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
}

type NormalizedFavoritePlaceUpdateInput = {
  category: FavoritePlaceCategory
  note: string | null
}

export class FavoritePlaceError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message)
  }
}

function normalizeRequiredString(
  value: unknown,
  fieldLabel: string,
  maxLength: number,
) {
  if (typeof value !== 'string') {
    throw new FavoritePlaceError(400, `${fieldLabel}不能为空`)
  }

  const normalizedValue = value.trim()

  if (!normalizedValue) {
    throw new FavoritePlaceError(400, `${fieldLabel}不能为空`)
  }

  if (normalizedValue.length > maxLength) {
    throw new FavoritePlaceError(400, `${fieldLabel}长度不能超过 ${maxLength} 个字符`)
  }

  return normalizedValue
}

function normalizeOptionalString(
  value: unknown,
  fieldLabel: string,
  maxLength: number,
) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value !== 'string') {
    throw new FavoritePlaceError(400, `${fieldLabel}格式不正确`)
  }

  const normalizedValue = value.trim()

  if (!normalizedValue) {
    return null
  }

  if (normalizedValue.length > maxLength) {
    throw new FavoritePlaceError(400, `${fieldLabel}长度不能超过 ${maxLength} 个字符`)
  }

  return normalizedValue
}

function normalizeCoordinate(
  value: unknown,
  fieldLabel: string,
  min: number,
  max: number,
) {
  const coordinate = typeof value === 'string' ? Number(value) : value

  if (
    typeof coordinate !== 'number' ||
    !Number.isFinite(coordinate) ||
    coordinate < min ||
    coordinate > max
  ) {
    throw new FavoritePlaceError(400, `${fieldLabel}格式不正确`)
  }

  return coordinate
}

function normalizeCategory(value: unknown) {
  const category = normalizeRequiredString(value, '收藏分类', 20)

  if (!FAVORITE_PLACE_CATEGORIES.includes(category as FavoritePlaceCategory)) {
    throw new FavoritePlaceError(
      400,
      `收藏分类只能选择：${FAVORITE_PLACE_CATEGORIES.join('、')}`,
    )
  }

  return category as FavoritePlaceCategory
}

function buildPlaceKey(amapPoiId: string | null, longitude: number, latitude: number) {
  if (amapPoiId) {
    return `poi:${amapPoiId}`
  }

  return `coordinate:${longitude.toFixed(6)},${latitude.toFixed(6)}`
}

function normalizeFavoritePlaceInput(
  input: unknown,
): NormalizedFavoritePlaceInput {
  if (!input || typeof input !== 'object') {
    throw new FavoritePlaceError(400, '请求体格式不正确')
  }

  const favoritePlaceInput = input as FavoritePlaceInput
  const amapPoiId = normalizeOptionalString(
    favoritePlaceInput.amapPoiId,
    '高德 POI ID',
    120,
  )
  const longitude = normalizeCoordinate(
    favoritePlaceInput.longitude,
    '经度',
    -180,
    180,
  )
  const latitude = normalizeCoordinate(
    favoritePlaceInput.latitude,
    '纬度',
    -90,
    90,
  )

  return {
    placeKey: buildPlaceKey(amapPoiId, longitude, latitude),
    amapPoiId,
    name: normalizeRequiredString(favoritePlaceInput.name, '地点名称', 120),
    address: normalizeRequiredString(favoritePlaceInput.address, '地点地址', 200),
    cityName: normalizeOptionalString(favoritePlaceInput.cityName, '城市', 80),
    district: normalizeOptionalString(favoritePlaceInput.district, '区域', 80),
    longitude,
    latitude,
    category: normalizeCategory(favoritePlaceInput.category),
    note: normalizeOptionalString(favoritePlaceInput.note, '备注', 200),
  }
}

function normalizeFavoritePlaceUpdateInput(
  input: unknown,
): NormalizedFavoritePlaceUpdateInput {
  if (!input || typeof input !== 'object') {
    throw new FavoritePlaceError(400, '请求体格式不正确')
  }

  const updateInput = input as UpdateFavoritePlaceInput

  return {
    category: normalizeCategory(updateInput.category),
    note: normalizeOptionalString(updateInput.note, '备注', 200),
  }
}

export function normalizeFavoritePlaceId(id: string) {
  const favoritePlaceId = Number(id)

  if (!Number.isInteger(favoritePlaceId) || favoritePlaceId <= 0) {
    throw new FavoritePlaceError(400, '收藏地点 ID 格式不正确')
  }

  return favoritePlaceId
}

async function ensureFavoritePlaceBelongsToUser(
  favoritePlaceId: number,
  userId: number,
) {
  const favoritePlace = await prisma.favoritePlace.findFirst({
    where: {
      id: favoritePlaceId,
      userId,
    },
    select: {
      id: true,
    },
  })

  if (!favoritePlace) {
    throw new FavoritePlaceError(404, '收藏地点不存在')
  }
}

function isUniqueConstraintError(error: unknown) {
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'P2002'
  )
}

export function listFavoritePlaces(userId: number) {
  return prisma.favoritePlace.findMany({
    where: {
      userId,
    },
    orderBy: {
      updatedAt: 'desc',
    },
  })
}

export async function createFavoritePlace(userId: number, input: unknown) {
  const normalizedInput = normalizeFavoritePlaceInput(input)

  try {
    return await prisma.favoritePlace.create({
      data: {
        ...normalizedInput,
        userId,
      },
    })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new FavoritePlaceError(409, '该地点已经收藏')
    }

    throw error
  }
}

export async function updateFavoritePlace(
  userId: number,
  favoritePlaceId: number,
  input: unknown,
) {
  await ensureFavoritePlaceBelongsToUser(favoritePlaceId, userId)
  const normalizedInput = normalizeFavoritePlaceUpdateInput(input)

  return prisma.favoritePlace.update({
    where: {
      id: favoritePlaceId,
    },
    data: normalizedInput,
  })
}

export async function deleteFavoritePlace(userId: number, favoritePlaceId: number) {
  await ensureFavoritePlaceBelongsToUser(favoritePlaceId, userId)

  await prisma.favoritePlace.delete({
    where: {
      id: favoritePlaceId,
    },
  })

  return {
    id: favoritePlaceId,
  }
}
