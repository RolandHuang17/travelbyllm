import {
  CalendarDays,
  CloudSun,
  MapPin,
  Pencil,
  Plus,
  RefreshCcw,
  Route,
  Trash2,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CardsApiError,
  deletePreferenceCard,
  fetchPreferenceCards,
  type PreferenceCard,
} from '../api/cards'
import { getPreferenceCardTransportLabel } from '../utils/preferenceCardDisplay'

type PreferenceCardsPanelProps = {
  token: string
  onAuthExpired: () => void
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请稍后重试'
}

function isAuthExpiredError(error: unknown) {
  return error instanceof CardsApiError && error.statusCode === 401
}

function toDateInputValue(dateValue: string | null) {
  return dateValue ? dateValue.slice(0, 10) : '未设置'
}

function CardMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-xs text-stone-400">{label}</span>
        <span className="mt-1 block truncate text-sm font-medium text-stone-800">
          {value}
        </span>
      </span>
    </div>
  )
}

function PreferenceCardItem({
  card,
  index,
  isDeleting,
  onDelete,
}: {
  card: PreferenceCard
  index: number
  isDeleting: boolean
  onDelete: (card: PreferenceCard) => void
}) {
  return (
    <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm transition hover:border-stone-300 hover:shadow-md">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-950 text-sm font-semibold text-white">
              {index + 1}
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-stone-950">
                {card.cardName}
              </h3>
              <p className="mt-1 text-xs text-stone-500">
                更新于 {toDateInputValue(card.updatedAt)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <Link
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-stone-200 px-3 text-xs font-medium text-stone-700 transition hover:border-stone-400 hover:text-stone-950"
            to={`/cards/${card.id}/edit`}
          >
            <Pencil size={14} />
            编辑
          </Link>
          <button
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-100 px-3 text-xs font-medium text-rose-600 transition hover:border-rose-200 hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-stone-300"
            disabled={isDeleting}
            type="button"
            onClick={() => onDelete(card)}
          >
            <Trash2 size={14} />
            {isDeleting ? '删除中' : '删除'}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CardMetric
          icon={<Route size={16} />}
          label="风格 / 交通"
          value={`${card.travelStyle} · ${getPreferenceCardTransportLabel(card)}`}
        />
        <CardMetric
          icon={<MapPin size={16} />}
          label="坐标城市"
          value={card.departureCity}
        />
        <CardMetric
          icon={<Users size={16} />}
          label="同行类型"
          value={card.companionType}
        />
        <CardMetric
          icon={<CalendarDays size={16} />}
          label="时间"
          value={`${card.travelDays} 天 · ${toDateInputValue(card.startDate)}`}
        />
        <CardMetric
          icon={<CloudSun size={16} />}
          label="天气模式"
          value={card.weatherMode}
        />
        <CardMetric
          icon={<MapPin size={16} />}
          label="景点偏好"
          value={card.scenicPreference}
        />
      </div>
    </article>
  )
}

export function PreferenceCardsPanel({
  token,
  onAuthExpired,
}: PreferenceCardsPanelProps) {
  const [cards, setCards] = useState<PreferenceCard[]>([])
  const [listStatus, setListStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  )
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
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
    <section className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-stone-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-stone-400">
            Preference Cards
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-stone-950">
            偏好卡片
          </h1>
          <p className="mt-2 text-sm leading-6 text-stone-500">
            默认展示已保存的出行偏好，新建或编辑会进入独立页面。
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-300"
            disabled={listStatus === 'loading'}
            type="button"
            onClick={() => void loadCards()}
          >
            <RefreshCcw size={16} />
            刷新
          </button>
          <Link
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-stone-950 px-4 text-sm font-medium text-white transition hover:bg-stone-800"
            to="/cards/new"
          >
            <Plus size={16} />
            新建卡片
          </Link>
        </div>
      </div>

      {message ? (
        <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}

      {listStatus === 'loading' ? (
        <p className="rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">
          正在加载偏好卡片...
        </p>
      ) : null}

      {listStatus === 'success' && cards.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-300 bg-white px-6 py-10 text-center">
          <h2 className="text-base font-semibold text-stone-950">
            还没有偏好卡片
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-500">
            创建一张常用出行偏好，后续规划时可以直接复用。
          </p>
          <Link
            className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-stone-950 px-4 text-sm font-medium text-white transition hover:bg-stone-800"
            to="/cards/new"
          >
            <Plus size={16} />
            新建卡片
          </Link>
        </div>
      ) : null}

      {listStatus === 'success' && cards.length > 0 ? (
        <div className="space-y-4">
          {cards.map((card, index) => (
            <PreferenceCardItem
              card={card}
              index={index}
              isDeleting={deletingCardId === card.id}
              key={card.id}
              onDelete={(targetCard) => void handleDelete(targetCard)}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}
