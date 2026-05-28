import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../lib/prisma'
import {
  generateCityPlan,
  generateDrivePlan,
  optimizePlan,
} from './planService'
import {
  generateLlmText,
  getPublicLlmInfo,
  isLlmConfigured,
  LlmError,
} from './llmService'

vi.mock('../lib/prisma', () => ({
  prisma: {
    preferenceCard: {
      findFirst: vi.fn(),
    },
    travelRecord: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('./llmService', () => ({
  generateLlmText: vi.fn(),
  getPublicLlmInfo: vi.fn(() => ({
    configured: false,
    model: 'test-model',
  })),
  isLlmConfigured: vi.fn(() => false),
  LlmError: class LlmError extends Error {},
}))

function buildCompleteLlmOutput(recordType = 'single-city-plan') {
  return JSON.stringify({
    markdown: '# 模型增强方案\n\n模型生成的完整行程。',
    structuredItinerary: {
      version: 3,
      title: '模型增强方案',
      summary: '模型补齐了理由、交通切换、备选风险和回程。',
      recordType,
      overview: {
        routeSummary: '深圳出发，广州游玩，最后一晚回深圳。',
        pace: '轻松均衡',
        bestFor: ['周末短途'],
        highlights: ['越秀公园'],
        dataBasis: ['用户输入', '地图坐标由本地补齐'],
      },
      days: [
        {
          day: 1,
          title: 'Day 1：模型安排',
          city: '广东省广州市',
          strategy: '上午先完成低强度户外点，下午保留弹性。',
          items: [
            {
              timeOfDay: '上午',
              timeWindow: '09:00-11:30',
              durationText: '约 2 小时',
              title: '越秀公园游览',
              description: '用低强度户外点作为开场。',
              reason: '上午体力好且户外舒适，适合安排城市公园。',
              placeName: '越秀公园',
              city: '广东省广州市',
              addressHint: '广州市越秀区',
              transport: '地铁',
              transition: {
                fromPlaceName: '广东省深圳市',
                toPlaceName: '越秀公园',
                transportMode: '高铁+地铁',
                durationText: '约 2 小时',
                distanceText: '约 140 公里',
                note: '耗时和距离为规划参考。',
              },
            },
          ],
          timelineItems: [
            {
              source: 'llm_advice',
              verified: false,
              timeOfDay: '上午',
              timeWindow: '09:00-11:30',
              durationText: '约 2 小时',
              title: '越秀公园游览',
              description: '用低强度户外点作为开场。',
              reason: '上午体力好且户外舒适，适合安排城市公园。',
              placeName: '越秀公园',
              city: '广东省广州市',
              addressHint: '广州市越秀区',
              transport: '地铁',
              transition: {
                fromPlaceName: '广东省深圳市',
                toPlaceName: '越秀公园',
                transportMode: '高铁+地铁',
                durationText: '约 2 小时',
                distanceText: '约 140 公里',
                note: '耗时和距离为规划参考。',
              },
            },
          ],
          transportCards: [
            {
              source: 'llm_advice',
              verified: false,
              title: '深圳到越秀公园',
              mode: '高铁+地铁',
              route: '广东省深圳市 -> 越秀公园',
              departureText: '广东省深圳市',
              arrivalText: '越秀公园',
              durationText: '约 2 小时',
              distanceText: '约 140 公里',
              reason: '跨城后直接接城市公园，节奏较稳。',
            },
          ],
          placeCards: [
            {
              source: 'llm_advice',
              verified: false,
              name: '越秀公园',
              city: '广东省广州市',
              addressHint: '广州市越秀区',
              description: '城市公园适合低强度开场。',
              durationText: '约 2 小时',
              visitTips: ['出行前核对天气和开放规则。'],
            },
          ],
          lodgingAreaAdvice: [
            {
              source: 'llm_advice',
              verified: false,
              area: '越秀或公园前周边',
              reason: '交通衔接便利，便于晚间返回。',
            },
          ],
          alternatives: ['雨天改为广东省博物馆。'],
          riskNotes: ['出发前核对开放时间和天气。'],
        },
      ],
      mapPoints: [
        {
          day: 1,
          order: 1,
          name: '越秀公园',
          city: '广东省广州市',
          addressHint: '广州市越秀区',
          longitude: null,
          latitude: null,
          geocodeStatus: 'pending',
          source: 'llm_advice',
          verified: false,
          formattedAddress: null,
        },
      ],
      verifiedMapPoints: [],
      notes: ['距离和耗时为规划参考。'],
      supplements: [
        {
          source: 'llm_advice',
          verified: false,
          title: '核对清单',
          items: ['出行前核对天气和交通。'],
        },
      ],
      dataQualityNotes: [
        {
          source: 'llm_advice',
          verified: false,
          label: '供应商数据',
          detail: '未接入票务、酒店和门票供应商。',
        },
      ],
      returnTrip: {
        fromCity: '广东省广州市',
        toCity: '广东省深圳市',
        departureTime: 'Day 3 晚上 19:30 后',
        arrivalTime: '最后一天晚上到家',
        transportMode: '高铁',
        durationText: '约 2 小时',
        distanceText: '约 140 公里',
        description: '最后一天晚上从广东省广州市返回广东省深圳市。',
        note: '出行前核对班次。',
      },
    },
  })
}

function buildIncompleteLlmOutput() {
  return JSON.stringify({
    markdown: '# 模型缺字段方案\n\n缺少增强字段。',
    structuredItinerary: {
      version: 2,
      title: '模型缺字段方案',
      summary: '缺少增强字段。',
      recordType: 'single-city-plan',
      days: [
        {
          day: 1,
          title: 'Day 1：缺字段',
          city: '广东省广州市',
          items: [
            {
              timeOfDay: '上午',
              title: '越秀公园',
              description: '游览越秀公园。',
              placeName: '越秀公园',
              city: '广东省广州市',
              addressHint: '广州市越秀区',
              transport: '地铁',
            },
          ],
        },
      ],
      mapPoints: [],
      notes: [],
    },
  })
}

function buildSupplierPollutedLlmOutput() {
  return JSON.stringify({
    markdown:
      '# 含供应商字段方案\n\n建议乘坐 G123，票价￥88，入住广州花园酒店，评分4.8分，当前营业中。',
    structuredItinerary: {
      version: 3,
      title: '含供应商字段方案',
      summary: '模型错误写入了无来源供应商事实。',
      recordType: 'single-city-plan',
      overview: {
        routeSummary: '深圳到广州，最后一晚回深圳。',
        pace: '轻松',
        bestFor: ['短途'],
        highlights: ['广州花园酒店', 'G123'],
        dataBasis: ['票价￥88', '评分4.8分'],
      },
      days: [
        {
          day: 1,
          title: 'Day 1：G123 到广州花园酒店',
          city: '广东省广州市',
          strategy: '乘坐 G123，票价￥88，入住广州花园酒店。',
          items: [
            {
              timeOfDay: '上午',
              title: '乘坐 G123 后入住广州花园酒店',
              description: '票价￥88，酒店评分4.8分，当前营业中。',
              reason: 'G123 最方便。',
              placeName: '广州花园酒店',
              city: '广东省广州市',
              addressHint: '广州市越秀区',
              transport: 'G123',
              transition: {
                fromPlaceName: '广东省深圳市',
                toPlaceName: '广州花园酒店',
                transportMode: 'G123',
                durationText: '约 1 小时',
                distanceText: '约 140 公里',
                note: '票价￥88。',
              },
            },
          ],
          timelineItems: [],
          transportCards: [
            {
              source: 'llm_advice',
              verified: false,
              title: '乘坐 G123',
              mode: 'G123',
              route: '深圳 -> 广州 G123',
              departureText: '深圳北',
              arrivalText: '广州南',
              durationText: '约 1 小时',
              distanceText: '约 140 公里',
              reason: '票价￥88。',
            },
          ],
          placeCards: [
            {
              source: 'llm_advice',
              verified: false,
              name: '广州花园酒店',
              city: '广东省广州市',
              addressHint: '广州市越秀区',
              description: '评分4.8分，当前营业中。',
              durationText: '约 2 小时',
              visitTips: ['门票88元。'],
            },
          ],
          lodgingAreaAdvice: [
            {
              source: 'llm_advice',
              verified: false,
              area: '广州花园酒店',
              reason: '价格600元/晚，评分4.8分。',
            },
          ],
          alternatives: ['可改住广州花园酒店。'],
          riskNotes: ['广州花园酒店当前营业中。'],
        },
      ],
      mapPoints: [
        {
          day: 1,
          order: 1,
          name: '广州花园酒店',
          city: '广东省广州市',
          addressHint: '广州市越秀区',
          longitude: null,
          latitude: null,
          geocodeStatus: 'pending',
          source: 'llm_advice',
          verified: false,
          formattedAddress: null,
        },
      ],
      verifiedMapPoints: [],
      notes: ['G123 票价￥88。'],
      supplements: [
        {
          source: 'llm_advice',
          verified: false,
          title: '供应商事实',
          items: ['广州花园酒店评分4.8分，门票88元。'],
        },
      ],
      dataQualityNotes: [
        {
          source: 'llm_advice',
          verified: false,
          label: '供应商事实',
          detail: 'G123 与票价￥88 未核验。',
        },
      ],
      returnTrip: {
        fromCity: '广东省广州市',
        toCity: '广东省深圳市',
        departureTime: 'Day 1 晚上',
        arrivalTime: '最后一天晚上到家',
        transportMode: 'G123',
        durationText: '约 1 小时',
        distanceText: '约 140 公里',
        description: '乘坐 G123 返回。',
        note: '票价￥88。',
      },
    },
  })
}

const baseRecord = {
  id: 40,
  userId: 12,
  cardId: null,
  recordType: 'optimized-plan',
  inputSummary: '原输入摘要',
  resultTitle: '湖南省长沙市 3 天智能旅行方案',
  resultContent: '# 湖南省长沙市 3 天智能旅行方案\n\n原方案内容',
  structuredContent: JSON.stringify({
    version: 1,
    title: '湖南省长沙市 3 天智能旅行方案',
    summary: '原方案摘要',
    recordType: 'single-city-plan',
    days: [],
    mapPoints: [],
    notes: [],
  }),
  weatherInfo: null,
  weatherSnapshot: null,
  createdAt: new Date('2026-05-27T12:00:00Z'),
  updatedAt: new Date('2026-05-27T12:00:00Z'),
}

describe('optimizePlan title versioning', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    delete process.env.AMAP_WEB_SERVICE_KEY
    vi.mocked(isLlmConfigured).mockReturnValue(false)
    vi.mocked(getPublicLlmInfo).mockReturnValue({
      configured: false,
      model: 'test-model',
    })
    vi.mocked(generateLlmText).mockReset()
    vi.mocked(prisma.preferenceCard.findFirst).mockResolvedValue(null)

    vi.mocked(prisma.travelRecord.create).mockImplementation(async (input) => ({
      id: 100,
      userId: 12,
      cardId: input.data.cardId ?? null,
      recordType: input.data.recordType,
      inputSummary: input.data.inputSummary,
      resultTitle: input.data.resultTitle,
      resultContent: input.data.resultContent,
      structuredContent: input.data.structuredContent ?? null,
      weatherInfo: input.data.weatherInfo ?? null,
      weatherSnapshot: input.data.weatherSnapshot ?? null,
      createdAt: new Date('2026-05-28T12:00:00Z'),
      updatedAt: new Date('2026-05-28T12:00:00Z'),
    }))
  })

  it.each([
    ['湖南省长沙市 3 天智能旅行方案', '湖南省长沙市 3 天智能旅行方案 - 优化版'],
    [
      '湖南省长沙市 3 天智能旅行方案 - 优化版',
      '湖南省长沙市 3 天智能旅行方案 - 优化版#2',
    ],
    [
      '湖南省长沙市 3 天智能旅行方案 - 优化版#2',
      '湖南省长沙市 3 天智能旅行方案 - 优化版#3',
    ],
  ])('saves "%s" as "%s"', async (sourceTitle, expectedTitle) => {
    vi.mocked(prisma.travelRecord.findFirst).mockResolvedValue({
      ...baseRecord,
      resultTitle: sourceTitle,
      resultContent: `# ${sourceTitle}\n\n原方案内容`,
      structuredContent: JSON.stringify({
        version: 1,
        title: sourceTitle,
        summary: '原方案摘要',
        recordType: 'optimized-plan',
        days: [],
        mapPoints: [],
        notes: [],
      }),
    })

    const result = await optimizePlan(12, {
      recordId: 40,
      optimizeRequirement: '继续加景点',
    })

    expect(result.plan.title).toBe(expectedTitle)
    expect(result.plan.content.startsWith(`# ${expectedTitle}`)).toBe(true)
    expect(result.plan.structuredContent.title).toBe(expectedTitle)
    expect(result.record.resultTitle).toBe(expectedTitle)
  })
})

describe('enhanced itinerary planning', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    delete process.env.AMAP_WEB_SERVICE_KEY
    vi.mocked(isLlmConfigured).mockReturnValue(false)
    vi.mocked(getPublicLlmInfo).mockReturnValue({
      configured: false,
      model: 'test-model',
    })
    vi.mocked(generateLlmText).mockReset()
    vi.mocked(prisma.preferenceCard.findFirst).mockResolvedValue(null)

    vi.mocked(prisma.travelRecord.create).mockImplementation(async (input) => ({
      id: 200,
      userId: input.data.userId,
      cardId: input.data.cardId ?? null,
      recordType: input.data.recordType,
      inputSummary: input.data.inputSummary,
      resultTitle: input.data.resultTitle,
      resultContent: input.data.resultContent,
      structuredContent: input.data.structuredContent ?? null,
      weatherInfo: input.data.weatherInfo ?? null,
      weatherSnapshot: input.data.weatherSnapshot ?? null,
      createdAt: new Date('2026-05-28T12:00:00Z'),
      updatedAt: new Date('2026-05-28T12:00:00Z'),
    }))
  })

  it('adds v3 rich-guide details and a final-night return trip to city plans', async () => {
    const result = await generateCityPlan(12, {
      targetCity: '广东省广州市',
      departureCity: '广东省深圳市',
      travelDays: 3,
      startDate: null,
      cardId: null,
      temporaryPreference: null,
      weatherMode: null,
    })

    expect(result.plan.structuredContent.version).toBe(3)
    expect(result.plan.structuredContent.returnTrip?.fromCity).toBe(
      '广东省广州市',
    )
    expect(result.plan.structuredContent.returnTrip?.toCity).toBe(
      '广东省深圳市',
    )
    expect(result.plan.structuredContent.returnTrip?.arrivalTime).toContain(
      '晚上到家',
    )
    expect(result.plan.content).toContain('最后一晚回程安排')
    expect(result.plan.structuredContent.days).toHaveLength(3)
    expect(result.plan.structuredContent.overview.routeSummary).toBeTruthy()
    expect(result.plan.structuredContent.supplements.length).toBeGreaterThan(0)
    expect(result.plan.structuredContent.dataQualityNotes.length).toBeGreaterThan(0)
    expect(result.plan.structuredContent.verifiedMapPoints).toHaveLength(0)
    expect(
      result.plan.structuredContent.mapPoints.every(
        (point) => !point.verified && point.geocodeStatus === 'skipped',
      ),
    ).toBe(true)
    expect(result.plan.structuredContent.days[0].alternatives.length).toBeGreaterThan(0)
    expect(result.plan.structuredContent.days[0].riskNotes.length).toBeGreaterThan(0)
    expect(result.plan.structuredContent.days[0].strategy).toBeTruthy()
    expect(result.plan.structuredContent.days[0].timelineItems.length).toBeGreaterThan(0)
    expect(result.plan.structuredContent.days[0].transportCards.length).toBeGreaterThan(0)
    expect(result.plan.structuredContent.days[0].placeCards.length).toBeGreaterThan(0)
    expect(result.plan.structuredContent.days[0].lodgingAreaAdvice.length).toBeGreaterThan(0)
    expect(result.plan.structuredContent.days[0].items[0].reason).toBeTruthy()
    expect(
      result.plan.structuredContent.days[0].items[0].transition?.durationText,
    ).toBeTruthy()
    expect(
      result.plan.structuredContent.days[0].items[0].transition?.distanceText,
    ).toBeTruthy()
  })

  it('closes drive routes by returning to the departure city at night', async () => {
    const result = await generateDrivePlan(12, {
      departureCity: '广东省广州市',
      destinationCity: '福建省厦门市',
      waypointCities: ['广东省汕头市', '广东省潮州市'],
      travelDays: 4,
      startDate: null,
      cardId: null,
      temporaryPreference: null,
      weatherMode: null,
    })

    expect(result.plan.structuredContent.version).toBe(3)
    expect(result.plan.summary).toContain('广东省广州市')
    expect(result.plan.summary).toContain('最后一晚回到广东省广州市')
    expect(result.plan.structuredContent.returnTrip?.fromCity).toBe(
      '福建省厦门市',
    )
    expect(result.plan.structuredContent.returnTrip?.toCity).toBe(
      '广东省广州市',
    )
    expect(result.plan.structuredContent.returnTrip?.arrivalTime).toContain(
      '晚上到家',
    )
    expect(result.plan.structuredContent.days[0].strategy).toContain('驾驶')
    expect(result.plan.structuredContent.days[0].transportCards.length).toBeGreaterThan(0)
    expect(result.plan.content).toContain(
      '广东省广州市 -> 广东省汕头市 -> 广东省潮州市 -> 福建省厦门市 -> 广东省广州市',
    )
  })

  it('keeps legacy v2 geocoded map points as verified amap points during optimization', async () => {
    vi.mocked(prisma.travelRecord.findFirst).mockResolvedValue({
      ...baseRecord,
      recordType: 'single-city-plan',
      resultTitle: '襄阳 3 天智能旅行方案',
      resultContent: '# 襄阳 3 天智能旅行方案\n\n原方案内容',
      structuredContent: JSON.stringify({
        version: 2,
        title: '襄阳 3 天智能旅行方案',
        summary: '旧结构里已有高德坐标。',
        recordType: 'single-city-plan',
        days: [],
        mapPoints: [
          {
            day: 1,
            order: 1,
            name: '襄阳博物馆新馆',
            city: '襄阳市',
            addressHint: '襄城区凤雏大道与庞公路交汇处',
            longitude: 112.171912,
            latitude: 32.025295,
            geocodeStatus: 'success',
          },
          {
            day: 1,
            order: 2,
            name: '不可绘制地点',
            city: '襄阳市',
            addressHint: '地址待核对',
            longitude: null,
            latitude: null,
            geocodeStatus: 'failed',
          },
        ],
        notes: [],
      }),
    })

    const result = await optimizePlan(12, {
      recordId: 62,
      optimizeRequirement: '保留原方案并优化节奏',
    })

    expect(result.plan.structuredContent.version).toBe(3)
    expect(result.plan.structuredContent.verifiedMapPoints).toHaveLength(1)
    expect(result.plan.structuredContent.verifiedMapPoints[0]).toMatchObject({
      name: '襄阳博物馆新馆',
      source: 'amap',
      verified: true,
      geocodeStatus: 'success',
      longitude: 112.171912,
      latitude: 32.025295,
      formattedAddress: '襄城区凤雏大道与庞公路交汇处',
    })
    expect(
      result.plan.structuredContent.mapPoints.find(
        (point) => point.name === '不可绘制地点',
      ),
    ).toMatchObject({
      verified: false,
      geocodeStatus: 'skipped',
      longitude: null,
      latitude: null,
    })
  })

  it('completes parseable LLM output locally without a second model call', async () => {
    vi.mocked(isLlmConfigured).mockReturnValue(true)
    vi.mocked(getPublicLlmInfo).mockReturnValue({
      configured: true,
      model: 'test-model',
    })
    vi.mocked(generateLlmText).mockResolvedValueOnce(buildIncompleteLlmOutput())

    const result = await generateCityPlan(12, {
      targetCity: '广东省广州市',
      departureCity: '广东省深圳市',
      travelDays: 3,
      startDate: null,
      cardId: null,
      temporaryPreference: null,
      weatherMode: null,
    })

    expect(generateLlmText).toHaveBeenCalledTimes(1)
    expect(result.generationMode).toBe('llm')
    expect(result.plan.structuredContent.version).toBe(3)
    expect(result.plan.title).toBe('模型缺字段方案')
    expect(result.plan.structuredContent.days).toHaveLength(3)
    expect(result.plan.structuredContent.days[0].items[0].reason).toBeTruthy()
    expect(
      result.plan.structuredContent.days[0].items[0].transition?.distanceText,
    ).toBeTruthy()
    expect(result.plan.structuredContent.days[0].alternatives.length).toBeGreaterThan(0)
    expect(result.plan.structuredContent.days[0].timelineItems.length).toBeGreaterThan(0)
    expect(result.plan.structuredContent.days[0].transportCards.length).toBeGreaterThan(0)
    expect(result.plan.structuredContent.days[0].placeCards.length).toBeGreaterThan(0)
    expect(result.plan.structuredContent.days[0].lodgingAreaAdvice.length).toBeGreaterThan(0)
    expect(result.plan.structuredContent.returnTrip?.toCity).toBe(
      '广东省深圳市',
    )
  })

  it('keeps complete model details while returning after one model call', async () => {
    vi.mocked(isLlmConfigured).mockReturnValue(true)
    vi.mocked(getPublicLlmInfo).mockReturnValue({
      configured: true,
      model: 'test-model',
    })
    vi.mocked(generateLlmText).mockResolvedValueOnce(buildCompleteLlmOutput())

    const result = await generateCityPlan(12, {
      targetCity: '广东省广州市',
      departureCity: '广东省深圳市',
      travelDays: 1,
      startDate: null,
      cardId: null,
      temporaryPreference: null,
      weatherMode: null,
    })

    expect(generateLlmText).toHaveBeenCalledTimes(1)
    expect(result.generationMode).toBe('llm')
    expect(result.plan.structuredContent.version).toBe(3)
    expect(result.plan.structuredContent.overview.highlights).toContain(
      '越秀公园',
    )
    expect(result.plan.structuredContent.days[0].items[0].reason).toContain(
      '上午体力好',
    )
    expect(result.plan.structuredContent.days[0].strategy).toContain(
      '上午先完成',
    )
    expect(result.plan.structuredContent.days[0].transportCards[0].route).toBe(
      '广东省深圳市 -> 越秀公园',
    )
    expect(result.plan.structuredContent.returnTrip?.toCity).toBe(
      '广东省深圳市',
    )
  })

  it('filters unverified supplier facts from model structured output', async () => {
    vi.mocked(isLlmConfigured).mockReturnValue(true)
    vi.mocked(getPublicLlmInfo).mockReturnValue({
      configured: true,
      model: 'test-model',
    })
    vi.mocked(generateLlmText).mockResolvedValueOnce(
      buildSupplierPollutedLlmOutput(),
    )

    const result = await generateCityPlan(12, {
      targetCity: '广东省广州市',
      departureCity: '广东省深圳市',
      travelDays: 1,
      startDate: null,
      cardId: null,
      temporaryPreference: null,
      weatherMode: null,
    })

    const serializedStructured = JSON.stringify(result.plan.structuredContent)

    expect(serializedStructured).not.toContain('G123')
    expect(serializedStructured).not.toContain('￥')
    expect(serializedStructured).not.toContain('88元')
    expect(serializedStructured).not.toContain('600元')
    expect(serializedStructured).not.toContain('4.8分')
    expect(serializedStructured).not.toContain('营业中')
    expect(serializedStructured).not.toContain('广州花园酒店')
    expect(result.plan.content).not.toContain('G123')
    expect(result.plan.content).not.toContain('￥')
    expect(
      result.plan.structuredContent.days[0].placeCards.some((place) =>
        place.name.includes('酒店'),
      ),
    ).toBe(false)
    expect(
      result.plan.structuredContent.mapPoints.some((point) =>
        point.name.includes('酒店'),
      ),
    ).toBe(false)
    expect(result.plan.structuredContent.verifiedMapPoints).toHaveLength(0)
  })

  it('adds verified map points only after AMap geocode succeeds', async () => {
    process.env.AMAP_WEB_SERVICE_KEY = 'test-amap-key'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: '1',
        geocodes: [
          {
            formatted_address: '广东省广州市越秀区越秀公园',
            location: '113.264385,23.12911',
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateCityPlan(12, {
      targetCity: '广东省广州市',
      departureCity: '广东省深圳市',
      travelDays: 1,
      startDate: null,
      cardId: null,
      temporaryPreference: null,
      weatherMode: null,
    })

    expect(fetchMock).toHaveBeenCalled()
    expect(result.plan.structuredContent.verifiedMapPoints.length).toBeGreaterThan(0)
    expect(result.plan.structuredContent.verifiedMapPoints[0]).toMatchObject({
      source: 'amap',
      verified: true,
      geocodeStatus: 'success',
      formattedAddress: '广东省广州市越秀区越秀公园',
      longitude: 113.264385,
      latitude: 23.12911,
    })
  })

  it('falls back to enhanced mock output when LLM output is not parseable JSON', async () => {
    vi.mocked(isLlmConfigured).mockReturnValue(true)
    vi.mocked(getPublicLlmInfo).mockReturnValue({
      configured: true,
      model: 'test-model',
    })
    vi.mocked(generateLlmText).mockResolvedValueOnce('无法解析的模型内容')

    const result = await generateCityPlan(12, {
      targetCity: '广东省广州市',
      departureCity: '广东省深圳市',
      travelDays: 3,
      startDate: null,
      cardId: null,
      temporaryPreference: null,
      weatherMode: null,
    })

    expect(generateLlmText).toHaveBeenCalledTimes(1)
    expect(result.generationMode).toBe('mock-fallback')
    expect(result.plan.structuredContent.version).toBe(3)
    expect(result.plan.structuredContent.returnTrip?.toCity).toBe(
      '广东省深圳市',
    )
  })

  it('falls back promptly when the model request times out', async () => {
    vi.mocked(isLlmConfigured).mockReturnValue(true)
    vi.mocked(getPublicLlmInfo).mockReturnValue({
      configured: true,
      model: 'test-model',
    })
    vi.mocked(generateLlmText).mockRejectedValueOnce(
      new LlmError('大模型服务调用超时'),
    )

    const result = await generateDrivePlan(12, {
      departureCity: '广东省广州市',
      destinationCity: '福建省厦门市',
      waypointCities: ['广东省潮州市'],
      travelDays: 3,
      startDate: null,
      cardId: null,
      temporaryPreference: null,
      weatherMode: null,
    })

    expect(generateLlmText).toHaveBeenCalledTimes(1)
    expect(result.generationMode).toBe('mock-fallback')
    expect(result.plan.structuredContent.returnTrip?.toCity).toBe(
      '广东省广州市',
    )
  })

  it('does not fabricate weather when the user disables weather reference', async () => {
    const result = await generateCityPlan(12, {
      targetCity: '广东省广州市',
      departureCity: '广东省深圳市',
      travelDays: 3,
      startDate: null,
      cardId: null,
      temporaryPreference: null,
      weatherMode: '不参考天气',
    })

    expect(result.plan.weatherSnapshot?.status).toBe('disabled')
    expect(result.plan.content).toContain('未启用天气参考')
    expect(result.record.weatherInfo).toContain('未启用天气参考')
  })

  it('passes the disabled-weather limitation to the model prompt', async () => {
    vi.mocked(isLlmConfigured).mockReturnValue(true)
    vi.mocked(getPublicLlmInfo).mockReturnValue({
      configured: true,
      model: 'test-model',
    })
    vi.mocked(generateLlmText).mockResolvedValueOnce(buildCompleteLlmOutput())

    await generateCityPlan(12, {
      targetCity: '广东省广州市',
      departureCity: '广东省深圳市',
      travelDays: 1,
      startDate: null,
      cardId: null,
      temporaryPreference: null,
      weatherMode: '不参考天气',
    })

    const request = vi.mocked(generateLlmText).mock.calls[0]?.[0]

    expect(request?.messages[1].content).toContain('天气状态：disabled')
    expect(request?.messages[1].content).toContain('不要编造实时或远期天气')
  })
})
