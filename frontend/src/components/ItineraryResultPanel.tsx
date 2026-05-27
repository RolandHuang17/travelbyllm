import { Download } from 'lucide-react'
import {
  Component,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react'
import type { PlanResult } from '../api/plan'
import type { TravelRecord } from '../api/history'
import { parseStructuredItinerary } from '../types/structuredItinerary'
import { exportItineraryToPdf } from '../utils/exportItineraryToPdf'
import { ItineraryMapPreview } from './ItineraryMapPreview'
import { StructuredItineraryView } from './StructuredItineraryView'
import { WeatherSummaryCard } from './WeatherSummaryCard'

type ItineraryResultPanelProps = {
  plan: PlanResult
  record?: TravelRecord | null
}

type ItineraryRenderBoundaryProps = {
  children: ReactNode
  fallbackMarkdown: string
  fallbackTitle: string
}

class ItineraryRenderBoundary extends Component<
  ItineraryRenderBoundaryProps,
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Itinerary result render error]', error, info)
  }

  componentDidUpdate(previousProps: ItineraryRenderBoundaryProps) {
    if (
      this.state.hasError &&
      (previousProps.fallbackMarkdown !== this.props.fallbackMarkdown ||
        previousProps.fallbackTitle !== this.props.fallbackTitle)
    ) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="rounded-2xl border border-amber-200 bg-white p-5">
          <h3 className="text-lg font-semibold text-slate-900">
            {this.props.fallbackTitle}
          </h3>
          <p className="mt-2 text-sm text-amber-700">
            结构化行程暂时无法展示，已为你保留文字方案。
          </p>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
            {this.props.fallbackMarkdown}
          </p>
        </section>
      )
    }

    return this.props.children
  }
}

export function ItineraryResultPanel({
  plan,
  record,
}: ItineraryResultPanelProps) {
  const exportRef = useRef<HTMLDivElement | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const weatherSnapshot = plan.weatherSnapshot ?? record?.weatherSnapshot
  const hasWeatherSummary = Boolean(weatherSnapshot || record?.weatherInfo)
  const structuredItinerary = parseStructuredItinerary(plan.structuredContent)

  const handleExport = async () => {
    if (!exportRef.current) {
      return
    }

    setIsExporting(true)

    try {
      await exportItineraryToPdf({
        element: exportRef.current,
        title: plan.title,
        fallbackText: plan.content,
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-teal-200 hover:text-teal-700 disabled:cursor-not-allowed disabled:text-slate-300"
          disabled={isExporting}
          type="button"
          onClick={() => void handleExport()}
        >
          <Download size={16} />
          {isExporting ? '导出中...' : '导出 PDF'}
        </button>
      </div>

      <ItineraryRenderBoundary
        fallbackMarkdown={plan.content}
        fallbackTitle={plan.title}
      >
        <div ref={exportRef} className="space-y-4 bg-white p-1">
          <StructuredItineraryView
            createdAt={record?.createdAt}
            itinerary={structuredItinerary}
            markdown={plan.content}
            title={plan.title}
          />

          <div
            className={`grid gap-4 ${hasWeatherSummary ? 'xl:grid-cols-2' : ''}`}
          >
            {hasWeatherSummary ? (
              <WeatherSummaryCard
                fallbackText={record?.weatherInfo}
                snapshot={weatherSnapshot}
              />
            ) : null}
            <ItineraryMapPreview itinerary={structuredItinerary} />
          </div>
        </div>
      </ItineraryRenderBoundary>
    </div>
  )
}
