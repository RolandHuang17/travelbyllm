import {
  CalendarDays,
  Download,
  FileText,
  Filter,
  MapPinned,
  RefreshCcw,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  deleteTravelRecord,
  fetchTravelRecordDetail,
  fetchTravelRecords,
  HistoryApiError,
  type TravelRecord,
  type TravelRecordSummary,
} from '../api/history'
import { parseStructuredItinerary } from '../types/structuredItinerary'
import { exportItineraryToPdf } from '../utils/exportItineraryToPdf'
import { ItineraryMapPreview } from './ItineraryMapPreview'
import { StructuredItineraryView } from './StructuredItineraryView'
import { WeatherSummaryCard } from './WeatherSummaryCard'

type HistoryPanelProps = {
  token: string
  onAuthExpired: () => void
  refreshSignal?: number
}

type RecordTypeFilter = 'all' | 'single-city-plan' | 'multi-city-drive-plan' | 'optimized-plan'
type SortMode = 'newest' | 'oldest'

const RECORD_TYPE_OPTIONS: Array<{
  value: RecordTypeFilter
  label: string
}> = [
  { value: 'all', label: '全部' },
  { value: 'single-city-plan', label: '单城市' },
  { value: 'multi-city-drive-plan', label: '自驾路线' },
  { value: 'optimized-plan', label: '优化方案' },
]

function formatDateTime(value: string) {
  return new Date(value).toLocaleString()
}

function getRecordTitle(record: TravelRecordSummary | TravelRecord) {
  return record.resultTitle || `${getRecordTypeLabel(record.recordType)} #${record.id}`
}

function getRecordTypeLabel(recordType: string) {
  if (recordType === 'single-city-plan') {
    return '单城市'
  }

  if (recordType === 'multi-city-drive-plan') {
    return '自驾路线'
  }

  if (recordType === 'optimized-plan') {
    return '优化方案'
  }

  return recordType
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请稍后重试'
}

function isAuthExpiredError(error: unknown) {
  return error instanceof HistoryApiError && error.statusCode === 401
}

function getDrawablePointCount(record: TravelRecordSummary | TravelRecord) {
  const structuredItinerary = parseStructuredItinerary(record.structuredContent)

  return (
    structuredItinerary?.mapPoints.filter(
      (point) => point.longitude !== null && point.latitude !== null,
    ).length ?? 0
  )
}

export function HistoryPanel({
  token,
  onAuthExpired,
  refreshSignal = 0,
}: HistoryPanelProps) {
  const navigate = useNavigate()
  const exportRef = useRef<HTMLDivElement | null>(null)
  const [records, setRecords] = useState<TravelRecordSummary[]>([])
  const [selectedRecord, setSelectedRecord] = useState<TravelRecord | null>(null)
  const [listStatus, setListStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  )
  const [query, setQuery] = useState('')
  const [recordTypeFilter, setRecordTypeFilter] =
    useState<RecordTypeFilter>('all')
  const [sortMode, setSortMode] = useState<SortMode>('newest')
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [loadingDetailId, setLoadingDetailId] = useState<number | null>(null)
  const [deletingRecordId, setDeletingRecordId] = useState<number | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const loadRecords = useCallback(async () => {
    setListStatus('loading')
    setErrorMessage('')

    try {
      const result = await fetchTravelRecords(token)

      setRecords(result.records)
      setListStatus('success')
    } catch (error) {
      if (isAuthExpiredError(error)) {
        onAuthExpired()
        return
      }

      setErrorMessage(getErrorMessage(error))
      setListStatus('error')
    }
  }, [onAuthExpired, token])

  useEffect(() => {
    void loadRecords()
  }, [loadRecords, refreshSignal])

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return records
      .filter((record) => {
        const matchesType =
          recordTypeFilter === 'all' || record.recordType === recordTypeFilter

        if (!matchesType) {
          return false
        }

        if (!normalizedQuery) {
          return true
        }

        return [
          getRecordTitle(record),
          record.inputSummary,
          record.resultContent ?? '',
          record.weatherInfo ?? '',
          record.weatherSnapshot ?? '',
        ]
          .join('\n')
          .toLowerCase()
          .includes(normalizedQuery)
      })
      .sort((left, right) => {
        const leftTime = new Date(left.createdAt).getTime()
        const rightTime = new Date(right.createdAt).getTime()

        return sortMode === 'newest'
          ? rightTime - leftTime
          : leftTime - rightTime
      })
  }, [query, recordTypeFilter, records, sortMode])

  const handleViewDetail = async (record: TravelRecordSummary) => {
    setLoadingDetailId(record.id)
    setMessage('')
    setErrorMessage('')

    try {
      const result = await fetchTravelRecordDetail(token, record.id)

      setSelectedRecord(result.record)
    } catch (error) {
      if (isAuthExpiredError(error)) {
        onAuthExpired()
        return
      }

      setErrorMessage(getErrorMessage(error))
    } finally {
      setLoadingDetailId(null)
    }
  }

  const handleDelete = async (record: TravelRecordSummary | TravelRecord) => {
    const shouldDelete = window.confirm(
      `确认删除行程「${getRecordTitle(record)}」吗？`,
    )

    if (!shouldDelete) {
      return
    }

    setDeletingRecordId(record.id)
    setMessage('')
    setErrorMessage('')

    try {
      await deleteTravelRecord(token, record.id)
      setRecords((currentRecords) =>
        currentRecords.filter((currentRecord) => currentRecord.id !== record.id),
      )

      if (selectedRecord?.id === record.id) {
        setSelectedRecord(null)
      }

      setMessage('行程已删除')
    } catch (error) {
      if (isAuthExpiredError(error)) {
        onAuthExpired()
        return
      }

      setErrorMessage(getErrorMessage(error))
    } finally {
      setDeletingRecordId(null)
    }
  }

  const handleOptimize = (record: TravelRecord) => {
    navigate(`/plan/optimize?recordId=${record.id}`)
  }

  const handleExport = async (record: TravelRecord) => {
    if (!exportRef.current) {
      return
    }

    setIsExporting(true)

    try {
      await exportItineraryToPdf({
        element: exportRef.current,
        title: getRecordTitle(record),
        fallbackText: record.resultContent,
      })
    } finally {
      setIsExporting(false)
    }
  }

  const selectedStructuredItinerary = parseStructuredItinerary(
    selectedRecord?.structuredContent,
  )

  return (
    <section className="space-y-6">
      <div className="border-b border-slate-200 pb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
              Trip Library
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">
              我的行程库
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              管理已经生成的旅行方案，按关键词、类型和时间快速定位，也可以继续优化或导出 PDF。
            </p>
          </div>

          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-teal-200 hover:text-teal-700 disabled:cursor-not-allowed disabled:text-slate-300"
            disabled={listStatus === 'loading'}
            type="button"
            onClick={() => void loadRecords()}
          >
            <RefreshCcw size={16} />
            刷新
          </button>
        </div>
      </div>

      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 lg:grid-cols-[1fr_12rem_12rem]">
        <label className="relative block">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <input
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
            placeholder="搜索标题、输入摘要或行程内容"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <label className="relative block">
          <Filter
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <select
            className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
            value={recordTypeFilter}
            onChange={(event) =>
              setRecordTypeFilter(event.target.value as RecordTypeFilter)
            }
          >
            {RECORD_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="relative block">
          <CalendarDays
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <select
            className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
          >
            <option value="newest">最新优先</option>
            <option value="oldest">最早优先</option>
          </select>
        </label>
      </div>

      {message ? (
        <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}

      {listStatus === 'loading' ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-6 text-sm text-slate-600">
          正在加载行程库...
        </div>
      ) : null}

      {listStatus === 'error' ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-6 text-sm text-rose-700">
          {errorMessage || '行程库加载失败'}
        </div>
      ) : null}

      {listStatus === 'success' && records.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center text-sm leading-6 text-slate-600">
          还没有行程。生成单城市方案、自驾路线或优化方案后，它们会自动保存到这里。
        </div>
      ) : null}

      {listStatus === 'success' && records.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <p>
              共 {records.length} 条，当前显示 {filteredRecords.length} 条
            </p>
          </div>

          {filteredRecords.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center text-sm leading-6 text-slate-600">
              没有匹配的行程，调整关键词或筛选条件试试。
            </div>
          ) : null}

          {filteredRecords.map((record) => {
            const drawablePointCount = getDrawablePointCount(record)

            return (
              <article
                className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-teal-200 hover:shadow-sm"
                key={record.id}
              >
                <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
                        {getRecordTypeLabel(record.recordType)}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatDateTime(record.createdAt)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <MapPinned size={13} />
                        {drawablePointCount > 0
                          ? `${drawablePointCount} 个地图点`
                          : '暂无地图点'}
                      </span>
                    </div>

                    <h3 className="mt-3 text-base font-semibold text-slate-900">
                      {getRecordTitle(record)}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                      {record.inputSummary}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <button
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-teal-200 hover:text-teal-700"
                      type="button"
                      onClick={() => void handleViewDetail(record)}
                    >
                      <FileText size={15} />
                      {loadingDetailId === record.id ? '加载中' : '详情'}
                    </button>
                    <button
                      className="inline-flex items-center gap-2 rounded-xl border border-rose-100 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-300"
                      disabled={deletingRecordId === record.id}
                      type="button"
                      onClick={() => void handleDelete(record)}
                    >
                      <Trash2 size={15} />
                      {deletingRecordId === record.id ? '删除中' : '删除'}
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : null}

      {selectedRecord ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
          <div className="mx-auto max-w-7xl rounded-2xl bg-slate-50 shadow-2xl">
            <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-teal-700">
                  Trip Detail
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">
                  {getRecordTitle(selectedRecord)}
                </h3>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-teal-200 hover:text-teal-700"
                  type="button"
                  onClick={() => handleOptimize(selectedRecord)}
                >
                  <Sparkles size={15} />
                  优化此方案
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-teal-200 hover:text-teal-700 disabled:cursor-not-allowed disabled:text-slate-300"
                  disabled={isExporting}
                  type="button"
                  onClick={() => void handleExport(selectedRecord)}
                >
                  <Download size={15} />
                  {isExporting ? '导出中' : '导出 PDF'}
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-100 bg-white px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                  type="button"
                  onClick={() => void handleDelete(selectedRecord)}
                >
                  <Trash2 size={15} />
                  删除
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300"
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                >
                  <X size={15} />
                  关闭
                </button>
              </div>
            </div>

            <div ref={exportRef} className="grid gap-5 bg-white p-5 xl:grid-cols-[1fr_0.9fr]">
              <StructuredItineraryView
                createdAt={selectedRecord.createdAt}
                itinerary={selectedStructuredItinerary}
                markdown={selectedRecord.resultContent}
                title={getRecordTitle(selectedRecord)}
              />
              <div className="space-y-4">
                <WeatherSummaryCard
                  fallbackText={selectedRecord.weatherInfo}
                  snapshot={selectedRecord.weatherSnapshot}
                />
                <ItineraryMapPreview itinerary={selectedStructuredItinerary} />
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h4 className="text-sm font-semibold text-slate-900">
                    记录信息
                  </h4>
                  <dl className="mt-3 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-1">
                    <div>
                      <dt className="text-xs text-slate-400">类型</dt>
                      <dd className="mt-1 font-medium text-slate-700">
                        {getRecordTypeLabel(selectedRecord.recordType)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-400">偏好卡片</dt>
                      <dd className="mt-1 font-medium text-slate-700">
                        {selectedRecord.cardId ?? '未关联'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-400">天气信息</dt>
                      <dd className="mt-1 font-medium text-slate-700">
                        {selectedRecord.weatherInfo || '未记录'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-400">输入摘要</dt>
                      <dd className="mt-1 leading-6 text-slate-700">
                        {selectedRecord.inputSummary}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
