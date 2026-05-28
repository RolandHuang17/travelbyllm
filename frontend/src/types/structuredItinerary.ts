export type GeocodeStatus = 'pending' | 'success' | 'failed' | 'skipped'

export type StructuredDataSource = 'user' | 'amap' | 'weather' | 'llm_advice'

export type StructuredVerification = {
  source: StructuredDataSource
  verified: boolean
}

export type StructuredItineraryTransition = {
  fromPlaceName: string | null
  toPlaceName: string | null
  transportMode: string | null
  durationText: string | null
  distanceText: string | null
  note: string | null
}

export type StructuredItineraryItem = {
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

export type StructuredItineraryTimelineItem = StructuredItineraryItem &
  StructuredVerification

export type StructuredItineraryTransportCard = StructuredVerification & {
  title: string
  mode: string | null
  route: string
  departureText: string | null
  arrivalText: string | null
  durationText: string | null
  distanceText: string | null
  reason: string
}

export type StructuredItineraryPlaceCard = StructuredVerification & {
  name: string
  city: string | null
  addressHint: string | null
  description: string
  durationText: string | null
  visitTips: string[]
}

export type StructuredItineraryLodgingAdvice = StructuredVerification & {
  area: string
  reason: string
}

export type StructuredItineraryDay = {
  day: number
  title: string
  city: string | null
  items: StructuredItineraryItem[]
  strategy: string
  timelineItems: StructuredItineraryTimelineItem[]
  transportCards: StructuredItineraryTransportCard[]
  placeCards: StructuredItineraryPlaceCard[]
  lodgingAreaAdvice: StructuredItineraryLodgingAdvice[]
  alternatives: string[]
  riskNotes: string[]
}

export type StructuredItineraryMapPoint = {
  day: number
  order: number
  name: string
  city: string | null
  addressHint: string | null
  longitude: number | null
  latitude: number | null
  geocodeStatus: GeocodeStatus
  source: StructuredDataSource
  verified: boolean
  formattedAddress: string | null
}

export type StructuredItineraryOverview = {
  routeSummary: string
  pace: string
  bestFor: string[]
  highlights: string[]
  dataBasis: string[]
}

export type StructuredItinerarySupplement = StructuredVerification & {
  title: string
  items: string[]
}

export type StructuredItineraryDataQualityNote = StructuredVerification & {
  label: string
  detail: string
}

export type StructuredItinerary = {
  version: 1 | 2 | 3
  title: string
  summary: string
  recordType: string
  overview: StructuredItineraryOverview
  days: StructuredItineraryDay[]
  mapPoints: StructuredItineraryMapPoint[]
  verifiedMapPoints: StructuredItineraryMapPoint[]
  notes: string[]
  supplements: StructuredItinerarySupplement[]
  dataQualityNotes: StructuredItineraryDataQualityNote[]
  returnTrip: StructuredItineraryReturnTrip | null
}

export type StructuredItineraryReturnTrip = {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function scrubSupplierFacts(text: string) {
  return text
    .replace(/\b[CGDZTKS]\d{1,5}\s*次?\b/gi, '班次待核对')
    .replace(/\b[A-Z]{2}\d{3,4}\b/g, '班次待核对')
    .replace(
      /(?:¥|￥|RMB|人民币)\s*\d+(?:\.\d+)?(?:\s*元)?(?:\s*\/?\s*(?:人|晚|间|张|起))?/gi,
      '价格待核对',
    )
    .replace(
      /\d+(?:\.\d+)?\s*元(?:\s*\/?\s*(?:人|晚|间|张|起|左右))?/g,
      '价格待核对',
    )
    .replace(/(?:评分|得分)\s*[:：]?\s*\d(?:\.\d)?\s*分?/g, '评分待核对')
    .replace(/\d(?:\.\d)?\s*分(?!钟)(?:好评|评分)?/g, '评分待核对')
    .replace(
      /(?:营业中|暂停营业|今日开放|当前开放|目前开放|开放中|闭馆中|已闭馆|正在营业)/g,
      '营业状态待核对',
    )
}

function scrubLodgingNames(text: string) {
  return text.replace(
    /[\u4e00-\u9fa5A-Za-z0-9·（）() -]{2,28}(?:酒店|宾馆|民宿|客栈|度假村)/g,
    (match, offset: number, fullText: string) => {
      const tail = fullText.slice(offset + match.length, offset + match.length + 4)

      if (/名|供应商|接口|数据/.test(tail) || /具体酒店$/.test(match)) {
        return match
      }

      return '住宿建议待核对'
    },
  )
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function readSafeString(value: unknown) {
  return scrubLodgingNames(scrubSupplierFacts(readString(value)))
}

function readOptionalString(value: unknown) {
  const text = readSafeString(value)

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
    ? value.map(readSafeString).filter(Boolean)
    : []
}

function readGeocodeStatus(value: unknown): GeocodeStatus {
  const status = readString(value)

  return status === 'success' ||
    status === 'failed' ||
    status === 'skipped' ||
    status === 'pending'
    ? status
    : 'pending'
}

function readDataSource(value: unknown): StructuredDataSource {
  const source = readString(value)

  return source === 'user' ||
    source === 'amap' ||
    source === 'weather' ||
    source === 'llm_advice'
    ? source
    : 'llm_advice'
}

function readVerification(
  value: Record<string, unknown>,
  fallbackSource: StructuredDataSource = 'llm_advice',
): StructuredVerification {
  const source = readDataSource(value.source ?? fallbackSource)

  return {
    source,
    verified:
      typeof value.verified === 'boolean'
        ? value.verified
        : source === 'user' || source === 'weather' || source === 'amap',
  }
}

function readAdviceVerification(
  value: Record<string, unknown>,
): StructuredVerification {
  const source = readDataSource(value.source)

  return source === 'user'
    ? { source, verified: true }
    : { source: 'llm_advice', verified: false }
}

function defaultOverview(title: string, summary: string): StructuredItineraryOverview {
  return {
    routeSummary: summary || title,
    pace: '轻松均衡',
    bestFor: ['希望获得可执行行程的旅行者'],
    highlights: title ? [title] : [],
    dataBasis: [
      '用户输入与偏好',
      '天气和地图数据仅在服务返回真实结果时作为事实展示',
      '未接入供应商接口的数据需要出行前核对',
    ],
  }
}

function defaultDataQualityNotes(): StructuredItineraryDataQualityNote[] {
  return [
    {
      source: 'llm_advice',
      verified: false,
      label: '数据边界',
      detail:
        '车次、票价、酒店名、评分、营业状态和门票价格未接入真实供应商时不会作为事实展示。',
    },
    {
      source: 'llm_advice',
      verified: false,
      label: '规划建议',
      detail: '游玩顺序、停留时长和交通衔接为规划建议，出行前仍需核对实时信息。',
    },
  ]
}

function isLikelySpecificLodgingName(value: string | null | undefined) {
  if (!value) {
    return false
  }

  if (/酒店名|酒店供应商|酒店接口|住宿区域|住宿建议/.test(value)) {
    return false
  }

  return /(酒店|宾馆|民宿|客栈|度假村)/.test(value)
}

function readTransition(value: unknown): StructuredItineraryTransition | null {
  if (!isRecord(value)) {
    return null
  }

  const transition = {
    fromPlaceName: readOptionalString(value.fromPlaceName),
    toPlaceName: readOptionalString(value.toPlaceName),
    transportMode:
      readOptionalString(value.transportMode) ??
      readOptionalString(value.transport),
    durationText: readOptionalString(value.durationText),
    distanceText: readOptionalString(value.distanceText),
    note: readOptionalString(value.note),
  }

  return Object.values(transition).some(Boolean) ? transition : null
}

function readReturnTrip(value: unknown): StructuredItineraryReturnTrip | null {
  if (!isRecord(value)) {
    return null
  }

  const description = readSafeString(value.description)

  return {
    fromCity: readOptionalString(value.fromCity),
    toCity: readOptionalString(value.toCity),
    departureTime: readOptionalString(value.departureTime),
    arrivalTime: readOptionalString(value.arrivalTime),
    transportMode: readOptionalString(value.transportMode),
    durationText: readOptionalString(value.durationText),
    distanceText: readOptionalString(value.distanceText),
    description: description || '最后一天晚上返回出发城市，到家后结束行程。',
    note: readOptionalString(value.note),
  }
}

function readItem(value: unknown): StructuredItineraryItem | null {
  if (!isRecord(value)) {
    return null
  }

  const title =
    readSafeString(value.title) ||
    readSafeString(value.placeName) ||
    '未命名安排'
  const rawPlaceName = readString(value.placeName)

  return {
    timeOfDay: readOptionalString(value.timeOfDay),
    timeWindow: readOptionalString(value.timeWindow),
    durationText: readOptionalString(value.durationText),
    title,
    description: readSafeString(value.description) || title,
    reason: readOptionalString(value.reason),
    placeName: isLikelySpecificLodgingName(rawPlaceName)
      ? null
      : readOptionalString(value.placeName),
    city: readOptionalString(value.city),
    addressHint: readOptionalString(value.addressHint),
    transport: readOptionalString(value.transport),
    transition: readTransition(value.transition),
  }
}

function timelineFromItems(
  items: StructuredItineraryItem[],
): StructuredItineraryTimelineItem[] {
  return items.map((item) => ({
    ...item,
    source: 'llm_advice',
    verified: false,
  }))
}

function readTimelineItems(
  value: unknown,
  fallbackItems: StructuredItineraryItem[],
): StructuredItineraryTimelineItem[] {
  if (!Array.isArray(value)) {
    return timelineFromItems(fallbackItems)
  }

  const items = value
    .map((itemValue) => {
      const item = readItem(itemValue)

      if (!item || !isRecord(itemValue)) {
        return null
      }

      return {
        ...item,
        ...readAdviceVerification(itemValue),
      } satisfies StructuredItineraryTimelineItem
    })
    .filter((item): item is StructuredItineraryTimelineItem => Boolean(item))

  return items.length ? items : timelineFromItems(fallbackItems)
}

function transportCardsFromItems(
  items: StructuredItineraryItem[],
): StructuredItineraryTransportCard[] {
  return items
    .map((item) => {
      if (!item.transition) {
        return null
      }

      const card: StructuredItineraryTransportCard = {
        source: 'llm_advice',
        verified: false,
        title: `${item.transition.fromPlaceName || '上一地点'} -> ${
          item.transition.toPlaceName || item.placeName || item.title
        }`,
        mode: item.transition.transportMode ?? item.transport,
        route: `${item.transition.fromPlaceName || '上一地点'} -> ${
          item.transition.toPlaceName || item.placeName || item.title
        }`,
        departureText: item.transition.fromPlaceName,
        arrivalText: item.transition.toPlaceName ?? item.placeName ?? item.title,
        durationText: item.transition.durationText,
        distanceText: item.transition.distanceText,
        reason:
          item.reason ||
          item.transition.note ||
          '根据当天地点顺序给出的交通衔接建议，出行前请核对实际路线。',
      }

      return card
    })
    .filter((card): card is StructuredItineraryTransportCard => Boolean(card))
}

function readTransportCards(
  value: unknown,
  fallbackItems: StructuredItineraryItem[],
): StructuredItineraryTransportCard[] {
  if (!Array.isArray(value)) {
    return transportCardsFromItems(fallbackItems)
  }

  const cards = value
    .map((cardValue) => {
      if (!isRecord(cardValue)) {
        return null
      }

      const route = readSafeString(cardValue.route)
      const reason = readSafeString(cardValue.reason)

      if (!route && !reason) {
        return null
      }

      return {
        ...readAdviceVerification(cardValue),
        title: readSafeString(cardValue.title) || '交通切换建议',
        mode: readOptionalString(cardValue.mode),
        route: route || '按当天实际位置衔接',
        departureText: readOptionalString(cardValue.departureText),
        arrivalText: readOptionalString(cardValue.arrivalText),
        durationText: readOptionalString(cardValue.durationText),
        distanceText: readOptionalString(cardValue.distanceText),
        reason: reason || '作为规划建议展示，出行前请核对实际交通。',
      } satisfies StructuredItineraryTransportCard
    })
    .filter((card): card is StructuredItineraryTransportCard => Boolean(card))

  return cards.length ? cards : transportCardsFromItems(fallbackItems)
}

function placeCardsFromItems(
  items: StructuredItineraryItem[],
): StructuredItineraryPlaceCard[] {
  return items
    .map((item) => {
      const name = item.placeName ?? item.title

      if (!name || /住宿建议待核对|未命名安排/.test(name)) {
        return null
      }

      const card: StructuredItineraryPlaceCard = {
        source: 'llm_advice',
        verified: false,
        name,
        city: item.city,
        addressHint: item.addressHint,
        description: item.description,
        durationText: item.durationText,
        visitTips: item.reason ? [item.reason] : [],
      }

      return card
    })
    .filter((card): card is StructuredItineraryPlaceCard => Boolean(card))
}

function readPlaceCards(
  value: unknown,
  fallbackItems: StructuredItineraryItem[],
): StructuredItineraryPlaceCard[] {
  if (!Array.isArray(value)) {
    return placeCardsFromItems(fallbackItems)
  }

  const cards = value
    .map((cardValue) => {
      if (!isRecord(cardValue)) {
        return null
      }

      const rawName = readString(cardValue.name)
      const name = readSafeString(cardValue.name)

      if (!name || isLikelySpecificLodgingName(rawName)) {
        return null
      }

      return {
        ...readAdviceVerification(cardValue),
        name,
        city: readOptionalString(cardValue.city),
        addressHint: readOptionalString(cardValue.addressHint),
        description:
          readSafeString(cardValue.description) ||
          `${name}可作为当天行程中的候选地点。`,
        durationText: readOptionalString(cardValue.durationText),
        visitTips: readStringList(cardValue.visitTips),
      } satisfies StructuredItineraryPlaceCard
    })
    .filter((card): card is StructuredItineraryPlaceCard => Boolean(card))

  return cards.length ? cards : placeCardsFromItems(fallbackItems)
}

function readLodgingAdvice(
  value: unknown,
  city: string | null,
): StructuredItineraryLodgingAdvice[] {
  if (!Array.isArray(value)) {
    return [
      {
        source: 'llm_advice',
        verified: false,
        area: `${city || '当天目的地'}交通便利区域`,
        reason: '建议选择便于次日出发、就餐和返程衔接的住宿区域。',
      },
    ]
  }

  const advice = value
    .map((adviceValue) => {
      if (!isRecord(adviceValue)) {
        return null
      }

      const rawArea = readString(adviceValue.area)
      const area = readSafeString(adviceValue.area)
      const reason = readSafeString(adviceValue.reason)

      if (!area && !reason) {
        return null
      }

      return {
        ...readAdviceVerification(adviceValue),
        area: isLikelySpecificLodgingName(rawArea)
          ? '交通便利区域'
          : area || '交通便利区域',
        reason: reason || '住宿区域建议仅供规划参考，预订前请自行核对。',
      } satisfies StructuredItineraryLodgingAdvice
    })
    .filter(
      (item): item is StructuredItineraryLodgingAdvice => Boolean(item),
    )

  return advice.length
    ? advice
    : readLodgingAdvice(null, city)
}

function readMapPoints(value: unknown): StructuredItineraryMapPoint[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((pointValue, index) => {
      if (!isRecord(pointValue)) {
        return null
      }

      const rawName =
        readString(pointValue.name) ||
        readString(pointValue.placeName) ||
        readString(pointValue.title)
      const name = scrubSupplierFacts(rawName)

      if (!name || isLikelySpecificLodgingName(rawName)) {
        return null
      }

      const longitude = readNullableNumber(pointValue.longitude)
      const latitude = readNullableNumber(pointValue.latitude)
      const geocodeStatus = readGeocodeStatus(pointValue.geocodeStatus)
      const hasSuccessfulCoordinate =
        longitude !== null && latitude !== null && geocodeStatus === 'success'
      const source = hasSuccessfulCoordinate
        ? readDataSource(pointValue.source || 'amap')
        : readDataSource(pointValue.source)
      const verified =
        source === 'amap' &&
        hasSuccessfulCoordinate &&
        (pointValue.verified === true || pointValue.verified === undefined)
      const formattedAddress =
        readOptionalString(pointValue.formattedAddress) ||
        (verified
          ? readOptionalString(pointValue.addressHint) ||
            readOptionalString(pointValue.city)
          : null)

      return {
        day: readPositiveInteger(pointValue.day, 1),
        order: readPositiveInteger(pointValue.order, index + 1),
        name,
        city: readOptionalString(pointValue.city),
        addressHint: readOptionalString(pointValue.addressHint),
        longitude,
        latitude,
        geocodeStatus,
        source,
        verified,
        formattedAddress: verified ? formattedAddress : null,
      } satisfies StructuredItineraryMapPoint
    })
    .filter((point): point is StructuredItineraryMapPoint => Boolean(point))
}

function readOverview(
  value: unknown,
  fallback: StructuredItineraryOverview,
): StructuredItineraryOverview {
  if (!isRecord(value)) {
    return fallback
  }

  const bestFor = readStringList(value.bestFor)
  const highlights = readStringList(value.highlights)
  const dataBasis = readStringList(value.dataBasis)

  return {
    routeSummary: readSafeString(value.routeSummary) || fallback.routeSummary,
    pace: readSafeString(value.pace) || fallback.pace,
    bestFor: bestFor.length ? bestFor : fallback.bestFor,
    highlights: highlights.length ? highlights : fallback.highlights,
    dataBasis: dataBasis.length ? dataBasis : fallback.dataBasis,
  }
}

function readSupplements(value: unknown): StructuredItinerarySupplement[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((supplementValue) => {
      if (!isRecord(supplementValue)) {
        return null
      }

      const title = readSafeString(supplementValue.title)
      const items = readStringList(supplementValue.items)

      if (!title || !items.length) {
        return null
      }

      return {
        ...readAdviceVerification(supplementValue),
        title,
        items,
      } satisfies StructuredItinerarySupplement
    })
    .filter((item): item is StructuredItinerarySupplement => Boolean(item))
}

function readDataQualityNotes(
  value: unknown,
): StructuredItineraryDataQualityNote[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((noteValue) => {
      if (!isRecord(noteValue)) {
        return null
      }

      const label = readSafeString(noteValue.label)
      const detail = readSafeString(noteValue.detail)

      if (!label || !detail) {
        return null
      }

      return {
        ...readVerification(noteValue),
        label,
        detail,
      } satisfies StructuredItineraryDataQualityNote
    })
    .filter((item): item is StructuredItineraryDataQualityNote => Boolean(item))
}

function readDay(value: unknown, index: number): StructuredItineraryDay | null {
  if (!isRecord(value)) {
    return null
  }

  const day = readPositiveInteger(value.day, index + 1)
  const items = Array.isArray(value.items)
    ? value
        .items
        .map(readItem)
        .filter((item): item is StructuredItineraryItem => Boolean(item))
    : []
  const city = readOptionalString(value.city)
  const strategy =
    readSafeString(value.strategy) ||
    `围绕第 ${day} 天核心地点安排顺路、低风险且可调整的游玩节奏。`

  return {
    day,
    title: readSafeString(value.title) || `Day ${day}`,
    city,
    items,
    strategy,
    timelineItems: readTimelineItems(value.timelineItems, items),
    transportCards: readTransportCards(value.transportCards, items),
    placeCards: readPlaceCards(value.placeCards, items),
    lodgingAreaAdvice: readLodgingAdvice(value.lodgingAreaAdvice, city),
    alternatives: readStringList(value.alternatives),
    riskNotes: readStringList(value.riskNotes),
  }
}

export function parseStructuredItinerary(
  value: string | StructuredItinerary | null | undefined,
): StructuredItinerary | null {
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

  const title = readSafeString(parsedValue.title) || '未命名行程'
  const summary = readSafeString(parsedValue.summary)
  const fallbackOverview = defaultOverview(title, summary)
  const days = Array.isArray(parsedValue.days)
    ? parsedValue.days
        .map(readDay)
        .filter((day): day is StructuredItineraryDay => Boolean(day))
    : []
  const mapPoints = readMapPoints(parsedValue.mapPoints)
  const verifiedMapPoints = readMapPoints(parsedValue.verifiedMapPoints)
    .concat(mapPoints)
    .filter((point) => point.verified)
  const version = readPositiveInteger(parsedValue.version, 3)

  return {
    version: version === 1 || version === 2 ? version : 3,
    title,
    summary,
    recordType: readSafeString(parsedValue.recordType) || 'unknown',
    overview: readOverview(parsedValue.overview, fallbackOverview),
    days,
    mapPoints,
    verifiedMapPoints,
    notes: readStringList(parsedValue.notes),
    supplements: readSupplements(parsedValue.supplements),
    dataQualityNotes: readDataQualityNotes(parsedValue.dataQualityNotes)
      .concat(defaultDataQualityNotes())
      .filter(
        (note, index, notes) =>
          notes.findIndex((item) => item.label === note.label) === index,
      ),
    returnTrip: readReturnTrip(parsedValue.returnTrip),
  }
}
