import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildWeatherSnapshot } from './weatherService'

const originalAmapKey = process.env.AMAP_WEB_SERVICE_KEY

const amapForecasts = [
  {
    date: '2026-05-27',
    week: '3',
    dayweather: '小雨',
    nightweather: '中雨',
    daytemp: '28',
    nighttemp: '23',
    daywind: '西北',
    nightwind: '西北',
    daypower: '1-3',
    nightpower: '1-3',
  },
  {
    date: '2026-05-28',
    week: '4',
    dayweather: '多云',
    nightweather: '多云',
    daytemp: '29',
    nighttemp: '24',
    daywind: '北',
    nightwind: '北',
    daypower: '1-3',
    nightpower: '1-3',
  },
  {
    date: '2026-05-29',
    week: '5',
    dayweather: '阴',
    nightweather: '阴',
    daytemp: '26',
    nighttemp: '21',
    daywind: '西北',
    nightwind: '西北',
    daypower: '1-3',
    nightpower: '1-3',
  },
  {
    date: '2026-05-30',
    week: '6',
    dayweather: '晴',
    nightweather: '晴',
    daytemp: '30',
    nighttemp: '22',
    daywind: '南',
    nightwind: '南',
    daypower: '1-3',
    nightpower: '1-3',
  },
]

function createAmapResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json',
    },
    status: 200,
  })
}

function mockAmapFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input))

      if (url.pathname === '/v3/geocode/geo') {
        return createAmapResponse({
          status: '1',
          geocodes: [
            {
              adcode: '430100',
              city: '长沙市',
              province: '湖南',
            },
          ],
        })
      }

      if (url.pathname === '/v3/weather/weatherInfo') {
        return createAmapResponse({
          status: '1',
          forecasts: [
            {
              city: '长沙市',
              adcode: '430100',
              province: '湖南',
              reporttime: '2026-05-27 23:04:28',
              casts: amapForecasts,
            },
          ],
        })
      }

      throw new Error(`Unexpected Amap request: ${url.pathname}`)
    }),
  )
}

describe('buildWeatherSnapshot', () => {
  beforeEach(() => {
    process.env.AMAP_WEB_SERVICE_KEY = 'test-amap-key'
    mockAmapFetch()
  })

  afterEach(() => {
    if (originalAmapKey === undefined) {
      delete process.env.AMAP_WEB_SERVICE_KEY
    } else {
      process.env.AMAP_WEB_SERVICE_KEY = originalAmapKey
    }

    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns matching forecasts for a start date inside the Amap range', async () => {
    const snapshot = await buildWeatherSnapshot({
      cities: ['湖南省长沙市'],
      startDate: '2026-05-28',
      days: 2,
      weatherMode: '参考天气',
    })

    expect(snapshot.status).toBe('success')
    expect(snapshot.summary).toContain('真实天气参考')
    expect(snapshot.summary).toContain('长沙市 2026-05-28')
    expect(snapshot.cities[0]).toMatchObject({
      city: '长沙市',
      status: 'success',
      message: null,
    })
    expect(snapshot.cities[0].forecasts.map((forecast) => forecast.date)).toEqual([
      '2026-05-28',
      '2026-05-29',
    ])
  })

  it('keeps recent forecasts when the start date is beyond the Amap range', async () => {
    const snapshot = await buildWeatherSnapshot({
      cities: ['湖南省长沙市'],
      startDate: '2026-07-16',
      days: 3,
      weatherMode: '参考天气',
    })

    expect(snapshot.status).toBe('unavailable')
    expect(snapshot.summary).toBe(
      '出行日期 2026-07-16 超出高德近期预报范围，以下展示长沙市当前可用近期天气参考。',
    )
    expect(snapshot.cities[0]).toMatchObject({
      city: '长沙市',
      status: 'out-of-range',
      message:
        '出行日期 2026-07-16 超出高德近期预报范围，以下展示长沙市当前可用近期天气参考',
    })
    expect(snapshot.cities[0].forecasts.map((forecast) => forecast.date)).toEqual([
      '2026-05-27',
      '2026-05-28',
      '2026-05-29',
      '2026-05-30',
    ])
  })

  it('reports missing Amap key without calling the weather provider', async () => {
    delete process.env.AMAP_WEB_SERVICE_KEY

    const snapshot = await buildWeatherSnapshot({
      cities: ['湖南省长沙市'],
      startDate: '2026-05-28',
      days: 2,
      weatherMode: '参考天气',
    })

    expect(snapshot.status).toBe('unavailable')
    expect(snapshot.summary).toContain('未配置高德地图 Web 服务 Key')
    expect(snapshot.cities[0]).toMatchObject({
      requestedCity: '湖南省长沙市',
      city: '湖南省长沙市',
      status: 'unavailable',
      message: '未配置高德地图 Web 服务 Key',
      forecasts: [],
    })
    expect(fetch).not.toHaveBeenCalled()
  })
})
