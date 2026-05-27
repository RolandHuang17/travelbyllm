import { ChevronRight, RefreshCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  CardsApiError,
  fetchPreferenceCards,
  type PreferenceCard,
} from '../api/cards'
import { getPreferenceCardTransportLabel } from '../utils/preferenceCardDisplay'

type PreferenceCardSelectorProps = {
  token: string
  value: string
  onChange: (value: string) => void
  onSelectedCardChange?: (card: PreferenceCard | null) => void
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
      ? 'border-amber-500 bg-amber-50 text-amber-950 ring-2 ring-amber-100'
      : 'border-stone-200 bg-white text-stone-700 hover:border-amber-300 hover:bg-amber-50/70'
  }

  return isSelected
    ? 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-100'
    : 'border-stone-200 bg-white text-stone-700 hover:border-emerald-300 hover:bg-emerald-50/70'
}

function getAccentTextClass(accent: 'sky' | 'orange') {
  return accent === 'orange' ? 'text-amber-700' : 'text-emerald-700'
}

function CardNumber({ number, accent }: { number: number; accent: 'sky' | 'orange' }) {
  const accentClass =
    accent === 'orange'
      ? 'bg-amber-100 text-amber-800'
      : 'bg-emerald-100 text-emerald-800'

  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${accentClass}`}
    >
      {number}
    </span>
  )
}

function toDateInputValue(dateValue: string | null) {
  return dateValue ? dateValue.slice(0, 10) : ''
}

function CardSummary({ card }: { card: PreferenceCard }) {
  const startDate = toDateInputValue(card.startDate)

  return (
    <span className="mt-2 grid gap-1 text-xs leading-5 text-stone-500 sm:grid-cols-2">
      <span>{card.travelStyle}</span>
      <span>{getPreferenceCardTransportLabel(card)}</span>
      <span>{card.scenicPreference}</span>
      <span>{card.departureCity}</span>
      <span>{card.travelDays} 天</span>
      {startDate ? <span>{startDate} 出发</span> : null}
    </span>
  )
}

export function PreferenceCardSelector({
  token,
  value,
  onChange,
  onSelectedCardChange,
  onAuthExpired,
  accent = 'sky',
}: PreferenceCardSelectorProps) {
  const selectorRef = useRef<HTMLElement | null>(null)
  const [cards, setCards] = useState<PreferenceCard[]>([])
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  )
  const [errorMessage, setErrorMessage] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const selectedCardIndex = cards.findIndex((card) => String(card.id) === value)
  const selectedCard = selectedCardIndex >= 0 ? cards[selectedCardIndex] : null

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

  useEffect(() => {
    if (!isExpanded) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        selectorRef.current &&
        event.target instanceof Node &&
        !selectorRef.current.contains(event.target)
      ) {
        setIsExpanded(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsExpanded(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isExpanded])

  const handleSelect = (nextValue: string, card: PreferenceCard | null) => {
    onChange(nextValue)
    onSelectedCardChange?.(card)
    setIsExpanded(false)
  }

  const collapsedSummary = selectedCard ? (
    <span className="mt-3 flex gap-3 rounded-2xl bg-white/80 px-4 py-3 text-left ring-1 ring-stone-200">
      <CardNumber number={selectedCardIndex + 1} accent={accent} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-stone-950">
          {selectedCard.cardName}
        </span>
        <CardSummary card={selectedCard} />
      </span>
    </span>
  ) : (
    <span className="mt-3 block rounded-2xl bg-white/80 px-4 py-3 text-sm font-medium text-stone-700 ring-1 ring-stone-200">
      {status === 'loading' ? '正在读取偏好卡片...' : '本次不使用偏好卡片'}
    </span>
  )

  return (
    <section
      ref={selectorRef}
      className="relative rounded-2xl border border-stone-200 bg-stone-50/80 p-4"
    >
      <button
        className="w-full text-left"
        type="button"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((currentValue) => !currentValue)}
      >
        <span className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <span>
            <span className="block text-sm font-semibold text-stone-950">
              选择偏好卡片
            </span>
            <span className="mt-1 block text-xs leading-5 text-stone-500">
              复用常用出行配置，系统会自动填充重合字段。
            </span>
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-medium transition ${getAccentTextClass(
              accent,
            )}`}
          >
            {isExpanded ? '收起' : '横向选择'}
            <ChevronRight
              className={`transition ${isExpanded ? 'rotate-90 lg:rotate-0' : ''}`}
              size={14}
            />
          </span>
        </span>
        {collapsedSummary}
      </button>

      {isExpanded ? (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 space-y-2 rounded-2xl border border-stone-200 bg-white p-3 shadow-2xl shadow-stone-950/15 lg:left-full lg:right-auto lg:top-0 lg:ml-4 lg:mt-0 lg:w-[28rem]">
          <div className="flex items-center justify-between gap-3 border-b border-stone-100 pb-3">
            <div>
              <p className="text-sm font-semibold text-stone-950">已保存偏好</p>
              <p className="mt-1 text-xs text-stone-500">
                选择后会自动回填本次规划输入。
              </p>
            </div>
            <button
              className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-600 transition hover:border-stone-300 hover:text-stone-950 disabled:cursor-not-allowed disabled:text-stone-300"
              disabled={status === 'loading'}
              type="button"
              onClick={() => void loadCards()}
            >
              <RefreshCcw size={13} />
              刷新卡片
            </button>
          </div>

          <button
            className={`w-full rounded-2xl border px-4 py-3 text-left transition ${getAccentClasses(
              accent,
              value === '',
            )}`}
            type="button"
            aria-pressed={value === ''}
            onClick={() => handleSelect('', null)}
          >
            <span className="block text-sm font-semibold">本次不使用偏好卡片</span>
            <span className="mt-0.5 block text-xs text-stone-500">
              继续使用本次填写的补充要求生成方案。
            </span>
          </button>

          {status === 'loading' ? (
            <p className="rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-600">
              正在读取已保存偏好卡片...
            </p>
          ) : null}

          {status === 'error' ? (
            <p className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </p>
          ) : null}

          {status === 'success' && cards.length === 0 ? (
            <div className="rounded-xl bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-600">
              暂无偏好卡片，可先去偏好卡片页面创建，或继续使用补充要求。
            </div>
          ) : null}

          {status === 'success' && cards.length > 0 ? (
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {cards.map((card, index) => {
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
                    onClick={() => handleSelect(cardValue, card)}
                  >
                    <span className="flex gap-3">
                      <CardNumber number={index + 1} accent={accent} />
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
      ) : null}
    </section>
  )
}
