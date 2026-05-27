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
      version: 2,
      title: '模型增强方案',
      summary: '模型补齐了理由、交通切换、备选风险和回程。',
      recordType,
      days: [
        {
          day: 1,
          title: 'Day 1：模型安排',
          city: '广东省广州市',
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
        },
      ],
      notes: ['距离和耗时为规划参考。'],
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

  it('adds v2 details and a final-night return trip to city plans', async () => {
    const result = await generateCityPlan(12, {
      targetCity: '广东省广州市',
      departureCity: '广东省深圳市',
      travelDays: 3,
      startDate: null,
      cardId: null,
      temporaryPreference: null,
      weatherMode: null,
    })

    expect(result.plan.structuredContent.version).toBe(2)
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
    expect(result.plan.structuredContent.days[0].alternatives.length).toBeGreaterThan(0)
    expect(result.plan.structuredContent.days[0].riskNotes.length).toBeGreaterThan(0)
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

    expect(result.plan.structuredContent.version).toBe(2)
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
    expect(result.plan.content).toContain(
      '广东省广州市 -> 广东省汕头市 -> 广东省潮州市 -> 福建省厦门市 -> 广东省广州市',
    )
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
    expect(result.plan.title).toBe('模型缺字段方案')
    expect(result.plan.structuredContent.days).toHaveLength(3)
    expect(result.plan.structuredContent.days[0].items[0].reason).toBeTruthy()
    expect(
      result.plan.structuredContent.days[0].items[0].transition?.distanceText,
    ).toBeTruthy()
    expect(result.plan.structuredContent.days[0].alternatives.length).toBeGreaterThan(0)
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
    expect(result.plan.structuredContent.days[0].items[0].reason).toContain(
      '上午体力好',
    )
    expect(result.plan.structuredContent.returnTrip?.toCity).toBe(
      '广东省深圳市',
    )
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
    expect(result.plan.structuredContent.version).toBe(2)
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
