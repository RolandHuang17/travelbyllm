import AMapLoader from '@amap/amap-jsapi-loader'
import type { MapCoordinate } from '../api/map'

declare global {
  interface Window {
    _AMapSecurityConfig?: {
      securityJsCode?: string
      serviceHost?: string
    }
  }
}

export type AMapCoordinateTuple = [number, number]

export type AMapOverlay = {
  on?: (eventName: string, callback: (event: unknown) => void) => void
}

export type AMapMapInstance = {
  add: (overlay: unknown) => void
  addControl: (control: unknown) => void
  clearMap: () => void
  destroy: () => void
  getCenter: () => unknown
  on: (eventName: string, callback: (event: unknown) => void) => void
  remove: (overlay: unknown | unknown[]) => void
  setCenter: (position: AMapCoordinateTuple) => void
  setFitView: (overlays: unknown[]) => void
  setZoomAndCenter: (zoom: number, position: AMapCoordinateTuple) => void
}

type AMapSearchService = {
  clear?: () => void
  getCity?: (callback: (result: unknown) => void) => void
  getCurrentPosition?: (
    callback: (status: string, result: unknown) => void,
  ) => void
  getAddress?: (
    position: AMapCoordinateTuple,
    callback: (status: string, result: unknown) => void,
  ) => void
  search: (...args: unknown[]) => void
  searchNearBy?: (...args: unknown[]) => void
}

export type AMapNamespace = {
  AutoComplete: new (options: Record<string, unknown>) => AMapSearchService
  Driving: new (options: Record<string, unknown>) => AMapSearchService
  Geocoder: new (options: Record<string, unknown>) => AMapSearchService
  Geolocation: new (options: Record<string, unknown>) => AMapSearchService
  LngLat: new (longitude: number, latitude: number) => unknown
  Map: new (
    container: HTMLElement,
    options: Record<string, unknown>,
  ) => AMapMapInstance
  Marker: new (options: Record<string, unknown>) => AMapOverlay
  PlaceSearch: new (options: Record<string, unknown>) => AMapSearchService
  Polyline: new (options: Record<string, unknown>) => AMapOverlay
  Riding: new (options: Record<string, unknown>) => AMapSearchService
  Scale: new () => unknown
  TileLayer: {
    Traffic: new (options: Record<string, unknown>) => AMapOverlay
  }
  ToolBar: new (options?: Record<string, unknown>) => unknown
  Transfer: new (options: Record<string, unknown>) => AMapSearchService
  Walking: new (options: Record<string, unknown>) => AMapSearchService
}

function getAmapServiceHost() {
  if (typeof window === 'undefined') {
    return '/_AMapService'
  }

  return `${window.location.origin}/_AMapService`
}

export async function loadAmap(plugins: string[]) {
  const key = import.meta.env.VITE_AMAP_JS_KEY?.trim()

  if (!key) {
    throw new Error('未配置高德地图前端 Key')
  }

  window._AMapSecurityConfig = {
    serviceHost: getAmapServiceHost(),
  }

  return (await AMapLoader.load({
    key,
    version: '2.0',
    plugins,
  })) as unknown as AMapNamespace
}

export function toAmapCoordinateTuple(
  coordinate: MapCoordinate,
): AMapCoordinateTuple {
  return [coordinate.longitude, coordinate.latitude]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function readFiniteNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const numberValue = Number(value)

    return Number.isFinite(numberValue) ? numberValue : null
  }

  return null
}

export function readLngLat(value: unknown): MapCoordinate | null {
  if (Array.isArray(value) && value.length >= 2) {
    const longitude = readFiniteNumber(value[0])
    const latitude = readFiniteNumber(value[1])

    return longitude !== null && latitude !== null
      ? { longitude, latitude }
      : null
  }

  if (typeof value === 'string') {
    const [longitudeText, latitudeText] = value.split(',')
    const longitude = readFiniteNumber(longitudeText)
    const latitude = readFiniteNumber(latitudeText)

    return longitude !== null && latitude !== null
      ? { longitude, latitude }
      : null
  }

  if (!isRecord(value)) {
    return null
  }

  const getLng = value.getLng
  const getLat = value.getLat

  if (typeof getLng === 'function' && typeof getLat === 'function') {
    const longitude = readFiniteNumber(getLng.call(value))
    const latitude = readFiniteNumber(getLat.call(value))

    return longitude !== null && latitude !== null
      ? { longitude, latitude }
      : null
  }

  const longitude =
    readFiniteNumber(value.lng) ??
    readFiniteNumber(value.longitude) ??
    readFiniteNumber(value.Lng)
  const latitude =
    readFiniteNumber(value.lat) ??
    readFiniteNumber(value.latitude) ??
    readFiniteNumber(value.Lat)

  return longitude !== null && latitude !== null
    ? { longitude, latitude }
    : null
}
