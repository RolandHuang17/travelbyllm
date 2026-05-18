import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  createTravelRecord,
  deleteTravelRecord,
  fetchTravelRecordDetail,
  fetchTravelRecords,
  HistoryApiError,
  updateTravelRecordTitle,
  type TravelRecord,
  type TravelRecordInput,
  type TravelRecordSummary,
} from '../api/history'

type HistoryPanelProps = {
  token: string
  onAuthExpired: () => void
  refreshSignal?: number
}

type HistoryFormState = {
  recordType: string
  inputSummary: string
  resultTitle: string
  resultContent: string
  weatherInfo: string
  cardId: string
}

const initialFormState: HistoryFormState = {
  recordType: 'single-city-plan',
  inputSummary: '广州出发，三天佛系慢游，偏自然风光',
  resultTitle: '测试历史记录',
  resultContent:
    'Day 1：抵达目的地并安排轻松游览。\nDay 2：优先自然风光和低强度步行。\nDay 3：预留返程时间，并根据天气调整户外安排。',
  weatherInfo: '晴到多云，适合户外活动',
  cardId: '',
}

function toRequestInput(form: HistoryFormState): TravelRecordInput {
  return {
    recordType: form.recordType,
    inputSummary: form.inputSummary,
    resultTitle: form.resultTitle.trim() || null,
    resultContent: form.resultContent,
    weatherInfo: form.weatherInfo.trim() || null,
    cardId: form.cardId ? Number(form.cardId) : null,
  }
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString()
}

function getRecordTitle(record: TravelRecordSummary | TravelRecord) {
  return record.resultTitle || `${record.recordType} #${record.id}`
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请稍后重试'
}

function isAuthExpiredError(error: unknown) {
  return error instanceof HistoryApiError && error.statusCode === 401
}

export function HistoryPanel({
  token,
  onAuthExpired,
  refreshSignal = 0,
}: HistoryPanelProps) {
  const [records, setRecords] = useState<TravelRecordSummary[]>([])
  const [selectedRecord, setSelectedRecord] = useState<TravelRecord | null>(null)
  const [listStatus, setListStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  )
  const [form, setForm] = useState<HistoryFormState>(initialFormState)
  const [titleDraft, setTitleDraft] = useState('')
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [loadingDetailId, setLoadingDetailId] = useState<number | null>(null)
  const [updatingTitleId, setUpdatingTitleId] = useState<number | null>(null)
  const [deletingRecordId, setDeletingRecordId] = useState<number | null>(null)

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

  const updateFormField = (field: keyof HistoryFormState, value: string) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsCreating(true)
    setMessage('')
    setErrorMessage('')

    try {
      const result = await createTravelRecord(token, toRequestInput(form))

      setMessage('测试历史记录已创建')
      setSelectedRecord(result.record)
      setTitleDraft(result.record.resultTitle ?? '')
      await loadRecords()
    } catch (error) {
      if (isAuthExpiredError(error)) {
        onAuthExpired()
        return
      }

      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsCreating(false)
    }
  }

  const handleViewDetail = async (record: TravelRecordSummary) => {
    setLoadingDetailId(record.id)
    setMessage('')
    setErrorMessage('')

    try {
      const result = await fetchTravelRecordDetail(token, record.id)

      setSelectedRecord(result.record)
      setTitleDraft(result.record.resultTitle ?? '')
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

  const handleUpdateTitle = async () => {
    if (!selectedRecord) {
      return
    }

    setUpdatingTitleId(selectedRecord.id)
    setMessage('')
    setErrorMessage('')

    try {
      const result = await updateTravelRecordTitle(
        token,
        selectedRecord.id,
        titleDraft.trim() || null,
      )

      setSelectedRecord(result.record)
      setTitleDraft(result.record.resultTitle ?? '')
      setMessage('历史记录标题已更新')
      await loadRecords()
    } catch (error) {
      if (isAuthExpiredError(error)) {
        onAuthExpired()
        return
      }

      setErrorMessage(getErrorMessage(error))
    } finally {
      setUpdatingTitleId(null)
    }
  }

  const handleDelete = async (record: TravelRecordSummary | TravelRecord) => {
    const shouldDelete = window.confirm(
      `确认删除历史记录「${getRecordTitle(record)}」吗？`,
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
        setTitleDraft('')
      }

      setMessage('历史记录已删除')
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

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
            History
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">
            历史记录管理
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            这里用于联调 `/api/history`。当前可以手动创建测试记录，后续旅游规划成功后会自动写入历史。
          </p>
        </div>

        <button
          className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-sky-200 hover:text-sky-700 disabled:cursor-not-allowed disabled:text-slate-300"
          disabled={listStatus === 'loading'}
          type="button"
          onClick={() => void loadRecords()}
        >
          刷新历史
        </button>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <form className="space-y-4" onSubmit={handleCreate}>
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              创建测试历史记录
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              这个表单只是临时联调入口，不代表最终旅游规划页面。
            </p>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">记录类型</span>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
              required
              type="text"
              value={form.recordType}
              onChange={(event) =>
                updateFormField('recordType', event.target.value)
              }
              placeholder="例如：single-city-plan"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">结果标题</span>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
              type="text"
              value={form.resultTitle}
              onChange={(event) =>
                updateFormField('resultTitle', event.target.value)
              }
              placeholder="可为空，例如：广州三天慢游方案"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">输入摘要</span>
            <textarea
              className="mt-2 min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
              required
              value={form.inputSummary}
              onChange={(event) =>
                updateFormField('inputSummary', event.target.value)
              }
              placeholder="概括用户输入和规划条件"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">结果内容</span>
            <textarea
              className="mt-2 min-h-36 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
              required
              value={form.resultContent}
              onChange={(event) =>
                updateFormField('resultContent', event.target.value)
              }
              placeholder="写入模拟的旅游规划结果"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                天气信息
              </span>
              <input
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                type="text"
                value={form.weatherInfo}
                onChange={(event) =>
                  updateFormField('weatherInfo', event.target.value)
                }
                placeholder="可为空"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                关联卡片 ID
              </span>
              <input
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                min={1}
                type="number"
                value={form.cardId}
                onChange={(event) => updateFormField('cardId', event.target.value)}
                placeholder="可为空"
              />
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

          <button
            className="w-full rounded-xl bg-sky-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={isCreating}
            type="submit"
          >
            {isCreating ? '创建中...' : '创建测试记录'}
          </button>
        </form>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="min-h-80 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                历史列表
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                当前共 {records.length} 条，按创建时间倒序排列。
              </p>
            </div>

            {listStatus === 'loading' ? (
              <p className="mt-6 rounded-xl bg-white px-4 py-3 text-sm text-slate-600">
                正在加载历史记录...
              </p>
            ) : null}

            {listStatus === 'error' ? (
              <p className="mt-6 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errorMessage || '历史记录加载失败'}
              </p>
            ) : null}

            {listStatus === 'success' && records.length === 0 ? (
              <div className="mt-6 rounded-xl bg-white px-5 py-6 text-sm leading-6 text-slate-600">
                还没有历史记录。先用左侧表单创建一条测试记录，后续旅游规划完成后会自动保存到这里。
              </div>
            ) : null}

            {listStatus === 'success' && records.length > 0 ? (
              <div className="mt-6 space-y-3">
                {records.map((record) => (
                  <article
                    className={`rounded-2xl border bg-white p-4 transition ${
                      selectedRecord?.id === record.id
                        ? 'border-sky-300 ring-4 ring-sky-100'
                        : 'border-slate-200'
                    }`}
                    key={record.id}
                  >
                    <div className="flex flex-col gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">
                          {getRecordTitle(record)}
                        </h4>
                        <p className="mt-1 text-xs text-slate-500">
                          {record.recordType} / {formatDateTime(record.createdAt)}
                        </p>
                      </div>

                      <p className="line-clamp-3 text-sm leading-6 text-slate-600">
                        {record.inputSummary}
                      </p>

                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-sky-200 hover:text-sky-700"
                          type="button"
                          onClick={() => void handleViewDetail(record)}
                        >
                          {loadingDetailId === record.id ? '加载中' : '查看详情'}
                        </button>
                        <button
                          className="rounded-lg border border-rose-100 px-3 py-2 text-xs font-medium text-rose-600 transition hover:border-rose-200 hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-300"
                          disabled={deletingRecordId === record.id}
                          type="button"
                          onClick={() => void handleDelete(record)}
                        >
                          {deletingRecordId === record.id ? '删除中' : '删除'}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </div>

          <div className="min-h-80 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-base font-semibold text-slate-900">
              历史详情
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              详情会额外读取完整 `resultContent`。
            </p>

            {selectedRecord ? (
              <div className="mt-6 space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    结果标题
                  </span>
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                    type="text"
                    value={titleDraft}
                    onChange={(event) => setTitleDraft(event.target.value)}
                    placeholder="可为空"
                  />
                </label>

                <button
                  className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  disabled={updatingTitleId === selectedRecord.id}
                  type="button"
                  onClick={() => void handleUpdateTitle()}
                >
                  {updatingTitleId === selectedRecord.id ? '保存中...' : '保存标题'}
                </button>

                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-xl bg-white px-4 py-3">
                    <dt className="text-slate-400">记录类型</dt>
                    <dd className="mt-1 font-medium text-slate-700">
                      {selectedRecord.recordType}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-white px-4 py-3">
                    <dt className="text-slate-400">创建时间</dt>
                    <dd className="mt-1 font-medium text-slate-700">
                      {formatDateTime(selectedRecord.createdAt)}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-white px-4 py-3">
                    <dt className="text-slate-400">关联卡片</dt>
                    <dd className="mt-1 font-medium text-slate-700">
                      {selectedRecord.cardId ?? '未关联'}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-white px-4 py-3">
                    <dt className="text-slate-400">天气信息</dt>
                    <dd className="mt-1 font-medium text-slate-700">
                      {selectedRecord.weatherInfo || '未记录'}
                    </dd>
                  </div>
                </dl>

                <div className="rounded-xl bg-white px-4 py-3">
                  <p className="text-sm font-medium text-slate-700">输入摘要</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                    {selectedRecord.inputSummary}
                  </p>
                </div>

                <div className="rounded-xl bg-white px-4 py-3">
                  <p className="text-sm font-medium text-slate-700">结果内容</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                    {selectedRecord.resultContent}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-xl bg-white px-5 py-6 text-sm leading-6 text-slate-600">
                从左侧列表选择一条历史记录后，这里会显示完整详情并允许修改标题。
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
