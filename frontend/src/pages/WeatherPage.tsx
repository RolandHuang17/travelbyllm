import {
  CalendarDays,
  CloudSun,
  Plus,
  RefreshCcw,
  ThermometerSun,
  Trash2,
  Wind,
} from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import {
  fetchWeatherSnapshot,
  WeatherApiError,
  type WeatherQueryInput,
} from '../api/weather'
import { WeatherSummaryCard } from '../components/WeatherSummaryCard'
import {
  formatLocationSelection,
  getDefaultLocationSelection,
  type LocationSelection,
} from '../utils/location'
import { LocationSelect } from '../components/LocationSelect'
import type { WeatherCitySnapshot, WeatherSnapshot } from '../types/weather'

type WeatherPageProps = {
  token: string
  onAuthExpired: () => void
}

type WeatherFormState = {
  cities: LocationSelection[]
  startDate: string
  days: string
}

const maxCityCount = 6

const initialFormState: WeatherFormState = {
  cities: [
    getDefaultLocationSelection('广东省广州市'),
    getDefaultLocationSelection('福建省厦门市'),
  ],
  startDate: '',
  days: '3',
}

const cityStatusLabelMap: Record<WeatherCitySnapshot['status'], string> = {
  success: '可用',
  'out-of-range': '展示近期参考',
  unavailable: '不可用',
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '天气查询失败，请稍后重试'
}

function isAuthExpiredError(error: unknown) {
  return error instanceof WeatherApiError && error.statusCode === 401
}

function normalizeDays(value: string) {
  const days = Number(value)

  return Number.isInteger(days) && days > 0 ? Math.min(days, 7) : 3
}

function toRequestInput(form: WeatherFormState): WeatherQueryInput {
  return {
    cities: form.cities.map(formatLocationSelection).filter(Boolean),
    startDate: form.startDate || null,
    days: normalizeDays(form.days),
  }
}

function formatReportTime(value: string | null) {
  if (!value) {
    return '未记录'
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function getCityStatusClassName(status: WeatherCitySnapshot['status']) {
  if (status === 'success') {
    return 'bg-emerald-50 text-emerald-700'
  }

  if (status === 'out-of-range') {
    return 'bg-sky-50 text-sky-700'
  }

  return 'bg-stone-100 text-stone-600'
}

function WeatherComparison({ snapshot }: { snapshot: WeatherSnapshot }) {
  const cities = snapshot.cities

  if (cities.length < 2) {
    return null
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-sky-700">
            Compare
          </p>
          <h3 className="mt-2 text-base font-semibold text-stone-950">
            多城市天气对比
          </h3>
        </div>
        <p className="text-xs text-stone-500">
          {snapshot.startDate
            ? `从 ${snapshot.startDate} 起`
            : '最近可用预报'}
          ，{snapshot.requestedDays} 天
        </p>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-stone-200">
        <div className="hidden grid-cols-[1.1fr_0.7fr_1.3fr_0.9fr_0.9fr] gap-3 bg-stone-50 px-4 py-3 text-xs font-medium text-stone-500 md:grid">
          <span>城市</span>
          <span>状态</span>
          <span>首日天气</span>
          <span>温度</span>
          <span>风力 / 发布时间</span>
        </div>

        <div className="divide-y divide-stone-100">
          {cities.map((city) => {
            const firstForecast = city.forecasts[0]

            return (
              <div
                className="grid gap-3 px-4 py-4 text-sm text-stone-600 md:grid-cols-[1.1fr_0.7fr_1.3fr_0.9fr_0.9fr] md:items-center"
                key={`${city.requestedCity}-${city.city}`}
              >
                <div>
                  <p className="font-semibold text-stone-950">{city.city}</p>
                  <p className="mt-1 text-xs text-stone-400">
                    {city.province ?? city.requestedCity}
                  </p>
                </div>
                <span
                  className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${getCityStatusClassName(city.status)}`}
                >
                  {cityStatusLabelMap[city.status]}
                </span>
                <div>
                  {firstForecast ? (
                    <>
                      <p className="inline-flex items-center gap-1 font-medium text-stone-800">
                        <CloudSun size={15} />
                        {firstForecast.dayWeather}/{firstForecast.nightWeather}
                      </p>
                      <p className="mt-1 text-xs text-stone-400">
                        {firstForecast.date}
                      </p>
                    </>
                  ) : (
                    <p>{city.message ?? '暂无预报'}</p>
                  )}
                </div>
                <p className="inline-flex items-center gap-1">
                  <ThermometerSun size={15} />
                  {firstForecast
                    ? `${firstForecast.nightTemp}-${firstForecast.dayTemp}℃`
                    : '--'}
                </p>
                <p className="inline-flex flex-col gap-1 text-xs leading-5">
                  <span className="inline-flex items-center gap-1 text-sm text-stone-600">
                    <Wind size={15} />
                    {firstForecast
                      ? `${firstForecast.dayWind}风${firstForecast.dayPower}级`
                      : '--'}
                  </span>
                  <span className="text-stone-400">
                    {formatReportTime(city.reportTime)}
                  </span>
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function WeatherPage({ token, onAuthExpired }: WeatherPageProps) {
  const [form, setForm] = useState<WeatherFormState>(initialFormState)
  const [snapshot, setSnapshot] = useState<WeatherSnapshot | null>(null)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const selectedCities = useMemo(
    () => form.cities.map(formatLocationSelection).filter(Boolean),
    [form.cities],
  )
  const canAddCity = form.cities.length < maxCityCount

  const updateCity = (index: number, value: LocationSelection) => {
    setForm((currentForm) => ({
      ...currentForm,
      cities: currentForm.cities.map((city, cityIndex) =>
        cityIndex === index ? value : city,
      ),
    }))
  }

  const addCity = () => {
    if (!canAddCity) {
      return
    }

    setForm((currentForm) => ({
      ...currentForm,
      cities: [
        ...currentForm.cities,
        getDefaultLocationSelection('广东省深圳市'),
      ],
    }))
  }

  const removeCity = (index: number) => {
    setForm((currentForm) => ({
      ...currentForm,
      cities: currentForm.cities.filter((_city, cityIndex) => cityIndex !== index),
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')
    setErrorMessage('')

    const requestInput = toRequestInput(form)

    if (!requestInput.cities.length) {
      setErrorMessage('请至少选择一个城市')
      return
    }

    setIsSubmitting(true)

    try {
      const result = await fetchWeatherSnapshot(token, requestInput)

      setSnapshot(result.weatherSnapshot)
      setMessage('天气查询已更新')
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
    <section className="rounded-[1.75rem] border border-stone-200 bg-white p-6 shadow-[0_18px_70px_rgba(28,25,23,0.08)] sm:p-8">
      <div className="flex flex-col gap-4 border-b border-stone-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-700">
            Weather
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-stone-950">
            天气查询
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
            查询目的地或沿途城市的近期天气，提前判断降雨、温差和风力变化。
          </p>
        </div>

        <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-700">
          高德天气 Web Service
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <h3 className="text-base font-semibold text-stone-950">
              查询条件
            </h3>
            <p className="mt-1 text-sm text-stone-500">
              可添加多个城市，适合自驾路线或多目的地旅行前对比天气。
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-sm font-medium text-stone-700">城市</h4>
                <p className="mt-1 text-xs text-stone-500">
                  最多添加 {maxCityCount} 个城市。
                </p>
              </div>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-200 px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:border-stone-200 disabled:text-stone-300"
                disabled={!canAddCity}
                type="button"
                onClick={addCity}
              >
                <Plus size={16} />
                添加城市
              </button>
            </div>

            {form.cities.map((city, index) => (
              <div
                className="rounded-2xl border border-sky-100 bg-sky-50/45 p-4"
                key={`${city.provinceCode}-${city.cityCode}-${city.countyCode ?? 'none'}-${index}`}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-stone-700">
                    城市 {index + 1}
                  </p>
                  <button
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-100 px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-stone-300"
                    disabled={form.cities.length <= 1}
                    type="button"
                    onClick={() => removeCity(index)}
                  >
                    <Trash2 size={14} />
                    删除
                  </button>
                </div>
                <LocationSelect
                  label={`城市 ${index + 1}`}
                  value={city}
                  onChange={(value) => updateCity(index, value)}
                />
              </div>
            ))}
          </div>

          <label className="block">
            <span className="text-sm font-medium text-stone-700">出行日期</span>
            <div className="relative mt-2">
              <CalendarDays
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                size={17}
              />
              <input
                className="w-full rounded-xl border border-stone-200 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                type="date"
                value={form.startDate}
                onChange={(event) =>
                  setForm((currentForm) => ({
                    ...currentForm,
                    startDate: event.target.value,
                  }))
                }
              />
            </div>
            <p className="mt-1.5 text-xs leading-5 text-stone-500">
              不选择日期时，展示最近可用预报。
            </p>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-stone-700">查询天数</span>
            <input
              className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
              max={7}
              min={1}
              type="number"
              value={form.days}
              onChange={(event) =>
                setForm((currentForm) => ({
                  ...currentForm,
                  days: event.target.value,
                }))
              }
            />
          </label>

          {selectedCities.length ? (
            <p className="rounded-xl bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-600">
              当前查询：{selectedCities.join('、')}
            </p>
          ) : null}

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
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-stone-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? (
              <>
                <RefreshCcw className="animate-spin" size={16} />
                查询中...
              </>
            ) : (
              <>
                <CloudSun size={16} />
                查询天气
              </>
            )}
          </button>
        </form>

        <div className="min-h-96 rounded-2xl border border-stone-200 bg-stone-50/80 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-stone-950">
                查询结果
              </h3>
              <p className="mt-1 text-sm text-stone-500">
                结果来自高德天气预报，远期日期会显示可用范围限制。
              </p>
            </div>
          </div>

          {isSubmitting ? (
            <div className="mt-6 rounded-xl bg-white px-5 py-6 text-sm leading-6 text-stone-600">
              正在获取天气预报...
            </div>
          ) : snapshot ? (
            <div className="mt-6 space-y-4">
              <WeatherSummaryCard snapshot={snapshot} />
              <WeatherComparison snapshot={snapshot} />
            </div>
          ) : (
            <div className="mt-6 rounded-xl bg-white px-5 py-6 text-sm leading-6 text-stone-600">
              选择城市和日期后查询天气。支持添加多个城市进行对比。
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
