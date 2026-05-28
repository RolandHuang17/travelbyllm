import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Filter,
  MapPinned,
  RefreshCcw,
  Search,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchTravelRecordDetail,
  fetchTravelRecords,
  HistoryApiError,
  type TravelRecord,
  type TravelRecordSummary,
} from '../api/history'
import { parseStructuredItinerary } from '../types/structuredItinerary'

type HistoryRecordPickerDialogProps = {
  token: string
  open: boolean
  selectedRecordId: number | null
  onSelect: (record: TravelRecord) => void
  onClose: () => void
  onAuthExpired: () => void
}

type RecordTypeFilter =
  | 'all'
  | 'single-city-plan'
  | 'multi-city-drive-plan'
  | 'optimized-plan'

type SortMode = 'newest' | 'oldest'

const recordTypeOptions: Array<{
  value: RecordTypeFilter
  label: string
}> = [
  { value: 'all', label: '全部记录' },
  { value: 'single-city-plan', label: '单城市' },
  { value: 'multi-city-drive-plan', label: '自驾路线' },
  { value: 'optimized-plan', label: '优化方案' },
]

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

function getRecordTitle(record: TravelRecordSummary | TravelRecord) {
  return record.resultTitle || `${getRecordTypeLabel(record.recordType)} #${record.id}`
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString()
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '历史记录读取失败'
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

function getMarkdownSnippet(record: TravelRecord | null) {
  const content = record?.resultContent.trim()

  if (!content) {
    return ''
  }

  return content.length > 420 ? `${content.slice(0, 420)}...` : content
}

export function HistoryRecordPickerDialog({
  token,
  open,
  selectedRecordId,
  onSelect,
  onClose,
  onAuthExpired,
}: HistoryRecordPickerDialogProps) {
  const [records, setRecords] = useState<TravelRecordSummary[]>([])
  const [activeRecordId, setActiveRecordId] = useState<number | null>(null)
  const [previewRecord, setPreviewRecord] = useState<TravelRecord | null>(null)
  const [listStatus, setListStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    'idle',
  )
  const [detailStatus, setDetailStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle')
  const [query, setQuery] = useState('')
  const [recordTypeFilter, setRecordTypeFilter] =
    useState<RecordTypeFilter>('all')
  const [sortMode, setSortMode] = useState<SortMode>('newest')
  const [listErrorMessage, setListErrorMessage] = useState('')
  const [detailErrorMessage, setDetailErrorMessage] = useState('')

  const loadRecordDetail = useCallback(
    async (recordId: number) => {
      setDetailStatus('loading')
      setDetailErrorMessage('')

      try {
        const result = await fetchTravelRecordDetail(token, recordId)

        setPreviewRecord(result.record)
        setDetailStatus('success')
      } catch (error) {
        if (isAuthExpiredError(error)) {
          onAuthExpired()
          return
        }

        setPreviewRecord(null)
        setDetailErrorMessage(getErrorMessage(error))
        setDetailStatus('error')
      }
    },
    [onAuthExpired, token],
  )

  const loadRecords = useCallback(async () => {
    setListStatus('loading')
    setListErrorMessage('')
    setDetailErrorMessage('')

    try {
      const result = await fetchTravelRecords(token)
      const nextRecordId = selectedRecordId ?? result.records[0]?.id ?? null

      setRecords(result.records)
      setActiveRecordId(nextRecordId)
      setListStatus('success')

      if (nextRecordId) {
        void loadRecordDetail(nextRecordId)
      } else {
        setPreviewRecord(null)
        setDetailStatus('idle')
      }
    } catch (error) {
      if (isAuthExpiredError(error)) {
        onAuthExpired()
        return
      }

      setRecords([])
      setActiveRecordId(null)
      setPreviewRecord(null)
      setListErrorMessage(getErrorMessage(error))
      setListStatus('error')
      setDetailStatus('idle')
    }
  }, [loadRecordDetail, onAuthExpired, selectedRecordId, token])

  useEffect(() => {
    if (!open) {
      return
    }

    const loadTimer = window.setTimeout(() => {
      void loadRecords()
    }, 0)

    return () => {
      window.clearTimeout(loadTimer)
    }
  }, [loadRecords, open])

  useEffect(() => {
    if (!open) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, open])

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return records
      .filter((record) => {
        if (
          recordTypeFilter !== 'all' &&
          record.recordType !== recordTypeFilter
        ) {
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
          `#${record.id}`,
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

  const previewStructuredItinerary = parseStructuredItinerary(
    previewRecord?.structuredContent,
  )
  const previewDays = previewStructuredItinerary?.days.slice(0, 3) ?? []
  const previewMapPointCount =
    previewStructuredItinerary?.mapPoints.length ??
    (previewRecord ? getDrawablePointCount(previewRecord) : 0)
  const previewMarkdownSnippet = getMarkdownSnippet(previewRecord)

  const handlePickRecord = (record: TravelRecordSummary) => {
    setActiveRecordId(record.id)
    void loadRecordDetail(record.id)
  }

  const handleUseSelectedRecord = () => {
    if (!previewRecord) {
      return
    }

    onSelect(previewRecord)
  }

  if (!open) {
    return null
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-hidden bg-slate-950/45 px-4 py-6 backdrop-blur-sm"
      role="dialog"
    >
      <div className="mx-auto flex h-full max-w-6xl items-center">
        <div className="flex max-h-full w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="shrink-0 flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-teal-700">
                Select History
              </p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">
                选择要优化的历史记录
              </h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                在这里搜索并预览已有方案，选中后会自动填入来源记录。
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-teal-200 hover:text-teal-700 disabled:cursor-not-allowed disabled:text-slate-300"
                disabled={listStatus === 'loading'}
                type="button"
                onClick={() => void loadRecords()}
              >
                <RefreshCcw size={15} />
                刷新
              </button>
              <button
                aria-label="关闭历史记录选择"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                type="button"
                onClick={onClose}
              >
                <X size={17} />
              </button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[0.9fr_1.1fr]">
            <div className="flex min-h-0 flex-col border-b border-slate-200 bg-slate-50/80 lg:border-b-0 lg:border-r">
              <div className="shrink-0 grid gap-3 border-b border-slate-200 bg-white p-4 md:grid-cols-[minmax(0,1fr)_11rem_9rem] lg:grid-cols-1 xl:grid-cols-[minmax(0,1fr)_10rem]">
                <label className="relative block xl:col-span-2">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={17}
                  />
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                    placeholder="搜索标题、摘要或 #ID"
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>

                <label className="relative block">
                  <Filter
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={17}
                  />
                  <select
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                    value={recordTypeFilter}
                    onChange={(event) =>
                      setRecordTypeFilter(event.target.value as RecordTypeFilter)
                    }
                  >
                    {recordTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="relative block">
                  <Clock3
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={17}
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

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {listStatus === 'loading' ? (
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-600">
                    正在加载历史记录...
                  </div>
                ) : null}

                {listStatus === 'error' ? (
                  <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-5 text-sm leading-6 text-rose-700">
                    {listErrorMessage || '历史记录加载失败'}
                  </div>
                ) : null}

                {listStatus === 'success' && records.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm leading-6 text-slate-600">
                    还没有可选择的历史记录。先生成一个旅行方案后，再回来优化。
                  </div>
                ) : null}

                {listStatus === 'success' && records.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-slate-500">
                      共 {records.length} 条，当前显示 {filteredRecords.length} 条
                    </p>

                    {filteredRecords.length === 0 ? (
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm leading-6 text-slate-600">
                        没有匹配的记录，换个关键词或筛选条件试试。
                      </div>
                    ) : null}

                    {filteredRecords.map((record) => {
                      const isActive = activeRecordId === record.id
                      const drawablePointCount = getDrawablePointCount(record)

                      return (
                        <button
                          className={`w-full rounded-2xl border bg-white p-4 text-left transition ${
                            isActive
                              ? 'border-teal-300 shadow-[0_12px_30px_rgba(15,118,110,0.12)]'
                              : 'border-slate-200 hover:border-teal-200 hover:shadow-sm'
                          }`}
                          key={record.id}
                          type="button"
                          onClick={() => handlePickRecord(record)}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
                              {getRecordTypeLabel(record.recordType)}
                            </span>
                            <span className="text-xs font-medium text-slate-400">
                              #{record.id}
                            </span>
                            {isActive ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-700">
                                <CheckCircle2 size={13} />
                                正在预览
                              </span>
                            ) : null}
                          </div>
                          <h4 className="mt-3 line-clamp-2 text-sm font-semibold leading-6 text-slate-900">
                            {getRecordTitle(record)}
                          </h4>
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                            {record.inputSummary}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays size={13} />
                              {formatDateTime(record.createdAt)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <MapPinned size={13} />
                              {drawablePointCount > 0
                                ? `${drawablePointCount} 个地图点`
                                : '暂无地图点'}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="min-h-0 overflow-y-auto bg-white p-5">
              {detailStatus === 'idle' ? (
                <div className="flex min-h-80 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 text-center text-sm leading-6 text-slate-500">
                  选择左侧记录后，这里会显示可快速判断的预览。
                </div>
              ) : null}

              {detailStatus === 'loading' ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-6 text-sm leading-6 text-slate-600">
                  正在加载记录详情...
                </div>
              ) : null}

              {detailStatus === 'error' ? (
                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-6 text-sm leading-6 text-rose-700">
                  {detailErrorMessage || '记录详情加载失败'}
                </div>
              ) : null}

              {detailStatus === 'success' && previewRecord ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-teal-700">
                          {getRecordTypeLabel(previewRecord.recordType)} #{previewRecord.id}
                        </p>
                        <h4 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
                          {getRecordTitle(previewRecord)}
                        </h4>
                        <p className="mt-2 text-xs text-slate-500">
                          生成时间：{formatDateTime(previewRecord.createdAt)}
                        </p>
                      </div>
                      <button
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-600"
                        type="button"
                        onClick={handleUseSelectedRecord}
                      >
                        <CheckCircle2 size={16} />
                        使用此记录
                      </button>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-slate-600">
                      {previewRecord.inputSummary}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs text-slate-400">地图点</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {previewMapPointCount > 0
                          ? `${previewMapPointCount} 个`
                          : '暂无'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs text-slate-400">天气信息</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {previewRecord.weatherSnapshot
                          ? '有天气快照'
                          : previewRecord.weatherInfo
                            ? '有天气说明'
                            : '暂无'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs text-slate-400">偏好卡片</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {previewRecord.cardId ?? '未关联'}
                      </p>
                    </div>
                  </div>

                  {previewStructuredItinerary ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <FileText size={16} />
                        结构化行程预览
                      </div>
                      {previewStructuredItinerary.summary ? (
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          {previewStructuredItinerary.summary}
                        </p>
                      ) : null}
                      <div className="mt-4 space-y-3">
                        {previewDays.map((day) => (
                          <div
                            className="rounded-xl bg-slate-50 px-4 py-3"
                            key={`${day.day}-${day.title}`}
                          >
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                              <p className="text-sm font-semibold text-slate-900">
                                {day.title}
                              </p>
                              {day.city ? (
                                <p className="text-xs text-slate-500">
                                  {day.city}
                                </p>
                              ) : null}
                            </div>
                            <p className="mt-2 text-xs leading-5 text-slate-500">
                              {day.items
                                .slice(0, 3)
                                .map((item) => item.title)
                                .join(' / ') || '暂无日程条目'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <FileText size={16} />
                        文本预览
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                        {previewMarkdownSnippet || '暂无可预览文本'}
                      </p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
