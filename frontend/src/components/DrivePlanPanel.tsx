import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { TravelRecord } from '../api/history'
import type { PreferenceCard } from '../api/cards'
import {
  fetchDriveRoutePreview,
  MapApiError,
  type DriveRoutePreview,
} from '../api/map'
import {
  fetchLlmStatus,
  generateDrivePlan,
  PlanApiError,
  type DrivePlanInput,
  type GenerationMode,
  type LlmStatus,
  type PlanResult,
} from '../api/plan'
import { ModelGenerationLoader } from './ModelGenerationLoader'
import {
  getGenerationDescription,
  getGenerationLabel,
} from '../utils/generationDisplay'
import { ItineraryResultPanel } from './ItineraryResultPanel'
import { LocationSelect } from './LocationSelect'
import {
  formatLocationSelection,
  getDefaultLocationSelection,
  parseLocationText,
  type LocationSelection,
} from '../utils/location'
import { PreferenceCardSelector } from './PreferenceCardSelector'
import { RouteMapPreview } from './RouteMapPreview'

type DrivePlanPanelProps = {
  token: string
  onAuthExpired: () => void
  onPlanGenerated: () => void
}

type DrivePlanFormState = {
  departureCity: LocationSelection
  destinationCity: LocationSelection
  waypointCities: LocationSelection[]
  travelDays: string
  startDate: string
  cardId: string
  temporaryPreference: string
  weatherMode: string
}

type RouteEndpointTone = 'departure' | 'target'
type CardBackedField = 'travelDays' | 'startDate'
type CardFieldSources = Partial<Record<CardBackedField, string>>

const initialFormState: DrivePlanFormState = {
  departureCity: getDefaultLocationSelection('广东省广州市'),
  destinationCity: getDefaultLocationSelection('福建省厦门市'),
  waypointCities: [
    getDefaultLocationSelection('广东省汕头市'),
    getDefaultLocationSelection('广东省潮州市'),
  ],
  travelDays: '4',
  startDate: '',
  cardId: '',
  temporaryPreference: '',
  weatherMode: '',
}

function toDateInputValue(dateValue: string | null) {
  return dateValue ? dateValue.slice(0, 10) : ''
}

function getRouteEndpointClasses(tone: RouteEndpointTone) {
  if (tone === 'target') {
    return {
      shell: 'border-amber-200 bg-amber-50/55',
      marker: 'bg-amber-600 text-white',
      label: 'text-amber-950',
      description: 'text-amber-700',
    }
  }

  return {
    shell: 'border-stone-200 bg-white',
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
    <span className="mt-1.5 block text-xs font-medium text-amber-700">
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

function toRequestInput(form: DrivePlanFormState): DrivePlanInput {
  return {
    departureCity: formatLocationSelection(form.departureCity),
    destinationCity: formatLocationSelection(form.destinationCity),
    waypointCities: form.waypointCities
      .map((city) => formatLocationSelection(city))
      .filter(Boolean),
    travelDays: Number(form.travelDays),
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
  return (
    (error instanceof PlanApiError || error instanceof MapApiError) &&
    error.statusCode === 401
  )
}

export function DrivePlanPanel({
  token,
  onAuthExpired,
  onPlanGenerated,
}: DrivePlanPanelProps) {
  const [form, setForm] = useState<DrivePlanFormState>(initialFormState)
  const [plan, setPlan] = useState<PlanResult | null>(null)
  const [record, setRecord] = useState<TravelRecord | null>(null)
  const [llmStatus, setLlmStatus] = useState<LlmStatus | null>(null)
  const [generationMode, setGenerationMode] = useState<GenerationMode | null>(
    null,
  )
  const [generationModel, setGenerationModel] = useState('')
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [routePreview, setRoutePreview] = useState<DriveRoutePreview | null>(
    null,
  )
  const [routePreviewError, setRoutePreviewError] = useState('')
  const [cardFieldSources, setCardFieldSources] = useState<CardFieldSources>({})
  const [selectedPreferenceCardName, setSelectedPreferenceCardName] =
    useState('')
  const [isInputExpanded, setIsInputExpanded] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGenerationComplete, setIsGenerationComplete] = useState(false)
  const [isRoutePreviewLoading, setIsRoutePreviewLoading] = useState(false)

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

  const updateFormField = (field: keyof DrivePlanFormState, value: string) => {
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
    field: 'departureCity' | 'destinationCity',
    value: LocationSelection,
  ) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  const updateWaypointCity = (index: number, value: LocationSelection) => {
    setForm((currentForm) => ({
      ...currentForm,
      waypointCities: currentForm.waypointCities.map((city, cityIndex) =>
        cityIndex === index ? value : city,
      ),
    }))
  }

  const addWaypointCity = () => {
    setForm((currentForm) => ({
      ...currentForm,
      waypointCities: [
        ...currentForm.waypointCities,
        getDefaultLocationSelection('广东省广州市'),
      ],
    }))
  }

  const removeWaypointCity = (index: number) => {
    setForm((currentForm) => ({
      ...currentForm,
      waypointCities: currentForm.waypointCities.filter(
        (_city, cityIndex) => cityIndex !== index,
      ),
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
    setIsRoutePreviewLoading(true)
    setMessage('')
    setErrorMessage('')
    setRoutePreview(null)
    setRoutePreviewError('')

    try {
      const requestInput = toRequestInput(form)
      const routePreviewPromise = fetchDriveRoutePreview(token, requestInput)
        .then((preview) => ({
          ok: true as const,
          preview,
        }))
        .catch((error) => ({
          ok: false as const,
          error,
        }))

      const result = await generateDrivePlan(token, requestInput)

      setPlan(result.plan)
      setRecord(result.record)
      setGenerationMode(result.generationMode)
      setGenerationModel(result.model)
      setMessage('多城市自驾路线已生成，并已自动保存到历史记录')
      setIsInputExpanded(false)
      setIsGenerationComplete(true)

      void routePreviewPromise.then((previewResult) => {
        setIsRoutePreviewLoading(false)

        if (previewResult.ok) {
          setRoutePreview(previewResult.preview)
          return
        }

        if (isAuthExpiredError(previewResult.error)) {
          onAuthExpired()
          return
        }

        setRoutePreviewError(getErrorMessage(previewResult.error))
      })
    } catch (error) {
      setIsRoutePreviewLoading(false)

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

  const canCollapseInput = Boolean(plan || record)
  const departureCityLabel =
    formatLocationSelection(form.departureCity) || '未填写出发城市'
  const destinationCityLabel =
    formatLocationSelection(form.destinationCity) || '未填写目的城市'
  const waypointCityLabels = form.waypointCities
    .map((city) => formatLocationSelection(city))
    .filter(Boolean)
  const driveRouteSummary = [
    departureCityLabel,
    ...waypointCityLabels,
    destinationCityLabel,
  ].join(' → ')
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
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-amber-700">
            Drive Plan
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-stone-950">
            多城市自驾路线规划
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
            组合出发地、目的地和途经城市，生成适合自驾节奏的跨城路线，结果会自动进入行程库。
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:items-end">
          <div className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm">
            {!llmStatus ? (
              <span className="font-medium text-stone-600">
                正在读取模型状态
              </span>
            ) : llmStatus.configured ? (
              <span className="font-medium text-amber-700">
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
                自驾路线输入
              </h3>
              <p className="mt-1 text-sm text-stone-500">
                选择偏好卡片会自动回填出发城市、天数和起始日期，补充要求仅用于本次生成。
              </p>
            </div>

            {canCollapseInput ? (
              <button
                className="inline-flex shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-amber-200 hover:text-amber-700"
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
              <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="space-y-4">
                  <PreferenceCardSelector
                    accent="orange"
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
                        className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                        min={1}
                        required
                        type="number"
                        value={form.travelDays}
                        onChange={(event) =>
                          updateFormField('travelDays', event.target.value)
                        }
                        placeholder="例如：4"
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
                        className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
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

                  <label className="block">
                    <span className="text-sm font-medium text-stone-700">
                      补充要求
                    </span>
                    <textarea
                      className="mt-2 min-h-24 w-full resize-y rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                      value={form.temporaryPreference}
                      onChange={(event) =>
                        updateFormField(
                          'temporaryPreference',
                          event.target.value,
                        )
                      }
                      placeholder="例如：沿海慢开，增加海景停留，午后少安排长途驾驶"
                    />
                  </label>
                </div>

                <div className="space-y-4">
                  <div className="space-y-3">
                    <RouteEndpoint
                      tone="departure"
                      marker="起"
                      title="出发城市"
                      description="自驾路线的起点，用于计算首段驾驶距离与出城节奏。"
                    >
                      <LocationSelect
                        required
                        accent="orange"
                        label="选择出发地"
                        value={form.departureCity}
                        onChange={(value) =>
                          updateLocationField('departureCity', value)
                        }
                      />
                    </RouteEndpoint>

                    <div className="ml-[1.15rem] h-4 w-px bg-gradient-to-b from-stone-300 to-amber-300" />

                    <RouteEndpoint
                      tone="target"
                      marker="终"
                      title="目的城市"
                      description="自驾路线的终点，也是本次跨城行程最终抵达地。"
                    >
                      <LocationSelect
                        required
                        accent="orange"
                        label="选择目的地"
                        value={form.destinationCity}
                        onChange={(value) =>
                          updateLocationField('destinationCity', value)
                        }
                      />
                    </RouteEndpoint>
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-slate-700">
                          途经城市
                        </h4>
                        <p className="mt-1 text-xs text-stone-500">
                          可添加多个途经城市，每个城市同样最多选择到县级。
                        </p>
                      </div>
                      <button
                        className="rounded-xl border border-amber-200 px-4 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-50"
                        type="button"
                        onClick={addWaypointCity}
                      >
                        添加途经城市
                      </button>
                    </div>

                    {form.waypointCities.length === 0 ? (
                      <p className="rounded-xl bg-white px-4 py-3 text-sm text-stone-500">
                        当前没有途经城市，路线会直接从出发城市到目的城市。
                      </p>
                    ) : null}

                    {form.waypointCities.map((waypointCity, index) => (
                      <div
                        className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4"
                        key={`${waypointCity.provinceCode}-${waypointCity.cityCode}-${index}`}
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-stone-700">
                            途经城市 {index + 1}
                          </p>
                          <button
                            className="rounded-lg border border-rose-100 px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                            type="button"
                            onClick={() => removeWaypointCity(index)}
                          >
                            删除
                          </button>
                        </div>
                        <LocationSelect
                          accent="orange"
                          label={`途经城市 ${index + 1}`}
                          value={waypointCity}
                          onChange={(value) =>
                            updateWaypointCity(index, value)
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
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
                className="w-full rounded-xl bg-stone-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? '正在生成，完成后自动展示' : '生成自驾路线'}
              </button>
            </form>
          ) : (
            <div className="mt-5 space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <SummaryItem label="自驾路线" value={driveRouteSummary} />
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

        <div className="rounded-2xl border border-stone-200 bg-amber-50/45 p-5">
          <div>
            <h3 className="text-base font-semibold text-stone-950">
              生成结果
            </h3>
            <p className="mt-1 text-sm text-stone-500">
              完成后会展示路线概览、每日停留和沿途建议。
            </p>
          </div>

          {isSubmitting ? (
            <div className="mt-6">
              <ModelGenerationLoader
                contextItems={[
                  { label: '自驾路线', value: driveRouteSummary },
                  { label: '旅行天数', value: travelDaysSummary },
                  { label: '出游日期', value: startDateSummary },
                ]}
                isComplete={isGenerationComplete}
                llmStatus={llmStatus}
                onCompleteAnimationEnd={handleGenerationComplete}
                variant="drive"
              />
            </div>
          ) : plan ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl bg-white p-5">
                <p className="text-sm font-medium uppercase tracking-[0.16em] text-amber-700">
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
                <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                  {getGenerationDescription(generationMode)}
                </p>
              </div>

              <RouteMapPreview
                accent="orange"
                errorMessage={routePreviewError}
                isLoading={isRoutePreviewLoading}
                preview={routePreview}
              />

              <ItineraryResultPanel plan={plan} record={record} />
            </div>
          ) : (
            <div className="mt-6 rounded-xl bg-white px-5 py-6 text-sm leading-6 text-stone-600">
              填写上方表单后生成路线。生成成功后，结果会在这里展示，并自动写入行程库。
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
