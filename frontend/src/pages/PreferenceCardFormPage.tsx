import { ArrowLeft, Save } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  CardsApiError,
  createPreferenceCard,
  fetchPreferenceCard,
  updatePreferenceCard,
  type PreferenceCard,
  type PreferenceCardInput,
} from '../api/cards'
import { LocationSelect } from '../components/LocationSelect'
import {
  formatLocationSelection,
  getDefaultLocationSelection,
  parseLocationText,
  type LocationSelection,
} from '../utils/location'

type PreferenceCardFormPageProps = {
  token: string
  onAuthExpired: () => void
}

const TRAVEL_STYLE_OPTIONS = ['特种兵旅游', '佛系慢游', '平衡型'] as const
const TRANSPORT_MODE_OPTIONS = ['公共交通', '自驾'] as const
const DRIVE_MODE_OPTIONS = ['当地租车自驾', '全程自驾'] as const
const SCENIC_PREFERENCE_OPTIONS = [
  '自然风光',
  '城市漫游',
  '休闲躺平',
  '人文历史',
  '平衡型',
] as const
const COMPANION_TYPE_OPTIONS = [
  '独自出行',
  '朋友结伴',
  '情侣出游',
  '家庭出游',
  '不指定',
] as const
const WEATHER_MODE_OPTIONS = ['参考天气', '不参考天气'] as const

type CardFormState = {
  cardName: string
  travelStyle: string
  transportMode: string
  driveMode: string
  scenicPreference: string
  departureCity: LocationSelection
  originalDepartureCity: string | null
  companionType: string
  travelDays: string
  startDate: string
  weatherMode: string
}

type OptionGroupProps<T extends readonly string[]> = {
  label: string
  options: T
  value: string
  onChange: (value: T[number]) => void
  columns?: 'two' | 'three'
  helperText?: string
}

const initialFormState: CardFormState = {
  cardName: '',
  travelStyle: '佛系慢游',
  transportMode: '公共交通',
  driveMode: '',
  scenicPreference: '自然风光',
  departureCity: getDefaultLocationSelection('广东省广州市'),
  originalDepartureCity: null,
  companionType: '朋友结伴',
  travelDays: '3',
  startDate: '',
  weatherMode: '参考天气',
}

function getValidOption<T extends readonly string[]>(
  value: string | null | undefined,
  options: T,
  fallback: T[number],
): T[number] {
  return options.includes(value ?? '') ? (value as T[number]) : fallback
}

function getOptionGridClass(columns: OptionGroupProps<readonly string[]>['columns']) {
  return columns === 'two' ? 'grid-cols-2' : 'sm:grid-cols-3'
}

function OptionGroup<T extends readonly string[]>({
  label,
  options,
  value,
  onChange,
  columns = 'three',
  helperText,
}: OptionGroupProps<T>) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-stone-700">{label}</legend>
      {helperText ? (
        <p className="mt-1 text-xs leading-5 text-stone-500">{helperText}</p>
      ) : null}
      <div className={`mt-2 grid gap-2 ${getOptionGridClass(columns)}`}>
        {options.map((option) => {
          const isSelected = value === option

          return (
            <button
              className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                isSelected
                  ? 'border-stone-950 bg-stone-950 text-white'
                  : 'border-stone-200 bg-white text-stone-600 hover:border-stone-400 hover:text-stone-950'
              }`}
              key={option}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onChange(option)}
            >
              {option}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function toDateInputValue(dateValue: string | null) {
  return dateValue ? dateValue.slice(0, 10) : ''
}

function toFormState(card: PreferenceCard): CardFormState {
  const parsedDepartureCity = parseLocationText(card.departureCity)

  return {
    cardName: card.cardName,
    travelStyle: getValidOption(card.travelStyle, TRAVEL_STYLE_OPTIONS, '佛系慢游'),
    transportMode: getValidOption(
      card.transportMode,
      TRANSPORT_MODE_OPTIONS,
      '公共交通',
    ),
    driveMode:
      card.transportMode === '自驾'
        ? getValidOption(card.driveMode, DRIVE_MODE_OPTIONS, '当地租车自驾')
        : '',
    scenicPreference: getValidOption(
      card.scenicPreference,
      SCENIC_PREFERENCE_OPTIONS,
      '自然风光',
    ),
    departureCity:
      parsedDepartureCity ?? getDefaultLocationSelection('广东省广州市'),
    originalDepartureCity: parsedDepartureCity ? null : card.departureCity,
    companionType: getValidOption(
      card.companionType,
      COMPANION_TYPE_OPTIONS,
      '朋友结伴',
    ),
    travelDays: String(card.travelDays),
    startDate: toDateInputValue(card.startDate),
    weatherMode: getValidOption(card.weatherMode, WEATHER_MODE_OPTIONS, '参考天气'),
  }
}

function toRequestInput(form: CardFormState): PreferenceCardInput {
  return {
    cardName: form.cardName,
    travelStyle: form.travelStyle,
    transportMode: form.transportMode,
    driveMode: form.transportMode === '自驾' ? form.driveMode : null,
    scenicPreference: form.scenicPreference,
    departureCity: formatLocationSelection(form.departureCity),
    companionType: form.companionType,
    travelDays: Number(form.travelDays),
    startDate: form.startDate || null,
    weatherMode: form.weatherMode,
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请稍后重试'
}

function isAuthExpiredError(error: unknown) {
  return error instanceof CardsApiError && error.statusCode === 401
}

export function PreferenceCardFormPage({
  token,
  onAuthExpired,
}: PreferenceCardFormPageProps) {
  const navigate = useNavigate()
  const { cardId } = useParams()
  const isEditMode = Boolean(cardId)
  const parsedCardId = cardId ? Number(cardId) : null
  const [form, setForm] = useState<CardFormState>(initialFormState)
  const [loadStatus, setLoadStatus] = useState<'loading' | 'success' | 'error'>(
    isEditMode ? 'loading' : 'success',
  )
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isEditMode) {
      setForm(initialFormState)
      setLoadStatus('success')
      setErrorMessage('')
      return
    }

    if (!parsedCardId || !Number.isInteger(parsedCardId) || parsedCardId <= 0) {
      setLoadStatus('error')
      setErrorMessage('偏好卡片 ID 无效')
      return
    }

    let isActive = true

    const loadCard = async () => {
      setLoadStatus('loading')
      setErrorMessage('')

      try {
        const result = await fetchPreferenceCard(token, parsedCardId)

        if (!isActive) {
          return
        }

        setForm(toFormState(result.card))
        setLoadStatus('success')
      } catch (error) {
        if (!isActive) {
          return
        }

        if (isAuthExpiredError(error)) {
          onAuthExpired()
          return
        }

        setErrorMessage(getErrorMessage(error))
        setLoadStatus('error')
      }
    }

    void loadCard()

    return () => {
      isActive = false
    }
  }, [isEditMode, onAuthExpired, parsedCardId, token])

  const updateFormField = (field: keyof CardFormState, value: string) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  const updateDepartureCity = (value: LocationSelection) => {
    setForm((currentForm) => ({
      ...currentForm,
      departureCity: value,
      originalDepartureCity: null,
    }))
  }

  const updateTransportMode = (
    transportMode: (typeof TRANSPORT_MODE_OPTIONS)[number],
  ) => {
    setForm((currentForm) => ({
      ...currentForm,
      transportMode,
      driveMode:
        transportMode === '自驾'
          ? getValidOption(
              currentForm.driveMode,
              DRIVE_MODE_OPTIONS,
              '当地租车自驾',
            )
          : '',
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage('')

    try {
      const input = toRequestInput(form)

      if (isEditMode) {
        if (!parsedCardId) {
          throw new Error('偏好卡片 ID 无效')
        }

        await updatePreferenceCard(token, parsedCardId, input)
      } else {
        await createPreferenceCard(token, input)
      }

      navigate('/cards', { replace: true })
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
    <section className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-stone-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            className="inline-flex items-center gap-2 text-sm font-medium text-stone-500 transition hover:text-stone-950"
            to="/cards"
          >
            <ArrowLeft size={16} />
            返回偏好卡片
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-950">
            {isEditMode ? '编辑偏好卡片' : '新建偏好卡片'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-stone-500">
            保存常用出行参数，规划路线时可以快速复用。
          </p>
        </div>
      </div>

      {loadStatus === 'loading' ? (
        <p className="rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">
          正在读取偏好卡片...
        </p>
      ) : null}

      {loadStatus === 'error' ? (
        <p className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage || '偏好卡片加载失败'}
        </p>
      ) : null}

      {loadStatus === 'success' ? (
        <form
          className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]"
          onSubmit={handleSubmit}
        >
          <div className="space-y-5">
            <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-stone-950">
                基本信息
              </h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="text-sm font-medium text-stone-700">
                    卡片名称
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm outline-none transition focus:border-stone-950 focus:ring-4 focus:ring-stone-100"
                    required
                    type="text"
                    value={form.cardName}
                    onChange={(event) =>
                      updateFormField('cardName', event.target.value)
                    }
                    placeholder="例如：周末慢游"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-stone-700">
                    出游总时间（天）
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm outline-none transition focus:border-stone-950 focus:ring-4 focus:ring-stone-100"
                    min={1}
                    required
                    type="number"
                    value={form.travelDays}
                    onChange={(event) =>
                      updateFormField('travelDays', event.target.value)
                    }
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-stone-700">
                    出游起始日期
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm outline-none transition focus:border-stone-950 focus:ring-4 focus:ring-stone-100"
                    type="date"
                    value={form.startDate}
                    onChange={(event) =>
                      updateFormField('startDate', event.target.value)
                    }
                  />
                </label>
              </div>
            </section>

            <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-stone-950">
                出行偏好
              </h2>
              <div className="mt-4 space-y-5">
                <OptionGroup
                  label="出游风格"
                  options={TRAVEL_STYLE_OPTIONS}
                  value={form.travelStyle}
                  onChange={(value) => updateFormField('travelStyle', value)}
                />

                <fieldset>
                  <legend className="text-sm font-medium text-stone-700">
                    交通方式
                  </legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {TRANSPORT_MODE_OPTIONS.map((option) => {
                      const isSelected = form.transportMode === option

                      return (
                        <button
                          className={`rounded-lg border px-4 py-3 text-left transition ${
                            isSelected
                              ? 'border-stone-950 bg-stone-950 text-white'
                              : 'border-stone-200 bg-white text-stone-600 hover:border-stone-400 hover:text-stone-950'
                          }`}
                          key={option}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => updateTransportMode(option)}
                        >
                          <span className="block text-sm font-semibold">
                            {option}
                          </span>
                          <span
                            className={`mt-1 block text-xs leading-5 ${
                              isSelected ? 'text-stone-300' : 'text-stone-500'
                            }`}
                          >
                            {option === '公共交通'
                              ? '高铁、地铁、公交、步行组合'
                              : '适合更自由的路线节奏'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </fieldset>

                {form.transportMode === '自驾' ? (
                  <OptionGroup
                    columns="two"
                    helperText="自驾模式会影响取还车和跨城驾驶强度。"
                    label="自驾模式"
                    options={DRIVE_MODE_OPTIONS}
                    value={form.driveMode}
                    onChange={(value) => updateFormField('driveMode', value)}
                  />
                ) : null}

                <div className="grid gap-5 md:grid-cols-2">
                  <OptionGroup
                    label="景点偏好"
                    options={SCENIC_PREFERENCE_OPTIONS}
                    value={form.scenicPreference}
                    onChange={(value) =>
                      updateFormField('scenicPreference', value)
                    }
                  />
                  <OptionGroup
                    label="同行类型"
                    options={COMPANION_TYPE_OPTIONS}
                    value={form.companionType}
                    onChange={(value) => updateFormField('companionType', value)}
                  />
                </div>

                <LocationSelect
                  required
                  label="当前坐标城市"
                  value={form.departureCity}
                  onChange={updateDepartureCity}
                  helperText={
                    form.originalDepartureCity
                      ? `旧数据「${form.originalDepartureCity}」无法可靠匹配，请重新选择省/市/县。`
                      : undefined
                  }
                />

                <OptionGroup
                  columns="two"
                  label="天气模式"
                  options={WEATHER_MODE_OPTIONS}
                  value={form.weatherMode}
                  onChange={(value) => updateFormField('weatherMode', value)}
                />
              </div>
            </section>
          </div>

          <aside className="h-fit rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-stone-950">保存</h2>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              每个账号最多保存 10 张偏好卡片。
            </p>

            {errorMessage ? (
              <p className="mt-4 rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errorMessage}
              </p>
            ) : null}

            <div className="mt-5 flex flex-col gap-3">
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-stone-950 px-4 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
                disabled={isSubmitting}
                type="submit"
              >
                <Save size={16} />
                {isSubmitting
                  ? '保存中...'
                  : isEditMode
                    ? '保存修改'
                    : '创建卡片'}
              </button>
              <Link
                className="inline-flex h-11 items-center justify-center rounded-lg border border-stone-200 px-4 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
                to="/cards"
              >
                取消
              </Link>
            </div>
          </aside>
        </form>
      ) : null}
    </section>
  )
}
