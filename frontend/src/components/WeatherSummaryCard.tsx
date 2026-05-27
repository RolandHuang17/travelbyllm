import {
  CalendarDays,
  CloudOff,
  CloudSun,
  MapPin,
  ThermometerSun,
  Wind,
} from 'lucide-react'
import {
  parseWeatherSnapshot,
  type WeatherCitySnapshot,
  type WeatherSnapshot,
} from '../types/weather'

type WeatherSummaryCardProps = {
  snapshot?: string | WeatherSnapshot | null
  fallbackText?: string | null
}

const statusLabelMap: Record<WeatherSnapshot['status'], string> = {
  success: '已接入实时预报',
  partial: '部分城市可用',
  disabled: '未参考天气',
  unavailable: '远期预报暂不可用',
}

const cityStatusLabelMap: Record<WeatherCitySnapshot['status'], string> = {
  success: '可用',
  'out-of-range': '展示近期参考',
  unavailable: '不可用',
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function getStatusClassName(status: WeatherSnapshot['status']) {
  if (status === 'success') {
    return 'border-emerald-100 bg-emerald-50 text-emerald-700'
  }

  if (status === 'partial') {
    return 'border-amber-100 bg-amber-50 text-amber-700'
  }

  return 'border-slate-200 bg-slate-50 text-slate-600'
}

function getCityStatusClassName(status: WeatherCitySnapshot['status']) {
  if (status === 'success') {
    return 'bg-emerald-50 text-emerald-700'
  }

  if (status === 'out-of-range') {
    return 'bg-sky-50 text-sky-700'
  }

  return 'bg-slate-100 text-slate-600'
}

function ForecastRow({ city }: { city: WeatherCitySnapshot }) {
  const visibleForecasts = city.forecasts

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <MapPin size={15} />
            <span className="truncate">{city.city}</span>
          </p>
          {city.province || city.reportTime ? (
            <p className="mt-1 text-xs text-slate-400">
              {[city.province, city.reportTime && `发布 ${city.reportTime}`]
                .filter(Boolean)
                .join(' · ')}
            </p>
          ) : null}
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${getCityStatusClassName(city.status)}`}
        >
          {cityStatusLabelMap[city.status]}
        </span>
      </div>

      {city.message ? (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
          {city.message}
        </p>
      ) : null}

      {visibleForecasts.length ? (
        <div className="mt-3 space-y-2">
          {visibleForecasts.map((forecast) => (
            <div
              className="grid gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 sm:grid-cols-[6.5rem_1fr]"
              key={`${city.city}-${forecast.date}`}
            >
              <p className="font-medium text-slate-900">{forecast.date}</p>
              <div className="grid gap-1 sm:grid-cols-3">
                <span className="inline-flex items-center gap-1">
                  <CloudSun size={13} />
                  {forecast.dayWeather}/{forecast.nightWeather}
                </span>
                <span className="inline-flex items-center gap-1">
                  <ThermometerSun size={13} />
                  {forecast.nightTemp}-{forecast.dayTemp}℃
                </span>
                <span className="inline-flex items-center gap-1">
                  <Wind size={13} />
                  {forecast.dayWind}风{forecast.dayPower}级
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function WeatherSummaryCard({
  snapshot,
  fallbackText,
}: WeatherSummaryCardProps) {
  const weatherSnapshot = parseWeatherSnapshot(snapshot)

  if (!weatherSnapshot && !fallbackText) {
    return null
  }

  if (!weatherSnapshot) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2">
          <CloudOff className="text-slate-400" size={18} />
          <h4 className="text-sm font-semibold text-slate-900">天气参考</h4>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">{fallbackText}</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-sky-700">
            Weather
          </p>
          <h4 className="mt-2 text-sm font-semibold text-slate-900">
            真实天气参考
          </h4>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium ${getStatusClassName(weatherSnapshot.status)}`}
        >
          {statusLabelMap[weatherSnapshot.status]}
        </span>
      </div>

      {weatherSnapshot.summary ? (
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {weatherSnapshot.summary}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1">
          <CalendarDays size={13} />
          {weatherSnapshot.startDate
            ? `出行日期 ${weatherSnapshot.startDate}`
            : '最近可用预报'}
        </span>
        {weatherSnapshot.generatedAt ? (
          <span className="rounded-full bg-slate-50 px-2.5 py-1">
            更新 {formatDateTime(weatherSnapshot.generatedAt)}
          </span>
        ) : null}
      </div>

      {weatherSnapshot.cities.length ? (
        <div className="mt-4 space-y-3">
          {weatherSnapshot.cities.map((city) => (
            <ForecastRow city={city} key={`${city.requestedCity}-${city.city}`} />
          ))}
        </div>
      ) : fallbackText ? (
        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
          {fallbackText}
        </p>
      ) : null}
    </div>
  )
}
