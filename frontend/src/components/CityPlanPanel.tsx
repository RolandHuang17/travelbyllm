import { useEffect, useState, type FormEvent } from 'react'
import {
  fetchLlmStatus,
  generateCityPlan,
  PlanApiError,
  type CityPlanInput,
  type CityPlanResult,
  type GenerationMode,
  type LlmStatus,
} from '../api/plan'
import type { TravelRecord } from '../api/history'
import { ModelGenerationLoader } from './ModelGenerationLoader'
import {
  getGenerationDescription,
  getGenerationLabel,
} from '../utils/generationDisplay'
import { LocationSelect } from './LocationSelect'
import {
  formatLocationSelection,
  getDefaultLocationSelection,
  type LocationSelection,
} from '../utils/location'
import { PreferenceCardSelector } from './PreferenceCardSelector'

type CityPlanPanelProps = {
  token: string
  onAuthExpired: () => void
  onPlanGenerated: () => void
}

type CityPlanFormState = {
  targetCity: LocationSelection
  departureCity: LocationSelection
  travelDays: string
  cardId: string
  temporaryPreference: string
  weatherMode: string
}

const initialFormState: CityPlanFormState = {
  targetCity: getDefaultLocationSelection('广东省广州市'),
  departureCity: getDefaultLocationSelection('广东省深圳市'),
  travelDays: '3',
  cardId: '',
  temporaryPreference: '偏自然风光，节奏轻松，避免过度赶路',
  weatherMode: '参考天气',
}

function toRequestInput(form: CityPlanFormState): CityPlanInput {
  return {
    targetCity: formatLocationSelection(form.targetCity),
    departureCity: formatLocationSelection(form.departureCity) || null,
    travelDays: form.travelDays ? Number(form.travelDays) : null,
    cardId: form.cardId ? Number(form.cardId) : null,
    temporaryPreference: form.temporaryPreference.trim() || null,
    weatherMode: form.weatherMode.trim() || null,
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '生成失败，请稍后重试'
}

function isAuthExpiredError(error: unknown) {
  return error instanceof PlanApiError && error.statusCode === 401
}

export function CityPlanPanel({
  token,
  onAuthExpired,
  onPlanGenerated,
}: CityPlanPanelProps) {
  const [form, setForm] = useState<CityPlanFormState>(initialFormState)
  const [plan, setPlan] = useState<CityPlanResult | null>(null)
  const [record, setRecord] = useState<TravelRecord | null>(null)
  const [llmStatus, setLlmStatus] = useState<LlmStatus | null>(null)
  const [generationMode, setGenerationMode] = useState<GenerationMode | null>(
    null,
  )
  const [generationModel, setGenerationModel] = useState('')
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

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

  const updateFormField = (field: keyof CityPlanFormState, value: string) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  const updateLocationField = (
    field: 'targetCity' | 'departureCity',
    value: LocationSelection,
  ) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setMessage('')
    setErrorMessage('')

    try {
      const result = await generateCityPlan(token, toRequestInput(form))

      setPlan(result.plan)
      setRecord(result.record)
      setGenerationMode(result.generationMode)
      setGenerationModel(result.model)
      setMessage('单城市方案已生成，并已自动保存到历史记录')
      onPlanGenerated()
    } catch (error) {
      if (isAuthExpiredError(error)) {
        onAuthExpired()
        return
      }

      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
            City Plan
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">
            单城市 AI 规划
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            这里会调用 `/api/plan/city` 生成旅行方案，并自动保存到历史记录。已配置大模型时优先使用真实模型，调用失败时自动回退到本地模板。
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:items-end">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            {!llmStatus ? (
              <span className="font-medium text-slate-600">
                正在读取模型状态
              </span>
            ) : llmStatus.configured ? (
              <span className="font-medium text-sky-700">
                当前模型：{llmStatus.model}
              </span>
            ) : (
              <span className="font-medium text-slate-600">
                当前使用本地 Mock 兜底
              </span>
            )}
          </div>

          {record ? (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              已保存历史 #{record.id}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              规划输入
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              可以选择已保存偏好卡片来复用字段，也可以只填写本次临时偏好。
            </p>
          </div>

          <div className="space-y-4">
            <LocationSelect
              required
              label="目标城市"
              value={form.targetCity}
              onChange={(value) => updateLocationField('targetCity', value)}
            />

            <LocationSelect
              label="出发城市"
              value={form.departureCity}
              onChange={(value) => updateLocationField('departureCity', value)}
            />
          </div>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">旅行天数</span>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
              min={1}
              type="number"
              value={form.travelDays}
              onChange={(event) =>
                updateFormField('travelDays', event.target.value)
              }
              placeholder="例如：3"
            />
          </label>

          <PreferenceCardSelector
            token={token}
            value={form.cardId}
            onChange={(value) => updateFormField('cardId', value)}
            onAuthExpired={onAuthExpired}
          />

          <label className="block">
            <span className="text-sm font-medium text-slate-700">临时偏好</span>
            <textarea
              className="mt-2 min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
              value={form.temporaryPreference}
              onChange={(event) =>
                updateFormField('temporaryPreference', event.target.value)
              }
              placeholder="例如：偏自然风光，节奏轻松"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">天气模式</span>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
              type="text"
              value={form.weatherMode}
              onChange={(event) =>
                updateFormField('weatherMode', event.target.value)
              }
              placeholder="例如：参考天气"
            />
          </label>

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
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? '生成中...' : '生成单城市方案'}
          </button>
        </form>

        <div className="min-h-96 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div>
            <h3 className="text-base font-semibold text-slate-900">生成结果</h3>
            <p className="mt-1 text-sm text-slate-500">
              已接入大模型生成链路；如果模型不可用，系统会自动使用本地模板兜底。
            </p>
          </div>

          {isSubmitting ? (
            <div className="mt-6">
              <ModelGenerationLoader llmStatus={llmStatus} />
            </div>
          ) : plan ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl bg-white p-5">
                <p className="text-sm font-medium uppercase tracking-[0.16em] text-sky-700">
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
                <p className="mt-3 rounded-xl bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-800">
                  {getGenerationDescription(generationMode)}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-5">
                <p className="text-sm font-medium text-slate-700">完整方案</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                  {plan.content}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-xl bg-white px-5 py-6 text-sm leading-6 text-slate-600">
              填写左侧表单后生成方案。生成成功后，结果会在这里展示，并自动写入下方历史记录。
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
