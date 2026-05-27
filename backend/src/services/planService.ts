import { prisma } from '../lib/prisma'
import {
  generateLlmText,
  getPublicLlmInfo,
  isLlmConfigured,
  LlmError,
} from './llmService'
import {
  buildWeatherSnapshot,
  formatWeatherSnapshotForPrompt,
  parseWeatherSnapshotJson,
  serializeWeatherSnapshot,
  type WeatherSnapshot,
} from './weatherService'

type CityPlanInput = {
  targetCity: unknown
  departureCity: unknown
  travelDays: unknown
  startDate: unknown
  cardId: unknown
  temporaryPreference: unknown
  weatherMode: unknown
}

type DrivePlanInput = {
  departureCity: unknown
  destinationCity: unknown
  waypointCities: unknown
  travelDays: unknown
  startDate: unknown
  cardId: unknown
  temporaryPreference: unknown
  weatherMode: unknown
}

type OptimizePlanInput = {
  recordId: unknown
  optimizeRequirement: unknown
}

type NormalizedCityPlanInput = {
  targetCity: string
  departureCity: string | null
  travelDays: number | null
  startDate: Date | null
  cardId: number | null
  temporaryPreference: string | null
  weatherMode: string | null
}

type NormalizedDrivePlanInput = {
  departureCity: string
  destinationCity: string
  waypointCities: string[]
  travelDays: number
  startDate: Date | null
  cardId: number | null
  temporaryPreference: string | null
  weatherMode: string | null
}

type NormalizedOptimizePlanInput = {
  recordId: number
  optimizeRequirement: string
}

type PreferenceSnapshot = {
  id: number
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

type MockCityPlan = {
  title: string
  summary: string
  content: string
}

type StructuredItineraryTransition = {
  fromPlaceName: string | null
  toPlaceName: string | null
  transportMode: string | null
  durationText: string | null
  distanceText: string | null
  note: string | null
}

type StructuredItineraryItem = {
  timeOfDay: string | null
  timeWindow: string | null
  durationText: string | null
  title: string
  description: string
  reason: string | null
  placeName: string | null
  city: string | null
  addressHint: string | null
  transport: string | null
  transition: StructuredItineraryTransition | null
}

type StructuredItineraryDay = {
  day: number
  title: string
  city: string | null
  items: StructuredItineraryItem[]
  alternatives: string[]
  riskNotes: string[]
}

type StructuredItineraryMapPoint = {
  day: number
  order: number
  name: string
  city: string | null
  addressHint: string | null
  longitude: number | null
  latitude: number | null
  geocodeStatus: 'pending' | 'success' | 'failed' | 'skipped'
}

export type StructuredItinerary = {
  version: 1 | 2
  title: string
  summary: string
  recordType: string
  days: StructuredItineraryDay[]
  mapPoints: StructuredItineraryMapPoint[]
  notes: string[]
  returnTrip: StructuredItineraryReturnTrip | null
}

type StructuredItineraryReturnTrip = {
  fromCity: string | null
  toCity: string | null
  departureTime: string | null
  arrivalTime: string | null
  transportMode: string | null
  durationText: string | null
  distanceText: string | null
  description: string
  note: string | null
}

type LlmStructuredPlanOutput = {
  markdown?: unknown
  structuredItinerary?: unknown
}

type PlanPromptMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type AmapGeocodeResponse = {
  status?: string
  geocodes?: Array<{
    formatted_address?: string
    location?: string
  }>
}

type CityPlanBuildResult = ReturnType<typeof buildMockCityPlan>
type DrivePlanBuildResult = ReturnType<typeof buildMockDrivePlan>
type OptimizePlanBuildResult = ReturnType<typeof buildMockOptimizedPlan>

type OptimizedPlanTitleInfo = {
  baseTitle: string
  nextTitle: string
  version: number
}

export class PlanError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message)
  }
}

class LlmStructuredContentError extends Error {
  constructor(
    public readonly issues: string[],
    public readonly rawContent: string,
    public readonly repairable: boolean,
  ) {
    super(issues.join('；') || '大模型结构化输出不完整')
  }
}

function normalizeRequiredString(value: unknown, fieldLabel: string) {
  if (typeof value !== 'string') {
    throw new PlanError(400, `${fieldLabel}不能为空`)
  }

  const normalizedValue = value.trim()

  if (!normalizedValue) {
    throw new PlanError(400, `${fieldLabel}不能为空`)
  }

  return normalizedValue
}

function normalizeOptionalString(value: unknown, fieldLabel: string) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value !== 'string') {
    throw new PlanError(400, `${fieldLabel}格式不正确`)
  }

  const normalizedValue = value.trim()

  return normalizedValue || null
}

function normalizeOptionalDate(value: unknown, fieldLabel: string) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value !== 'string') {
    throw new PlanError(400, `${fieldLabel}格式不正确`)
  }

  const normalizedValue = value.trim()

  if (!normalizedValue) {
    return null
  }

  const date = new Date(normalizedValue)

  if (Number.isNaN(date.getTime())) {
    throw new PlanError(400, `${fieldLabel}格式不正确`)
  }

  return date
}

function normalizeOptionalPositiveInteger(value: unknown, fieldLabel: string) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value
  }

  if (typeof value === 'string' && /^[1-9]\d*$/.test(value.trim())) {
    return Number(value)
  }

  throw new PlanError(400, `${fieldLabel}必须是正整数`)
}

function normalizeOptionalId(value: unknown, fieldLabel: string) {
  return normalizeOptionalPositiveInteger(value, fieldLabel)
}

function normalizeRequiredId(value: unknown, fieldLabel: string) {
  const normalizedValue = normalizeOptionalPositiveInteger(value, fieldLabel)

  if (!normalizedValue) {
    throw new PlanError(400, `${fieldLabel}格式不正确`)
  }

  return normalizedValue
}

function normalizeRequiredPositiveInteger(value: unknown, fieldLabel: string) {
  const normalizedValue = normalizeOptionalPositiveInteger(value, fieldLabel)

  if (!normalizedValue) {
    throw new PlanError(400, `${fieldLabel}必须是正整数`)
  }

  return normalizedValue
}

function normalizeWaypointCities(value: unknown) {
  if (value === null || value === undefined) {
    return []
  }

  if (!Array.isArray(value)) {
    throw new PlanError(400, '途经城市格式不正确')
  }

  return value.map((item) => normalizeRequiredString(item, '途经城市'))
}

function normalizeCityPlanInput(input: unknown): NormalizedCityPlanInput {
  if (!input || typeof input !== 'object') {
    throw new PlanError(400, '请求体格式不正确')
  }

  const cityPlanInput = input as CityPlanInput

  return {
    targetCity: normalizeRequiredString(cityPlanInput.targetCity, '目标城市'),
    departureCity: normalizeOptionalString(
      cityPlanInput.departureCity,
      '出发城市',
    ),
    travelDays: normalizeOptionalPositiveInteger(
      cityPlanInput.travelDays,
      '旅行天数',
    ),
    startDate: normalizeOptionalDate(cityPlanInput.startDate, '出游起始日期'),
    cardId: normalizeOptionalId(cityPlanInput.cardId, '偏好卡片 ID'),
    temporaryPreference: normalizeOptionalString(
      cityPlanInput.temporaryPreference,
      '补充要求',
    ),
    weatherMode: normalizeOptionalString(cityPlanInput.weatherMode, '天气模式'),
  }
}

function normalizeDrivePlanInput(input: unknown): NormalizedDrivePlanInput {
  if (!input || typeof input !== 'object') {
    throw new PlanError(400, '请求体格式不正确')
  }

  const drivePlanInput = input as DrivePlanInput

  return {
    departureCity: normalizeRequiredString(
      drivePlanInput.departureCity,
      '出发城市',
    ),
    destinationCity: normalizeRequiredString(
      drivePlanInput.destinationCity,
      '目的城市',
    ),
    waypointCities: normalizeWaypointCities(drivePlanInput.waypointCities),
    travelDays: normalizeRequiredPositiveInteger(
      drivePlanInput.travelDays,
      '旅行天数',
    ),
    startDate: normalizeOptionalDate(drivePlanInput.startDate, '出游起始日期'),
    cardId: normalizeOptionalId(drivePlanInput.cardId, '偏好卡片 ID'),
    temporaryPreference: normalizeOptionalString(
      drivePlanInput.temporaryPreference,
      '补充要求',
    ),
    weatherMode: normalizeOptionalString(drivePlanInput.weatherMode, '天气模式'),
  }
}

function normalizeOptimizePlanInput(input: unknown): NormalizedOptimizePlanInput {
  if (!input || typeof input !== 'object') {
    throw new PlanError(400, '请求体格式不正确')
  }

  const optimizePlanInput = input as OptimizePlanInput

  return {
    recordId: normalizeRequiredId(optimizePlanInput.recordId, '历史记录 ID'),
    optimizeRequirement: normalizeRequiredString(
      optimizePlanInput.optimizeRequirement,
      '优化要求',
    ),
  }
}

async function getPreferenceSnapshot(userId: number, cardId: number) {
  const card = await prisma.preferenceCard.findFirst({
    where: {
      id: cardId,
      userId,
    },
    select: {
      id: true,
      cardName: true,
      travelStyle: true,
      transportMode: true,
      driveMode: true,
      scenicPreference: true,
      departureCity: true,
      companionType: true,
      travelDays: true,
      startDate: true,
      weatherMode: true,
    },
  })

  if (!card) {
    throw new PlanError(404, '偏好卡片不存在')
  }

  return card
}

async function getTravelRecordSnapshot(userId: number, recordId: number) {
  const record = await prisma.travelRecord.findFirst({
    where: {
      id: recordId,
      userId,
    },
  })

  if (!record) {
    throw new PlanError(404, '历史记录不存在')
  }

  return record
}

function getNextOptimizedPlanTitle(originalTitle: string): OptimizedPlanTitleInfo {
  const normalizedTitle = originalTitle.trim()
  const optimizedTitleMatch = normalizedTitle.match(
    /^(.*?)(?:\s*-\s*)?优化版(?:#([1-9]\d*))?$/,
  )

  if (!optimizedTitleMatch) {
    return {
      baseTitle: normalizedTitle,
      nextTitle: `${normalizedTitle} - 优化版`,
      version: 1,
    }
  }

  const baseTitle = optimizedTitleMatch[1].trim()
  const currentVersion = optimizedTitleMatch[2]
    ? Number(optimizedTitleMatch[2])
    : 1
  const nextVersion = currentVersion + 1

  return {
    baseTitle,
    nextTitle: `${baseTitle} - 优化版#${nextVersion}`,
    version: nextVersion,
  }
}

function buildDailySchedule(targetCity: string, travelDays: number) {
  const dayThemes = [
    '抵达适应与城市初印象',
    '核心景点深度游览',
    '自然风光与慢节奏体验',
    '本地生活、街区漫步与美食',
    '轻松收尾与返程准备',
  ]

  return Array.from({ length: travelDays }, (_item, index) => {
    const dayNumber = index + 1
    const theme = dayThemes[index % dayThemes.length]

    return [
      `Day ${dayNumber}：${theme}`,
      `- 上午：围绕${targetCity}的代表性区域安排低压力游览。`,
      `- 下午：根据体力选择景点、街区或自然空间，避免行程过满。`,
      `- 晚上：预留用餐和休息时间，整理第二天路线。`,
    ].join('\n')
  }).join('\n\n')
}

function buildDriveDailySchedule(routeCities: string[], travelDays: number) {
  return Array.from({ length: travelDays }, (_item, index) => {
    const dayNumber = index + 1
    const currentCity = routeCities[index % routeCities.length]
    const nextCity = routeCities[(index + 1) % routeCities.length]

    if (dayNumber === travelDays) {
      return [
        `Day ${dayNumber}：${currentCity}收尾与返程准备`,
        `- 上午：安排${currentCity}轻量游览，优先选择停车和补给便利的区域。`,
        '- 下午：预留车辆整理、返程或继续前往下一段行程的时间。',
        '- 晚上：复盘路线消耗，避免最后一天安排过密。',
      ].join('\n')
    }

    return [
      `Day ${dayNumber}：${currentCity} -> ${nextCity}`,
      `- 上午：从${currentCity}出发，控制驾驶节奏，中途安排服务区休息。`,
      `- 下午：抵达${nextCity}后优先办理入住或停车，再安排低强度游览。`,
      '- 晚上：结合当地餐饮和夜间交通情况，预留充足休息时间。',
    ].join('\n')
  }).join('\n\n')
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function readOptionalString(value: unknown) {
  const text = readString(value)
  return text || null
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

function readNullableNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const numberValue = Number(value)

    return Number.isFinite(numberValue) ? numberValue : null
  }

  return null
}

function readStringList(value: unknown) {
  return Array.isArray(value)
    ? value.map(readString).filter(Boolean)
    : []
}

function normalizeGeocodeStatus(
  value: unknown,
): StructuredItineraryMapPoint['geocodeStatus'] {
  const status = readString(value)

  return status === 'success' ||
    status === 'failed' ||
    status === 'skipped' ||
    status === 'pending'
    ? status
    : 'pending'
}

function readTransition(value: unknown): StructuredItineraryTransition | null {
  const record = readRecord(value)

  if (!record) {
    return null
  }

  const transition = {
    fromPlaceName: readOptionalString(record.fromPlaceName),
    toPlaceName: readOptionalString(record.toPlaceName),
    transportMode:
      readOptionalString(record.transportMode) ??
      readOptionalString(record.transport),
    durationText: readOptionalString(record.durationText),
    distanceText: readOptionalString(record.distanceText),
    note: readOptionalString(record.note),
  }

  return Object.values(transition).some(Boolean) ? transition : null
}

function readReturnTrip(
  value: unknown,
): StructuredItineraryReturnTrip | null {
  const record = readRecord(value)

  if (!record) {
    return null
  }

  const description = readString(record.description)

  return {
    fromCity: readOptionalString(record.fromCity),
    toCity: readOptionalString(record.toCity),
    departureTime: readOptionalString(record.departureTime),
    arrivalTime: readOptionalString(record.arrivalTime),
    transportMode: readOptionalString(record.transportMode),
    durationText: readOptionalString(record.durationText),
    distanceText: readOptionalString(record.distanceText),
    description: description || '最后一天晚上返回出发城市，到家后结束行程。',
    note: readOptionalString(record.note),
  }
}

function buildMinimalStructuredItinerary(
  recordType: string,
  title: string,
  summary: string,
  notes: string[] = [],
  returnTrip: StructuredItineraryReturnTrip | null = null,
): StructuredItinerary {
  return {
    version: 2,
    title,
    summary,
    recordType,
    days: [],
    mapPoints: [],
    notes,
    returnTrip,
  }
}

function buildMapPointsFromDays(days: StructuredItineraryDay[]) {
  const orderByDay = new Map<number, number>()
  const points: StructuredItineraryMapPoint[] = []

  for (const day of days) {
    for (const item of day.items) {
      const name = item.placeName ?? item.title

      if (!name) {
        continue
      }

      const order = (orderByDay.get(day.day) ?? 0) + 1
      orderByDay.set(day.day, order)
      points.push({
        day: day.day,
        order,
        name,
        city: item.city ?? day.city,
        addressHint: item.addressHint,
        longitude: null,
        latitude: null,
        geocodeStatus: 'pending',
      })
    }
  }

  return points
}

function normalizeStructuredItinerary(
  value: unknown,
  fallback: StructuredItinerary,
): StructuredItinerary {
  const record = readRecord(value)

  if (!record) {
    return fallback
  }

  const days = Array.isArray(record.days)
    ? record.days
        .map((dayValue, index) => {
          const dayRecord = readRecord(dayValue)

          if (!dayRecord) {
            return null
          }

          const dayNumber = readPositiveInteger(dayRecord.day, index + 1)
          const items = Array.isArray(dayRecord.items)
            ? dayRecord.items
                .map((itemValue) => {
                  const itemRecord = readRecord(itemValue)

                  if (!itemRecord) {
                    return null
                  }

                  const title =
                    readString(itemRecord.title) ||
                    readString(itemRecord.placeName) ||
                    '未命名安排'
                  const description = readString(itemRecord.description)

                  return {
                    timeOfDay: readOptionalString(itemRecord.timeOfDay),
                    timeWindow: readOptionalString(itemRecord.timeWindow),
                    durationText: readOptionalString(itemRecord.durationText),
                    title,
                    description: description || title,
                    reason: readOptionalString(itemRecord.reason),
                    placeName: readOptionalString(itemRecord.placeName),
                    city: readOptionalString(itemRecord.city),
                    addressHint: readOptionalString(itemRecord.addressHint),
                    transport: readOptionalString(itemRecord.transport),
                    transition: readTransition(itemRecord.transition),
                  } satisfies StructuredItineraryItem
                })
                .filter((item): item is StructuredItineraryItem =>
                  Boolean(item),
                )
            : []

          return {
            day: dayNumber,
            title:
              readString(dayRecord.title) ||
              `Day ${dayNumber}`,
            city: readOptionalString(dayRecord.city),
            items,
            alternatives: readStringList(dayRecord.alternatives),
            riskNotes: readStringList(dayRecord.riskNotes),
          } satisfies StructuredItineraryDay
        })
        .filter((day): day is StructuredItineraryDay => Boolean(day))
    : fallback.days

  const mapPoints = Array.isArray(record.mapPoints)
    ? record.mapPoints
        .map((pointValue, index) => {
          const pointRecord = readRecord(pointValue)

          if (!pointRecord) {
            return null
          }

          const name =
            readString(pointRecord.name) ||
            readString(pointRecord.placeName) ||
            readString(pointRecord.title)

          if (!name) {
            return null
          }

          return {
            day: readPositiveInteger(pointRecord.day, 1),
            order: readPositiveInteger(pointRecord.order, index + 1),
            name,
            city: readOptionalString(pointRecord.city),
            addressHint: readOptionalString(pointRecord.addressHint),
            longitude: readNullableNumber(pointRecord.longitude),
            latitude: readNullableNumber(pointRecord.latitude),
            geocodeStatus: normalizeGeocodeStatus(pointRecord.geocodeStatus),
          } satisfies StructuredItineraryMapPoint
        })
        .filter((point): point is StructuredItineraryMapPoint =>
          Boolean(point),
        )
    : []

  return {
    version: readPositiveInteger(record.version, fallback.version) === 1 ? 1 : 2,
    title: readString(record.title) || fallback.title,
    summary: readString(record.summary) || fallback.summary,
    recordType: readString(record.recordType) || fallback.recordType,
    days,
    mapPoints: mapPoints.length ? mapPoints : buildMapPointsFromDays(days),
    notes: readStringList(record.notes).length
      ? readStringList(record.notes)
      : fallback.notes,
    returnTrip: readReturnTrip(record.returnTrip) ?? fallback.returnTrip,
  }
}

function stripJsonFence(content: string) {
  const trimmed = content.trim()
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)

  return fenceMatch?.[1]?.trim() ?? trimmed
}

function parseLlmStructuredPlanOutput(content: string) {
  const strippedContent = stripJsonFence(content)

  try {
    return JSON.parse(strippedContent) as LlmStructuredPlanOutput
  } catch {
    const startIndex = strippedContent.indexOf('{')
    const endIndex = strippedContent.lastIndexOf('}')

    if (startIndex < 0 || endIndex <= startIndex) {
      return null
    }

    try {
      return JSON.parse(
        strippedContent.slice(startIndex, endIndex + 1),
      ) as LlmStructuredPlanOutput
    } catch {
      return null
    }
  }
}

function applyStructuredLlmContent(
  content: string,
  fallbackPlan: {
    plan: {
      title: string
      summary: string
      content: string
      structuredContent: StructuredItinerary
    }
  },
) {
  const parsedOutput = parseLlmStructuredPlanOutput(content)

  if (!parsedOutput) {
    throw new LlmStructuredContentError(
      ['大模型返回内容不是可解析的 JSON 对象'],
      content,
      false,
    )
  }

  const markdown =
    readString(parsedOutput?.markdown) || fallbackPlan.plan.content
  const structuredContent = normalizeStructuredItinerary(
    parsedOutput?.structuredItinerary,
    {
      ...fallbackPlan.plan.structuredContent,
      summary: getSummaryFromLlmContent(markdown, fallbackPlan.plan.summary),
    },
  )

  return {
    title: structuredContent.title || fallbackPlan.plan.title,
    summary: structuredContent.summary || getSummaryFromLlmContent(
      markdown,
      fallbackPlan.plan.summary,
    ),
    content: markdown,
    structuredContent: {
      ...structuredContent,
      title: structuredContent.title || fallbackPlan.plan.title,
      summary:
        structuredContent.summary ||
        getSummaryFromLlmContent(markdown, fallbackPlan.plan.summary),
    },
  }
}

function firstText(...values: Array<string | null | undefined>) {
  return values.find((value) => value?.trim())?.trim() ?? null
}

function fallbackTimeWindow(timeOfDay: string | null, index: number) {
  if (timeOfDay?.includes('上午')) {
    return '09:00-11:30'
  }

  if (timeOfDay?.includes('下午')) {
    return '14:00-17:00'
  }

  if (timeOfDay?.includes('晚上') || timeOfDay?.includes('晚间')) {
    return '18:30-21:00'
  }

  return index === 0 ? '09:00-11:30' : index === 1 ? '14:00-17:00' : '18:30-21:00'
}

function buildSafeTransitionFallback({
  transition,
  fallbackTransition,
  item,
  fallbackItem,
  previousPlaceName,
}: {
  transition: StructuredItineraryTransition | null
  fallbackTransition: StructuredItineraryTransition | null
  item: StructuredItineraryItem
  fallbackItem: StructuredItineraryItem | null
  previousPlaceName: string | null
}) {
  const toPlaceName =
    firstText(
      transition?.toPlaceName,
      fallbackTransition?.toPlaceName,
      item.placeName,
      fallbackItem?.placeName,
      item.title,
      fallbackItem?.title,
    ) ?? '当前安排'

  return {
    fromPlaceName:
      firstText(
        transition?.fromPlaceName,
        fallbackTransition?.fromPlaceName,
        previousPlaceName,
      ) ?? '上一地点',
    toPlaceName,
    transportMode:
      firstText(
        transition?.transportMode,
        fallbackTransition?.transportMode,
        item.transport,
        fallbackItem?.transport,
      ) ?? '按实际交通选择',
    durationText:
      firstText(transition?.durationText, fallbackTransition?.durationText) ??
      '按实际路线核对',
    distanceText:
      firstText(transition?.distanceText, fallbackTransition?.distanceText) ??
      '按实际路线核对',
    note:
      firstText(transition?.note, fallbackTransition?.note) ??
      '距离和耗时为规划参考，出行前请按实际路线、路况或班次核对。',
  } satisfies StructuredItineraryTransition
}

function completeStructuredItem({
  item,
  fallbackItem,
  previousPlaceName,
  index,
}: {
  item: StructuredItineraryItem
  fallbackItem: StructuredItineraryItem | null
  previousPlaceName: string | null
  index: number
}) {
  const timeOfDay = firstText(item.timeOfDay, fallbackItem?.timeOfDay)
  const title = firstText(item.title, fallbackItem?.title) ?? '未命名安排'
  const placeName = firstText(item.placeName, fallbackItem?.placeName, title)

  const completedItem: StructuredItineraryItem = {
    timeOfDay,
    timeWindow:
      firstText(item.timeWindow, fallbackItem?.timeWindow) ??
      fallbackTimeWindow(timeOfDay, index),
    durationText:
      firstText(item.durationText, fallbackItem?.durationText) ??
      '建议停留约 1.5-2.5 小时',
    title,
    description:
      firstText(item.description, fallbackItem?.description) ??
      `${title}，按当天体力和交通情况弹性安排。`,
    reason:
      firstText(item.reason, fallbackItem?.reason) ??
      '基于当天顺路程度、体力节奏和可替换性安排；出行前请结合开放时间、天气和同行人状态再核对。',
    placeName,
    city: firstText(item.city, fallbackItem?.city),
    addressHint: firstText(item.addressHint, fallbackItem?.addressHint),
    transport: firstText(item.transport, fallbackItem?.transport),
    transition: null,
  }

  completedItem.transition = buildSafeTransitionFallback({
    transition: item.transition,
    fallbackTransition: fallbackItem?.transition ?? null,
    item: completedItem,
    fallbackItem,
    previousPlaceName,
  })

  return completedItem
}

function completeStructuredDay({
  day,
  fallbackDay,
  index,
}: {
  day: StructuredItineraryDay | null
  fallbackDay: StructuredItineraryDay | null
  index: number
}) {
  const dayNumber = day?.day ?? fallbackDay?.day ?? index + 1
  const sourceItems = day?.items.length ? day.items : []
  const fallbackItems = fallbackDay?.items ?? []
  const itemCount = Math.max(sourceItems.length, fallbackItems.length)
  let previousPlaceName =
    firstText(
      sourceItems[0]?.transition?.fromPlaceName,
      fallbackItems[0]?.transition?.fromPlaceName,
      day?.city,
      fallbackDay?.city,
    ) ?? null
  const items = Array.from({ length: itemCount }, (_item, itemIndex) => {
    const sourceItem = sourceItems[itemIndex] ??
      fallbackItems[itemIndex] ?? {
        timeOfDay: null,
        timeWindow: null,
        durationText: null,
        title: '未命名安排',
        description: '按当天实际情况安排。',
        reason: null,
        placeName: null,
        city: null,
        addressHint: null,
        transport: null,
        transition: null,
      }
    const fallbackItem = fallbackItems[itemIndex] ?? null
    const completedItem = completeStructuredItem({
      item: sourceItem,
      fallbackItem,
      previousPlaceName,
      index: itemIndex,
    })

    previousPlaceName =
      completedItem.placeName ?? completedItem.transition?.toPlaceName ?? completedItem.title

    return completedItem
  })

  return {
    day: dayNumber,
    title:
      firstText(day?.title, fallbackDay?.title) ??
      `Day ${dayNumber}`,
    city: firstText(day?.city, fallbackDay?.city),
    items,
    alternatives: day?.alternatives.length
      ? day.alternatives
      : fallbackDay?.alternatives.length
        ? fallbackDay.alternatives
        : [
            '雨天可替换为室内展馆、商圈或住宿周边轻量活动。',
            '拥挤或排队过长时优先保留当天核心地点，压缩非必要停留。',
            '体力不足时减少跨区移动，把晚间安排改为就近用餐和休息。',
          ],
    riskNotes: day?.riskNotes.length
      ? day.riskNotes
      : fallbackDay?.riskNotes.length
        ? fallbackDay.riskNotes
        : [
            '出行前请核对开放时间、预约规则和交通班次。',
            '天气、路况和排队情况可能变化，建议保留机动时间。',
          ],
  } satisfies StructuredItineraryDay
}

function completeReturnTrip(
  returnTrip: StructuredItineraryReturnTrip | null,
  fallbackReturnTrip: StructuredItineraryReturnTrip | null,
  completedDays: StructuredItineraryDay[],
) {
  const lastDay = completedDays[completedDays.length - 1] ?? null
  const lastItem = lastDay?.items[lastDay.items.length - 1] ?? null
  const fromCity =
    firstText(returnTrip?.fromCity, fallbackReturnTrip?.fromCity, lastItem?.city, lastDay?.city) ??
    '最后游玩城市'
  const toCity =
    firstText(returnTrip?.toCity, fallbackReturnTrip?.toCity) ?? '出发城市'

  return {
    fromCity,
    toCity,
    departureTime:
      firstText(returnTrip?.departureTime, fallbackReturnTrip?.departureTime) ??
      `Day ${lastDay?.day ?? (completedDays.length || 1)} 晚上`,
    arrivalTime:
      firstText(returnTrip?.arrivalTime, fallbackReturnTrip?.arrivalTime) ??
      '最后一天晚上到家',
    transportMode:
      firstText(returnTrip?.transportMode, fallbackReturnTrip?.transportMode) ??
      '按实际交通选择',
    durationText:
      firstText(returnTrip?.durationText, fallbackReturnTrip?.durationText) ??
      '按实际路线或班次核对',
    distanceText:
      firstText(returnTrip?.distanceText, fallbackReturnTrip?.distanceText) ??
      '按实际路线核对',
    description:
      firstText(returnTrip?.description, fallbackReturnTrip?.description) ??
      `最后一天晚上从${fromCity}返回${toCity}，默认${toCity}为家所在城市，到家后结束行程。`,
    note:
      firstText(returnTrip?.note, fallbackReturnTrip?.note) ??
      '回程距离和耗时为规划参考，出行前请核对实时路况、班次或航班信息。',
  } satisfies StructuredItineraryReturnTrip
}

function completeStructuredItineraryWithFallback(
  itinerary: StructuredItinerary,
  fallback: StructuredItinerary,
) {
  const sourceDays = itinerary.days.length ? itinerary.days : []
  const fallbackDays = fallback.days
  const dayCount = Math.max(sourceDays.length, fallbackDays.length)
  const days = Array.from({ length: dayCount }, (_item, index) => {
    const sourceDay = sourceDays[index] ?? null
    const fallbackDay =
      fallbackDays.find((day) => day.day === sourceDay?.day) ??
      fallbackDays[index] ??
      null

    return completeStructuredDay({
      day: sourceDay ?? fallbackDay,
      fallbackDay,
      index,
    })
  })
  const mapPoints = itinerary.mapPoints
  const generatedMapPoints = buildMapPointsFromDays(days)
  const completedMapPoints =
    mapPoints.length >= generatedMapPoints.length
      ? mapPoints
      : generatedMapPoints.length
        ? generatedMapPoints
        : fallback.mapPoints

  return {
    version: 2,
    title: itinerary.title || fallback.title,
    summary: itinerary.summary || fallback.summary,
    recordType: itinerary.recordType || fallback.recordType,
    days,
    mapPoints: completedMapPoints,
    notes: itinerary.notes.length
      ? itinerary.notes
      : fallback.notes.length
        ? fallback.notes
        : ['出行前请核对开放时间、天气、路况和交通班次。'],
    returnTrip: completeReturnTrip(
      itinerary.returnTrip,
      fallback.returnTrip,
      days,
    ),
  } satisfies StructuredItinerary
}

function applyCompleteStructuredLlmContent(
  content: string,
  fallbackPlan: Parameters<typeof applyStructuredLlmContent>[1],
) {
  const plan = applyStructuredLlmContent(content, fallbackPlan)
  const structuredContent = completeStructuredItineraryWithFallback(
    plan.structuredContent,
    fallbackPlan.plan.structuredContent,
  )

  return {
    ...plan,
    title: structuredContent.title || plan.title || fallbackPlan.plan.title,
    summary:
      structuredContent.summary ||
      plan.summary ||
      fallbackPlan.plan.summary,
    structuredContent,
  }
}

function replaceMarkdownTitle(markdown: string, title: string) {
  const lines = markdown.trim().split('\n')

  if (lines[0]?.trim().startsWith('# ')) {
    return [`# ${title}`, ...lines.slice(1)].join('\n')
  }

  return [`# ${title}`, '', markdown.trim()].join('\n')
}

function forcePlanTitle(
  plan: {
    title: string
    summary: string
    content: string
    structuredContent: StructuredItinerary
  },
  title: string,
) {
  return {
    ...plan,
    title,
    content: replaceMarkdownTitle(plan.content, title),
    structuredContent: {
      ...plan.structuredContent,
      title,
    },
  }
}

function getStructuredOutputInstructions(recordType: string) {
  return [
    '你必须只输出一个 JSON 对象，不要输出 Markdown 代码围栏，也不要输出额外解释。',
    'JSON 顶层格式必须为：',
    '{',
    '  "markdown": "完整 Markdown 旅行方案文本",',
    '  "structuredItinerary": {',
    '    "version": 2,',
    `    "recordType": "${recordType}",`,
    '    "title": "方案标题",',
    '    "summary": "一句话摘要",',
    '    "days": [',
    '      {',
    '        "day": 1,',
    '        "title": "Day 1 标题",',
    '        "city": "城市名",',
    '        "items": [',
    '          {',
    '            "timeOfDay": "上午/下午/晚上或具体时段",',
    '            "timeWindow": "09:00-11:30 这类时间窗",',
    '            "durationText": "建议停留 2 小时",',
    '            "title": "安排标题",',
    '            "description": "详细说明",',
    '            "reason": "为什么选择这个时间段和地点；可基于天气、顺路、体力、偏好或开闭馆风险",',
    '            "placeName": "真实地点名；如果没有具体地点则为 null",',
    '            "city": "地点所在城市",',
    '            "addressHint": "可用于地图搜索的辅助地址或区域",',
    '            "transport": "本段通行方式或 null",',
    '            "transition": {',
    '              "fromPlaceName": "上一地点或出发城市/住宿地",',
    '              "toPlaceName": "本安排地点",',
    '              "transportMode": "步行/地铁/打车/自驾/高铁等",',
    '              "durationText": "约 20 分钟",',
    '              "distanceText": "约 3 公里",',
    '              "note": "切换说明；距离和耗时是规划参考，不是实时导航"',
    '            }',
    '          }',
    '        ],',
    '        "alternatives": ["雨天/拥挤/体力不足时可替换的方案"],',
    '        "riskNotes": ["开放时间、排队、天气、驾驶或交通风险提醒"]',
    '      }',
    '    ],',
    '    "mapPoints": [',
    '      {',
    '        "day": 1,',
    '        "order": 1,',
    '        "name": "真实地点名",',
    '        "city": "城市名",',
    '        "addressHint": "辅助地址或区域",',
    '        "longitude": null,',
    '        "latitude": null,',
    '        "geocodeStatus": "pending"',
    '      }',
    '    ],',
    '    "notes": ["出行前需要核对开放时间、天气和交通"],',
    '    "returnTrip": {',
    '      "fromCity": "最后游玩城市",',
    '      "toCity": "出发城市，也就是默认家所在城市",',
    '      "departureTime": "Day N 晚上 19:30 后",',
    '      "arrivalTime": "最后一天晚上到家",',
    '      "transportMode": "自驾/高铁/飞机/公共交通等",',
    '      "durationText": "约 2-5 小时或按实际班次核对",',
    '      "distanceText": "约 100-300 公里或按实际路线核对",',
    '      "description": "最后一天晚上从最后游玩城市返回出发城市，到家后结束行程",',
    '      "note": "回程距离和耗时为规划参考，出行前核对实时路况/班次"',
    '    }',
    '  }',
    '}',
    '每个上午/下午/晚上安排都必须写 reason，并且 transition 必须包含通行方式、切换时长和距离。',
    '每天必须提供 alternatives 和 riskNotes。',
    '无论单城市还是多城市自驾，returnTrip 都必须安排在旅行最后一天晚上回到出发城市。',
    'mapPoints 只放真实可搜索的地点，不要放“上午”“市中心一带”这类泛称。',
    '距离和耗时可以给近似参考，但不要宣称实时导航、实时路况或精确价格。',
  ].join('\n')
}

function getPlanLlmTimeoutMs() {
  const configuredTimeout = Number(process.env.PLAN_LLM_TIMEOUT_MS)

  if (Number.isFinite(configuredTimeout) && configuredTimeout > 0) {
    return configuredTimeout
  }

  const baseTimeout = Number(process.env.LLM_TIMEOUT_MS ?? 120000)
  const normalizedBaseTimeout =
    Number.isFinite(baseTimeout) && baseTimeout > 0 ? baseTimeout : 120000

  return Math.min(normalizedBaseTimeout, 90000)
}

async function generateCompletePlanWithRepair({
  messages,
  fallbackPlan,
  temperature,
}: {
  messages: PlanPromptMessage[]
  fallbackPlan: Parameters<typeof applyStructuredLlmContent>[1]
  temperature: number
}) {
  const content = await generateLlmText({
    messages,
    temperature,
    timeoutMs: getPlanLlmTimeoutMs(),
  })

  return applyCompleteStructuredLlmContent(content, fallbackPlan)
}

function serializeStructuredItinerary(itinerary: StructuredItinerary) {
  return JSON.stringify(itinerary)
}

function getAmapWebServiceKeyOrNull() {
  return process.env.AMAP_WEB_SERVICE_KEY?.trim() || null
}

function parseAmapCoordinate(value: string) {
  const [longitudeText, latitudeText] = value.split(',')
  const longitude = Number(longitudeText)
  const latitude = Number(latitudeText)

  return Number.isFinite(longitude) && Number.isFinite(latitude)
    ? { longitude, latitude }
    : null
}

function buildMapPointSearchText(point: StructuredItineraryMapPoint) {
  return [point.city, point.name, point.addressHint]
    .map((item) => item?.trim())
    .filter(Boolean)
    .join(' ')
}

async function geocodeMapPoint(
  point: StructuredItineraryMapPoint,
  apiKey: string,
) {
  const searchText = buildMapPointSearchText(point)

  if (!searchText) {
    return {
      ...point,
      geocodeStatus: 'skipped' as const,
    }
  }

  const url = new URL('https://restapi.amap.com/v3/geocode/geo')
  url.searchParams.set('key', apiKey)
  url.searchParams.set('address', searchText)
  url.searchParams.set('output', 'json')

  if (point.city) {
    url.searchParams.set('city', point.city)
  }

  try {
    const response = await fetch(url)
    const body = (await response.json()) as AmapGeocodeResponse
    const location = body.geocodes?.[0]?.location
    const coordinate = location ? parseAmapCoordinate(location) : null

    if (!response.ok || body.status !== '1' || !coordinate) {
      return {
        ...point,
        geocodeStatus: 'failed' as const,
      }
    }

    return {
      ...point,
      longitude: coordinate.longitude,
      latitude: coordinate.latitude,
      geocodeStatus: 'success' as const,
    }
  } catch {
    return {
      ...point,
      geocodeStatus: 'failed' as const,
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function enrichStructuredItineraryMapPoints(
  itinerary: StructuredItinerary,
) {
  const apiKey = getAmapWebServiceKeyOrNull()

  if (!apiKey) {
    return {
      ...itinerary,
      mapPoints: itinerary.mapPoints.map((point) => ({
        ...point,
        geocodeStatus:
          point.longitude !== null && point.latitude !== null
            ? ('success' as const)
            : ('skipped' as const),
      })),
    }
  }

  const mapPoints: StructuredItineraryMapPoint[] = []

  for (const point of itinerary.mapPoints) {
    if (point.longitude !== null && point.latitude !== null) {
      mapPoints.push({
        ...point,
        geocodeStatus: 'success',
      })
      continue
    }

    await sleep(250)
    mapPoints.push(await geocodeMapPoint(point, apiKey))
  }

  return {
    ...itinerary,
    mapPoints,
  }
}

function buildTransition({
  fromPlaceName,
  toPlaceName,
  transportMode,
  durationText,
  distanceText,
  note,
}: StructuredItineraryTransition): StructuredItineraryTransition {
  return {
    fromPlaceName,
    toPlaceName,
    transportMode,
    durationText,
    distanceText,
    note,
  }
}

function buildReturnTrip({
  fromCity,
  toCity,
  travelDays,
  transportMode,
  drivePlan,
}: {
  fromCity: string
  toCity: string
  travelDays: number
  transportMode: string
  drivePlan?: boolean
}): StructuredItineraryReturnTrip {
  return {
    fromCity,
    toCity,
    departureTime: `Day ${travelDays} 晚上 19:30 后`,
    arrivalTime: '最后一天晚上到家',
    transportMode,
    durationText: drivePlan
      ? '按实际路线核对，建议预留 2-5 小时以上'
      : '按实际班次核对，建议预留 2-5 小时',
    distanceText: drivePlan
      ? '按实际自驾路线核对'
      : '按实际交通路线核对',
    description: `最后一天晚上从${fromCity}返回${toCity}，默认${toCity}为家所在城市，到家后结束行程。`,
    note: drivePlan
      ? '回程距离和耗时仅作规划参考，出发前请核对实时路况、充电/加油和停车条件。'
      : '回程时间以实际车次、航班或市内交通为准，建议提前确认末班和行李时间。',
  }
}

function renderTransition(transition: StructuredItineraryTransition | null) {
  if (!transition) {
    return '未填写切换信息'
  }

  return [
    `${transition.fromPlaceName ?? '上一地点'} -> ${transition.toPlaceName ?? '当前地点'}`,
    transition.transportMode ? `方式：${transition.transportMode}` : null,
    transition.durationText ? `耗时：${transition.durationText}` : null,
    transition.distanceText ? `距离：${transition.distanceText}` : null,
    transition.note,
  ]
    .filter(Boolean)
    .join('；')
}

function renderStructuredDailySchedule(itinerary: StructuredItinerary) {
  return itinerary.days
    .map((day) =>
      [
        `${day.title}${day.city ? `（${day.city}）` : ''}`,
        ...day.items.map((item) =>
          [
            `- ${item.timeOfDay ?? '安排'}${item.timeWindow ? ` ${item.timeWindow}` : ''}：${item.title}`,
            `  - 地点：${item.placeName ?? '按当天情况确定'}${item.durationText ? `；建议停留：${item.durationText}` : ''}`,
            `  - 理由：${item.reason ?? item.description}`,
            `  - 切换：${renderTransition(item.transition)}`,
            `  - 内容：${item.description}`,
          ].join('\n'),
        ),
        day.alternatives.length
          ? `- 备选方案：${day.alternatives.join('；')}`
          : null,
        day.riskNotes.length
          ? `- 风险提示：${day.riskNotes.join('；')}`
          : null,
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n')
}

function renderReturnTrip(returnTrip: StructuredItineraryReturnTrip | null) {
  if (!returnTrip) {
    return '最后一天晚上返回出发城市，到家后结束行程。'
  }

  return [
    `- 回程：${returnTrip.fromCity ?? '最后游玩城市'} -> ${returnTrip.toCity ?? '出发城市'}`,
    `- 时间：${returnTrip.departureTime ?? '最后一天晚上'}，${returnTrip.arrivalTime ?? '晚上到家'}`,
    `- 方式：${returnTrip.transportMode ?? '按实际交通选择'}`,
    `- 预计：${returnTrip.durationText ?? '按实际路线核对'}；${returnTrip.distanceText ?? '按实际路线核对'}`,
    `- 说明：${returnTrip.description}`,
    returnTrip.note ? `- 提醒：${returnTrip.note}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

function buildCityStructuredItinerary(
  recordType: string,
  title: string,
  summary: string,
  targetCity: string,
  departureCity: string,
  transportMode: string,
  travelDays: number,
  notes: string[],
): StructuredItinerary {
  const dayTitles = [
    '抵达适应与城市初印象',
    '核心景点深度游览',
    '自然风光与慢节奏体验',
    '本地生活与美食探索',
    '轻松收尾与返程准备',
  ]
  const itemTemplates = [
    {
      timeOfDay: '上午',
      suffix: '博物馆',
      title: '城市文化与展陈参观',
      description: '用低压力节奏了解城市背景，适合作为当天的开场。',
      timeWindow: '09:00-11:30',
      durationText: '约 2-2.5 小时',
      reason: '上午体力较好，优先安排室内文化类地点；若天气炎热或降雨，也能保持行程稳定。',
      transportMode,
      transitionDuration: '约 20-40 分钟',
      transitionDistance: '约 3-10 公里',
    },
    {
      timeOfDay: '下午',
      suffix: '公园',
      title: '户外散步与休息',
      description: '安排自然空间或开放街区，给行程保留缓冲。',
      timeWindow: '14:00-17:00',
      durationText: '约 2-3 小时',
      reason: '下午适合安排弹性更高的开放空间，天气好时体验更完整，天气变化时也容易缩短或替换。',
      transportMode,
      transitionDuration: '约 15-35 分钟',
      transitionDistance: '约 2-8 公里',
    },
    {
      timeOfDay: '晚上',
      suffix: '老城区',
      title: '本地街区与餐饮',
      description: '结合餐饮和夜间交通情况，选择方便返回住宿的区域。',
      timeWindow: '18:30-21:00',
      durationText: '约 1.5-2.5 小时',
      reason: '晚上以餐饮和轻量街区为主，降低体力消耗，也方便根据当天排队和天气调整。',
      transportMode,
      transitionDuration: '约 15-30 分钟',
      transitionDistance: '约 2-6 公里',
    },
  ]
  const days = Array.from({ length: travelDays }, (_item, index) => {
    const dayNumber = index + 1
    let previousPlaceName = dayNumber === 1 ? departureCity : `${targetCity}住宿地`

    return {
      day: dayNumber,
      title: `Day ${dayNumber}：${dayTitles[index % dayTitles.length]}`,
      city: targetCity,
      items: itemTemplates.map((template) => {
        const isLastEvening =
          dayNumber === travelDays && template.timeOfDay === '晚上'
        const placeName = isLastEvening
          ? `${targetCity}交通枢纽`
          : `${targetCity}${template.suffix}`
        const titleText = isLastEvening ? '晚间返程前整理与出发' : template.title
        const description = isLastEvening
          ? `压缩晚间游玩强度，预留行李、用餐和前往交通枢纽的时间，随后从${targetCity}返回${departureCity}。`
          : template.description
        const reason = isLastEvening
          ? '最后一天晚上默认到家，所以晚间不再安排高强度游玩，优先保证返程稳定。'
          : template.reason
        const transition = buildTransition({
          fromPlaceName: previousPlaceName,
          toPlaceName: placeName,
          transportMode: template.transportMode,
          durationText: template.transitionDuration,
          distanceText: template.transitionDistance,
          note: '为规划参考，实际耗时请按住宿位置、路况和公共交通班次核对。',
        })

        previousPlaceName = placeName

        return {
          timeOfDay: template.timeOfDay,
          timeWindow: template.timeWindow,
          durationText: template.durationText,
          title: titleText,
          description,
          reason,
          placeName,
          city: targetCity,
          addressHint: targetCity,
          transport: template.transportMode,
          transition,
        } satisfies StructuredItineraryItem
      }),
      alternatives: [
        `雨天可把户外安排替换为${targetCity}博物馆、商圈或室内展馆。`,
        '如果排队过长，优先保留当天核心点，压缩晚间街区停留。',
        '体力不足时可取消下午第二段，只保留餐饮和住宿周边散步。',
      ],
      riskNotes: [
        '热门场馆需提前核对开放时间、预约规则和闭馆日。',
        '高温、降雨或大风时优先减少户外停留。',
        dayNumber === travelDays
          ? '最后一天必须预留回程时间，避免晚间交通衔接过紧。'
          : '晚间返回住宿前核对末班车和打车等待时间。',
      ],
    } satisfies StructuredItineraryDay
  })

  return {
    version: 2,
    title,
    summary,
    recordType,
    days,
    mapPoints: buildMapPointsFromDays(days),
    notes,
    returnTrip: buildReturnTrip({
      fromCity: targetCity,
      toCity: departureCity,
      travelDays,
      transportMode,
    }),
  }
}

function buildDriveStructuredItinerary(
  recordType: string,
  title: string,
  summary: string,
  routeCities: string[],
  homeCity: string,
  driveMode: string,
  travelDays: number,
  notes: string[],
): StructuredItinerary {
  const destinationCity = routeCities[routeCities.length - 1] ?? homeCity
  const days = Array.from({ length: travelDays }, (_item, index) => {
    const dayNumber = index + 1
    const isLastDay = dayNumber === travelDays
    const currentCity = isLastDay
      ? destinationCity
      : routeCities[Math.min(index, routeCities.length - 1)]
    const nextCity = isLastDay
      ? destinationCity
      : routeCities[Math.min(index + 1, routeCities.length - 1)]
    const morningPlace = isLastDay
      ? `${destinationCity}市中心`
      : `${currentCity}出发补给点`
    const afternoonPlace = isLastDay
      ? `${destinationCity}代表景点`
      : `${nextCity}代表景点`
    const eveningPlace = isLastDay
      ? `${destinationCity}返程出发点`
      : `${nextCity}住宿区`

    return {
      day: dayNumber,
      title:
        isLastDay
          ? `Day ${dayNumber}：${destinationCity}收尾与晚间回程`
          : `Day ${dayNumber}：${currentCity}到${nextCity}`,
      city: currentCity,
      items: [
        {
          timeOfDay: '上午',
          timeWindow: '08:30-11:30',
          durationText: isLastDay ? '约 2 小时' : '约 2-3 小时驾驶与休息',
          title: `${currentCity}出发与补给`,
          description: isLastDay
            ? '最后一天上午只安排城市内轻量活动和车辆整理，为下午收尾和晚间回程留出空间。'
            : `从${currentCity}出发前确认车辆、停车、补给和当天休息点，避免连续驾驶过久。`,
          reason: isLastDay
            ? '最后一天晚上需要到家，上午保持低强度可以降低回程疲劳。'
            : '上午路况和精力通常更稳定，适合完成跨城主驾驶段。',
          placeName: morningPlace,
          city: currentCity,
          addressHint: currentCity,
          transport: driveMode,
          transition: buildTransition({
            fromPlaceName: dayNumber === 1 ? homeCity : `${currentCity}住宿区`,
            toPlaceName: morningPlace,
            transportMode: driveMode,
            durationText: '约 10-30 分钟',
            distanceText: '约 2-10 公里',
            note: '出发前核对车辆状态、停车费和补给条件。',
          }),
        },
        {
          timeOfDay: '下午',
          timeWindow: '14:00-17:00',
          durationText: '约 2-3 小时',
          title:
            isLastDay
              ? `${destinationCity}轻量游览`
              : `${nextCity}抵达后低强度游览`,
          description: isLastDay
            ? '选择停车和离城都较方便的代表性区域，控制游玩时长。'
            : '抵达后优先停车或办理入住，再安排低强度游览，避免跨城后继续赶景点。',
          reason: isLastDay
            ? '下午保留城市印象点，同时不压缩晚间返程时间。'
            : '下午抵达后安排低强度点位，更符合自驾后的体力状态。',
          placeName: afternoonPlace,
          city: isLastDay ? destinationCity : nextCity,
          addressHint: isLastDay ? destinationCity : nextCity,
          transport: driveMode,
          transition: buildTransition({
            fromPlaceName: morningPlace,
            toPlaceName: afternoonPlace,
            transportMode: driveMode,
            durationText: isLastDay ? '约 20-40 分钟' : '约 1.5-3 小时',
            distanceText: isLastDay ? '约 5-15 公里' : '约 80-220 公里',
            note: '跨城距离为规划参考，出发前请按高德等导航重新核对。',
          }),
        },
        {
          timeOfDay: '晚上',
          timeWindow: '18:30-22:30',
          durationText: isLastDay ? '按回程路线核对' : '约 1.5-2 小时',
          title: isLastDay ? '晚间回程到家' : `${nextCity}入住与休整`,
          description: isLastDay
            ? `从${destinationCity}晚间出发返回${homeCity}，默认${homeCity}为家所在城市。`
            : '晚间以入住、餐饮和复盘路况为主，不继续增加长距离移动。',
          reason: isLastDay
            ? '最后一天晚上必须到家，因此晚间段专门留给返程，不再叠加游玩任务。'
            : '自驾路线更需要稳定休息，晚间降低强度能保证第二天驾驶状态。',
          placeName: eveningPlace,
          city: isLastDay ? destinationCity : nextCity,
          addressHint: isLastDay ? destinationCity : nextCity,
          transport: driveMode,
          transition: buildTransition({
            fromPlaceName: afternoonPlace,
            toPlaceName: isLastDay ? homeCity : eveningPlace,
            transportMode: driveMode,
            durationText: isLastDay ? '约 2-5 小时以上' : '约 15-30 分钟',
            distanceText: isLastDay ? '按实际返程路线核对' : '约 3-10 公里',
            note: isLastDay
              ? '回程需以实时路况为准，必要时提前出发或增加休息。'
              : '优先选择停车方便、第二天出城顺路的住宿区域。',
          }),
        },
      ],
      alternatives: [
        '遇到降雨或拥堵时，减少下午景点停留，优先保证跨城和入住。',
        '体力不足时取消晚间街区活动，只保留餐饮、补给和休息。',
        '如高速拥堵，改为服务区休整或缩短当天游览范围。',
      ],
      riskNotes: [
        '每日出发前核对实时路况、限行、停车和充电/加油条件。',
        '跨城段不要疲劳驾驶，每 2 小时左右安排休息。',
        isLastDay
          ? '最后一天晚间必须预留返程，不建议追加远郊景点。'
          : '雨天、山路或夜间路段需降低速度并增加机动时间。',
      ],
    } satisfies StructuredItineraryDay
  })

  return {
    version: 2,
    title,
    summary,
    recordType,
    days,
    mapPoints: buildMapPointsFromDays(days),
    notes,
    returnTrip: buildReturnTrip({
      fromCity: destinationCity,
      toCity: homeCity,
      travelDays,
      transportMode: driveMode,
      drivePlan: true,
    }),
  }
}

function parseStructuredItineraryJson(value: string | null | undefined) {
  if (!value) {
    return null
  }

  try {
    return normalizeStructuredItinerary(JSON.parse(value), {
      version: 1,
      title: '',
      summary: '',
      recordType: 'legacy',
      days: [],
      mapPoints: [],
      notes: [],
      returnTrip: null,
    })
  } catch {
    return null
  }
}

function getPlanWeatherMode(
  weatherMode: string | null,
  preference: PreferenceSnapshot | null,
) {
  return weatherMode ?? preference?.weatherMode ?? '参考天气'
}

function getPlanStartDate(
  startDate: Date | null,
  preference: PreferenceSnapshot | null,
) {
  return startDate ?? preference?.startDate ?? null
}

function formatDateKey(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null
}

function getWeatherInfoFallback(weatherMode: string, drivePlan = false) {
  return drivePlan
    ? `${weatherMode}：长途驾驶前建议核对最新天气、路况和停车条件，并为山区、雨天或夜间路段预留机动时间。`
    : `${weatherMode}：出行前建议核对最新天气，并根据降雨、高温或大风情况调整室外安排。`
}

function buildWeatherPromptSection(weatherSnapshot: WeatherSnapshot) {
  return [
    '## 真实天气参考',
    formatWeatherSnapshotForPrompt(weatherSnapshot),
    '',
    '请基于上述天气参考生成“天气提示”。如果状态为 disabled、unavailable、partial 或 out-of-range，请明确说明限制，不要编造实时或远期天气。',
  ].join('\n')
}

function buildFallbackPlanOutline(
  fallbackPlan: CityPlanBuildResult | DrivePlanBuildResult,
) {
  const itinerary = fallbackPlan.plan.structuredContent

  return [
    `参考标题：${itinerary.title}`,
    `参考摘要：${itinerary.summary}`,
    ...itinerary.days.map((day) => {
      const items = day.items
        .map((item) => `${item.timeOfDay ?? '安排'} ${item.placeName ?? item.title}`)
        .join('；')

      return `${day.title}：${items}`
    }),
    `回程要求：${itinerary.returnTrip?.description ?? '最后一天晚上返回出发城市，到家后结束行程。'}`,
  ].join('\n')
}

function buildMockCityPlan(
  input: NormalizedCityPlanInput,
  preference: PreferenceSnapshot | null,
  weatherSnapshot: WeatherSnapshot,
) {
  const travelDays = input.travelDays ?? preference?.travelDays

  if (!travelDays) {
    throw new PlanError(400, '旅行天数必须是正整数')
  }

  const departureCity =
    input.departureCity ?? preference?.departureCity ?? '未填写出发城市'
  const travelStyle = preference?.travelStyle ?? input.temporaryPreference ?? '轻松均衡'
  const transportMode = preference?.transportMode ?? '公共交通'
  const driveMode = preference?.driveMode
  const scenicPreference =
    preference?.scenicPreference ?? input.temporaryPreference ?? '综合体验'
  const companionType = preference?.companionType ?? '未指定同行人'
  const weatherMode = getPlanWeatherMode(input.weatherMode, preference)
  const startDateText = formatDateKey(getPlanStartDate(input.startDate, preference))
  const preferenceLabel = preference
    ? `偏好卡片「${preference.cardName}」`
    : '补充要求'
  const title = `${input.targetCity} ${travelDays} 天智能旅行方案`
  const summaryParts = [
    `从${departureCity}出发，前往${input.targetCity}。`,
    `本次规划参考${preferenceLabel}，整体风格为${travelStyle}，交通方式为${transportMode}。`,
    `景点偏好侧重${scenicPreference}，同行类型为${companionType}。`,
  ]

  if (startDateText) {
    summaryParts.push(`出游起始日期为${startDateText}。`)
  }

  if (input.temporaryPreference) {
    summaryParts.push(`本次补充要求：${input.temporaryPreference}。`)
  }

  const summary = summaryParts.join('')
  const weatherInfo =
    weatherSnapshot.summary || getWeatherInfoFallback(weatherMode)
  const cityTransportMode = driveMode ?? transportMode
  const structuredContent = buildCityStructuredItinerary(
    'single-city-plan',
    title,
    summary,
    input.targetCity,
    departureCity,
    cityTransportMode,
    travelDays,
    [
      '行程执行前仍建议核对景区开放时间、交通班次和天气变化。',
      '地点间距离和耗时均为规划参考，不代表实时导航。',
    ],
  )
  const content = [
    `# ${title}`,
    '',
    '## 方案概览',
    summary,
    '',
    '## 每日安排',
    renderStructuredDailySchedule(structuredContent),
    '',
    '## 交通建议',
    driveMode
      ? `本次可参考「${driveMode}」安排城市内与周边移动，并保留休息与补给时间。`
      : `建议优先使用${transportMode}，减少路线切换成本，并把住宿安排在交通便利区域。`,
    '',
    '## 最后一晚回程安排',
    renderReturnTrip(structuredContent.returnTrip),
    '',
    '## 天气提示',
    weatherInfo,
    '',
    '## 备选与风险',
    '- 每天均保留雨天、拥挤和体力不足的替代方案，可在结构化行程中逐日查看。',
    '- 如天气不可用或超出预报范围，方案只做风险提醒，不编造实时天气。',
    '',
    '## 注意事项',
    '- 行程可根据体力、开闭馆信息和交通班次继续微调。',
    '- 热门景点建议提前确认预约规则与开放时间。',
    '- 行程执行前仍建议核对景区开放时间、交通班次和天气变化。',
  ].join('\n')

  return {
    plan: {
      title,
      summary,
      content,
      structuredContent,
    },
    inputSummary: [
      `目标城市：${input.targetCity}`,
      `出发城市：${departureCity}`,
      `旅行天数：${travelDays}`,
      ...(startDateText ? [`出游起始日期：${startDateText}`] : []),
      `偏好来源：${preferenceLabel}`,
      `偏好摘要：${scenicPreference}`,
      ...(input.temporaryPreference
        ? [`补充要求：${input.temporaryPreference}`]
        : []),
    ].join('；'),
    weatherInfo,
    weatherSnapshot,
    cardId: preference?.id ?? null,
  }
}

function buildCityPlanPrompt(
  input: NormalizedCityPlanInput,
  preference: PreferenceSnapshot | null,
  fallbackPlan: CityPlanBuildResult,
) {
  const travelDays = input.travelDays ?? preference?.travelDays
  const departureCity = input.departureCity ?? preference?.departureCity ?? '未填写'
  const startDateText =
    formatDateKey(getPlanStartDate(input.startDate, preference)) ?? '未填写'
  const preferenceText = buildPreferencePromptText(
    preference,
    input.temporaryPreference,
  )

  return [
    {
      role: 'system' as const,
      content:
        '你是一个中文智能旅游规划助手。请根据用户输入生成实用、清晰、可执行的旅行方案。不要编造具体价格，不要承诺景区一定开放。',
    },
    {
      role: 'user' as const,
      content: [
        '请生成一份单城市旅行方案。',
        '',
        '## 用户输入',
        `目标城市：${input.targetCity}`,
        `出发城市：${departureCity}`,
        `默认家所在城市：${departureCity}`,
        `旅行天数：${travelDays ?? '未填写'}`,
        `出游起始日期：${startDateText}`,
        `天气模式：${getPlanWeatherMode(input.weatherMode, preference)}`,
        '',
        '## 用户偏好',
        preferenceText,
        '',
        buildWeatherPromptSection(fallbackPlan.weatherSnapshot),
        '',
        '## 输出要求',
        '- 第一行必须是一级标题，格式为：# 城市 天数 天智能旅行方案',
        '- 必须包含：方案概览、每日安排、交通建议、天气提示、注意事项',
        '- 每日安排要按 Day 1、Day 2 的形式写',
        '- 每个上午、下午、晚上安排都要写清楚：时间窗、建议停留时长、选择该地点的理由、从上一地点切换到本地点的方式/约耗时/约距离',
        '- 选择理由可以基于天气、顺路程度、体力安排、同行人偏好、开闭馆风险或演示可执行性',
        '- 每天必须提供雨天、拥挤或体力不足时的备选方案，以及开放时间、天气或交通风险提示',
        `- 最后一天晚上必须从${input.targetCity}返回${departureCity}，默认${departureCity}就是家所在城市，并说明晚上到家`,
        '- 内容要适合课程项目演示，表达自然，不要提到“mock”',
        '- 天气提示必须优先使用真实天气参考；如果天气信息不足，请说明需要出行前核对天气，不要编造实时天气',
        '- 地点间距离和耗时只作为近似规划参考，不要宣称实时导航或精确路况',
        '',
        '## 结构化输出要求',
        getStructuredOutputInstructions('single-city-plan'),
        '',
        '## 行程结构参考',
        '请沿用所需天数和最后一晚回程约束，具体地点与理由应结合用户输入规划：',
        buildFallbackPlanOutline(fallbackPlan),
      ].join('\n'),
    },
  ]
}

function buildPreferencePromptText(
  preference: PreferenceSnapshot | null,
  temporaryPreference: string | null,
) {
  const supplementText = `补充要求：${temporaryPreference ?? '未填写'}`

  if (!preference) {
    return supplementText
  }

  return [
    `偏好卡片名称：${preference.cardName}`,
    `旅行风格：${preference.travelStyle}`,
    `交通方式：${preference.transportMode}`,
    `驾驶模式：${preference.driveMode ?? '未填写'}`,
    `景点偏好：${preference.scenicPreference}`,
    `出发城市：${preference.departureCity}`,
    `同行类型：${preference.companionType}`,
    `偏好旅行天数：${preference.travelDays}`,
    `偏好出游起始日期：${formatDateKey(preference.startDate) ?? '未填写'}`,
    `天气模式：${preference.weatherMode}`,
    supplementText,
  ].join('\n')
}

function buildDrivePlanPrompt(
  input: NormalizedDrivePlanInput,
  preference: PreferenceSnapshot | null,
  fallbackPlan: DrivePlanBuildResult,
) {
  const routeCities = [
    input.departureCity,
    ...input.waypointCities,
    input.destinationCity,
  ]
  const fullRouteCities = [...routeCities, input.departureCity]

  return [
    {
      role: 'system' as const,
      content:
        '你是一个中文自驾旅行路线规划助手。请根据用户输入生成安全、清晰、可执行的多城市自驾路线方案。不要编造实时路况、精确距离、具体价格或景区一定开放的信息。',
    },
    {
      role: 'user' as const,
      content: [
        '请生成一份多城市自驾路线方案。',
        '',
        '## 用户输入',
        `出发城市：${input.departureCity}`,
        `默认家所在城市：${input.departureCity}`,
        `目的城市：${input.destinationCity}`,
        `途经城市：${input.waypointCities.length ? input.waypointCities.join('、') : '无'}`,
        `城市顺序：${routeCities.join(' -> ')}`,
        `完整自驾闭环：${fullRouteCities.join(' -> ')}`,
        `旅行天数：${input.travelDays}`,
        `出游起始日期：${formatDateKey(getPlanStartDate(input.startDate, preference)) ?? '未填写'}`,
        `天气模式：${getPlanWeatherMode(input.weatherMode, preference)}`,
        '',
        '## 用户偏好',
        buildPreferencePromptText(preference, input.temporaryPreference),
        '',
        buildWeatherPromptSection(fallbackPlan.weatherSnapshot),
        '',
        '## 输出要求',
        '- 第一行必须是一级标题，格式为：# 出发城市到目的城市 天数 天自驾路线方案',
        '- 必须包含：路线概览、城市顺序、每日安排、自驾建议、天气提示、注意事项',
        '- 每日安排要按 Day 1、Day 2 的形式写',
        '- 自驾建议要强调安全、休息、停车、补给和机动时间',
        '- 每个上午、下午、晚上安排都要写清楚：时间窗、建议停留时长、选择该地点的理由、从上一地点切换到本地点的方式/约耗时/约距离',
        '- 多城市自驾路线必须按“出发城市 -> 途经城市 -> 目的城市 -> 出发城市”设计，最后一段作为回程段单独说明',
        `- 最后一天晚上必须从${input.destinationCity}返回${input.departureCity}，默认${input.departureCity}就是家所在城市，并说明晚上到家`,
        '- 每天必须提供雨天、拥堵或体力不足时的备选方案，以及路况、停车、天气或驾驶风险提示',
        '- 内容要适合课程项目演示，表达自然，不要提到“mock”',
        '- 天气提示必须优先使用真实天气参考；如果缺少实时天气、路况或距离，请明确提醒出行前核对，不要编造实时信息',
        '- 自驾距离和时长只给近似规划参考，不要宣称实时导航、实时路况或精确价格',
        '',
        '## 结构化输出要求',
        getStructuredOutputInstructions('multi-city-drive-plan'),
        '',
        '## 行程结构参考',
        '请沿用闭环路线和最后一晚回程约束，具体地点与理由应结合用户输入规划：',
        buildFallbackPlanOutline(fallbackPlan),
      ].join('\n'),
    },
  ]
}

function buildOptimizePlanPrompt(
  originalRecord: Awaited<ReturnType<typeof getTravelRecordSnapshot>>,
  input: NormalizedOptimizePlanInput,
  fallbackPlan: OptimizePlanBuildResult,
) {
  const originalTitle =
    originalRecord.resultTitle ?? `${originalRecord.recordType} #${originalRecord.id}`
  const targetTitle = fallbackPlan.plan.title

  return [
    {
      role: 'system' as const,
      content:
        '你是一个中文旅行方案优化助手。请基于用户已有旅行方案和新增优化要求，生成一份更合适的优化版方案。不要覆盖原方案，不要编造实时价格、天气或景区一定开放的信息。',
    },
    {
      role: 'user' as const,
      content: [
        '请基于原历史记录生成优化版旅行方案。',
        '',
        '## 原方案信息',
        `历史记录 ID：${originalRecord.id}`,
        `原记录类型：${originalRecord.recordType}`,
        `原方案标题：${originalTitle}`,
        `原输入摘要：${originalRecord.inputSummary}`,
        `原天气信息：${originalRecord.weatherInfo ?? '未记录'}`,
        '',
        '## 优化要求',
        input.optimizeRequirement,
        '',
        '## 原方案全文',
        originalRecord.resultContent,
        '',
        '## 输出要求',
        `- 第一行必须是一级标题，且必须精确使用：# ${targetTitle}`,
        '- 如果原方案已经是优化版，本次标题必须继续递增为“优化版#2”“优化版#3”这类格式，不要重复生成普通“优化版”。',
        '- 必须包含：原方案来源、优化要求、优化摘要、调整后的重点安排、天气与风险提示、注意事项',
        '- 优化时尽量保留原方案已有城市、天数和主要结构，只针对用户要求进行调整',
        '- 如果原方案包含结构化回程安排，请保留并按优化要求微调；如果原方案没有，也要补充最后一天晚上回到出发城市的 returnTrip',
        '- 每个结构化安排都要尽量补齐选择理由、地点切换方式、约耗时、约距离、每日备选方案和风险提示',
        '- 内容要适合课程项目演示，表达自然，不要提到“mock”',
        '- 如果天气或开放信息不足，请提醒用户出行前核对，不要编造实时信息',
        '',
        '## 结构化输出要求',
        getStructuredOutputInstructions('optimized-plan'),
        '',
        '## 当前兜底方案参考',
        fallbackPlan.plan.content,
      ].join('\n'),
    },
  ]
}

function getSummaryFromLlmContent(content: string, fallbackSummary: string) {
  const firstParagraph = content
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('#'))

  return firstParagraph ?? fallbackSummary
}

async function buildCityPlanWithLlmFallback(
  input: NormalizedCityPlanInput,
  preference: PreferenceSnapshot | null,
  weatherSnapshot: WeatherSnapshot,
) {
  const fallbackPlan = buildMockCityPlan(input, preference, weatherSnapshot)
  const llmInfo = getPublicLlmInfo()

  if (!isLlmConfigured()) {
    return {
      ...fallbackPlan,
      generationMode: 'mock' as const,
      model: llmInfo.model,
    }
  }

  try {
    const plan = await generateCompletePlanWithRepair({
      messages: buildCityPlanPrompt(input, preference, fallbackPlan),
      fallbackPlan,
      temperature: 0.7,
    })

    return {
      ...fallbackPlan,
      plan,
      inputSummary: `${fallbackPlan.inputSummary}；生成方式：${llmInfo.model}`,
      generationMode: 'llm' as const,
      model: llmInfo.model,
    }
  } catch (error) {
    if (error instanceof LlmError) {
      console.warn(`[LLM fallback] ${error.message}`)
    } else {
      console.warn('[LLM fallback] 未知大模型调用错误')
    }

    return {
      ...fallbackPlan,
      inputSummary: `${fallbackPlan.inputSummary}；生成方式：mock fallback`,
      generationMode: 'mock-fallback' as const,
      model: llmInfo.model,
    }
  }
}

async function buildDrivePlanWithLlmFallback(
  input: NormalizedDrivePlanInput,
  preference: PreferenceSnapshot | null,
  weatherSnapshot: WeatherSnapshot,
) {
  const fallbackPlan = buildMockDrivePlan(input, preference, weatherSnapshot)
  const llmInfo = getPublicLlmInfo()

  if (!isLlmConfigured()) {
    return {
      ...fallbackPlan,
      generationMode: 'mock' as const,
      model: llmInfo.model,
    }
  }

  try {
    const plan = await generateCompletePlanWithRepair({
      messages: buildDrivePlanPrompt(input, preference, fallbackPlan),
      fallbackPlan,
      temperature: 0.7,
    })

    return {
      ...fallbackPlan,
      plan,
      inputSummary: `${fallbackPlan.inputSummary}；生成方式：${llmInfo.model}`,
      generationMode: 'llm' as const,
      model: llmInfo.model,
    }
  } catch (error) {
    if (error instanceof LlmError) {
      console.warn(`[LLM fallback] ${error.message}`)
    } else {
      console.warn('[LLM fallback] 未知大模型调用错误')
    }

    return {
      ...fallbackPlan,
      inputSummary: `${fallbackPlan.inputSummary}；生成方式：mock fallback`,
      generationMode: 'mock-fallback' as const,
      model: llmInfo.model,
    }
  }
}

function buildMockDrivePlan(
  input: NormalizedDrivePlanInput,
  preference: PreferenceSnapshot | null,
  weatherSnapshot: WeatherSnapshot,
) {
  const routeCities = [
    input.departureCity,
    ...input.waypointCities,
    input.destinationCity,
  ]
  const routeText = routeCities.join(' -> ')
  const fullRouteText = [...routeCities, input.departureCity].join(' -> ')
  const travelStyle = preference?.travelStyle ?? input.temporaryPreference ?? '轻松均衡'
  const transportMode = preference?.transportMode ?? '自驾'
  const driveMode = preference?.driveMode ?? '弹性自驾'
  const scenicPreference =
    preference?.scenicPreference ?? input.temporaryPreference ?? '综合体验'
  const companionType = preference?.companionType ?? '未指定同行人'
  const weatherMode = getPlanWeatherMode(input.weatherMode, preference)
  const startDateText = formatDateKey(getPlanStartDate(input.startDate, preference))
  const preferenceLabel = preference
    ? `偏好卡片「${preference.cardName}」`
    : '补充要求'
  const title = `${input.departureCity}到${input.destinationCity} ${input.travelDays} 天自驾路线方案`
  const summaryParts = [
    `本次自驾规划路线为：${fullRouteText}，最后一晚回到${input.departureCity}。`,
    `方案参考${preferenceLabel}，整体风格为${travelStyle}，交通方式为${transportMode}，驾驶模式为${driveMode}。`,
    `景点偏好侧重${scenicPreference}，同行类型为${companionType}。`,
  ]

  if (startDateText) {
    summaryParts.push(`出游起始日期为${startDateText}。`)
  }

  if (input.temporaryPreference) {
    summaryParts.push(`本次补充要求：${input.temporaryPreference}。`)
  }

  const summary = summaryParts.join('')
  const weatherInfo =
    weatherSnapshot.summary || getWeatherInfoFallback(weatherMode, true)
  const structuredContent = buildDriveStructuredItinerary(
    'multi-city-drive-plan',
    title,
    summary,
    routeCities,
    input.departureCity,
    driveMode,
    input.travelDays,
    [
      '长途驾驶请合理安排休息，避免疲劳驾驶，并提前确认目的地停车条件。',
      '自驾距离和时长均为规划参考，不代表实时导航。',
    ],
  )
  const content = [
    `# ${title}`,
    '',
    '## 路线概览',
    summary,
    '',
    '## 城市顺序',
    routeCities.map((city, index) => `${index + 1}. ${city}`).join('\n'),
    '',
    `完整闭环：${fullRouteText}`,
    '',
    '## 每日安排',
    renderStructuredDailySchedule(structuredContent),
    '',
    '## 自驾建议',
    `建议采用「${driveMode}」节奏推进，每天预留机动时间，优先保证驾驶安全和休息质量。`,
    `如果实际使用${transportMode}以外的方式，应在后续真实规划阶段重新计算交通耗时。`,
    '',
    '## 最后一晚回程安排',
    renderReturnTrip(structuredContent.returnTrip),
    '',
    '## 天气提示',
    weatherInfo,
    '',
    '## 备选与风险',
    '- 每天均保留雨天、拥堵和体力不足时的压缩方案，可在结构化行程中逐日查看。',
    '- 如天气、路况或距离不可用，方案只做安全提醒，不编造实时路况。',
    '',
    '## 注意事项',
    '- 每日驾驶强度可按实际体力、天气和路况继续调整。',
    '- 出发前请确认真实距离、驾驶时长、路况和停车建议。',
    '- 长途驾驶请合理安排休息，避免疲劳驾驶，并提前确认目的地停车条件。',
  ].join('\n')

  return {
    plan: {
      title,
      summary,
      content,
      structuredContent,
    },
    inputSummary: [
      `路线：${routeText}`,
      `旅行天数：${input.travelDays}`,
      ...(startDateText ? [`出游起始日期：${startDateText}`] : []),
      `偏好来源：${preferenceLabel}`,
      `偏好摘要：${scenicPreference}`,
      ...(input.temporaryPreference
        ? [`补充要求：${input.temporaryPreference}`]
        : []),
    ].join('；'),
    weatherInfo,
    weatherSnapshot,
    cardId: preference?.id ?? null,
  }
}

async function buildOptimizedPlanWithLlmFallback(
  originalRecord: Awaited<ReturnType<typeof getTravelRecordSnapshot>>,
  input: NormalizedOptimizePlanInput,
) {
  const fallbackPlan = buildMockOptimizedPlan(originalRecord, input)
  const llmInfo = getPublicLlmInfo()

  if (!isLlmConfigured()) {
    return {
      ...fallbackPlan,
      generationMode: 'mock' as const,
      model: llmInfo.model,
    }
  }

  try {
    const plan = forcePlanTitle(
      await generateCompletePlanWithRepair({
        messages: buildOptimizePlanPrompt(originalRecord, input, fallbackPlan),
        fallbackPlan,
        temperature: 0.65,
      }),
      fallbackPlan.plan.title,
    )

    return {
      ...fallbackPlan,
      plan,
      inputSummary: `${fallbackPlan.inputSummary}；生成方式：${llmInfo.model}`,
      generationMode: 'llm' as const,
      model: llmInfo.model,
    }
  } catch (error) {
    if (error instanceof LlmError) {
      console.warn(`[LLM fallback] ${error.message}`)
    } else {
      console.warn('[LLM fallback] 未知大模型调用错误')
    }

    return {
      ...fallbackPlan,
      inputSummary: `${fallbackPlan.inputSummary}；生成方式：mock fallback`,
      generationMode: 'mock-fallback' as const,
      model: llmInfo.model,
    }
  }
}

function buildMockOptimizedPlan(
  originalRecord: Awaited<ReturnType<typeof getTravelRecordSnapshot>>,
  input: NormalizedOptimizePlanInput,
) {
  const originalTitle =
    originalRecord.resultTitle ?? `${originalRecord.recordType} #${originalRecord.id}`
  const optimizedTitleInfo = getNextOptimizedPlanTitle(originalTitle)
  const title = optimizedTitleInfo.nextTitle
  const summary = [
    `基于历史记录 #${originalRecord.id}「${originalTitle}」进行优化。`,
    `本次优化重点：${input.optimizeRequirement}。`,
    '优化版会保留原方案结构，并围绕新的要求调整节奏与重点。',
  ].join('')
  const weatherInfo =
    originalRecord.weatherInfo ??
    '未记录天气信息；出行前建议补充核对最新天气。'
  const weatherSnapshot = parseWeatherSnapshotJson(originalRecord.weatherSnapshot)
  const content = [
    `# ${title}`,
    '',
    '## 原方案来源',
    `- 原历史记录 ID：${originalRecord.id}`,
    `- 原记录类型：${originalRecord.recordType}`,
    `- 原方案标题：${originalTitle}`,
    '',
    '## 优化要求',
    input.optimizeRequirement,
    '',
    '## 优化摘要',
    summary,
    '',
    '## 调整后的重点安排',
    '- 优先保留原方案中已经形成的城市、天数和主要路线结构，避免推倒重来。',
    `- 围绕「${input.optimizeRequirement}」调整每日节奏、交通切换和游玩强度。`,
    '- 对容易产生疲劳、排队或交通不确定性的安排增加缓冲时间。',
    '- 将餐饮、休息、天气变化和临时调整空间纳入方案说明。',
    '',
    '## 原方案内容参考',
    originalRecord.resultContent,
    '',
    '## 天气与风险提示',
    weatherInfo,
    '',
    '## 注意事项',
    '- 优化结果可继续根据实际出行日期、预算和同行人状态微调。',
    '- 如果新的要求涉及预算、开放时间或交通班次，出行前仍需再次核对。',
    '- 优化结果会作为新的历史记录保存，原始方案不会被覆盖。',
  ].join('\n')
  const originalStructured = parseStructuredItineraryJson(
    originalRecord.structuredContent,
  )
  const structuredContent = originalStructured
    ? {
        ...originalStructured,
        title,
        summary,
        recordType: 'optimized-plan',
        notes: [
          `本次优化重点：${input.optimizeRequirement}`,
          ...originalStructured.notes,
        ],
      }
    : buildMinimalStructuredItinerary('optimized-plan', title, summary, [
        `本次优化重点：${input.optimizeRequirement}`,
        '优化结果会作为新的历史记录保存，原始方案不会被覆盖。',
      ])

  return {
    plan: {
      title,
      summary,
      content,
      structuredContent,
    },
    inputSummary: [
      `原历史记录 ID：${originalRecord.id}`,
      `原记录类型：${originalRecord.recordType}`,
      ...(optimizedTitleInfo.version > 1
        ? [`优化版本：#${optimizedTitleInfo.version}`]
        : []),
      `优化要求：${input.optimizeRequirement}`,
    ].join('；'),
    weatherInfo,
    weatherSnapshot,
    cardId: originalRecord.cardId,
  }
}

function getCityPlanWeatherDays(
  input: NormalizedCityPlanInput,
  preference: PreferenceSnapshot | null,
) {
  return input.travelDays ?? preference?.travelDays ?? 1
}

function getCityPlanWeatherSnapshot(
  input: NormalizedCityPlanInput,
  preference: PreferenceSnapshot | null,
) {
  return buildWeatherSnapshot({
    cities: [input.targetCity],
    startDate: getPlanStartDate(input.startDate, preference),
    days: getCityPlanWeatherDays(input, preference),
    weatherMode: getPlanWeatherMode(input.weatherMode, preference),
  })
}

function getDrivePlanWeatherSnapshot(
  input: NormalizedDrivePlanInput,
  preference: PreferenceSnapshot | null,
) {
  return buildWeatherSnapshot({
    cities: [
      input.departureCity,
      ...input.waypointCities,
      input.destinationCity,
    ],
    startDate: getPlanStartDate(input.startDate, preference),
    days: input.travelDays,
    weatherMode: getPlanWeatherMode(input.weatherMode, preference),
  })
}

export async function generateCityPlan(userId: number, input: unknown) {
  const normalizedInput = normalizeCityPlanInput(input)
  const preference = normalizedInput.cardId
    ? await getPreferenceSnapshot(userId, normalizedInput.cardId)
    : null
  const weatherSnapshot = await getCityPlanWeatherSnapshot(
    normalizedInput,
    preference,
  )
  const planResult = await buildCityPlanWithLlmFallback(
    normalizedInput,
    preference,
    weatherSnapshot,
  )
  const structuredContent = await enrichStructuredItineraryMapPoints(
    planResult.plan.structuredContent,
  )

  const record = await prisma.travelRecord.create({
    data: {
      userId,
      cardId: planResult.cardId,
      recordType: 'single-city-plan',
      inputSummary: planResult.inputSummary,
      resultTitle: planResult.plan.title,
      resultContent: planResult.plan.content,
      structuredContent: serializeStructuredItinerary(structuredContent),
      weatherInfo: planResult.weatherInfo,
      weatherSnapshot: serializeWeatherSnapshot(planResult.weatherSnapshot),
    },
  })

  return {
    plan: {
      ...planResult.plan,
      structuredContent,
      weatherSnapshot: planResult.weatherSnapshot,
    },
    record,
    generationMode: planResult.generationMode,
    model: planResult.model,
  }
}

export async function optimizePlan(userId: number, input: unknown) {
  const normalizedInput = normalizeOptimizePlanInput(input)
  const originalRecord = await getTravelRecordSnapshot(
    userId,
    normalizedInput.recordId,
  )
  const planResult = await buildOptimizedPlanWithLlmFallback(
    originalRecord,
    normalizedInput,
  )
  const structuredContent = await enrichStructuredItineraryMapPoints(
    planResult.plan.structuredContent,
  )

  const record = await prisma.travelRecord.create({
    data: {
      userId,
      cardId: planResult.cardId,
      recordType: 'optimized-plan',
      inputSummary: planResult.inputSummary,
      resultTitle: planResult.plan.title,
      resultContent: planResult.plan.content,
      structuredContent: serializeStructuredItinerary(structuredContent),
      weatherInfo: planResult.weatherInfo,
      weatherSnapshot: planResult.weatherSnapshot
        ? serializeWeatherSnapshot(planResult.weatherSnapshot)
        : null,
    },
  })

  return {
    plan: {
      ...planResult.plan,
      structuredContent,
      weatherSnapshot: planResult.weatherSnapshot,
    },
    record,
    generationMode: planResult.generationMode,
    model: planResult.model,
  }
}

export async function generateDrivePlan(userId: number, input: unknown) {
  const normalizedInput = normalizeDrivePlanInput(input)
  const preference = normalizedInput.cardId
    ? await getPreferenceSnapshot(userId, normalizedInput.cardId)
    : null
  const weatherSnapshot = await getDrivePlanWeatherSnapshot(
    normalizedInput,
    preference,
  )
  const planResult = await buildDrivePlanWithLlmFallback(
    normalizedInput,
    preference,
    weatherSnapshot,
  )
  const structuredContent = await enrichStructuredItineraryMapPoints(
    planResult.plan.structuredContent,
  )

  const record = await prisma.travelRecord.create({
    data: {
      userId,
      cardId: planResult.cardId,
      recordType: 'multi-city-drive-plan',
      inputSummary: planResult.inputSummary,
      resultTitle: planResult.plan.title,
      resultContent: planResult.plan.content,
      structuredContent: serializeStructuredItinerary(structuredContent),
      weatherInfo: planResult.weatherInfo,
      weatherSnapshot: serializeWeatherSnapshot(planResult.weatherSnapshot),
    },
  })

  return {
    plan: {
      ...planResult.plan,
      structuredContent,
      weatherSnapshot: planResult.weatherSnapshot,
    },
    record,
    generationMode: planResult.generationMode,
    model: planResult.model,
  }
}
