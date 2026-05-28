import { useEffect, useMemo, useRef, useState } from 'react'
import type { DriveRoutePreview } from '../api/map'
import {
  loadAmap,
  toAmapCoordinateTuple,
  type AMapMapInstance,
  type AMapNamespace,
} from '../utils/amap'

type RouteMapPreviewProps = {
  preview: DriveRoutePreview | null
  isLoading: boolean
  errorMessage: string
  accent?: 'sky' | 'orange'
}

function formatDistance(meters: number) {
  if (!Number.isFinite(meters) || meters <= 0) {
    return '0 m'
  }

  if (meters >= 1000) {
    const kilometers = meters / 1000
    return kilometers >= 100
      ? `${Math.round(kilometers)} km`
      : `${kilometers.toFixed(1)} km`
  }

  return `${Math.round(meters)} m`
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0 分钟'
  }

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round((seconds % 3600) / 60)

  if (hours === 0) {
    return `${minutes} 分钟`
  }

  return `${hours} 小时 ${minutes} 分钟`
}

function getAccentColor(accent: 'sky' | 'orange') {
  return accent === 'orange' ? '#ea580c' : '#0284c7'
}

function getAccentTextClass(accent: 'sky' | 'orange') {
  return accent === 'orange' ? 'text-orange-700' : 'text-sky-700'
}

export function RouteMapPreview({
  preview,
  isLoading,
  errorMessage,
  accent = 'orange',
}: RouteMapPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<AMapMapInstance | null>(null)
  const amapRef = useRef<AMapNamespace | null>(null)
  const [isMapReady, setIsMapReady] = useState(false)
  const [mapLoadError, setMapLoadError] = useState('')

  const accentColor = useMemo(() => getAccentColor(accent), [accent])
  const accentTextClass = useMemo(() => getAccentTextClass(accent), [accent])

  useEffect(() => {
    let isActive = true

    const initializeMap = async () => {
      try {
        const AMap = await loadAmap(['AMap.Scale', 'AMap.ToolBar'])

        if (!isActive || !containerRef.current) {
          return
        }

        amapRef.current = AMap
        const map = new AMap.Map(containerRef.current, {
          viewMode: '2D',
          zoom: 5,
          resizeEnable: true,
        })

        map.addControl(new AMap.Scale())
        map.addControl(new AMap.ToolBar())

        mapRef.current = map
        setIsMapReady(true)
        setMapLoadError('')
      } catch (error) {
        if (!isActive) {
          return
        }

        setMapLoadError(
          error instanceof Error ? error.message : '地图初始化失败',
        )
      }
    }

    void initializeMap()

    return () => {
      isActive = false

      mapRef.current?.destroy()

      mapRef.current = null
      amapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const AMap = amapRef.current

    if (!map || !AMap) {
      return
    }

    map.clearMap()

    if (!preview) {
      return
    }

    const overlays: unknown[] = []
    const allPoints = [
      preview.origin,
      ...preview.waypoints,
      preview.destination,
    ]

    allPoints.forEach((point) => {
      const marker = new AMap.Marker({
        position: toAmapCoordinateTuple(point.location),
        title: point.formattedAddress || point.address || point.label,
      })

      overlays.push(marker)
      map.add(marker)
    })

    if (preview.route.coordinates.length > 1) {
      const polyline = new AMap.Polyline({
        path: preview.route.coordinates.map(toAmapCoordinateTuple),
        strokeColor: accentColor,
        strokeWeight: 5,
        strokeOpacity: 0.9,
        lineJoin: 'round',
        lineCap: 'round',
      })

      overlays.push(polyline)
      map.add(polyline)
    }

    if (overlays.length > 0) {
      map.setFitView(overlays)
    }
  }, [accentColor, isMapReady, preview])

  const hasMapError = Boolean(errorMessage || mapLoadError)

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3">
        <div>
          <p className={`text-xs font-medium uppercase tracking-[0.2em] ${accentTextClass}`}>
            Map Preview
          </p>
          <h3 className="mt-1 text-sm font-semibold text-slate-900">
            自驾路线地图
          </h3>
        </div>

        {preview ? (
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-900">
              {formatDistance(preview.route.distance)}
            </p>
            <p className="text-xs text-slate-500">
              {formatDuration(preview.route.duration)}
            </p>
          </div>
        ) : null}
      </div>

      <div className="relative h-80 bg-slate-100">
        <div ref={containerRef} className="absolute inset-0 h-full w-full" />

        {!preview ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100/90 px-6 text-center text-sm leading-6 text-slate-500">
            {isLoading
              ? '路线地图正在加载，稍后会显示起点、途经点和终点。'
              : '提交自驾路线后，这里会显示起点、途经点和终点的地图。'}
          </div>
        ) : null}

        {preview && !isMapReady ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100/75 px-6 text-center text-sm leading-6 text-slate-600">
            地图加载中...
          </div>
        ) : null}

        {hasMapError ? (
          <div className="absolute left-4 right-4 top-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700 shadow-sm">
            {errorMessage || mapLoadError}
          </div>
        ) : null}

        {isLoading ? (
          <div className="absolute bottom-4 left-4 rounded-xl border border-white/70 bg-white/90 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
            正在生成路线地图...
          </div>
        ) : null}
      </div>

      {preview ? (
        <div className="grid gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              起点
            </p>
            <p className="mt-1 break-words leading-6 text-slate-700">
              {preview.origin.formattedAddress}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              途经
            </p>
            <p className="mt-1 leading-6 text-slate-700">
              {preview.waypoints.length > 0
                ? `${preview.waypoints.length} 个城市`
                : '无'}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              终点
            </p>
            <p className="mt-1 break-words leading-6 text-slate-700">
              {preview.destination.formattedAddress}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  )
}
