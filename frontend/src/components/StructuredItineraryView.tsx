import {
  AlertTriangle,
  Clock3,
  Lightbulb,
  MapPinned,
  Route,
} from 'lucide-react'
import type {
  StructuredItinerary,
  StructuredItineraryReturnTrip,
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

function hasTransitionDetail(transition: StructuredItineraryTransition | null) {
  return transition && Object.values(transition).some(Boolean)
}

function TransitionBlock({
  transition,
}: {
  transition: StructuredItineraryTransition | null
}) {
  if (!hasTransitionDetail(transition)) {
    return null
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-600">
      <p className="flex items-center gap-1.5 font-medium text-slate-900">
        <Route size={14} />
        地点切换
      </p>
      <p className="mt-1">
        {transition?.fromPlaceName || '上一地点'} {'->'}{' '}
        {transition?.toPlaceName || '当前地点'}
      </p>
      <div className="mt-1 flex flex-wrap gap-2">
        {transition?.transportMode ? (
          <span>方式：{transition.transportMode}</span>
        ) : null}
        {transition?.durationText ? (
          <span>耗时：{transition.durationText}</span>
        ) : null}
        {transition?.distanceText ? (
          <span>距离：{transition.distanceText}</span>
        ) : null}
      </div>
      {transition?.note ? (
        <p className="mt-1 text-slate-500">{transition.note}</p>
      ) : null}
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
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
        <Route size={17} />
        最后一晚回程安排
      </p>
      <p className="mt-2 text-sm leading-6 text-emerald-900">
        {returnTrip.description}
      </p>
      <div className="mt-3 grid gap-2 text-xs text-emerald-800 sm:grid-cols-2">
        <span className="rounded-xl bg-white/75 px-3 py-2">
          路线：{returnTrip.fromCity || '最后游玩城市'} {'->'}{' '}
          {returnTrip.toCity || '出发城市'}
        </span>
        <span className="rounded-xl bg-white/75 px-3 py-2">
          时间：{returnTrip.departureTime || '最后一天晚上'}；{returnTrip.arrivalTime || '晚上到家'}
        </span>
        <span className="rounded-xl bg-white/75 px-3 py-2">
          方式：{returnTrip.transportMode || '按实际交通选择'}
        </span>
        <span className="rounded-xl bg-white/75 px-3 py-2">
          预计：{returnTrip.durationText || '按实际路线核对'}；{returnTrip.distanceText || '按实际路线核对'}
        </span>
      </div>
      {returnTrip.note ? (
        <p className="mt-3 text-xs leading-5 text-emerald-700">
          {returnTrip.note}
        </p>
      ) : null}
    </div>
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
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {createdAt ? (
          <p className="mt-1 text-xs text-slate-500">
            生成时间：{formatDateTime(createdAt)}
          </p>
        ) : null}
        <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
          {markdown}
        </p>
      </div>
    )
  }

  const days = safeArray(itinerary.days)
  const notes = safeArray(itinerary.notes)

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-teal-700">
          Structured Itinerary V{itinerary.version}
        </p>
        <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
          {itinerary.title || title}
        </h3>
        {createdAt ? (
          <p className="mt-1 text-xs text-slate-500">
            生成时间：{formatDateTime(createdAt)}
          </p>
        ) : null}
        {itinerary.summary ? (
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {itinerary.summary}
          </p>
        ) : null}
      </div>

      {days.length ? (
        <div className="space-y-3">
          {days.map((day) => (
            <article
              className="rounded-2xl border border-slate-200 bg-white p-5"
              key={`${day.day}-${day.title}`}
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <h4 className="text-base font-semibold text-slate-900">
                  {day.title}
                </h4>
                {day.city ? (
                  <p className="text-xs font-medium text-slate-500">
                    {day.city}
                  </p>
                ) : null}
              </div>

              <div className="mt-4 space-y-3">
                {safeArray(day.items).map((item, index) => (
                  <div
                    className="grid gap-3 rounded-xl bg-slate-50 px-4 py-3 sm:grid-cols-[7rem_1fr]"
                    key={`${day.day}-${item.title}-${index}`}
                  >
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
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-semibold text-slate-900">
                          {item.title}
                        </p>
                        {item.durationText ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                            <Clock3 size={13} />
                            {item.durationText}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {item.description}
                      </p>
                      {item.reason ? (
                        <p className="mt-2 flex gap-2 rounded-xl border border-teal-100 bg-white px-3 py-2 text-xs leading-5 text-teal-800">
                          <Lightbulb className="mt-0.5 shrink-0" size={14} />
                          <span>{item.reason}</span>
                        </p>
                      ) : null}
                      <TransitionBlock transition={item.transition} />
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                        {item.placeName ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1">
                            <MapPinned size={13} />
                            {item.placeName}
                          </span>
                        ) : null}
                        {item.transport ? (
                          <span className="rounded-full bg-white px-2 py-1">
                            {item.transport}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {safeArray(day.alternatives).length ||
              safeArray(day.riskNotes).length ? (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {safeArray(day.alternatives).length ? (
                    <div className="rounded-xl bg-sky-50 px-4 py-3">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-sky-800">
                        <Lightbulb size={14} />
                        备选方案
                      </p>
                      <ul className="mt-2 space-y-1.5 text-xs leading-5 text-sky-700">
                        {safeArray(day.alternatives).map((alternative) => (
                          <li key={alternative}>- {alternative}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {safeArray(day.riskNotes).length ? (
                    <div className="rounded-xl bg-amber-50 px-4 py-3">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                        <AlertTriangle size={14} />
                        风险提示
                      </p>
                      <ul className="mt-2 space-y-1.5 text-xs leading-5 text-amber-700">
                        {safeArray(day.riskNotes).map((riskNote) => (
                          <li key={riskNote}>- {riskNote}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      <ReturnTripBlock returnTrip={itinerary.returnTrip ?? null} />

      {notes.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h4 className="text-sm font-semibold text-slate-900">注意事项</h4>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
            {notes.map((note) => (
              <li key={note}>- {note}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
