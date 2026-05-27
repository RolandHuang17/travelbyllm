import { prisma } from '../lib/prisma'

const MAX_CARDS_PER_USER = 10
const TRAVEL_STYLE_OPTIONS = ['特种兵旅游', '佛系慢游', '平衡型'] as const
const TRANSPORT_MODE_OPTIONS = ['公共交通', '自驾'] as const
const DRIVE_MODE_OPTIONS = ['当地租车自驾', '全程自驾'] as const
const SCENIC_PREFERENCE_OPTIONS = [
  '自然风光',
  '城市漫游',
  '休闲躺平',
  '人文历史',
  '平衡型',
] as const
const COMPANION_TYPE_OPTIONS = [
  '独自出行',
  '朋友结伴',
  '情侣出游',
  '家庭出游',
  '不指定',
] as const
const WEATHER_MODE_OPTIONS = ['参考天气', '不参考天气'] as const

type PreferenceCardInput = {
  cardName: unknown
  travelStyle: unknown
  transportMode: unknown
  driveMode: unknown
  scenicPreference: unknown
  departureCity: unknown
  companionType: unknown
  travelDays: unknown
  startDate: unknown
  weatherMode: unknown
}

type NormalizedPreferenceCardInput = {
  cardName: string
  travelStyle: string
  transportMode: string
  driveMode: string | null
  scenicPreference: string
  departureCity: string
  companionType: string
  travelDays: number
  startDate: Date | null
  weatherMode: string
}

export class CardError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message)
  }
}

function normalizeRequiredString(value: unknown, fieldLabel: string) {
  if (typeof value !== 'string') {
    throw new CardError(400, `${fieldLabel}不能为空`)
  }

  const normalizedValue = value.trim()

  if (!normalizedValue) {
    throw new CardError(400, `${fieldLabel}不能为空`)
  }

  return normalizedValue
}

function normalizeOption<T extends readonly string[]>(
  value: unknown,
  fieldLabel: string,
  options: T,
): T[number] {
  const normalizedValue = normalizeRequiredString(value, fieldLabel)

  if (!options.includes(normalizedValue)) {
    throw new CardError(
      400,
      `${fieldLabel}只能选择：${options.join('、')}`,
    )
  }

  return normalizedValue
}

function normalizeDriveMode(transportMode: string, value: unknown) {
  if (transportMode === '公共交通') {
    return null
  }

  const normalizedValue = normalizeRequiredString(value, '自驾模式')

  if (!(DRIVE_MODE_OPTIONS as readonly string[]).includes(normalizedValue)) {
    throw new CardError(
      400,
      `自驾模式只能选择：${DRIVE_MODE_OPTIONS.join('、')}`,
    )
  }

  return normalizedValue
}

function normalizeTravelDays(value: unknown) {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value
  }

  if (typeof value === 'string' && /^[1-9]\d*$/.test(value.trim())) {
    return Number(value)
  }

  throw new CardError(400, '旅行天数必须是正整数')
}

function normalizeStartDate(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value !== 'string') {
    throw new CardError(400, '出发日期格式不正确')
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    throw new CardError(400, '出发日期格式不正确')
  }

  return date
}

function normalizeCardInput(input: unknown): NormalizedPreferenceCardInput {
  if (!input || typeof input !== 'object') {
    throw new CardError(400, '请求体格式不正确')
  }

  const cardInput = input as PreferenceCardInput
  const transportMode = normalizeOption(
    cardInput.transportMode,
    '交通方式',
    TRANSPORT_MODE_OPTIONS,
  )

  return {
    cardName: normalizeRequiredString(cardInput.cardName, '卡片名称'),
    travelStyle: normalizeOption(
      cardInput.travelStyle,
      '出游风格',
      TRAVEL_STYLE_OPTIONS,
    ),
    transportMode,
    driveMode: normalizeDriveMode(transportMode, cardInput.driveMode),
    scenicPreference: normalizeOption(
      cardInput.scenicPreference,
      '景点偏好',
      SCENIC_PREFERENCE_OPTIONS,
    ),
    departureCity: normalizeRequiredString(cardInput.departureCity, '当前坐标城市'),
    companionType: normalizeOption(
      cardInput.companionType,
      '同行类型',
      COMPANION_TYPE_OPTIONS,
    ),
    travelDays: normalizeTravelDays(cardInput.travelDays),
    startDate: normalizeStartDate(cardInput.startDate),
    weatherMode: normalizeOption(
      cardInput.weatherMode,
      '天气模式',
      WEATHER_MODE_OPTIONS,
    ),
  }
}

export function normalizeCardId(id: string) {
  const cardId = Number(id)

  if (!Number.isInteger(cardId) || cardId <= 0) {
    throw new CardError(400, '卡片 ID 格式不正确')
  }

  return cardId
}

async function ensureCardBelongsToUser(cardId: number, userId: number) {
  const card = await prisma.preferenceCard.findFirst({
    where: {
      id: cardId,
      userId,
    },
    select: {
      id: true,
    },
  })

  if (!card) {
    throw new CardError(404, '偏好卡片不存在')
  }
}

export function listPreferenceCards(userId: number) {
  return prisma.preferenceCard.findMany({
    where: {
      userId,
    },
    orderBy: [
      {
        createdAt: 'asc',
      },
      {
        id: 'asc',
      },
    ],
  })
}

export async function getPreferenceCard(userId: number, cardId: number) {
  const card = await prisma.preferenceCard.findFirst({
    where: {
      id: cardId,
      userId,
    },
  })

  if (!card) {
    throw new CardError(404, '偏好卡片不存在')
  }

  return card
}

export async function createPreferenceCard(
  userId: number,
  input: unknown,
) {
  const cardCount = await prisma.preferenceCard.count({
    where: {
      userId,
    },
  })

  if (cardCount >= MAX_CARDS_PER_USER) {
    throw new CardError(400, `每个用户最多只能创建 ${MAX_CARDS_PER_USER} 张偏好卡片`)
  }

  const normalizedInput = normalizeCardInput(input)

  return prisma.preferenceCard.create({
    data: {
      ...normalizedInput,
      userId,
    },
  })
}

export async function updatePreferenceCard(
  userId: number,
  cardId: number,
  input: unknown,
) {
  await ensureCardBelongsToUser(cardId, userId)

  const normalizedInput = normalizeCardInput(input)

  return prisma.preferenceCard.update({
    where: {
      id: cardId,
    },
    data: normalizedInput,
  })
}

export async function deletePreferenceCard(userId: number, cardId: number) {
  await ensureCardBelongsToUser(cardId, userId)

  await prisma.preferenceCard.delete({
    where: {
      id: cardId,
    },
  })

  return {
    id: cardId,
  }
}
