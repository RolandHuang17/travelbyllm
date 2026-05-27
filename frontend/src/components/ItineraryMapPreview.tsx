import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  StructuredItinerary,
  StructuredItineraryMapPoint,
} from '../types/structuredItinerary'
import {
  loadAmap,
  type AMapMapInstance,
  type AMapNamespace,
} from '../utils/amap'

type ItineraryMapPreviewProps = {
  itinerary: StructuredItinerary | null
  className?: string
}

function getPointCoordinate(point: StructuredItineraryMapPoint) {
  return point.longitude !== null && point.latitude !== null
    ? ([point.longitude, point.latitude] as [number, number])
    : null
}

function sortMapPoints(points: StructuredItineraryMapPoint[]) {
  return [...points].sort((left, right) => {
    if (left.day !== right.day) {
      return left.day - right.day
    }

    return left.order - right.order
  })
}

export function ItineraryMapPreview({
  itinerary,
  className = '',
}: ItineraryMapPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<AMapMapInstance | null>(null)
  const amapRef = useRef<AMapNamespace | null>(null)
  const [isMapReady, setIsMapReady] = useState(false)
  const [mapLoadError, setMapLoadError] = useState('')

  const drawablePoints = useMemo(
    () =>
      sortMapPoints(
        Array.isArray(itinerary?.mapPoints) ? itinerary.mapPoints : [],
      ).filter((point) =>
        Boolean(getPointCoordinate(point)),
      ),
    [itinerary],
  )

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
      } catch (error) {
        if (!isActive) {
          return
        }

        setMapLoadError(error instanceof Error ? error.message : '地图加载失败')
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

    if (!drawablePoints.length) {
      return
    }

    const overlays: unknown[] = []
    const path: [number, number][] = []

    drawablePoints.forEach((point, index) => {
      const coordinate = getPointCoordinate(point)

      if (!coordinate) {
        return
      }

      path.push(coordinate)

      const marker = new AMap.Marker({
        position: coordinate,
        title: `${point.name} / Day ${point.day}`,
        content: `<div style="width:28px;height:28px;border-radius:9999px;background:#0f766e;color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;box-shadow:0 8px 20px rgba(15,118,110,.28);border:2px solid white;">${index + 1}</div>`,
      })

      overlays.push(marker)
      map.add(marker)
    })

    if (path.length > 1) {
      const polyline = new AMap.Polyline({
        path,
        strokeColor: '#0f766e',
        strokeWeight: 5,
        strokeOpacity: 0.85,
        lineJoin: 'round',
        lineCap: 'round',
      })

      overlays.push(polyline)
      map.add(polyline)
    }

    map.setFitView(overlays)
  }, [drawablePoints, isMapReady])

  return (
    <section
      className={`overflow-hidden rounded-2xl border border-slate-200 bg-white ${className}`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-teal-700">
            Map Outline
          </p>
          <h3 className="mt-1 text-sm font-semibold text-slate-900">
            行程轮廓地图
          </h3>
        </div>
        <p className="text-right text-xs leading-5 text-slate-500">
          {drawablePoints.length > 0
            ? `${drawablePoints.length} 个可绘制地点`
            : '暂无可绘制地点'}
        </p>
      </div>

      <div className="relative h-80 bg-slate-100">
        <div
          ref={containerRef}
          className="absolute inset-0 h-full w-full"
          data-html2canvas-ignore="true"
        />

        {!drawablePoints.length ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100/90 px-6 text-center text-sm leading-6 text-slate-500">
            暂无可绘制地点，仍可查看文字行程。这里展示的是行程点位轮廓，不是实时导航路线。
          </div>
        ) : null}

        {drawablePoints.length > 0 && !isMapReady ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 px-6 text-center text-sm leading-6 text-slate-600">
            地图加载中...
          </div>
        ) : null}

        {mapLoadError ? (
          <div className="absolute left-4 right-4 top-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700 shadow-sm">
            {mapLoadError}
          </div>
        ) : null}
      </div>

      {drawablePoints.length ? (
        <div className="max-h-48 overflow-auto border-t border-slate-200 bg-slate-50 px-4 py-3">
          <ol className="space-y-2 text-sm text-slate-600">
            {drawablePoints.map((point, index) => (
              <li
                className="flex items-start gap-3"
                key={`${point.day}-${point.order}-${point.name}-${index}`}
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-700 text-xs font-semibold text-white">
                  {index + 1}
                </span>
                <span>
                  <span className="font-medium text-slate-800">
                    Day {point.day} / {point.name}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {point.city || point.addressHint || '未记录位置补充'}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  )
}
