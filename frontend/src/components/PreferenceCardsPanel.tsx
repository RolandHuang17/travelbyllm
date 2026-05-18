import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  CardsApiError,
  createPreferenceCard,
  deletePreferenceCard,
  fetchPreferenceCards,
  updatePreferenceCard,
  type PreferenceCard,
  type PreferenceCardInput,
} from '../api/cards'
import { LocationSelect } from './LocationSelect'
import {
  formatLocationSelection,
  getDefaultLocationSelection,
  parseLocationText,
  type LocationSelection,
} from '../utils/location'
import {
  getPreferenceCardEmoji,
  getPreferenceCardTransportLabel,
} from '../utils/preferenceCardDisplay'

type PreferenceCardsPanelProps = {
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
  columns?: 'auto' | 'two' | 'three'
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
  if (columns === 'two') {
    return 'grid-cols-2'
  }

  if (columns === 'three') {
    return 'sm:grid-cols-3'
  }

  return 'sm:grid-cols-3'
}

function OptionGroup<T extends readonly string[]>({
  label,
  options,
  value,
  onChange,
  columns = 'auto',
  helperText,
}: OptionGroupProps<T>) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-slate-700">{label}</legend>
      {helperText ? (
        <p className="mt-1 text-xs leading-5 text-slate-500">{helperText}</p>
      ) : null}
      <div className={`mt-2 grid gap-2 ${getOptionGridClass(columns)}`}>
        {options.map((option) => {
          const isSelected = value === option

          return (
            <button
              className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                isSelected
                  ? 'border-sky-500 bg-sky-50 text-sky-800 ring-4 ring-sky-100'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50/60 hover:text-sky-700'
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

export function PreferenceCardsPanel({
  token,
  onAuthExpired,
}: PreferenceCardsPanelProps) {
  const [cards, setCards] = useState<PreferenceCard[]>([])
  const [listStatus, setListStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  )
  const [form, setForm] = useState<CardFormState>(initialFormState)
  const [editingCardId, setEditingCardId] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingCardId, setDeletingCardId] = useState<number | null>(null)

  const loadCards = useCallback(async () => {
    setListStatus('loading')
    setErrorMessage('')

    try {
      const result = await fetchPreferenceCards(token)

      setCards(result.cards)
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
    void loadCards()
  }, [loadCards])

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

  const resetForm = () => {
    setForm(initialFormState)
    setEditingCardId(null)
  }

  const handleEdit = (card: PreferenceCard) => {
    setForm(toFormState(card))
    setEditingCardId(card.id)
    setMessage('')
    setErrorMessage('')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setMessage('')
    setErrorMessage('')

    try {
      const input = toRequestInput(form)

      if (editingCardId) {
        await updatePreferenceCard(token, editingCardId, input)
        setMessage('偏好卡片已更新')
      } else {
        await createPreferenceCard(token, input)
        setMessage('偏好卡片已创建')
      }

      resetForm()
      await loadCards()
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

  const handleDelete = async (card: PreferenceCard) => {
    const shouldDelete = window.confirm(`确认删除偏好卡片「${card.cardName}」吗？`)

    if (!shouldDelete) {
      return
    }

    setDeletingCardId(card.id)
    setMessage('')
    setErrorMessage('')

    try {
      await deletePreferenceCard(token, card.id)
      setCards((currentCards) =>
        currentCards.filter((currentCard) => currentCard.id !== card.id),
      )
      setMessage('偏好卡片已删除')

      if (editingCardId === card.id) {
        resetForm()
      }
    } catch (error) {
      if (isAuthExpiredError(error)) {
        onAuthExpired()
        return
      }

      setErrorMessage(getErrorMessage(error))
    } finally {
      setDeletingCardId(null)
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
            Preference Cards
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">
            偏好卡片管理
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            这里会真实调用 `/api/cards`，用于保存后续旅游规划可以复用的出行偏好。
          </p>
        </div>

        <button
          className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-sky-200 hover:text-sky-700 disabled:cursor-not-allowed disabled:text-slate-300"
          disabled={listStatus === 'loading'}
          type="button"
          onClick={() => void loadCards()}
        >
          刷新列表
        </button>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {editingCardId ? '编辑卡片' : '创建卡片'}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              当前后端限制每个用户最多保存 10 张偏好卡片。
            </p>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">卡片名称</span>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
              required
              type="text"
              value={form.cardName}
              onChange={(event) =>
                updateFormField('cardName', event.target.value)
              }
              placeholder="例如：周末慢游"
            />
          </label>

          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <OptionGroup
                columns="three"
                label="出游风格"
                options={TRAVEL_STYLE_OPTIONS}
                value={form.travelStyle}
                onChange={(value) => updateFormField('travelStyle', value)}
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_35px_rgba(15,23,42,0.04)]">
              <div className="mb-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    交通方式
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    先选大类；选择自驾后再补充自驾模式。
                  </p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {TRANSPORT_MODE_OPTIONS.map((option) => {
                  const isSelected = form.transportMode === option

                  return (
                    <button
                      className={`rounded-2xl border px-4 py-3 text-left transition ${
                        isSelected
                          ? 'border-sky-500 bg-sky-50 text-sky-900 ring-4 ring-sky-100'
                          : 'border-slate-200 bg-slate-50/70 text-slate-600 hover:border-sky-200 hover:bg-sky-50/70'
                      }`}
                      key={option}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => updateTransportMode(option)}
                    >
                      <span className="block text-sm font-semibold">
                        {option}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        {option === '公共交通'
                          ? '高铁、地铁、公交、步行等低负担组合'
                          : '适合路线自由度更高的出行方式'}
                      </span>
                    </button>
                  )
                })}
              </div>

              {form.transportMode === '自驾' ? (
                <div className="mt-3 rounded-2xl border border-sky-100 bg-sky-50/60 p-3">
                  <OptionGroup
                    columns="two"
                    helperText="自驾模式会影响后续路线规划时对取还车、跨城驾驶强度的描述。"
                    label="自驾模式"
                    options={DRIVE_MODE_OPTIONS}
                    value={form.driveMode}
                    onChange={(value) => updateFormField('driveMode', value)}
                  />
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <OptionGroup
                  columns="auto"
                  label="景点偏好"
                  options={SCENIC_PREFERENCE_OPTIONS}
                  value={form.scenicPreference}
                  onChange={(value) =>
                    updateFormField('scenicPreference', value)
                  }
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <OptionGroup
                  columns="auto"
                  label="同行类型"
                  options={COMPANION_TYPE_OPTIONS}
                  value={form.companionType}
                  onChange={(value) => updateFormField('companionType', value)}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
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
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-sm font-medium text-slate-700">出游时间</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">
                    出游总时间（天）
                  </span>
                  <input
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                    min={1}
                    required
                    type="number"
                    value={form.travelDays}
                    onChange={(event) =>
                      updateFormField('travelDays', event.target.value)
                    }
                    placeholder="例如：3"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-slate-500">
                    出游起始日期
                  </span>
                  <input
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                    type="date"
                    value={form.startDate}
                    onChange={(event) =>
                      updateFormField('startDate', event.target.value)
                    }
                  />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <OptionGroup
                columns="two"
                label="天气模式"
                options={WEATHER_MODE_OPTIONS}
                value={form.weatherMode}
                onChange={(value) => updateFormField('weatherMode', value)}
              />
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

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              className="flex-1 rounded-xl bg-sky-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting
                ? '保存中...'
                : editingCardId
                  ? '保存修改'
                  : '创建卡片'}
            </button>

            {editingCardId ? (
              <button
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                type="button"
                onClick={resetForm}
              >
                取消编辑
              </button>
            ) : null}
          </div>
        </form>

        <div className="min-h-80 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                已保存卡片
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                当前共 {cards.length} 张，列表按最近更新时间排序。
              </p>
            </div>
          </div>

          {listStatus === 'loading' ? (
            <p className="mt-6 rounded-xl bg-white px-4 py-3 text-sm text-slate-600">
              正在加载偏好卡片...
            </p>
          ) : null}

          {listStatus === 'error' ? (
            <p className="mt-6 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage || '偏好卡片加载失败'}
            </p>
          ) : null}

          {listStatus === 'success' && cards.length === 0 ? (
            <div className="mt-6 rounded-xl bg-white px-5 py-6 text-sm leading-6 text-slate-600">
              还没有偏好卡片。先在左侧创建一张，后续旅游规划就可以直接复用它。
            </div>
          ) : null}

          {listStatus === 'success' && cards.length > 0 ? (
            <div className="mt-6 space-y-4">
              {cards.map((card) => (
                <article
                  className={`rounded-2xl border bg-white p-5 transition ${
                    editingCardId === card.id
                      ? 'border-sky-300 ring-4 ring-sky-100'
                      : 'border-slate-200'
                  }`}
                  key={card.id}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-2xl">
                        {getPreferenceCardEmoji(card)}
                      </span>
                      <h4 className="text-base font-semibold text-slate-900">
                        {card.cardName}
                      </h4>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-sky-200 hover:text-sky-700"
                        type="button"
                        onClick={() => handleEdit(card)}
                      >
                        编辑
                      </button>
                      <button
                        className="rounded-lg border border-rose-100 px-3 py-2 text-xs font-medium text-rose-600 transition hover:border-rose-200 hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-300"
                        disabled={deletingCardId === card.id}
                        type="button"
                        onClick={() => void handleDelete(card)}
                      >
                        {deletingCardId === card.id ? '删除中' : '删除'}
                      </button>
                    </div>
                  </div>

                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-slate-400">出游风格</dt>
                      <dd className="mt-1 font-medium text-slate-700">
                        {card.travelStyle}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">交通方式</dt>
                      <dd className="mt-1 font-medium text-slate-700">
                        {getPreferenceCardTransportLabel(card)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">景点偏好</dt>
                      <dd className="mt-1 font-medium text-slate-700">
                        {card.scenicPreference}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">当前坐标城市</dt>
                      <dd className="mt-1 font-medium text-slate-700">
                        {card.departureCity}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">同行类型</dt>
                      <dd className="mt-1 font-medium text-slate-700">
                        {card.companionType}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">出游起始日期</dt>
                      <dd className="mt-1 font-medium text-slate-700">
                        {toDateInputValue(card.startDate) || '未设置'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">天气模式</dt>
                      <dd className="mt-1 font-medium text-slate-700">
                        {card.weatherMode}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
