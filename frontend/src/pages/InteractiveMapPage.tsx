import {
  Bookmark,
  BookmarkCheck,
  Bike,
  Car,
  ChevronDown,
  LocateFixed,
  MapPin,
  MoveRight,
  Navigation,
  RefreshCcw,
  Route,
  Search,
  Star,
  Trash2,
  TrainFront,
  X,
  Footprints,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createFavoritePlace,
  deleteFavoritePlace,
  fetchFavoritePlaces,
  MapApiError,
  updateFavoritePlace,
  type FavoritePlace,
  type FavoritePlaceCategory,
  type FavoritePlaceInput,
  type MapCoordinate,
} from '../api/map'
import {
  loadAmap,
  readLngLat,
  toAmapCoordinateTuple,
  type AMapMapInstance,
  type AMapNamespace,
  type AMapOverlay,
} from '../utils/amap'

type InteractiveMapPageProps = {
  token: string
  onAuthExpired: () => void
}

type MapPlaceSource = 'search' | 'favorite' | 'picked' | 'current'

type MapPlace = {
  amapPoiId: string | null
  name: string
  address: string
  cityName: string | null
  district: string | null
  location: MapCoordinate
  source: MapPlaceSource
}

type PlaceSuggestion = {
  id: string
  name: string
  district: string
}

type FavoriteDraft = {
  category: FavoritePlaceCategory
  note: string
}

type PanelTab = 'search' | 'route' | 'favorites'
type RouteMode = 'driving' | 'walking' | 'riding' | 'transit'
type RoutePointTarget = 'origin' | 'destination'
type RouteStepMode =
  | 'drive'
  | 'walk'
  | 'ride'
  | 'bus'
  | 'subway'
  | 'rail'
  | 'taxi'
  | 'transfer'
  | 'other'

type RouteStep = {
  mode: RouteStepMode
  title: string
  distance: number | null
  duration: number | null
}

type RouteSummary = {
  mode: RouteMode
  distance: number | null
  duration: number | null
  steps: RouteStep[]
}

type RouteRenderer = {
  clear?: () => void
}

const FAVORITE_CATEGORIES: FavoritePlaceCategory[] = [
  '景点',
  '美食',
  '住宿',
  '交通',
  '购物',
  '其他',
]

const NEARBY_KEYWORDS: Array<{
  label: string
  keyword: string
  category: FavoritePlaceCategory
}> = [
  { label: '景点', keyword: '景点', category: '景点' },
  { label: '美食', keyword: '餐厅 美食', category: '美食' },
  { label: '住宿', keyword: '酒店', category: '住宿' },
  { label: '交通', keyword: '地铁站 停车场', category: '交通' },
  { label: '购物', keyword: '商场', category: '购物' },
]

const ROUTE_MODE_OPTIONS: Array<{
  value: RouteMode
  label: string
}> = [
  { value: 'driving', label: '驾车' },
  { value: 'walking', label: '步行' },
  { value: 'riding', label: '骑行' },
  { value: 'transit', label: '公交' },
]

const ROUTE_POINT_LABELS: Record<RoutePointTarget, string> = {
  origin: '起点',
  destination: '终点',
}

const MAP_PLUGINS = [
  'AMap.Scale',
  'AMap.ToolBar',
  'AMap.Geolocation',
  'AMap.AutoComplete',
  'AMap.PlaceSearch',
  'AMap.Geocoder',
  'AMap.Driving',
  'AMap.Walking',
  'AMap.Riding',
  'AMap.Transfer',
]

function isAuthExpiredError(error: unknown) {
  return error instanceof MapApiError && error.statusCode === 401
}

function getErrorMessage(error: unknown, fallbackMessage = '操作失败，请稍后重试') {
  return error instanceof Error ? error.message : fallbackMessage
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function readString(value: unknown) {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
      .join(' ')
  }

  return ''
}

function readNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const numberValue = Number(value)

    return Number.isFinite(numberValue) ? numberValue : null
  }

  return null
}

function readArray(value: unknown) {
  return Array.isArray(value) ? value : []
}

function readRecordProperty(value: unknown, propertyName: string) {
  if (!isRecord(value)) {
    return undefined
  }

  return value[propertyName]
}

function formatCoordinateLabel(location: MapCoordinate) {
  return `${location.longitude.toFixed(6)}, ${location.latitude.toFixed(6)}`
}

function isSameCoordinate(
  firstLocation: MapCoordinate,
  secondLocation: MapCoordinate,
) {
  return (
    Math.abs(firstLocation.longitude - secondLocation.longitude) < 0.000001 &&
    Math.abs(firstLocation.latitude - secondLocation.latitude) < 0.000001
  )
}

function buildPlaceKey(place: Pick<MapPlace, 'amapPoiId' | 'location'>) {
  if (place.amapPoiId) {
    return `poi:${place.amapPoiId}`
  }

  return `coordinate:${place.location.longitude.toFixed(6)},${place.location.latitude.toFixed(6)}`
}

function buildFavoritePlaceKey(favoritePlace: FavoritePlace) {
  return favoritePlace.placeKey
}

function isSamePlace(firstPlace: MapPlace, secondPlace: MapPlace) {
  return (
    buildPlaceKey(firstPlace) === buildPlaceKey(secondPlace) ||
    isSameCoordinate(firstPlace.location, secondPlace.location)
  )
}

function favoriteToPlace(favoritePlace: FavoritePlace): MapPlace {
  return {
    amapPoiId: favoritePlace.amapPoiId,
    name: favoritePlace.name,
    address: favoritePlace.address,
    cityName: favoritePlace.cityName,
    district: favoritePlace.district,
    location: {
      longitude: favoritePlace.longitude,
      latitude: favoritePlace.latitude,
    },
    source: 'favorite',
  }
}

function placeToFavoriteInput(
  place: MapPlace,
  category: FavoritePlaceCategory,
  note: string,
): FavoritePlaceInput {
  return {
    amapPoiId: place.amapPoiId,
    name: place.name,
    address: place.address,
    cityName: place.cityName,
    district: place.district,
    longitude: place.location.longitude,
    latitude: place.location.latitude,
    category,
    note: note.trim() || null,
  }
}

function formatDistance(meters: number | null) {
  if (!meters || meters <= 0) {
    return '未知距离'
  }

  if (meters >= 1000) {
    const kilometers = meters / 1000

    return kilometers >= 100
      ? `${Math.round(kilometers)} km`
      : `${kilometers.toFixed(1)} km`
  }

  return `${Math.round(meters)} m`
}

function formatDuration(seconds: number | null) {
  if (!seconds || seconds <= 0) {
    return '未知用时'
  }

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round((seconds % 3600) / 60)

  if (hours === 0) {
    return `${minutes} 分钟`
  }

  return `${hours} 小时 ${minutes} 分钟`
}

function parsePoiToPlace(value: unknown): MapPlace | null {
  if (!isRecord(value)) {
    return null
  }

  const location = readLngLat(value.location)

  if (!location) {
    return null
  }

  const name = readString(value.name) || '未命名地点'
  const address = readString(value.address) || readString(value.district) || name
  const cityName = readString(value.cityname) || null
  const district = readString(value.adname) || readString(value.district) || null
  const amapPoiId = readString(value.id) || readString(value.poiid) || null

  return {
    amapPoiId,
    name,
    address,
    cityName,
    district,
    location,
    source: 'search',
  }
}

function parsePoiSearchResult(result: unknown) {
  const poiList = readRecordProperty(result, 'poiList')
  const pois = readArray(readRecordProperty(poiList, 'pois')).length
    ? readArray(readRecordProperty(poiList, 'pois'))
    : readArray(readRecordProperty(result, 'pois'))

  return pois
    .map(parsePoiToPlace)
    .filter((place): place is MapPlace => Boolean(place))
}

function parseSuggestions(result: unknown): PlaceSuggestion[] {
  const tips = readArray(readRecordProperty(result, 'tips'))

  return tips
    .map((tip, index) => {
      if (!isRecord(tip)) {
        return null
      }

      const name = readString(tip.name)

      if (!name) {
        return null
      }

      return {
        id: readString(tip.id) || `${name}-${index}`,
        name,
        district: readString(tip.district),
      }
    })
    .filter((suggestion): suggestion is PlaceSuggestion => Boolean(suggestion))
}

function createPickedCoordinatePlace(location: MapCoordinate): MapPlace {
  const coordinateLabel = formatCoordinateLabel(location)

  return {
    amapPoiId: null,
    name: '地图选点',
    address: `坐标 ${coordinateLabel}`,
    cityName: null,
    district: null,
    location,
    source: 'picked',
  }
}

function parseReverseGeocodeResult(
  result: unknown,
  location: MapCoordinate,
): MapPlace {
  const regeocode = readRecordProperty(result, 'regeocode')
  const addressComponent = readRecordProperty(regeocode, 'addressComponent')
  const pois = readArray(readRecordProperty(regeocode, 'pois'))
  const firstPoi = pois.find(isRecord)
  const formattedAddress =
    readString(readRecordProperty(regeocode, 'formattedAddress')) ||
    `坐标 ${formatCoordinateLabel(location)}`
  const cityName =
    readString(readRecordProperty(addressComponent, 'city')) ||
    readString(readRecordProperty(addressComponent, 'province')) ||
    null
  const district =
    readString(readRecordProperty(addressComponent, 'district')) || null
  const poiName = firstPoi ? readString(firstPoi.name) : ''

  return {
    amapPoiId: firstPoi ? readString(firstPoi.id) || null : null,
    name: poiName || formattedAddress,
    address: formattedAddress,
    cityName,
    district,
    location,
    source: 'picked',
  }
}

function readMapClickLocation(event: unknown) {
  return (
    readLngLat(readRecordProperty(event, 'lnglat')) ||
    readLngLat(readRecordProperty(event, 'lngLat')) ||
    readLngLat(readRecordProperty(event, 'lngLatObj')) ||
    readLngLat(event)
  )
}

function readRouteDistance(value: unknown) {
  return readNumber(readRecordProperty(value, 'distance'))
}

function readRouteDuration(value: unknown) {
  return (
    readNumber(readRecordProperty(value, 'time')) ??
    readNumber(readRecordProperty(value, 'duration'))
  )
}

function createRouteStep(
  mode: RouteStepMode,
  title: string,
  source?: unknown,
): RouteStep | null {
  const normalizedTitle = readString(title)

  if (!normalizedTitle) {
    return null
  }

  return {
    mode,
    title: normalizedTitle,
    distance: source ? readRouteDistance(source) : null,
    duration: source ? readRouteDuration(source) : null,
  }
}

function extractRouteStepsFromSteps(
  value: unknown,
  mode: RouteStepMode,
  limit = 10,
) {
  return readArray(value)
    .map((step) => {
      if (!isRecord(step)) {
        return null
      }

      return createRouteStep(
        mode,
        readString(step.instruction) || readString(step.road),
        step,
      )
    })
    .filter((step): step is RouteStep => Boolean(step))
    .slice(0, limit)
}

function readFirstRecord(value: unknown) {
  return readArray(value).find(isRecord)
}

function readStationName(value: unknown) {
  if (isRecord(value)) {
    return (
      readString(value.name) ||
      readString(value.station_name) ||
      readString(value.stop_name)
    )
  }

  return readString(value)
}

function readTransferLine(segment: Record<string, unknown>) {
  const transit = readRecordProperty(segment, 'transit')
  const bus = readRecordProperty(segment, 'bus')
  const transitLine = readRecordProperty(transit, 'line')

  if (isRecord(transitLine)) {
    return transitLine
  }

  return (
    readFirstRecord(readRecordProperty(transit, 'lines')) ??
    readFirstRecord(readRecordProperty(bus, 'buslines'))
  )
}

function getTransferSegmentMode(segment: Record<string, unknown>): RouteStepMode {
  const modeText = (
    readString(segment.transit_mode) || readString(segment.mode)
  ).toLowerCase()
  const bus = readRecordProperty(segment, 'bus')
  const buslines = readArray(readRecordProperty(bus, 'buslines'))

  if (modeText.includes('subway') || modeText.includes('metro')) {
    return 'subway'
  }

  if (modeText.includes('rail')) {
    return 'rail'
  }

  if (modeText.includes('taxi')) {
    return 'taxi'
  }

  if (modeText.includes('bus')) {
    return 'bus'
  }

  if (modeText.includes('walk')) {
    return 'walk'
  }

  if (readRecordProperty(segment, 'walking')) {
    return 'walk'
  }

  if (buslines.length > 0) {
    return 'bus'
  }

  return 'transfer'
}

function buildTransferLineTitle(
  segment: Record<string, unknown>,
  mode: RouteStepMode,
) {
  const instruction = readString(segment.instruction)

  if (instruction) {
    return instruction
  }

  const line = readTransferLine(segment)
  const lineName = line
    ? readString(line.name) || readString(line.line_name)
    : ''
  const departure = line
    ? readStationName(
        readRecordProperty(line, 'departure_stop') ??
          readRecordProperty(line, 'on_station'),
      )
    : ''
  const arrival = line
    ? readStationName(
        readRecordProperty(line, 'arrival_stop') ??
          readRecordProperty(line, 'off_station'),
      )
    : ''

  if (lineName) {
    const action = mode === 'subway' ? '乘坐地铁' : '乘坐'
    const stops =
      departure && arrival
        ? `，${departure} 至 ${arrival}`
        : departure
          ? `，从 ${departure} 上车`
          : arrival
            ? `，到 ${arrival}`
            : ''

    return `${action} ${lineName}${stops}`
  }

  const transit = readRecordProperty(segment, 'transit')
  const onStation = readStationName(readRecordProperty(transit, 'on_station'))
  const offStation = readStationName(readRecordProperty(transit, 'off_station'))

  if (onStation && offStation) {
    return `从 ${onStation} 至 ${offStation}`
  }

  if (mode === 'taxi') {
    return '打车前往下一站'
  }

  if (mode === 'rail') {
    return '乘坐铁路前往下一站'
  }

  return ''
}

function buildWalkingTransferTitle(segment: Record<string, unknown>) {
  const instruction = readString(segment.instruction)

  if (instruction) {
    return instruction
  }

  const walking = readRecordProperty(segment, 'walking')
  const steps = extractRouteStepsFromSteps(
    readRecordProperty(walking, 'steps'),
    'walk',
    2,
  )

  if (steps.length === 0) {
    return '步行前往下一站'
  }

  return steps.map((step) => step.title).join('；')
}

function readTransferSegmentDistance(
  segment: Record<string, unknown>,
  mode: RouteStepMode,
) {
  const transit = readRecordProperty(segment, 'transit')
  const walking = readRecordProperty(segment, 'walking')
  const bus = readRecordProperty(segment, 'bus')
  const line = readTransferLine(segment)

  if (mode === 'walk') {
    return readRouteDistance(segment) ?? readRouteDistance(walking)
  }

  return (
    readRouteDistance(segment) ??
    readRouteDistance(transit) ??
    readRouteDistance(bus) ??
    readRouteDistance(line)
  )
}

function readTransferSegmentDuration(
  segment: Record<string, unknown>,
  mode: RouteStepMode,
) {
  const transit = readRecordProperty(segment, 'transit')
  const walking = readRecordProperty(segment, 'walking')
  const bus = readRecordProperty(segment, 'bus')
  const line = readTransferLine(segment)

  if (mode === 'walk') {
    return readRouteDuration(segment) ?? readRouteDuration(walking)
  }

  return (
    readRouteDuration(segment) ??
    readRouteDuration(transit) ??
    readRouteDuration(bus) ??
    readRouteDuration(line)
  )
}

function extractTransferSteps(plan: unknown) {
  const segments = readArray(readRecordProperty(plan, 'segments'))

  return segments
    .map((segment) => {
      if (!isRecord(segment)) {
        return null
      }

      const mode = getTransferSegmentMode(segment)
      const title =
        mode === 'walk'
          ? buildWalkingTransferTitle(segment)
          : buildTransferLineTitle(segment, mode)

      return createRouteStep(mode, title || '前往下一段', {
        distance: readTransferSegmentDistance(segment, mode),
        duration: readTransferSegmentDuration(segment, mode),
      })
    })
    .filter((step): step is RouteStep => Boolean(step))
    .slice(0, 16)
}

function parseRouteSummary(mode: RouteMode, result: unknown): RouteSummary {
  if (mode === 'transit') {
    const plans = readArray(readRecordProperty(result, 'plans'))
    const plan = plans.find(isRecord)

    return {
      mode,
      distance: readNumber(readRecordProperty(plan, 'distance')),
      duration:
        readNumber(readRecordProperty(plan, 'time')) ??
        readNumber(readRecordProperty(plan, 'duration')),
      steps: extractTransferSteps(plan),
    }
  }

  const routes = readArray(readRecordProperty(result, 'routes'))
  const route = routes.find(isRecord)
  const stepMode: RouteStepMode =
    mode === 'driving' ? 'drive' : mode === 'walking' ? 'walk' : 'ride'
  const stepSource =
    mode === 'riding'
      ? readRecordProperty(route, 'rides')
      : readRecordProperty(route, 'steps')

  return {
    mode,
    distance: readNumber(readRecordProperty(route, 'distance')),
    duration:
      readNumber(readRecordProperty(route, 'time')) ??
      readNumber(readRecordProperty(route, 'duration')),
    steps: extractRouteStepsFromSteps(stepSource, stepMode),
  }
}

function getMarkerContent(color: string, isSelected: boolean) {
  const size = isSelected ? 24 : 18
  const border = isSelected ? 4 : 3

  return `<div style="width:${size}px;height:${size}px;border-radius:999px;background:${color};border:${border}px solid white;box-shadow:0 12px 24px rgba(15,23,42,.28);"></div>`
}

function getRouteModeIcon(mode: RouteMode) {
  if (mode === 'driving') {
    return <Car className="h-4 w-4" />
  }

  if (mode === 'walking') {
    return <Footprints className="h-4 w-4" />
  }

  if (mode === 'riding') {
    return <Bike className="h-4 w-4" />
  }

  return <TrainFront className="h-4 w-4" />
}

function getRouteStepLabel(mode: RouteStepMode) {
  const labels: Record<RouteStepMode, string> = {
    drive: '驾车',
    walk: '步行',
    ride: '骑行',
    bus: '公交',
    subway: '地铁',
    rail: '铁路',
    taxi: '打车',
    transfer: '换乘',
    other: '路线',
  }

  return labels[mode]
}

function formatRouteStepMeta(step: RouteStep) {
  return [
    step.distance && step.distance > 0 ? formatDistance(step.distance) : '',
    step.duration && step.duration > 0 ? formatDuration(step.duration) : '',
  ]
    .filter(Boolean)
    .join(' / ')
}

export function InteractiveMapPage({
  token,
  onAuthExpired,
}: InteractiveMapPageProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<AMapMapInstance | null>(null)
  const amapRef = useRef<AMapNamespace | null>(null)
  const geocoderRef = useRef<InstanceType<AMapNamespace['Geocoder']> | null>(null)
  const geolocationRef = useRef<InstanceType<AMapNamespace['Geolocation']> | null>(
    null,
  )
  const placeSearchRef = useRef<InstanceType<AMapNamespace['PlaceSearch']> | null>(
    null,
  )
  const autoCompleteRef = useRef<InstanceType<AMapNamespace['AutoComplete']> | null>(
    null,
  )
  const markerOverlaysRef = useRef<AMapOverlay[]>([])
  const focusMarkerRef = useRef<AMapOverlay | null>(null)
  const trafficLayerRef = useRef<AMapOverlay | null>(null)
  const routeRendererRef = useRef<RouteRenderer | null>(null)

  const [isMapReady, setIsMapReady] = useState(false)
  const [mapErrorMessage, setMapErrorMessage] = useState('')
  const [activeTab, setActiveTab] = useState<PanelTab>('search')
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [searchResults, setSearchResults] = useState<MapPlace[]>([])
  const [selectedPlace, setSelectedPlace] = useState<MapPlace | null>(null)
  const [favoritePlaces, setFavoritePlaces] = useState<FavoritePlace[]>([])
  const [favoriteDrafts, setFavoriteDrafts] = useState<
    Record<number, FavoriteDraft>
  >({})
  const [favoriteCategory, setFavoriteCategory] =
    useState<FavoritePlaceCategory>('景点')
  const [favoriteNote, setFavoriteNote] = useState('')
  const [favoriteFilter, setFavoriteFilter] =
    useState<FavoritePlaceCategory | '全部'>('全部')
  const [favoriteSearchQuery, setFavoriteSearchQuery] = useState('')
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [isFavoritesLoading, setIsFavoritesLoading] = useState(false)
  const [isFavoriteSaving, setIsFavoriteSaving] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [showTraffic, setShowTraffic] = useState(false)
  const [routeMode, setRouteMode] = useState<RouteMode>('driving')
  const [routeOrigin, setRouteOrigin] = useState<MapPlace | null>(null)
  const [routeDestination, setRouteDestination] = useState<MapPlace | null>(null)
  const [routePointQueries, setRoutePointQueries] = useState<
    Record<RoutePointTarget, string>
  >({
    origin: '',
    destination: '',
  })
  const [routePointSuggestions, setRoutePointSuggestions] = useState<
    Record<RoutePointTarget, PlaceSuggestion[]>
  >({
    origin: [],
    destination: [],
  })
  const [routePointResults, setRoutePointResults] = useState<
    Record<RoutePointTarget, MapPlace[]>
  >({
    origin: [],
    destination: [],
  })
  const [routePointErrorMessages, setRoutePointErrorMessages] = useState<
    Record<RoutePointTarget, string>
  >({
    origin: '',
    destination: '',
  })
  const [routePointLoading, setRoutePointLoading] = useState<
    Record<RoutePointTarget, boolean>
  >({
    origin: false,
    destination: false,
  })
  const [activeRoutePointTarget, setActiveRoutePointTarget] =
    useState<RoutePointTarget | null>(null)
  const [routeWaypoints, setRouteWaypoints] = useState<MapPlace[]>([])
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null)
  const [routeErrorMessage, setRouteErrorMessage] = useState('')
  const [isRouteLoading, setIsRouteLoading] = useState(false)

  const favoriteByPlaceKey = useMemo(() => {
    return new Map(
      favoritePlaces.map((favoritePlace) => [
        buildFavoritePlaceKey(favoritePlace),
        favoritePlace,
      ]),
    )
  }, [favoritePlaces])

  const visibleFavoritePlaces = useMemo(() => {
    const normalizedQuery = favoriteSearchQuery.trim().toLowerCase()

    return favoritePlaces.filter((favoritePlace) => {
      const matchesCategory =
        favoriteFilter === '全部' || favoritePlace.category === favoriteFilter
      const matchesQuery =
        !normalizedQuery ||
        [
          favoritePlace.name,
          favoritePlace.address,
          favoritePlace.cityName ?? '',
          favoritePlace.district ?? '',
          favoritePlace.note ?? '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery)

      return matchesCategory && matchesQuery
    })
  }, [favoriteFilter, favoritePlaces, favoriteSearchQuery])

  const markerPlaces = useMemo(() => {
    const placesByKey = new Map<string, MapPlace>()

    favoritePlaces.forEach((favoritePlace) => {
      const place = favoriteToPlace(favoritePlace)
      placesByKey.set(buildPlaceKey(place), place)
    })

    searchResults.forEach((place) => {
      placesByKey.set(buildPlaceKey(place), place)
    })

    return Array.from(placesByKey.values())
  }, [favoritePlaces, searchResults])

  const selectedFavorite = selectedPlace
    ? favoriteByPlaceKey.get(buildPlaceKey(selectedPlace))
    : null

  const handleApiError = useCallback(
    (error: unknown, fallbackMessage?: string) => {
      if (isAuthExpiredError(error)) {
        onAuthExpired()
        return
      }

      setErrorMessage(getErrorMessage(error, fallbackMessage))
    },
    [onAuthExpired],
  )

  const focusPlace = useCallback((place: MapPlace, zoom = 15) => {
    const map = mapRef.current
    const AMap = amapRef.current

    setSelectedPlace(place)

    if (!map || !AMap) {
      return
    }

    const position = toAmapCoordinateTuple(place.location)

    map.setZoomAndCenter(zoom, position)

    if (focusMarkerRef.current) {
      map.remove(focusMarkerRef.current)
    }

    const marker = new AMap.Marker({
      position,
      title: place.name,
      content: getMarkerContent('#0f766e', true),
      anchor: 'bottom-center',
    })

    focusMarkerRef.current = marker
    map.add(marker)
  }, [])

  const selectSearchPlace = useCallback(
    (place: MapPlace, zoom = 15) => {
      setSearchResults((currentResults) => [
        place,
        ...currentResults
          .filter((currentPlace) => !isSamePlace(currentPlace, place))
          .slice(0, 9),
      ])
      focusPlace(place, zoom)
      setActiveTab('search')
      setIsMobilePanelOpen(true)
    },
    [focusPlace],
  )

  const loadFavorites = useCallback(async () => {
    setIsFavoritesLoading(true)

    try {
      const result = await fetchFavoritePlaces(token)

      setFavoritePlaces(result.favoritePlaces)
    } catch (error) {
      handleApiError(error, '收藏地点加载失败')
    } finally {
      setIsFavoritesLoading(false)
    }
  }, [handleApiError, token])

  const reverseGeocodeAt = useCallback(
    (location: MapCoordinate) => {
      const pickedPlace = createPickedCoordinatePlace(location)
      const geocoder = geocoderRef.current

      selectSearchPlace(pickedPlace)
      setMessage('已标注该坐标')
      setErrorMessage('')

      if (!geocoder?.getAddress) {
        setMessage('已标注该坐标，地址反查服务尚未准备好')
        return
      }

      geocoder.getAddress(
        toAmapCoordinateTuple(location),
        (status: string, result: unknown) => {
          if (status !== 'complete') {
            setMessage('已标注该坐标，未能识别具体地址')
            return
          }

          const place = parseReverseGeocodeResult(result, location)

          selectSearchPlace(place)
          setMessage('已标注该地图位置')
        },
      )
    },
    [selectSearchPlace],
  )

  useEffect(() => {
    let isActive = true

    const initializeMap = async () => {
      try {
        const AMap = await loadAmap(MAP_PLUGINS)

        if (!isActive || !mapContainerRef.current) {
          return
        }

        amapRef.current = AMap

        const map = new AMap.Map(mapContainerRef.current, {
          center: [113.2644, 23.1291],
          resizeEnable: true,
          viewMode: '2D',
          zoom: 12,
        })

        map.addControl(new AMap.Scale())
        map.addControl(new AMap.ToolBar({ position: 'RB' }))

        const geolocation = new AMap.Geolocation({
          enableHighAccuracy: true,
          timeout: 10000,
          showButton: false,
          showCircle: false,
          showMarker: true,
          panToLocation: true,
          zoomToAccuracy: true,
        })
        const trafficLayer = new AMap.TileLayer.Traffic({
          autoRefresh: true,
          interval: 180,
          zIndex: 12,
        })

        map.addControl(geolocation)
        map.on('click', (event: unknown) => {
          const location = readMapClickLocation(event)

          if (location) {
            reverseGeocodeAt(location)
            return
          }

          setErrorMessage('未能读取地图点击位置')
        })

        mapRef.current = map
        geocoderRef.current = new AMap.Geocoder({
          extensions: 'all',
          radius: 1000,
        })
        geolocationRef.current = geolocation
        placeSearchRef.current = new AMap.PlaceSearch({
          city: '全国',
          extensions: 'all',
          pageSize: 12,
        })
        autoCompleteRef.current = new AMap.AutoComplete({
          city: '全国',
        })
        trafficLayerRef.current = trafficLayer

        setIsMapReady(true)
        setMapErrorMessage('')
      } catch (error) {
        if (!isActive) {
          return
        }

        setMapErrorMessage(getErrorMessage(error, '地图初始化失败'))
      }
    }

    void initializeMap()

    return () => {
      isActive = false
      routeRendererRef.current?.clear?.()
      mapRef.current?.destroy()
      mapRef.current = null
      amapRef.current = null
      geocoderRef.current = null
      geolocationRef.current = null
      placeSearchRef.current = null
      autoCompleteRef.current = null
      trafficLayerRef.current = null
    }
  }, [reverseGeocodeAt])

  useEffect(() => {
    void loadFavorites()
  }, [loadFavorites])

  useEffect(() => {
    setFavoriteDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts }

      favoritePlaces.forEach((favoritePlace) => {
        if (!nextDrafts[favoritePlace.id]) {
          nextDrafts[favoritePlace.id] = {
            category: favoritePlace.category,
            note: favoritePlace.note ?? '',
          }
        }
      })

      return nextDrafts
    })
  }, [favoritePlaces])

  useEffect(() => {
    const autoComplete = autoCompleteRef.current
    const normalizedQuery = searchQuery.trim()

    if (!autoComplete || normalizedQuery.length < 2) {
      setSuggestions([])
      return
    }

    const timer = window.setTimeout(() => {
      autoComplete.search(normalizedQuery, (status: string, result: unknown) => {
        if (status !== 'complete') {
          setSuggestions([])
          return
        }

        setSuggestions(parseSuggestions(result).slice(0, 6))
      })
    }, 280)

    return () => {
      window.clearTimeout(timer)
    }
  }, [searchQuery])

  useEffect(() => {
    const autoComplete = autoCompleteRef.current
    const target = activeRoutePointTarget

    if (!target) {
      return
    }

    const normalizedQuery = routePointQueries[target].trim()

    if (!autoComplete || normalizedQuery.length < 2) {
      setRoutePointSuggestions((currentSuggestions) => ({
        ...currentSuggestions,
        [target]: [],
      }))
      return
    }

    const timer = window.setTimeout(() => {
      autoComplete.search(normalizedQuery, (status: string, result: unknown) => {
        setRoutePointSuggestions((currentSuggestions) => ({
          ...currentSuggestions,
          [target]:
            status === 'complete' ? parseSuggestions(result).slice(0, 5) : [],
        }))
      })
    }, 280)

    return () => {
      window.clearTimeout(timer)
    }
  }, [activeRoutePointTarget, routePointQueries])

  useEffect(() => {
    const map = mapRef.current
    const AMap = amapRef.current

    if (!map || !AMap) {
      return
    }

    if (markerOverlaysRef.current.length > 0) {
      map.remove(markerOverlaysRef.current)
      markerOverlaysRef.current = []
    }

    const overlays = markerPlaces.map((place) => {
      const isFavorite = favoriteByPlaceKey.has(buildPlaceKey(place))
      const marker = new AMap.Marker({
        position: toAmapCoordinateTuple(place.location),
        title: place.name,
        content: getMarkerContent(isFavorite ? '#f59e0b' : '#2563eb', false),
        anchor: 'bottom-center',
      })

      marker.on?.('click', () => {
        focusPlace(place)
        setIsMobilePanelOpen(true)
      })
      map.add(marker)

      return marker
    })

    markerOverlaysRef.current = overlays
  }, [favoriteByPlaceKey, focusPlace, markerPlaces])

  useEffect(() => {
    const map = mapRef.current
    const trafficLayer = trafficLayerRef.current

    if (!map || !trafficLayer) {
      return
    }

    if (showTraffic) {
      map.add(trafficLayer)
      return
    }

    map.remove(trafficLayer)
  }, [showTraffic])

  const searchPlacesByKeyword = useCallback(
    (
      keyword: string,
      onComplete: (places: MapPlace[], status: string) => void,
    ) => {
      const placeSearch = placeSearchRef.current
      const normalizedKeyword = keyword.trim()

      if (!placeSearch || !normalizedKeyword) {
        onComplete([], 'invalid')
        return
      }

      placeSearch.search(normalizedKeyword, (status: string, result: unknown) => {
        if (status !== 'complete') {
          onComplete([], status)
          return
        }

        onComplete(parsePoiSearchResult(result), status)
      })
    },
    [],
  )

  const handleSearch = useCallback(
    (keyword = searchQuery) => {
      const normalizedKeyword = keyword.trim()

      if (!normalizedKeyword) {
        return
      }

      setSearchQuery(normalizedKeyword)
      setIsSearching(true)
      setMessage('')
      setErrorMessage('')
      setSuggestions([])

      searchPlacesByKeyword(normalizedKeyword, (places, status) => {
        setIsSearching(false)

        if (status !== 'complete') {
          setSearchResults([])
          setErrorMessage('没有找到匹配地点')
          return
        }

        setSearchResults(places)

        if (places.length > 0) {
          focusPlace(places[0])
          setMessage(`找到 ${places.length} 个地点`)
        } else {
          setErrorMessage('没有找到匹配地点')
        }
      })
    },
    [focusPlace, searchPlacesByKeyword, searchQuery],
  )

  const handleNearbySearch = (keyword: string) => {
    const placeSearch = placeSearchRef.current
    const map = mapRef.current

    if (!placeSearch?.searchNearBy || !map) {
      return
    }

    const center = readLngLat(map.getCenter())

    if (!center) {
      setErrorMessage('当前地图中心点不可用')
      return
    }

    setIsSearching(true)
    setMessage('')
    setErrorMessage('')
    setSearchQuery(keyword)

    placeSearch.searchNearBy(
      keyword,
      toAmapCoordinateTuple(center),
      5000,
      (status: string, result: unknown) => {
        setIsSearching(false)

        if (status !== 'complete') {
          setSearchResults([])
          setErrorMessage('附近没有找到匹配地点')
          return
        }

        const places = parsePoiSearchResult(result)

        setSearchResults(places)

        if (places.length > 0) {
          focusPlace(places[0])
          setMessage(`附近找到 ${places.length} 个地点`)
        } else {
          setErrorMessage('附近没有找到匹配地点')
        }
      },
    )
  }

  const handleLocate = () => {
    const geolocation = geolocationRef.current

    if (!geolocation?.getCurrentPosition) {
      setErrorMessage('定位服务尚未准备好')
      return
    }

    setIsLocating(true)
    setErrorMessage('')
    setMessage('')

    geolocation.getCurrentPosition((status: string, result: unknown) => {
      setIsLocating(false)

      if (status !== 'complete') {
        setErrorMessage('定位失败，请检查浏览器定位权限')
        return
      }

      const position = readLngLat(readRecordProperty(result, 'position'))

      if (!position) {
        setErrorMessage('定位结果格式异常')
        return
      }

      const address =
        readString(readRecordProperty(result, 'formattedAddress')) || '当前位置'
      const place: MapPlace = {
        amapPoiId: null,
        name: '当前位置',
        address,
        cityName: null,
        district: null,
        location: position,
        source: 'current',
      }

      setSearchResults((currentResults) => [place, ...currentResults.slice(0, 9)])
      focusPlace(place, 16)
      setMessage('已定位到当前位置')
    })
  }

  const handleSaveFavorite = async () => {
    if (!selectedPlace) {
      return
    }

    setIsFavoriteSaving(true)
    setErrorMessage('')
    setMessage('')

    try {
      const result = await createFavoritePlace(
        token,
        placeToFavoriteInput(selectedPlace, favoriteCategory, favoriteNote),
      )

      setFavoritePlaces((currentFavorites) => [
        result.favoritePlace,
        ...currentFavorites,
      ])
      setFavoriteNote('')
      setMessage('地点已收藏')
    } catch (error) {
      handleApiError(error, '收藏失败')
    } finally {
      setIsFavoriteSaving(false)
    }
  }

  const handleRemoveFavorite = async (favoritePlaceId: number) => {
    setErrorMessage('')
    setMessage('')

    try {
      await deleteFavoritePlace(token, favoritePlaceId)
      setFavoritePlaces((currentFavorites) =>
        currentFavorites.filter(
          (favoritePlace) => favoritePlace.id !== favoritePlaceId,
        ),
      )
      setMessage('收藏已删除')
    } catch (error) {
      handleApiError(error, '删除收藏失败')
    }
  }

  const handleUpdateFavorite = async (favoritePlace: FavoritePlace) => {
    const draft = favoriteDrafts[favoritePlace.id]

    if (!draft) {
      return
    }

    setErrorMessage('')
    setMessage('')

    try {
      const result = await updateFavoritePlace(token, favoritePlace.id, {
        category: draft.category,
        note: draft.note.trim() || null,
      })

      setFavoritePlaces((currentFavorites) =>
        currentFavorites.map((currentFavorite) =>
          currentFavorite.id === favoritePlace.id
            ? result.favoritePlace
            : currentFavorite,
        ),
      )
      setMessage('收藏已更新')
    } catch (error) {
      handleApiError(error, '更新收藏失败')
    }
  }

  const clearCurrentRouteLayer = useCallback(() => {
    routeRendererRef.current?.clear?.()
    routeRendererRef.current = null
    setRouteSummary(null)
    setRouteErrorMessage('')
  }, [])

  const handleSetRoutePoint = (
    place: MapPlace,
    target: 'origin' | 'destination' | 'waypoint',
  ) => {
    if (target === 'origin') {
      setRouteOrigin(place)
      setRoutePointQueries((currentQueries) => ({
        ...currentQueries,
        origin: place.name,
      }))
    } else if (target === 'destination') {
      setRouteDestination(place)
      setRoutePointQueries((currentQueries) => ({
        ...currentQueries,
        destination: place.name,
      }))
    } else {
      setRouteWaypoints((currentWaypoints) => {
        if (currentWaypoints.length >= 3) {
          setRouteErrorMessage('驾车路线最多添加 3 个途经点')
          return currentWaypoints
        }

        return [...currentWaypoints, place]
      })
    }

    if (target !== 'waypoint') {
      setRoutePointResults((currentResults) => ({
        ...currentResults,
        [target]: [],
      }))
      setRoutePointSuggestions((currentSuggestions) => ({
        ...currentSuggestions,
        [target]: [],
      }))
      setRoutePointErrorMessages((currentMessages) => ({
        ...currentMessages,
        [target]: '',
      }))
    }

    clearCurrentRouteLayer()
    setActiveTab('route')
    setIsMobilePanelOpen(true)
  }

  const handleRoutePointQueryChange = (
    target: RoutePointTarget,
    value: string,
  ) => {
    setActiveRoutePointTarget(target)
    setRoutePointQueries((currentQueries) => ({
      ...currentQueries,
      [target]: value,
    }))
    setRoutePointResults((currentResults) => ({
      ...currentResults,
      [target]: [],
    }))
    setRoutePointErrorMessages((currentMessages) => ({
      ...currentMessages,
      [target]: '',
    }))
  }

  const handleRoutePointSearch = useCallback(
    (target: RoutePointTarget, keyword = routePointQueries[target]) => {
      const normalizedKeyword = keyword.trim()

      if (!normalizedKeyword) {
        setRoutePointErrorMessages((currentMessages) => ({
          ...currentMessages,
          [target]: `请输入${ROUTE_POINT_LABELS[target]}`,
        }))
        return
      }

      setActiveRoutePointTarget(null)
      setRoutePointQueries((currentQueries) => ({
        ...currentQueries,
        [target]: normalizedKeyword,
      }))
      setRoutePointLoading((currentLoading) => ({
        ...currentLoading,
        [target]: true,
      }))
      setRoutePointResults((currentResults) => ({
        ...currentResults,
        [target]: [],
      }))
      setRoutePointSuggestions((currentSuggestions) => ({
        ...currentSuggestions,
        [target]: [],
      }))
      setRoutePointErrorMessages((currentMessages) => ({
        ...currentMessages,
        [target]: '',
      }))
      setRouteErrorMessage('')

      searchPlacesByKeyword(normalizedKeyword, (places, status) => {
        setRoutePointLoading((currentLoading) => ({
          ...currentLoading,
          [target]: false,
        }))

        if (status !== 'complete' || places.length === 0) {
          setRoutePointErrorMessages((currentMessages) => ({
            ...currentMessages,
            [target]: '没有找到匹配地点',
          }))
          return
        }

        setRoutePointResults((currentResults) => ({
          ...currentResults,
          [target]: places,
        }))
      })
    },
    [routePointQueries, searchPlacesByKeyword],
  )

  const handleSelectRoutePoint = (
    target: RoutePointTarget,
    place: MapPlace,
  ) => {
    handleSetRoutePoint(place, target)
    setActiveRoutePointTarget(null)
    setRoutePointResults((currentResults) => ({
      ...currentResults,
      [target]: [],
    }))
    setRoutePointSuggestions((currentSuggestions) => ({
      ...currentSuggestions,
      [target]: [],
    }))
    setRoutePointErrorMessages((currentMessages) => ({
      ...currentMessages,
      [target]: '',
    }))
    focusPlace(place)
  }

  const handleSwapRoutePoints = () => {
    setRouteOrigin(routeDestination)
    setRouteDestination(routeOrigin)
    setRoutePointQueries((currentQueries) => ({
      ...currentQueries,
      origin: routeDestination?.name ?? '',
      destination: routeOrigin?.name ?? '',
    }))
    clearCurrentRouteLayer()
  }

  const handleClearRoutePoint = (target: RoutePointTarget) => {
    if (target === 'origin') {
      setRouteOrigin(null)
    } else {
      setRouteDestination(null)
    }

    setRoutePointQueries((currentQueries) => ({
      ...currentQueries,
      [target]: '',
    }))
    setRoutePointResults((currentResults) => ({
      ...currentResults,
      [target]: [],
    }))
    setRoutePointSuggestions((currentSuggestions) => ({
      ...currentSuggestions,
      [target]: [],
    }))
    setRoutePointErrorMessages((currentMessages) => ({
      ...currentMessages,
      [target]: '',
    }))
    clearCurrentRouteLayer()
  }

  const handleClearRoute = () => {
    clearCurrentRouteLayer()
  }

  const handleRunRoute = () => {
    const map = mapRef.current
    const AMap = amapRef.current

    if (!map || !AMap || !routeOrigin || !routeDestination) {
      setRouteErrorMessage('请先设置起点和终点')
      return
    }

    handleClearRoute()
    setIsRouteLoading(true)
    setRouteErrorMessage('')

    const origin = new AMap.LngLat(
      routeOrigin.location.longitude,
      routeOrigin.location.latitude,
    )
    const destination = new AMap.LngLat(
      routeDestination.location.longitude,
      routeDestination.location.latitude,
    )
    const callback = (status: string, result: unknown) => {
      setIsRouteLoading(false)

      if (status !== 'complete') {
        setRouteErrorMessage('没有找到可用路线')
        return
      }

      setRouteSummary(parseRouteSummary(routeMode, result))
    }

    if (routeMode === 'driving') {
      const driving = new AMap.Driving({
        map,
        showTraffic: true,
      })
      routeRendererRef.current = driving
      driving.search(
        origin,
        destination,
        {
          waypoints: routeWaypoints.map(
            (waypoint) =>
              new AMap.LngLat(
                waypoint.location.longitude,
                waypoint.location.latitude,
              ),
          ),
        },
        callback,
      )
      return
    }

    if (routeMode === 'walking') {
      const walking = new AMap.Walking({ map })
      routeRendererRef.current = walking
      walking.search(origin, destination, callback)
      return
    }

    if (routeMode === 'riding') {
      const riding = new AMap.Riding({ map })
      routeRendererRef.current = riding
      riding.search(origin, destination, callback)
      return
    }

    const transfer = new AMap.Transfer({
      city: routeOrigin.cityName ?? '全国',
      cityd: routeDestination.cityName ?? routeOrigin.cityName ?? '全国',
      map,
    })
    routeRendererRef.current = transfer
    transfer.search(origin, destination, callback)
  }

  const renderPlaceActions = (place: MapPlace) => (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <button
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-teal-200 hover:bg-teal-50"
        type="button"
        onClick={() => handleSetRoutePoint(place, 'origin')}
      >
        <Navigation className="h-3.5 w-3.5" />
        设为起点
      </button>
      <button
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-teal-200 hover:bg-teal-50"
        type="button"
        onClick={() => handleSetRoutePoint(place, 'destination')}
      >
        <MapPin className="h-3.5 w-3.5" />
        设为终点
      </button>
      <button
        className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-teal-200 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={routeMode !== 'driving'}
        type="button"
        onClick={() => handleSetRoutePoint(place, 'waypoint')}
      >
        <MoveRight className="h-3.5 w-3.5" />
        加入驾车途经点
      </button>
    </div>
  )

  const renderRoutePointEditor = (target: RoutePointTarget) => {
    const label = ROUTE_POINT_LABELS[target]
    const place = target === 'origin' ? routeOrigin : routeDestination
    const suggestions = routePointSuggestions[target]
    const results = routePointResults[target]
    const isLoading = routePointLoading[target]
    const targetErrorMessage = routePointErrorMessages[target]

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault()
            handleRoutePointSearch(target)
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <label
              className="text-xs font-semibold text-slate-500"
              htmlFor={`route-${target}`}
            >
              {label}
            </label>
            {place ? (
              <span className="shrink-0 text-[11px] font-medium text-teal-700">
                已设置
              </span>
            ) : null}
          </div>
          <div className="grid grid-cols-[1fr_auto_auto] gap-2">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                autoComplete="off"
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-100"
                id={`route-${target}`}
                type="search"
                value={routePointQueries[target]}
                onChange={(event) =>
                  handleRoutePointQueryChange(target, event.target.value)
                }
                onFocus={() => setActiveRoutePointTarget(target)}
                placeholder={`搜索${label}`}
              />
            </div>
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!place && !routePointQueries[target].trim()}
              title={`清空${label}`}
              type="button"
              onClick={() => handleClearRoutePoint(target)}
            >
              <X className="h-4 w-4" />
            </button>
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={isLoading || !routePointQueries[target].trim()}
              title={`搜索${label}`}
              type="submit"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
        </form>

        {place ? (
          <button
            className="mt-3 flex w-full items-start gap-2 rounded-xl bg-slate-50 px-3 py-2 text-left transition hover:bg-teal-50"
            type="button"
            onClick={() => focusPlace(place)}
          >
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-slate-900">
                {place.name}
              </span>
              <span className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-500">
                {place.address}
              </span>
            </span>
          </button>
        ) : null}

        {activeRoutePointTarget === target && suggestions.length > 0 ? (
          <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {suggestions.map((suggestion) => (
              <button
                className="block w-full px-3 py-2 text-left text-xs transition hover:bg-slate-50"
                key={suggestion.id}
                type="button"
                onClick={() => handleRoutePointSearch(target, suggestion.name)}
              >
                <span className="block truncate font-medium text-slate-900">
                  {suggestion.name}
                </span>
                {suggestion.district ? (
                  <span className="mt-0.5 block truncate text-slate-500">
                    {suggestion.district}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}

        {isLoading ? (
          <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
            正在搜索{label}
          </p>
        ) : null}

        {targetErrorMessage ? (
          <p className="mt-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
            {targetErrorMessage}
          </p>
        ) : null}

        {results.length > 0 ? (
          <div className="mt-2 max-h-52 space-y-2 overflow-y-auto pr-1">
            {results.map((resultPlace) => (
              <button
                className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-teal-200 hover:bg-teal-50"
                key={buildPlaceKey(resultPlace)}
                type="button"
                onClick={() => handleSelectRoutePoint(target, resultPlace)}
              >
                <span className="block truncate text-sm font-medium text-slate-900">
                  {resultPlace.name}
                </span>
                <span className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-500">
                  {resultPlace.address}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  const renderSelectedPlace = () => {
    if (!selectedPlace) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm leading-6 text-slate-500">
          搜索、点击地图或选择收藏后，这里会显示地点操作。
        </div>
      )
    }

    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">
              {selectedPlace.name}
            </p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
              {selectedPlace.address}
            </p>
          </div>
          {selectedFavorite ? (
            <BookmarkCheck className="h-5 w-5 shrink-0 text-amber-500" />
          ) : (
            <Bookmark className="h-5 w-5 shrink-0 text-slate-400" />
          )}
        </div>

        <div className="mt-4 grid grid-cols-[1fr_1.4fr] gap-2">
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
            value={favoriteCategory}
            onChange={(event) =>
              setFavoriteCategory(event.target.value as FavoritePlaceCategory)
            }
          >
            {FAVORITE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <input
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
            maxLength={200}
            type="text"
            value={favoriteNote}
            onChange={(event) => setFavoriteNote(event.target.value)}
            placeholder="备注"
          />
        </div>

        <div className="mt-2 flex gap-2">
          {selectedFavorite ? (
            <button
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-rose-100 bg-white px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
              type="button"
              onClick={() => void handleRemoveFavorite(selectedFavorite.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              取消收藏
            </button>
          ) : (
            <button
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-teal-700 px-3 py-2 text-xs font-medium text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={isFavoriteSaving}
              type="button"
              onClick={() => void handleSaveFavorite()}
            >
              <Star className="h-3.5 w-3.5" />
              {isFavoriteSaving ? '收藏中' : '收藏地点'}
            </button>
          )}
        </div>

        {renderPlaceActions(selectedPlace)}
      </div>
    )
  }

  return (
    <section className="-mx-4 -my-6 h-[calc(100svh-8.5rem)] min-h-[620px] overflow-hidden bg-slate-900 text-slate-950 sm:-mx-6 lg:-mx-8 lg:h-[calc(100svh-5rem)]">
      <div className="relative h-full w-full">
        <div
          ref={mapContainerRef}
          className="absolute inset-0 h-full w-full bg-slate-200"
        />

        {!isMapReady ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100 text-sm font-medium text-slate-600">
            {mapErrorMessage || '地图加载中...'}
          </div>
        ) : null}

        {mapErrorMessage ? (
          <div className="absolute left-4 right-4 top-4 z-20 rounded-2xl border border-rose-100 bg-white px-4 py-3 text-sm leading-6 text-rose-700 shadow-xl shadow-slate-950/10 lg:left-auto lg:w-96">
            {mapErrorMessage}
          </div>
        ) : null}

        <div className="pointer-events-none absolute inset-x-4 top-4 z-20 flex items-start justify-end gap-3 lg:left-auto lg:right-6 lg:top-6 lg:w-auto">
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/95 text-slate-700 shadow-xl shadow-slate-950/10 backdrop-blur transition hover:text-teal-700"
              title="定位当前位置"
              type="button"
              onClick={handleLocate}
            >
              <LocateFixed className={`h-5 w-5 ${isLocating ? 'animate-pulse' : ''}`} />
            </button>
            <button
              className={`inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/70 shadow-xl shadow-slate-950/10 backdrop-blur transition ${
                showTraffic
                  ? 'bg-teal-700 text-white'
                  : 'bg-white/95 text-slate-700 hover:text-teal-700'
              }`}
              title="切换实时路况"
              type="button"
              onClick={() => setShowTraffic((currentValue) => !currentValue)}
            >
              <Route className="h-5 w-5" />
            </button>
            <button
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/95 text-slate-700 shadow-xl shadow-slate-950/10 backdrop-blur transition hover:text-teal-700 lg:hidden"
              title="展开操作面板"
              type="button"
              onClick={() =>
                setIsMobilePanelOpen((currentValue) => !currentValue)
              }
            >
              <ChevronDown
                className={`h-5 w-5 transition ${isMobilePanelOpen ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
        </div>

        <aside
          className={`absolute inset-x-0 bottom-0 z-30 max-h-[74svh] overflow-hidden rounded-t-[1.75rem] border border-white/70 bg-white/95 shadow-2xl shadow-slate-950/20 backdrop-blur-xl transition-transform duration-300 lg:bottom-6 lg:left-6 lg:right-auto lg:top-6 lg:flex lg:max-h-none lg:w-[25rem] lg:translate-y-0 lg:flex-col lg:rounded-[1.75rem] ${
            isMobilePanelOpen ? 'translate-y-0' : 'translate-y-[calc(100%-4.5rem)]'
          }`}
        >
          <div className="border-b border-slate-200 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">
                  Map
                </p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">
                  互动地图
                </h2>
              </div>
              <button
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 lg:hidden"
                type="button"
                onClick={() =>
                  setIsMobilePanelOpen((currentValue) => !currentValue)
                }
              >
                <ChevronDown
                  className={`h-5 w-5 transition ${isMobilePanelOpen ? '' : 'rotate-180'}`}
                />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 rounded-2xl bg-slate-100 p-1 text-xs font-medium text-slate-500">
              {[
                ['search', '搜索'],
                ['route', '路线'],
                ['favorites', '收藏'],
              ].map(([tab, label]) => (
                <button
                  className={`rounded-xl px-3 py-2 transition ${
                    activeTab === tab
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'hover:text-slate-900'
                  }`}
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab as PanelTab)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {activeTab === 'search' ? (
              <div className="space-y-4">
                <form
                  className="relative"
                  onSubmit={(event) => {
                    event.preventDefault()
                    handleSearch()
                  }}
                >
                  <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" />
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-12 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="搜索地点、景点、餐厅"
                  />
                  <button
                    className="absolute right-1.5 top-1.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                    disabled={isSearching || !searchQuery.trim()}
                    title="搜索"
                    type="submit"
                  >
                    <Search className="h-4 w-4" />
                  </button>

                  {suggestions.length > 0 ? (
                    <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-950/10">
                      {suggestions.map((suggestion) => (
                        <button
                          className="block w-full px-4 py-3 text-left text-sm transition hover:bg-slate-50"
                          key={suggestion.id}
                          type="button"
                          onClick={() => handleSearch(suggestion.name)}
                        >
                          <span className="block font-medium text-slate-900">
                            {suggestion.name}
                          </span>
                          {suggestion.district ? (
                            <span className="mt-0.5 block text-xs text-slate-500">
                              {suggestion.district}
                            </span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </form>

                <div className="grid grid-cols-5 gap-2">
                  {NEARBY_KEYWORDS.map((item) => (
                    <button
                      className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-medium text-slate-600 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
                      key={item.label}
                      type="button"
                      onClick={() => handleNearbySearch(item.keyword)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {message ? (
                  <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-700">
                    {message}
                  </p>
                ) : null}

                {errorMessage ? (
                  <p className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
                    {errorMessage}
                  </p>
                ) : null}

                {renderSelectedPlace()}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">
                      搜索结果
                    </h3>
                    {isSearching ? (
                      <span className="text-xs text-slate-500">搜索中</span>
                    ) : null}
                  </div>

                  {searchResults.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
                      暂无结果
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {searchResults.map((place) => (
                        <button
                          className="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-teal-200 hover:bg-teal-50"
                          key={buildPlaceKey(place)}
                          type="button"
                          onClick={() => focusPlace(place)}
                        >
                          <span className="flex items-start gap-3">
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-slate-900">
                                {place.name}
                              </span>
                              <span className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                                {place.address}
                              </span>
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {activeTab === 'route' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-4 rounded-2xl bg-slate-100 p-1 text-xs font-medium text-slate-500">
                  {ROUTE_MODE_OPTIONS.map((option) => (
                    <button
                      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 transition ${
                        routeMode === option.value
                          ? 'bg-white text-slate-950 shadow-sm'
                          : 'hover:text-slate-900'
                      }`}
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setRouteMode(option.value)
                        if (option.value !== 'driving') {
                          setRouteWaypoints([])
                        }
                        clearCurrentRouteLayer()
                      }}
                    >
                      {getRouteModeIcon(option.value)}
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  {renderRoutePointEditor('origin')}
                  {renderRoutePointEditor('destination')}

                  <button
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    type="button"
                    onClick={handleSwapRoutePoints}
                  >
                    <RefreshCcw className="h-4 w-4" />
                    交换起终点
                  </button>
                </div>

                {routeMode === 'driving' ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">
                        途经点
                      </p>
                      <span className="text-xs text-slate-500">
                        {routeWaypoints.length}/3
                      </span>
                    </div>
                    {routeWaypoints.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
                        从地点详情加入途经点
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {routeWaypoints.map((waypoint, index) => (
                          <div
                            className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                            key={`${buildPlaceKey(waypoint)}-${index}`}
                          >
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                              {waypoint.name}
                            </span>
                            <button
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                              type="button"
                              onClick={() => {
                                setRouteWaypoints((currentWaypoints) =>
                                  currentWaypoints.filter(
                                    (_waypoint, waypointIndex) =>
                                      waypointIndex !== index,
                                  ),
                                )
                                clearCurrentRouteLayer()
                              }}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="rounded-xl bg-teal-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                    disabled={isRouteLoading || !routeOrigin || !routeDestination}
                    type="button"
                    onClick={handleRunRoute}
                  >
                    {isRouteLoading ? '查询中' : '查询路线'}
                  </button>
                  <button
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    type="button"
                    onClick={handleClearRoute}
                  >
                    清除图层
                  </button>
                </div>

                {routeErrorMessage ? (
                  <p className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
                    {routeErrorMessage}
                  </p>
                ) : null}

                {routeSummary ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          距离
                        </p>
                        <p className="mt-1 text-base font-semibold text-slate-950">
                          {formatDistance(routeSummary.distance)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          用时
                        </p>
                        <p className="mt-1 text-base font-semibold text-slate-950">
                          {formatDuration(routeSummary.duration)}
                        </p>
                      </div>
                    </div>
                    {routeSummary.steps.length > 0 ? (
                      <ol className="mt-4 space-y-2">
                        {routeSummary.steps.map((step, index) => {
                          const meta = formatRouteStepMeta(step)

                          return (
                            <li
                              className="rounded-xl bg-white px-3 py-2 text-xs leading-5 text-slate-600"
                              key={`${step.mode}-${step.title}-${index}`}
                            >
                              <div className="flex items-start gap-2">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-50 text-[11px] font-semibold text-teal-700">
                                  {index + 1}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="mb-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                    {getRouteStepLabel(step.mode)}
                                  </span>
                                  <span className="block break-words text-slate-700">
                                    {step.title}
                                  </span>
                                  {meta ? (
                                    <span className="mt-0.5 block text-[11px] text-slate-400">
                                      {meta}
                                    </span>
                                  ) : null}
                                </span>
                              </div>
                            </li>
                          )
                        })}
                      </ol>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeTab === 'favorites' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <input
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                    type="search"
                    value={favoriteSearchQuery}
                    onChange={(event) =>
                      setFavoriteSearchQuery(event.target.value)
                    }
                    placeholder="搜索收藏"
                  />
                  <button
                    className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:text-teal-700"
                    title="刷新收藏"
                    type="button"
                    onClick={() => void loadFavorites()}
                  >
                    <RefreshCcw
                      className={`h-4 w-4 ${isFavoritesLoading ? 'animate-spin' : ''}`}
                    />
                  </button>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1">
                  {(['全部', ...FAVORITE_CATEGORIES] as Array<
                    FavoritePlaceCategory | '全部'
                  >).map((category) => (
                    <button
                      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                        favoriteFilter === category
                          ? 'bg-slate-950 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      key={category}
                      type="button"
                      onClick={() => setFavoriteFilter(category)}
                    >
                      {category}
                    </button>
                  ))}
                </div>

                {visibleFavoritePlaces.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm leading-6 text-slate-500">
                    暂无收藏地点
                  </div>
                ) : (
                  <div className="space-y-3">
                    {visibleFavoritePlaces.map((favoritePlace) => {
                      const draft = favoriteDrafts[favoritePlace.id] ?? {
                        category: favoritePlace.category,
                        note: favoritePlace.note ?? '',
                      }
                      const place = favoriteToPlace(favoritePlace)

                      return (
                        <div
                          className="rounded-2xl border border-slate-200 bg-white p-4"
                          key={favoritePlace.id}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <button
                              className="min-w-0 flex-1 text-left"
                              type="button"
                              onClick={() => focusPlace(place)}
                            >
                              <span className="block truncate text-sm font-semibold text-slate-950">
                                {favoritePlace.name}
                              </span>
                              <span className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                                {favoritePlace.address}
                              </span>
                            </button>
                            <button
                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                              title="删除收藏"
                              type="button"
                              onClick={() =>
                                void handleRemoveFavorite(favoritePlace.id)
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="mt-3 grid grid-cols-[0.8fr_1.2fr] gap-2">
                            <select
                              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                              value={draft.category}
                              onChange={(event) =>
                                setFavoriteDrafts((currentDrafts) => ({
                                  ...currentDrafts,
                                  [favoritePlace.id]: {
                                    ...draft,
                                    category: event.target
                                      .value as FavoritePlaceCategory,
                                  },
                                }))
                              }
                            >
                              {FAVORITE_CATEGORIES.map((category) => (
                                <option key={category} value={category}>
                                  {category}
                                </option>
                              ))}
                            </select>
                            <input
                              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                              maxLength={200}
                              type="text"
                              value={draft.note}
                              onChange={(event) =>
                                setFavoriteDrafts((currentDrafts) => ({
                                  ...currentDrafts,
                                  [favoritePlace.id]: {
                                    ...draft,
                                    note: event.target.value,
                                  },
                                }))
                              }
                              placeholder="备注"
                            />
                          </div>

                          <div className="mt-3 grid grid-cols-3 gap-2">
                            <button
                              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                              type="button"
                              onClick={() => void handleUpdateFavorite(favoritePlace)}
                            >
                              保存
                            </button>
                            <button
                              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                              type="button"
                              onClick={() => handleSetRoutePoint(place, 'origin')}
                            >
                              起点
                            </button>
                            <button
                              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                              type="button"
                              onClick={() =>
                                handleSetRoutePoint(place, 'destination')
                              }
                            >
                              终点
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </section>
  )
}
