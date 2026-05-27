export type GeocodeStatus = 'pending' | 'success' | 'failed' | 'skipped'

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

export type StructuredItineraryDay = {
  day: number
  title: string
  city: string | null
  items: StructuredItineraryItem[]
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

function readNotes(value: unknown) {
  return Array.isArray(value)
    ? value.map(readString).filter(Boolean)
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

function readReturnTrip(
  value: unknown,
): StructuredItineraryReturnTrip | null {
  if (!isRecord(value)) {
    return null
  }

  const description = readString(value.description)

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

  const days = Array.isArray(parsedValue.days)
    ? parsedValue.days
        .map((dayValue, index) => {
          if (!isRecord(dayValue)) {
            return null
          }

          const day = readPositiveInteger(dayValue.day, index + 1)
          const items = Array.isArray(dayValue.items)
            ? dayValue.items
                .map((itemValue) => {
                  if (!isRecord(itemValue)) {
                    return null
                  }

                  const title =
                    readString(itemValue.title) ||
                    readString(itemValue.placeName) ||
                    '未命名安排'

                  return {
                    timeOfDay: readOptionalString(itemValue.timeOfDay),
                    timeWindow: readOptionalString(itemValue.timeWindow),
                    durationText: readOptionalString(itemValue.durationText),
                    title,
                    description: readString(itemValue.description) || title,
                    reason: readOptionalString(itemValue.reason),
                    placeName: readOptionalString(itemValue.placeName),
                    city: readOptionalString(itemValue.city),
                    addressHint: readOptionalString(itemValue.addressHint),
                    transport: readOptionalString(itemValue.transport),
                    transition: readTransition(itemValue.transition),
                  } satisfies StructuredItineraryItem
                })
                .filter((item): item is StructuredItineraryItem =>
                  Boolean(item),
                )
            : []

          return {
            day,
            title: readString(dayValue.title) || `Day ${day}`,
            city: readOptionalString(dayValue.city),
            items,
            alternatives: readNotes(dayValue.alternatives),
            riskNotes: readNotes(dayValue.riskNotes),
          } satisfies StructuredItineraryDay
        })
        .filter((day): day is StructuredItineraryDay => Boolean(day))
    : []

  const mapPoints = Array.isArray(parsedValue.mapPoints)
    ? parsedValue.mapPoints
        .map((pointValue, index) => {
          if (!isRecord(pointValue)) {
            return null
          }

          const name = readString(pointValue.name)

          if (!name) {
            return null
          }

          return {
            day: readPositiveInteger(pointValue.day, 1),
            order: readPositiveInteger(pointValue.order, index + 1),
            name,
            city: readOptionalString(pointValue.city),
            addressHint: readOptionalString(pointValue.addressHint),
            longitude: readNullableNumber(pointValue.longitude),
            latitude: readNullableNumber(pointValue.latitude),
            geocodeStatus: readGeocodeStatus(pointValue.geocodeStatus),
          } satisfies StructuredItineraryMapPoint
        })
        .filter((point): point is StructuredItineraryMapPoint =>
          Boolean(point),
        )
    : []

  return {
    version: readPositiveInteger(parsedValue.version, 1) === 1 ? 1 : 2,
    title: readString(parsedValue.title) || '未命名行程',
    summary: readString(parsedValue.summary),
    recordType: readString(parsedValue.recordType) || 'unknown',
    days,
    mapPoints,
    notes: readNotes(parsedValue.notes),
    returnTrip: readReturnTrip(parsedValue.returnTrip),
  }
}
