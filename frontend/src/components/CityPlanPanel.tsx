import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react'
import {
  fetchLlmStatus,
  generateCityPlan,
  PlanApiError,
  type CityPlanInput,
  type LlmStatus,
} from '../api/plan'
import type { PreferenceCard } from '../api/cards'
import { ModelGenerationLoader } from './ModelGenerationLoader'
import {
  getGenerationDescription,
  getGenerationLabel,
} from '../utils/generationDisplay'
import { ItineraryResultPanel } from './ItineraryResultPanel'
import { LocationSelect } from './LocationSelect'
import {
  formatLocationSelection,
  parseLocationText,
  type LocationSelection,
} from '../utils/location'
import { PreferenceCardSelector } from './PreferenceCardSelector'
import type {
  CardFieldSources,
  CityPlanFormState,
  CityPlanPanelState,
} from './cityPlanPanelState'

type CityPlanPanelProps = {
  token: string
  state: CityPlanPanelState
  onStateChange: Dispatch<SetStateAction<CityPlanPanelState>>
  onAuthExpired: () => void
  onPlanGenerated: () => void
}

type RouteEndpointTone = 'departure' | 'target'

function resolveStateAction<T>(currentValue: T, action: SetStateAction<T>) {
  return typeof action === 'function'
    ? (action as (value: T) => T)(currentValue)
    : action
}

function toDateInputValue(dateValue: string | null) {
  return dateValue ? dateValue.slice(0, 10) : ''
}

function getRouteEndpointClasses(tone: RouteEndpointTone) {
  if (tone === 'target') {
    return {
      shell: 'border-emerald-200 bg-emerald-50/50',
      marker: 'bg-emerald-600 text-white',
      label: 'text-emerald-950',
      description: 'text-emerald-700',
    }
  }

  return {
    shell: 'border-stone-200 bg-stone-50/80',
    marker: 'bg-stone-950 text-white',
    label: 'text-stone-950',
    description: 'text-stone-500',
  }
}

function RouteEndpoint({
  tone,
  marker,
  title,
  description,
  children,
}: {
  tone: RouteEndpointTone
  marker: string
  title: string
  description: string
  children: React.ReactNode
}) {
  const classes = getRouteEndpointClasses(tone)

  return (
    <section className={`rounded-2xl border p-4 ${classes.shell}`}>
      <div className="mb-3 flex items-center gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${classes.marker}`}
        >
          {marker}
        </span>
        <span>
          <span className={`block text-sm font-semibold ${classes.label}`}>
            {title}
          </span>
          <span className={`mt-0.5 block text-xs ${classes.description}`}>
            {description}
          </span>
        </span>
      </div>

      {children}
    </section>
  )
}

function SourceHint({ children }: { children: React.ReactNode }) {
  return (
    <span className="mt-1.5 block text-xs font-medium text-emerald-700">
      {children}
    </span>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-stone-400">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold leading-6 text-stone-900">
        {value}
      </p>
    </div>
  )
}

function toRequestInput(form: CityPlanFormState): CityPlanInput {
  return {
    targetCity: formatLocationSelection(form.targetCity),
    departureCity: formatLocationSelection(form.departureCity) || null,
    travelDays: form.travelDays ? Number(form.travelDays) : null,
    startDate: form.startDate || null,
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
  state,
  onStateChange,
  onAuthExpired,
  onPlanGenerated,
}: CityPlanPanelProps) {
  const {
    form,
    plan,
    record,
    generationMode,
    generationModel,
    message,
    errorMessage,
    cardFieldSources,
    selectedPreferenceCardName,
    isInputExpanded,
  } = state
  const [llmStatus, setLlmStatus] = useState<LlmStatus | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGenerationComplete, setIsGenerationComplete] = useState(false)

  const setPanelField = <K extends keyof CityPlanPanelState>(
    field: K,
    value: SetStateAction<CityPlanPanelState[K]>,
  ) => {
    onStateChange((currentState) => ({
      ...currentState,
      [field]: resolveStateAction(currentState[field], value),
    }))
  }

  const setPanelFields = (fields: Partial<CityPlanPanelState>) => {
    onStateChange((currentState) => ({
      ...currentState,
      ...fields,
    }))
  }

  const setForm = (value: SetStateAction<CityPlanFormState>) =>
    setPanelField('form', value)

  const setCardFieldSources = (value: SetStateAction<CardFieldSources>) =>
    setPanelField('cardFieldSources', value)

  const setSelectedPreferenceCardName = (value: string) =>
    setPanelField('selectedPreferenceCardName', value)

  const setIsInputExpanded = (value: SetStateAction<boolean>) =>
    setPanelField('isInputExpanded', value)

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

    if (field === 'travelDays' || field === 'startDate') {
      setCardFieldSources((currentSources) => {
        const nextSources = { ...currentSources }
        delete nextSources[field]

        return nextSources
      })
    }
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

  const handlePreferenceCardSelected = (card: PreferenceCard | null) => {
    if (!card) {
      setForm((currentForm) => ({
        ...currentForm,
        cardId: '',
        weatherMode: '',
      }))
      setCardFieldSources({})
      setSelectedPreferenceCardName('')
      return
    }

    const parsedDepartureCity = parseLocationText(card.departureCity)
    const cardName = `偏好卡片「${card.cardName}」`
    const startDate = toDateInputValue(card.startDate)

    setForm((currentForm) => ({
      ...currentForm,
      cardId: String(card.id),
      departureCity: parsedDepartureCity ?? currentForm.departureCity,
      travelDays: String(card.travelDays),
      startDate,
      weatherMode: card.weatherMode,
    }))
    setCardFieldSources({
      travelDays: `来自${cardName}`,
      ...(startDate ? { startDate: `来自${cardName}` } : {}),
    })
    setSelectedPreferenceCardName(card.cardName)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setIsGenerationComplete(false)
    setPanelFields({
      message: '',
      errorMessage: '',
    })

    try {
      const result = await generateCityPlan(token, toRequestInput(form))

      setPanelFields({
        plan: result.plan,
        record: result.record,
        generationMode: result.generationMode,
        generationModel: result.model,
        message: '单城市方案已生成，并已自动保存到历史记录',
        isInputExpanded: false,
      })
      setIsGenerationComplete(true)
    } catch (error) {
      if (isAuthExpiredError(error)) {
        setIsSubmitting(false)
        setIsGenerationComplete(false)
        onAuthExpired()
        return
      }

      setPanelFields({
        errorMessage: getErrorMessage(error),
        isInputExpanded: true,
      })
      setIsSubmitting(false)
      setIsGenerationComplete(false)
    }
  }

  const handleGenerationComplete = useCallback(() => {
    setIsSubmitting(false)
    setIsGenerationComplete(false)
    onPlanGenerated()
  }, [onPlanGenerated])

  const canCollapseInput = Boolean(plan || record)
  const departureCityLabel =
    formatLocationSelection(form.departureCity) || '未填写出发城市'
  const targetCityLabel =
    formatLocationSelection(form.targetCity) || '未填写目标城市'
  const travelDaysSummary = form.travelDays
    ? `${form.travelDays} 天${
        cardFieldSources.travelDays ? ` · ${cardFieldSources.travelDays}` : ''
      }`
    : '未填写'
  const startDateSummary = form.startDate
    ? `${form.startDate}${
        cardFieldSources.startDate ? ` · ${cardFieldSources.startDate}` : ''
      }`
    : '未填写'

  return (
    <section className="rounded-[1.75rem] border border-stone-200 bg-white p-6 shadow-[0_18px_70px_rgba(28,25,23,0.08)] sm:p-8">
      <div className="flex flex-col gap-4 border-b border-stone-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700">
            City Plan
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-stone-950">
            单城市深度旅行方案
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
            选择目的地、出发城市和出行偏好，生成一份可执行的城市旅行攻略，结果会自动进入行程库。
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:items-end">
          <div className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm">
            {!llmStatus ? (
              <span className="font-medium text-stone-600">
                正在读取模型状态
              </span>
            ) : llmStatus.configured ? (
              <span className="font-medium text-emerald-700">
                当前模型：{llmStatus.model}
              </span>
            ) : (
              <span className="font-medium text-stone-600">
                当前使用本地模板
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

      <div className="mt-6 space-y-6">
        <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-stone-950">
                规划输入
              </h3>
              <p className="mt-1 text-sm text-stone-500">
                选择偏好卡片会自动回填出发城市、天数和起始日期，补充要求仅用于本次生成。
              </p>
            </div>

            {canCollapseInput ? (
              <button
                className="inline-flex shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-emerald-200 hover:text-emerald-700"
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
            <form className="mt-5 space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="space-y-4">
                  <PreferenceCardSelector
                    token={token}
                    value={form.cardId}
                    onChange={(value) => updateFormField('cardId', value)}
                    onSelectedCardChange={handlePreferenceCardSelected}
                    onAuthExpired={onAuthExpired}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-medium text-stone-700">
                        旅行天数
                      </span>
                      <input
                        className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                        min={1}
                        type="number"
                        value={form.travelDays}
                        onChange={(event) =>
                          updateFormField('travelDays', event.target.value)
                        }
                        placeholder="例如：3"
                      />
                      {cardFieldSources.travelDays ? (
                        <SourceHint>{cardFieldSources.travelDays}</SourceHint>
                      ) : null}
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-stone-700">
                        出游起始日期
                      </span>
                      <input
                        className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                        type="date"
                        value={form.startDate}
                        onChange={(event) =>
                          updateFormField('startDate', event.target.value)
                        }
                      />
                      {cardFieldSources.startDate ? (
                        <SourceHint>{cardFieldSources.startDate}</SourceHint>
                      ) : null}
                    </label>
                  </div>
                </div>

                <div className="space-y-3">
                  <RouteEndpoint
                    tone="departure"
                    marker="起"
                    title="出发城市"
                    description="从这里开始行程，影响抵达与交通建议。"
                  >
                    <LocationSelect
                      label="选择出发地"
                      value={form.departureCity}
                      onChange={(value) =>
                        updateLocationField('departureCity', value)
                      }
                    />
                  </RouteEndpoint>

                  <div className="ml-[1.15rem] h-4 w-px bg-gradient-to-b from-stone-300 to-emerald-300" />

                  <RouteEndpoint
                    tone="target"
                    marker="终"
                    title="目标城市"
                    description="要深度游玩的城市，也是本次方案的核心目的地。"
                  >
                    <LocationSelect
                      required
                      accent="sky"
                      label="选择目的地"
                      value={form.targetCity}
                      onChange={(value) =>
                        updateLocationField('targetCity', value)
                      }
                    />
                  </RouteEndpoint>
                </div>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-stone-700">
                  补充要求
                </span>
                <textarea
                  className="mt-2 min-h-24 w-full resize-y rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  value={form.temporaryPreference}
                  onChange={(event) =>
                    updateFormField('temporaryPreference', event.target.value)
                  }
                  placeholder="例如：想多安排早茶和老街区，减少排队和长距离步行"
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
                className="w-full rounded-xl bg-stone-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? '正在生成，完成后自动展示' : '生成单城市方案'}
              </button>
            </form>
          ) : (
            <div className="mt-5 space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <SummaryItem
                  label="城市路线"
                  value={`${departureCityLabel} → ${targetCityLabel}`}
                />
                <SummaryItem label="旅行天数" value={travelDaysSummary} />
                <SummaryItem label="出游日期" value={startDateSummary} />
                <SummaryItem
                  label="偏好卡片"
                  value={
                    selectedPreferenceCardName
                      ? `偏好卡片「${selectedPreferenceCardName}」`
                      : '本次不使用偏好卡片'
                  }
                />
              </div>

              {message ? (
                <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {message}
                </p>
              ) : null}
            </div>
          )}
        </div>

        <div className="min-h-96 rounded-2xl border border-stone-200 bg-stone-50/80 p-5">
          <div>
            <h3 className="text-base font-semibold text-stone-950">生成结果</h3>
            <p className="mt-1 text-sm text-stone-500">
              完成后会展示结构化行程、交通建议和天气提示。
            </p>
          </div>

          {isSubmitting ? (
            <div className="mt-6">
              <ModelGenerationLoader
                contextItems={[
                  {
                    label: '城市路线',
                    value: `${departureCityLabel} → ${targetCityLabel}`,
                  },
                  { label: '旅行天数', value: travelDaysSummary },
                  { label: '出游日期', value: startDateSummary },
                ]}
                isComplete={isGenerationComplete}
                llmStatus={llmStatus}
                onCompleteAnimationEnd={handleGenerationComplete}
                variant="city"
              />
            </div>
          ) : plan ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl bg-white p-5">
                <p className="text-sm font-medium uppercase tracking-[0.16em] text-emerald-700">
                  {getGenerationLabel(generationMode)}
                </p>
                <h4 className="mt-3 text-xl font-semibold text-stone-950">
                  {plan.title}
                </h4>
                <p className="mt-2 text-xs font-medium text-stone-500">
                  {generationModel ? `生成模型：${generationModel}` : null}
                </p>
                <p className="mt-3 text-sm leading-6 text-stone-600">
                  {plan.summary}
                </p>
                <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
                  {getGenerationDescription(generationMode)}
                </p>
              </div>

              <ItineraryResultPanel plan={plan} record={record} />
            </div>
          ) : (
            <div className="mt-6 rounded-xl bg-white px-5 py-6 text-sm leading-6 text-stone-600">
              填写上方表单后生成方案。生成成功后，结果会在这里展示，并自动写入行程库。
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
