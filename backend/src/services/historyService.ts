import { prisma } from '../lib/prisma'

type TravelRecordInput = {
  recordType: unknown
  inputSummary: unknown
  resultTitle: unknown
  resultContent: unknown
  weatherInfo: unknown
  cardId: unknown
}

type NormalizedTravelRecordInput = {
  recordType: string
  inputSummary: string
  resultTitle: string | null
  resultContent: string
  weatherInfo: string | null
  cardId: number | null
}

export class HistoryError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message)
  }
}

function normalizeRequiredString(value: unknown, fieldLabel: string) {
  if (typeof value !== 'string') {
    throw new HistoryError(400, `${fieldLabel}不能为空`)
  }

  const normalizedValue = value.trim()

  if (!normalizedValue) {
    throw new HistoryError(400, `${fieldLabel}不能为空`)
  }

  return normalizedValue
}

function normalizeOptionalString(value: unknown, fieldLabel: string) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value !== 'string') {
    throw new HistoryError(400, `${fieldLabel}格式不正确`)
  }

  const normalizedValue = value.trim()

  return normalizedValue || null
}

function normalizeOptionalId(value: unknown, fieldLabel: string) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const id = Number(value)

  if (!Number.isInteger(id) || id <= 0) {
    throw new HistoryError(400, `${fieldLabel}格式不正确`)
  }

  return id
}

function normalizeTravelRecordInput(
  input: unknown,
): NormalizedTravelRecordInput {
  if (!input || typeof input !== 'object') {
    throw new HistoryError(400, '请求体格式不正确')
  }

  const recordInput = input as TravelRecordInput

  return {
    recordType: normalizeRequiredString(recordInput.recordType, '记录类型'),
    inputSummary: normalizeRequiredString(recordInput.inputSummary, '输入摘要'),
    resultTitle: normalizeOptionalString(recordInput.resultTitle, '结果标题'),
    resultContent: normalizeRequiredString(
      recordInput.resultContent,
      '结果内容',
    ),
    weatherInfo: normalizeOptionalString(recordInput.weatherInfo, '天气信息'),
    cardId: normalizeOptionalId(recordInput.cardId, '偏好卡片 ID'),
  }
}

export function normalizeHistoryId(id: string) {
  const historyId = Number(id)

  if (!Number.isInteger(historyId) || historyId <= 0) {
    throw new HistoryError(400, '历史记录 ID 格式不正确')
  }

  return historyId
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
    throw new HistoryError(404, '偏好卡片不存在')
  }
}

async function ensureHistoryBelongsToUser(historyId: number, userId: number) {
  const history = await prisma.travelRecord.findFirst({
    where: {
      id: historyId,
      userId,
    },
    select: {
      id: true,
    },
  })

  if (!history) {
    throw new HistoryError(404, '历史记录不存在')
  }
}

export function listTravelRecords(userId: number) {
  return prisma.travelRecord.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      userId: true,
      cardId: true,
      recordType: true,
      inputSummary: true,
      resultTitle: true,
      weatherInfo: true,
      createdAt: true,
      updatedAt: true,
    },
  })
}

export async function getTravelRecord(userId: number, historyId: number) {
  const history = await prisma.travelRecord.findFirst({
    where: {
      id: historyId,
      userId,
    },
  })

  if (!history) {
    throw new HistoryError(404, '历史记录不存在')
  }

  return history
}

export async function createTravelRecord(userId: number, input: unknown) {
  const normalizedInput = normalizeTravelRecordInput(input)

  if (normalizedInput.cardId) {
    await ensureCardBelongsToUser(normalizedInput.cardId, userId)
  }

  return prisma.travelRecord.create({
    data: {
      ...normalizedInput,
      userId,
    },
  })
}

export async function updateTravelRecordTitle(
  userId: number,
  historyId: number,
  input: unknown,
) {
  if (!input || typeof input !== 'object') {
    throw new HistoryError(400, '请求体格式不正确')
  }

  const titleInput = input as {
    resultTitle: unknown
  }
  const resultTitle = normalizeOptionalString(titleInput.resultTitle, '结果标题')

  await ensureHistoryBelongsToUser(historyId, userId)

  return prisma.travelRecord.update({
    where: {
      id: historyId,
    },
    data: {
      resultTitle,
    },
  })
}

export async function deleteTravelRecord(userId: number, historyId: number) {
  await ensureHistoryBelongsToUser(historyId, userId)

  await prisma.travelRecord.delete({
    where: {
      id: historyId,
    },
  })

  return {
    id: historyId,
  }
}
