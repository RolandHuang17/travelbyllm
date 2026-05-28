import {
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  Clock3,
  Hotel,
  Info,
  Lightbulb,
  MapPinned,
  Navigation,
  Route,
  ShieldCheck,
} from 'lucide-react'
import type {
  StructuredDataSource,
  StructuredItinerary,
  StructuredItineraryDay,
  StructuredItineraryReturnTrip,
  StructuredItineraryTimelineItem,
  StructuredItineraryTransition,
} from '../types/structuredItinerary'

type StructuredItineraryViewProps = {
  itinerary: StructuredItinerary | null
  markdown: string
  title: string
  createdAt?: string
}

function formatDateTime(value?: string) {
  return value ? new Date(value).toLocaleString() : ''
}

function safeArray<T>(value: T[] | null | undefined) {
  return Array.isArray(value) ? value : []
}

function sourceLabel(source: StructuredDataSource) {
  const labels: Record<StructuredDataSource, string> = {
    user: '用户输入',
    amap: '高德验证',
    weather: '天气服务',
    llm_advice: '规划建议',
  }

  return labels[source]
}

function SourceBadge({
  source,
  verified,
}: {
  source: StructuredDataSource
  verified: boolean
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium ${
        verified
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-slate-50 text-slate-500'
      }`}
    >
      {verified ? <BadgeCheck size={12} /> : <Info size={12} />}
      {sourceLabel(source)}
    </span>
  )
}

function hasTransitionDetail(transition: StructuredItineraryTransition | null) {
  return transition && Object.values(transition).some(Boolean)
}

function TransitionLine({
  transition,
}: {
  transition: StructuredItineraryTransition | null
}) {
  if (!hasTransitionDetail(transition)) {
    return null
  }

  return (
    <div className="mt-3 border-l border-slate-200 pl-3 text-xs leading-5 text-slate-500">
      <p className="font-medium text-slate-700">
        {transition?.fromPlaceName || '上一地点'} {'->'}{' '}
        {transition?.toPlaceName || '当前地点'}
      </p>
      <p className="mt-1">
        {[
          transition?.transportMode,
          transition?.durationText,
          transition?.distanceText,
        ]
          .filter(Boolean)
          .join(' / ')}
      </p>
      {transition?.note ? <p className="mt-1">{transition.note}</p> : null}
    </div>
  )
}

function ReturnTripBlock({
  returnTrip,
}: {
  returnTrip: StructuredItineraryReturnTrip | null
}) {
  if (!returnTrip) {
    return null
  }

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
        <Route size={17} />
        最后一晚回程
      </div>
      <p className="mt-3 text-sm leading-6 text-emerald-900">
        {returnTrip.description}
      </p>
      <dl className="mt-4 grid gap-3 text-xs text-emerald-800 sm:grid-cols-2">
        <div>
          <dt className="text-emerald-600">路线</dt>
          <dd className="mt-1 font-medium">
            {returnTrip.fromCity || '最后游玩城市'} {'->'}{' '}
            {returnTrip.toCity || '出发城市'}
          </dd>
        </div>
        <div>
          <dt className="text-emerald-600">时间</dt>
          <dd className="mt-1 font-medium">
            {returnTrip.departureTime || '最后一天晚上'}；{returnTrip.arrivalTime || '晚上到家'}
          </dd>
        </div>
        <div>
          <dt className="text-emerald-600">方式</dt>
          <dd className="mt-1 font-medium">
            {returnTrip.transportMode || '按实际交通选择'}
          </dd>
        </div>
        <div>
          <dt className="text-emerald-600">预计</dt>
          <dd className="mt-1 font-medium">
            {returnTrip.durationText || '按实际路线核对'}；{returnTrip.distanceText || '按实际路线核对'}
          </dd>
        </div>
      </dl>
      {returnTrip.note ? (
        <p className="mt-3 text-xs leading-5 text-emerald-700">
          {returnTrip.note}
        </p>
      ) : null}
    </section>
  )
}

function TimelineRow({
  item,
  index,
}: {
  item: StructuredItineraryTimelineItem
  index: number
}) {
  return (
    <div className="grid gap-3 border-t border-slate-100 py-4 first:border-t-0 first:pt-0 sm:grid-cols-[6rem_1fr]">
      <div>
        <p className="text-xs font-semibold text-teal-700">
          {item.timeOfDay || `安排 ${index + 1}`}
        </p>
        {item.timeWindow ? (
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {item.timeWindow}
          </p>
        ) : null}
      </div>
      <div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-950">
              {item.title}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
              {item.placeName ? (
                <span className="inline-flex items-center gap-1">
                  <MapPinned size={13} />
                  {item.placeName}
                </span>
              ) : null}
              {item.durationText ? (
                <span className="inline-flex items-center gap-1">
                  <Clock3 size={13} />
                  {item.durationText}
                </span>
              ) : null}
              {item.transport ? <span>{item.transport}</span> : null}
            </div>
          </div>
          <SourceBadge source={item.source} verified={item.verified} />
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {item.description}
        </p>
        {item.reason ? (
          <p className="mt-2 flex gap-2 text-xs leading-5 text-teal-800">
            <Lightbulb className="mt-0.5 shrink-0" size={14} />
            <span>{item.reason}</span>
          </p>
        ) : null}
        <TransitionLine transition={item.transition} />
      </div>
    </div>
  )
}

function DaySection({ day }: { day: StructuredItineraryDay }) {
  const timelineItems = safeArray(day.timelineItems)
  const transportCards = safeArray(day.transportCards)
  const placeCards = safeArray(day.placeCards)
  const lodgingAdvice = safeArray(day.lodgingAreaAdvice)

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">Day {day.day}</p>
          <h4 className="mt-1 text-base font-semibold text-slate-950">
            {day.title}
          </h4>
        </div>
        {day.city ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
            <MapPinned size={13} />
            {day.city}
          </span>
        ) : null}
      </div>

      <div className="mt-4 rounded-xl bg-teal-50/70 px-4 py-3 text-sm leading-6 text-teal-900">
        <p className="flex items-center gap-2 font-semibold">
          <Navigation size={15} />
          当天打法
        </p>
        <p className="mt-1">{day.strategy}</p>
      </div>

      {transportCards.length ? (
        <section className="mt-5">
          <h5 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Route size={15} />
            交通与切换
          </h5>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {transportCards.map((card, index) => (
              <div
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                key={`${card.route}-${index}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">
                    {card.title}
                  </p>
                  <SourceBadge source={card.source} verified={card.verified} />
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  {card.route}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                  {card.mode ? <span>{card.mode}</span> : null}
                  {card.durationText ? <span>{card.durationText}</span> : null}
                  {card.distanceText ? <span>{card.distanceText}</span> : null}
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  {card.reason}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {timelineItems.length ? (
        <section className="mt-5">
          <h5 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <CalendarDays size={15} />
            景点时间线
          </h5>
          <div className="mt-3">
            {timelineItems.map((item, index) => (
              <TimelineRow
                index={index}
                item={item}
                key={`${day.day}-${item.title}-${index}`}
              />
            ))}
          </div>
        </section>
      ) : null}

      {placeCards.length ? (
        <section className="mt-5">
          <h5 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <MapPinned size={15} />
            地点建议
          </h5>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {placeCards.map((place) => (
              <div
                className="rounded-xl border border-slate-200 px-4 py-3"
                key={`${day.day}-${place.name}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {place.name}
                    </p>
                    {place.city || place.addressHint ? (
                      <p className="mt-1 text-xs text-slate-500">
                        {[place.city, place.addressHint].filter(Boolean).join(' / ')}
                      </p>
                    ) : null}
                  </div>
                  <SourceBadge
                    source={place.source}
                    verified={place.verified}
                  />
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  {place.description}
                </p>
                {place.durationText ? (
                  <p className="mt-2 text-xs font-medium text-slate-500">
                    建议停留：{place.durationText}
                  </p>
                ) : null}
                {place.visitTips.length ? (
                  <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-500">
                    {place.visitTips.map((tip) => (
                      <li key={tip}>- {tip}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {lodgingAdvice.length ? (
        <section className="mt-5 rounded-xl bg-stone-50 px-4 py-3">
          <h5 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
            <Hotel size={15} />
            住宿区域建议
          </h5>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {lodgingAdvice.map((advice) => (
              <div key={`${day.day}-${advice.area}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-stone-900">
                    {advice.area}
                  </p>
                  <SourceBadge
                    source={advice.source}
                    verified={advice.verified}
                  />
                </div>
                <p className="mt-2 text-xs leading-5 text-stone-600">
                  {advice.reason}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {safeArray(day.alternatives).length || safeArray(day.riskNotes).length ? (
        <section className="mt-5 grid gap-3 lg:grid-cols-2">
          {safeArray(day.alternatives).length ? (
            <div className="rounded-xl bg-sky-50 px-4 py-3">
              <p className="flex items-center gap-2 text-xs font-semibold text-sky-800">
                <Lightbulb size={14} />
                备选方案
              </p>
              <ul className="mt-2 space-y-1 text-xs leading-5 text-sky-700">
                {day.alternatives.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {safeArray(day.riskNotes).length ? (
            <div className="rounded-xl bg-amber-50 px-4 py-3">
              <p className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                <AlertTriangle size={14} />
                风险提示
              </p>
              <ul className="mt-2 space-y-1 text-xs leading-5 text-amber-700">
                {day.riskNotes.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </article>
  )
}

export function StructuredItineraryView({
  itinerary,
  markdown,
  title,
  createdAt,
}: StructuredItineraryViewProps) {
  if (!itinerary) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {createdAt ? (
          <p className="mt-1 text-xs text-slate-500">
            生成时间：{formatDateTime(createdAt)}
          </p>
        ) : null}
        <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
          {markdown}
        </p>
      </section>
    )
  }

  const days = safeArray(itinerary.days)
  const overview = itinerary.overview
  const supplements = safeArray(itinerary.supplements)
  const dataQualityNotes = safeArray(itinerary.dataQualityNotes)

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-teal-700">
              Rich Guide V{itinerary.version}
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
              {itinerary.title || title}
            </h3>
            {createdAt ? (
              <p className="mt-1 text-xs text-slate-500">
                生成时间：{formatDateTime(createdAt)}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800">
              {overview.pace}
            </span>
            {overview.bestFor.slice(0, 3).map((item) => (
              <span
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                key={item}
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        {itinerary.summary ? (
          <p className="mt-4 text-sm leading-6 text-slate-600">
            {itinerary.summary}
          </p>
        ) : null}

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold text-slate-500">路线概览</p>
            <p className="mt-2 text-sm leading-6 text-slate-800">
              {overview.routeSummary}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold text-slate-500">攻略重点</p>
            <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-700">
              {overview.highlights.slice(0, 5).map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <ShieldCheck size={14} />
            数据依据
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {overview.dataBasis.map((item) => (
              <span
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500"
                key={item}
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {days.length ? (
        <div className="space-y-4">
          {days.map((day) => (
            <DaySection day={day} key={`${day.day}-${day.title}`} />
          ))}
        </div>
      ) : null}

      <ReturnTripBlock returnTrip={itinerary.returnTrip ?? null} />

      {supplements.length ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h4 className="text-sm font-semibold text-slate-900">补充攻略</h4>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {supplements.map((supplement) => (
              <div
                className="border-t border-slate-100 pt-3 first:border-t-0 first:pt-0 lg:border-t-0 lg:pt-0"
                key={supplement.title}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">
                    {supplement.title}
                  </p>
                  <SourceBadge
                    source={supplement.source}
                    verified={supplement.verified}
                  />
                </div>
                <ul className="mt-2 space-y-1.5 text-sm leading-6 text-slate-600">
                  {supplement.items.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {dataQualityNotes.length ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ShieldCheck size={16} />
            数据可信度
          </h4>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {dataQualityNotes.map((note) => (
              <div
                className="rounded-xl bg-slate-50 px-4 py-3"
                key={`${note.label}-${note.detail}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">
                    {note.label}
                  </p>
                  <SourceBadge source={note.source} verified={note.verified} />
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  {note.detail}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
