import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  fetchTravelRecordDetail,
  HistoryApiError,
  type TravelRecord,
} from '../api/history'
import {
  fetchLlmStatus,
  optimizePlan,
  PlanApiError,
  type GenerationMode,
  type LlmStatus,
  type OptimizePlanInput,
  type PlanResult,
} from '../api/plan'
import { ModelGenerationLoader } from './ModelGenerationLoader'
import {
  getGenerationDescription,
  getGenerationLabel,
} from '../utils/generationDisplay'
import { HistoryRecordPickerDialog } from './HistoryRecordPickerDialog'
import { ItineraryResultPanel } from './ItineraryResultPanel'

type OptimizePlanPanelProps = {
  token: string
  onAuthExpired: () => void
  onPlanGenerated: () => void
}

type OptimizePlanFormState = {
  recordId: string
  optimizeRequirement: string
}

const initialFormState: OptimizePlanFormState = {
  recordId: '',
  optimizeRequirement: '减少步行，增加美食安排，更适合亲子出行',
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold leading-6 text-slate-900">
        {value}
      </p>
    </div>
  )
}

function toRequestInput(form: OptimizePlanFormState): OptimizePlanInput {
  return {
    recordId: Number(form.recordId),
    optimizeRequirement: form.optimizeRequirement,
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '优化失败，请稍后重试'
}

function isAuthExpiredError(error: unknown) {
  return (
    (error instanceof PlanApiError || error instanceof HistoryApiError) &&
    error.statusCode === 401
  )
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

function getRecordTitle(record: TravelRecord) {
  return record.resultTitle || `${getRecordTypeLabel(record.recordType)} #${record.id}`
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString()
}

function parsePositiveRecordId(value: string) {
  const recordId = Number(value)

  return Number.isInteger(recordId) && recordId > 0 ? recordId : null
}

export function OptimizePlanPanel({
  token,
  onAuthExpired,
  onPlanGenerated,
}: OptimizePlanPanelProps) {
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState<OptimizePlanFormState>(() => ({
    ...initialFormState,
    recordId: searchParams.get('recordId') ?? initialFormState.recordId,
  }))
  const [plan, setPlan] = useState<PlanResult | null>(null)
  const [record, setRecord] = useState<TravelRecord | null>(null)
  const [llmStatus, setLlmStatus] = useState<LlmStatus | null>(null)
  const [generationMode, setGenerationMode] = useState<GenerationMode | null>(
    null,
  )
  const [generationModel, setGenerationModel] = useState('')
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isInputExpanded, setIsInputExpanded] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGenerationComplete, setIsGenerationComplete] = useState(false)
  const [sourceRecord, setSourceRecord] = useState<TravelRecord | null>(null)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [isSourceRecordLoading, setIsSourceRecordLoading] = useState(false)
  const [sourceRecordErrorMessage, setSourceRecordErrorMessage] = useState('')

  useEffect(() => {
    let isActive = true

    const loadLlmStatus = async () => {
      try {
        const status = await fetchLlmStatus(token)

        if (!isActive) {
          return
        }

        setLlmStatus(status)
      } catch (error) {
        if (!isActive) {
          return
        }

        if (isAuthExpiredError(error)) {
          onAuthExpired()
          return
        }

        setLlmStatus(null)
      }
    }

    void loadLlmStatus()

    return () => {
      isActive = false
    }
  }, [onAuthExpired, token])

  useEffect(() => {
    const initialRecordId = searchParams.get('recordId')

    if (!initialRecordId) {
      return
    }

    const parsedRecordId = Number(initialRecordId)

    if (!Number.isInteger(parsedRecordId) || parsedRecordId <= 0) {
      setSourceRecordErrorMessage('历史记录 ID 格式不正确，请重新选择记录')
      return
    }

    let isActive = true

    const loadSourceRecord = async () => {
      setIsSourceRecordLoading(true)
      setSourceRecordErrorMessage('')

      try {
        const result = await fetchTravelRecordDetail(token, parsedRecordId)

        if (!isActive) {
          return
        }

        setSourceRecord(result.record)
        setForm((currentForm) => ({
          ...currentForm,
          recordId: String(result.record.id),
        }))
      } catch (error) {
        if (!isActive) {
          return
        }

        if (isAuthExpiredError(error)) {
          onAuthExpired()
          return
        }

        setSourceRecord(null)
        setSourceRecordErrorMessage(getErrorMessage(error))
      } finally {
        if (isActive) {
          setIsSourceRecordLoading(false)
        }
      }
    }

    void loadSourceRecord()

    return () => {
      isActive = false
    }
  }, [onAuthExpired, searchParams, token])

  const updateFormField = (
    field: keyof OptimizePlanFormState,
    value: string,
  ) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const selectedRecordId = parsePositiveRecordId(form.recordId)

    if (!selectedRecordId) {
      setErrorMessage('请先选择要优化的历史记录')
      return
    }

    setIsSubmitting(true)
    setIsGenerationComplete(false)
    setMessage('')
    setErrorMessage('')

    try {
      const result = await optimizePlan(token, toRequestInput(form))

      setPlan(result.plan)
      setRecord(result.record)
      setGenerationMode(result.generationMode)
      setGenerationModel(result.model)
      setMessage('方案已优化，并已作为新的历史记录保存')
      setIsInputExpanded(false)
      setIsGenerationComplete(true)
    } catch (error) {
      if (isAuthExpiredError(error)) {
        setIsSubmitting(false)
        setIsGenerationComplete(false)
        onAuthExpired()
        return
      }

      setErrorMessage(getErrorMessage(error))
      setIsInputExpanded(true)
      setIsSubmitting(false)
      setIsGenerationComplete(false)
    }
  }

  const handleGenerationComplete = useCallback(() => {
    setIsSubmitting(false)
    setIsGenerationComplete(false)
    onPlanGenerated()
  }, [onPlanGenerated])

  const handleSourceRecordSelected = (selectedRecord: TravelRecord) => {
    setSourceRecord(selectedRecord)
    setSourceRecordErrorMessage('')
    setForm((currentForm) => ({
      ...currentForm,
      recordId: String(selectedRecord.id),
    }))
    setIsPickerOpen(false)
  }

  const handleClearSourceRecord = () => {
    setSourceRecord(null)
    setSourceRecordErrorMessage('')
    setForm((currentForm) => ({
      ...currentForm,
      recordId: '',
    }))
  }

  const canCollapseInput = Boolean(plan || record)
  const requirementSummary =
    form.optimizeRequirement.trim() || '未填写优化要求'
  const selectedRecordId = parsePositiveRecordId(form.recordId)
  const sourceRecordSummary = sourceRecord
    ? `${getRecordTitle(sourceRecord)} · #${sourceRecord.id}`
    : selectedRecordId
      ? `#${selectedRecordId}`
      : '未选择'
  const canSubmit = Boolean(selectedRecordId) && !isSubmitting

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
            Optimize Plan
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">
            方案 AI 优化
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            读取已有行程并追加新的旅行要求，生成一个可对比的优化版本，不覆盖原方案。
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:items-end">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            {!llmStatus ? (
              <span className="font-medium text-slate-600">
                正在读取模型状态
              </span>
            ) : llmStatus.configured ? (
              <span className="font-medium text-teal-700">
                当前模型：{llmStatus.model}
              </span>
            ) : (
              <span className="font-medium text-slate-600">
                当前使用本地模板
              </span>
            )}
          </div>

          {record ? (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              已保存优化历史 #{record.id}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                优化输入
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                选择一条已有行程作为来源，再填写本次希望调整的重点。
              </p>
            </div>

            {canCollapseInput ? (
              <button
                className="inline-flex shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-teal-200 hover:text-teal-700"
                type="button"
                onClick={() =>
                  setIsInputExpanded((currentValue) => !currentValue)
                }
              >
                {isInputExpanded ? '收起输入' : '编辑输入'}
              </button>
            ) : null}
          </div>

          {isInputExpanded ? (
            <form
              className="mt-5 grid gap-4 lg:grid-cols-[0.32fr_0.68fr]"
              onSubmit={handleSubmit}
            >
              <div className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  来源记录
                </span>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  {isSourceRecordLoading ? (
                    <p className="text-sm leading-6 text-slate-500">
                      正在读取来源记录...
                    </p>
                  ) : sourceRecord ? (
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
                          {getRecordTypeLabel(sourceRecord.recordType)}
                        </span>
                        <span className="text-xs font-medium text-slate-400">
                          #{sourceRecord.id}
                        </span>
                      </div>
                      <h4 className="mt-3 text-sm font-semibold leading-6 text-slate-900">
                        {getRecordTitle(sourceRecord)}
                      </h4>
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
                        {sourceRecord.inputSummary}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        生成时间：{formatDateTime(sourceRecord.createdAt)}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm leading-6 text-slate-600">
                      还没有选择来源记录。打开历史记录选择器，可以直接搜索并预览已有方案。
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      className="inline-flex items-center justify-center rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-600"
                      type="button"
                      onClick={() => setIsPickerOpen(true)}
                    >
                      {sourceRecord ? '更换记录' : '选择历史记录'}
                    </button>
                    {sourceRecord || form.recordId ? (
                      <button
                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-rose-200 hover:text-rose-600"
                        type="button"
                        onClick={handleClearSourceRecord}
                      >
                        清除选择
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  优化要求
                </span>
                <textarea
                  className="mt-2 min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                  required
                  value={form.optimizeRequirement}
                  onChange={(event) =>
                    updateFormField('optimizeRequirement', event.target.value)
                  }
                  placeholder="例如：减少步行，增加美食安排，更适合亲子出行"
                />
              </label>

              {message ? (
                <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 lg:col-span-2">
                  {message}
                </p>
              ) : null}

              {errorMessage ? (
                <p className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700 lg:col-span-2">
                  {errorMessage}
                </p>
              ) : null}

              {sourceRecordErrorMessage ? (
                <p className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700 lg:col-span-2">
                  {sourceRecordErrorMessage}。可以重新选择一条历史记录。
                </p>
              ) : null}

              <button
                className="w-full rounded-xl bg-teal-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-slate-300 lg:col-span-2"
                disabled={!canSubmit}
                type="submit"
              >
                {isSubmitting
                  ? '正在优化，完成后自动展示'
                  : form.recordId
                    ? '生成优化版方案'
                    : '先选择来源记录'}
              </button>
            </form>
          ) : (
            <div className="mt-5 space-y-4">
              <div className="grid gap-3 md:grid-cols-[0.32fr_0.68fr]">
                <SummaryItem label="来源记录" value={sourceRecordSummary} />
                <SummaryItem label="优化要求" value={requirementSummary} />
              </div>

              {message ? (
                <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {message}
                </p>
              ) : null}
            </div>
          )}
        </div>

        <div className="min-h-96 rounded-2xl border border-slate-200 bg-teal-50/50 p-5">
          <div>
            <h3 className="text-base font-semibold text-slate-900">优化结果</h3>
            <p className="mt-1 text-sm text-slate-500">
              优化完成后会展示新的结构化行程，并保存为新的历史记录。
            </p>
          </div>

          {isSubmitting ? (
            <div className="mt-6">
              <ModelGenerationLoader
                contextItems={[
                  {
                    label: '来源记录',
                    value: sourceRecordSummary,
                  },
                  { label: '优化要求', value: requirementSummary },
                ]}
                isComplete={isGenerationComplete}
                llmStatus={llmStatus}
                onCompleteAnimationEnd={handleGenerationComplete}
                variant="optimize"
              />
            </div>
          ) : plan ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl bg-white p-5">
                <p className="text-sm font-medium uppercase tracking-[0.16em] text-teal-700">
                  {getGenerationLabel(generationMode)}
                </p>
                <h4 className="mt-3 text-xl font-semibold text-slate-900">
                  {plan.title}
                </h4>
                <p className="mt-2 text-xs font-medium text-slate-500">
                  {generationModel ? `生成模型：${generationModel}` : null}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {plan.summary}
                </p>
                <p className="mt-3 rounded-xl bg-teal-50 px-4 py-3 text-sm leading-6 text-teal-800">
                  {getGenerationDescription(generationMode)}
                </p>
              </div>

              <ItineraryResultPanel plan={plan} record={record} />
            </div>
          ) : (
            <div className="mt-6 rounded-xl bg-white px-5 py-6 text-sm leading-6 text-slate-600">
              填写上方表单后生成优化版方案。生成成功后，结果会在这里展示，并自动写入历史记录。
            </div>
          )}
        </div>
      </div>
      <HistoryRecordPickerDialog
        open={isPickerOpen}
        selectedRecordId={selectedRecordId}
        token={token}
        onAuthExpired={onAuthExpired}
        onClose={() => setIsPickerOpen(false)}
        onSelect={handleSourceRecordSelected}
      />
    </section>
  )
}
