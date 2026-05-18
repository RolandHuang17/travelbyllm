import { useEffect, useState } from 'react'
import {
  CardsApiError,
  fetchPreferenceCards,
  type PreferenceCard,
} from '../api/cards'
import {
  getPreferenceCardEmoji,
  getPreferenceCardTransportLabel,
} from '../utils/preferenceCardDisplay'

type PreferenceCardSelectorProps = {
  token: string
  value: string
  onChange: (value: string) => void
  onAuthExpired: () => void
  accent?: 'sky' | 'orange'
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '偏好卡片加载失败'
}

function isAuthExpiredError(error: unknown) {
  return error instanceof CardsApiError && error.statusCode === 401
}

function getAccentClasses(accent: 'sky' | 'orange', isSelected: boolean) {
  if (accent === 'orange') {
    return isSelected
      ? 'border-orange-500 bg-orange-50 text-orange-900 ring-4 ring-orange-100'
      : 'border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50/70'
  }

  return isSelected
    ? 'border-sky-500 bg-sky-50 text-sky-900 ring-4 ring-sky-100'
    : 'border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50/70'
}

function getAccentTextClass(accent: 'sky' | 'orange') {
  return accent === 'orange' ? 'text-orange-700' : 'text-sky-700'
}

function CardSummary({ card }: { card: PreferenceCard }) {
  return (
    <span className="mt-2 grid gap-1 text-xs leading-5 text-slate-500 sm:grid-cols-2">
      <span>{card.travelStyle}</span>
      <span>{getPreferenceCardTransportLabel(card)}</span>
      <span>{card.scenicPreference}</span>
      <span>{card.departureCity}</span>
      <span>{card.travelDays} 天</span>
    </span>
  )
}

export function PreferenceCardSelector({
  token,
  value,
  onChange,
  onAuthExpired,
  accent = 'sky',
}: PreferenceCardSelectorProps) {
  const [cards, setCards] = useState<PreferenceCard[]>([])
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  )
  const [errorMessage, setErrorMessage] = useState('')

  const loadCards = async () => {
    setStatus('loading')
    setErrorMessage('')

    try {
      const result = await fetchPreferenceCards(token)

      setCards(result.cards)
      setStatus('success')
    } catch (error) {
      if (isAuthExpiredError(error)) {
        onAuthExpired()
        return
      }

      setErrorMessage(getErrorMessage(error))
      setStatus('error')
    }
  }

  useEffect(() => {
    let isActive = true

    const loadInitialCards = async () => {
      try {
        const result = await fetchPreferenceCards(token)

        if (!isActive) {
          return
        }

        setCards(result.cards)
        setStatus('success')
      } catch (error) {
        if (!isActive) {
          return
        }

        if (isAuthExpiredError(error)) {
          onAuthExpired()
          return
        }

        setErrorMessage(getErrorMessage(error))
        setStatus('error')
      }
    }

    void loadInitialCards()

    return () => {
      isActive = false
    }
  }, [onAuthExpired, token])

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">
            选择偏好卡片
          </h4>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            可选一张已保存偏好卡片复用字段，也可以不使用卡片，仅填写临时偏好。
          </p>
        </div>
        <button
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-300"
          disabled={status === 'loading'}
          type="button"
          onClick={() => void loadCards()}
        >
          刷新卡片
        </button>
      </div>

      <div className="mt-3 space-y-2">
        <button
          className={`w-full rounded-2xl border px-4 py-3 text-left transition ${getAccentClasses(
            accent,
            value === '',
          )}`}
          type="button"
          aria-pressed={value === ''}
          onClick={() => onChange('')}
        >
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-xl shadow-sm">
              🧭
            </span>
            <span>
              <span className="block text-sm font-semibold">
                本次不使用偏好卡片
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                继续使用本次填写的临时偏好生成方案。
              </span>
            </span>
          </span>
        </button>

        {status === 'loading' ? (
          <p className="rounded-xl bg-white px-4 py-3 text-sm text-slate-600">
            正在读取已保存偏好卡片...
          </p>
        ) : null}

        {status === 'error' ? (
          <p className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </p>
        ) : null}

        {status === 'success' && cards.length === 0 ? (
          <div className="rounded-xl bg-white px-4 py-3 text-sm leading-6 text-slate-600">
            暂无偏好卡片，可先去偏好卡片页创建，或继续使用临时偏好。
          </div>
        ) : null}

        {status === 'success' && cards.length > 0 ? (
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {cards.map((card) => {
              const cardValue = String(card.id)
              const isSelected = value === cardValue

              return (
                <button
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${getAccentClasses(
                    accent,
                    isSelected,
                  )}`}
                  key={card.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onChange(cardValue)}
                >
                  <span className="flex gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
                      {getPreferenceCardEmoji(card)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <span className="truncate text-sm font-semibold">
                          {card.cardName}
                        </span>
                        {isSelected ? (
                          <span
                            className={`text-xs font-semibold ${getAccentTextClass(
                              accent,
                            )}`}
                          >
                            已选择
                          </span>
                        ) : null}
                      </span>
                      <CardSummary card={card} />
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    </section>
  )
}
