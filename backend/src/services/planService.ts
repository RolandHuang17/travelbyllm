import { prisma } from '../lib/prisma'
import {
  generateLlmText,
  getPublicLlmInfo,
  isLlmConfigured,
  LlmError,
} from './llmService'

type CityPlanInput = {
  targetCity: unknown
  departureCity: unknown
  travelDays: unknown
  cardId: unknown
  temporaryPreference: unknown
  weatherMode: unknown
}

type DrivePlanInput = {
  departureCity: unknown
  destinationCity: unknown
  waypointCities: unknown
  travelDays: unknown
  cardId: unknown
  temporaryPreference: unknown
  weatherMode: unknown
}

type OptimizePlanInput = {
  recordId: unknown
  optimizeRequirement: unknown
}

type NormalizedCityPlanInput = {
  targetCity: string
  departureCity: string | null
  travelDays: number | null
  cardId: number | null
  temporaryPreference: string | null
  weatherMode: string | null
}

type NormalizedDrivePlanInput = {
  departureCity: string
  destinationCity: string
  waypointCities: string[]
  travelDays: number
  cardId: number | null
  temporaryPreference: string | null
  weatherMode: string | null
}

type NormalizedOptimizePlanInput = {
  recordId: number
  optimizeRequirement: string
}

type PreferenceSnapshot = {
  id: number
  cardName: string
  travelStyle: string
  transportMode: string
  driveMode: string | null
  scenicPreference: string
  departureCity: string
  companionType: string
  travelDays: number
  startDate: Date | null
  weatherMode: string
}

type MockCityPlan = {
  title: string
  summary: string
  content: string
}

type CityPlanBuildResult = ReturnType<typeof buildMockCityPlan>
type DrivePlanBuildResult = ReturnType<typeof buildMockDrivePlan>
type OptimizePlanBuildResult = ReturnType<typeof buildMockOptimizedPlan>

export class PlanError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message)
  }
}

function normalizeRequiredString(value: unknown, fieldLabel: string) {
  if (typeof value !== 'string') {
    throw new PlanError(400, `${fieldLabel}不能为空`)
  }

  const normalizedValue = value.trim()

  if (!normalizedValue) {
    throw new PlanError(400, `${fieldLabel}不能为空`)
  }

  return normalizedValue
}

function normalizeOptionalString(value: unknown, fieldLabel: string) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value !== 'string') {
    throw new PlanError(400, `${fieldLabel}格式不正确`)
  }

  const normalizedValue = value.trim()

  return normalizedValue || null
}

function normalizeOptionalPositiveInteger(value: unknown, fieldLabel: string) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value
  }

  if (typeof value === 'string' && /^[1-9]\d*$/.test(value.trim())) {
    return Number(value)
  }

  throw new PlanError(400, `${fieldLabel}必须是正整数`)
}

function normalizeOptionalId(value: unknown, fieldLabel: string) {
  return normalizeOptionalPositiveInteger(value, fieldLabel)
}

function normalizeRequiredId(value: unknown, fieldLabel: string) {
  const normalizedValue = normalizeOptionalPositiveInteger(value, fieldLabel)

  if (!normalizedValue) {
    throw new PlanError(400, `${fieldLabel}格式不正确`)
  }

  return normalizedValue
}

function normalizeRequiredPositiveInteger(value: unknown, fieldLabel: string) {
  const normalizedValue = normalizeOptionalPositiveInteger(value, fieldLabel)

  if (!normalizedValue) {
    throw new PlanError(400, `${fieldLabel}必须是正整数`)
  }

  return normalizedValue
}

function normalizeWaypointCities(value: unknown) {
  if (value === null || value === undefined) {
    return []
  }

  if (!Array.isArray(value)) {
    throw new PlanError(400, '途经城市格式不正确')
  }

  return value.map((item) => normalizeRequiredString(item, '途经城市'))
}

function normalizeCityPlanInput(input: unknown): NormalizedCityPlanInput {
  if (!input || typeof input !== 'object') {
    throw new PlanError(400, '请求体格式不正确')
  }

  const cityPlanInput = input as CityPlanInput

  return {
    targetCity: normalizeRequiredString(cityPlanInput.targetCity, '目标城市'),
    departureCity: normalizeOptionalString(
      cityPlanInput.departureCity,
      '出发城市',
    ),
    travelDays: normalizeOptionalPositiveInteger(
      cityPlanInput.travelDays,
      '旅行天数',
    ),
    cardId: normalizeOptionalId(cityPlanInput.cardId, '偏好卡片 ID'),
    temporaryPreference: normalizeOptionalString(
      cityPlanInput.temporaryPreference,
      '临时偏好',
    ),
    weatherMode: normalizeOptionalString(cityPlanInput.weatherMode, '天气模式'),
  }
}

function normalizeDrivePlanInput(input: unknown): NormalizedDrivePlanInput {
  if (!input || typeof input !== 'object') {
    throw new PlanError(400, '请求体格式不正确')
  }

  const drivePlanInput = input as DrivePlanInput

  return {
    departureCity: normalizeRequiredString(
      drivePlanInput.departureCity,
      '出发城市',
    ),
    destinationCity: normalizeRequiredString(
      drivePlanInput.destinationCity,
      '目的城市',
    ),
    waypointCities: normalizeWaypointCities(drivePlanInput.waypointCities),
    travelDays: normalizeRequiredPositiveInteger(
      drivePlanInput.travelDays,
      '旅行天数',
    ),
    cardId: normalizeOptionalId(drivePlanInput.cardId, '偏好卡片 ID'),
    temporaryPreference: normalizeOptionalString(
      drivePlanInput.temporaryPreference,
      '临时偏好',
    ),
    weatherMode: normalizeOptionalString(drivePlanInput.weatherMode, '天气模式'),
  }
}

function normalizeOptimizePlanInput(input: unknown): NormalizedOptimizePlanInput {
  if (!input || typeof input !== 'object') {
    throw new PlanError(400, '请求体格式不正确')
  }

  const optimizePlanInput = input as OptimizePlanInput

  return {
    recordId: normalizeRequiredId(optimizePlanInput.recordId, '历史记录 ID'),
    optimizeRequirement: normalizeRequiredString(
      optimizePlanInput.optimizeRequirement,
      '优化要求',
    ),
  }
}

async function getPreferenceSnapshot(userId: number, cardId: number) {
  const card = await prisma.preferenceCard.findFirst({
    where: {
      id: cardId,
      userId,
    },
    select: {
      id: true,
      cardName: true,
      travelStyle: true,
      transportMode: true,
      driveMode: true,
      scenicPreference: true,
      departureCity: true,
      companionType: true,
      travelDays: true,
      startDate: true,
      weatherMode: true,
    },
  })

  if (!card) {
    throw new PlanError(404, '偏好卡片不存在')
  }

  return card
}

async function getTravelRecordSnapshot(userId: number, recordId: number) {
  const record = await prisma.travelRecord.findFirst({
    where: {
      id: recordId,
      userId,
    },
  })

  if (!record) {
    throw new PlanError(404, '历史记录不存在')
  }

  return record
}

function buildDailySchedule(targetCity: string, travelDays: number) {
  const dayThemes = [
    '抵达适应与城市初印象',
    '核心景点深度游览',
    '自然风光与慢节奏体验',
    '本地生活、街区漫步与美食',
    '轻松收尾与返程准备',
  ]

  return Array.from({ length: travelDays }, (_item, index) => {
    const dayNumber = index + 1
    const theme = dayThemes[index % dayThemes.length]

    return [
      `Day ${dayNumber}：${theme}`,
      `- 上午：围绕${targetCity}的代表性区域安排低压力游览。`,
      `- 下午：根据体力选择景点、街区或自然空间，避免行程过满。`,
      `- 晚上：预留用餐和休息时间，整理第二天路线。`,
    ].join('\n')
  }).join('\n\n')
}

function buildDriveDailySchedule(routeCities: string[], travelDays: number) {
  return Array.from({ length: travelDays }, (_item, index) => {
    const dayNumber = index + 1
    const currentCity = routeCities[index % routeCities.length]
    const nextCity = routeCities[(index + 1) % routeCities.length]

    if (dayNumber === travelDays) {
      return [
        `Day ${dayNumber}：${currentCity}收尾与返程准备`,
        `- 上午：安排${currentCity}轻量游览，优先选择停车和补给便利的区域。`,
        '- 下午：预留车辆整理、返程或继续前往下一段行程的时间。',
        '- 晚上：复盘路线消耗，避免最后一天安排过密。',
      ].join('\n')
    }

    return [
      `Day ${dayNumber}：${currentCity} -> ${nextCity}`,
      `- 上午：从${currentCity}出发，控制驾驶节奏，中途安排服务区休息。`,
      `- 下午：抵达${nextCity}后优先办理入住或停车，再安排低强度游览。`,
      '- 晚上：结合当地餐饮和夜间交通情况，预留充足休息时间。',
    ].join('\n')
  }).join('\n\n')
}

function buildMockCityPlan(
  input: NormalizedCityPlanInput,
  preference: PreferenceSnapshot | null,
) {
  const travelDays = input.travelDays ?? preference?.travelDays

  if (!travelDays) {
    throw new PlanError(400, '旅行天数必须是正整数')
  }

  const departureCity =
    input.departureCity ?? preference?.departureCity ?? '未填写出发城市'
  const travelStyle = preference?.travelStyle ?? input.temporaryPreference ?? '轻松均衡'
  const transportMode = preference?.transportMode ?? '公共交通'
  const driveMode = preference?.driveMode
  const scenicPreference =
    preference?.scenicPreference ?? input.temporaryPreference ?? '综合体验'
  const companionType = preference?.companionType ?? '未指定同行人'
  const weatherMode = input.weatherMode ?? preference?.weatherMode ?? '参考天气'
  const preferenceLabel = preference
    ? `偏好卡片「${preference.cardName}」`
    : '临时偏好'
  const title = `${input.targetCity} ${travelDays} 天智能旅行方案`
  const summary = [
    `从${departureCity}出发，前往${input.targetCity}。`,
    `本次 mock 规划参考${preferenceLabel}，整体风格为${travelStyle}，交通方式为${transportMode}。`,
    `景点偏好侧重${scenicPreference}，同行类型为${companionType}。`,
  ].join('')
  const weatherInfo = `${weatherMode}：本阶段使用 mock 天气提示。实际开发时可替换为真实天气接口，天气失败不应阻断主规划。`
  const content = [
    `# ${title}`,
    '',
    '## 方案概览',
    summary,
    '',
    '## 每日安排',
    buildDailySchedule(input.targetCity, travelDays),
    '',
    '## 交通建议',
    driveMode
      ? `本次可参考「${driveMode}」安排城市内与周边移动，并保留休息与补给时间。`
      : `建议优先使用${transportMode}，减少路线切换成本，并把住宿安排在交通便利区域。`,
    '',
    '## 天气提示',
    weatherInfo,
    '',
    '## 注意事项',
    '- 当前结果由 mock 模板生成，用于打通课程项目主链路。',
    '- 后续接入大语言模型后，可保留相同接口与历史记录保存流程。',
    '- 行程执行前仍建议核对景区开放时间、交通班次和天气变化。',
  ].join('\n')

  return {
    plan: {
      title,
      summary,
      content,
    },
    inputSummary: [
      `目标城市：${input.targetCity}`,
      `出发城市：${departureCity}`,
      `旅行天数：${travelDays}`,
      `偏好来源：${preferenceLabel}`,
      `偏好摘要：${scenicPreference}`,
    ].join('；'),
    weatherInfo,
    cardId: preference?.id ?? null,
  }
}

function buildCityPlanPrompt(
  input: NormalizedCityPlanInput,
  preference: PreferenceSnapshot | null,
  fallbackPlan: CityPlanBuildResult,
) {
  const travelDays = input.travelDays ?? preference?.travelDays
  const preferenceText = preference
    ? [
        `偏好卡片名称：${preference.cardName}`,
        `旅行风格：${preference.travelStyle}`,
        `交通方式：${preference.transportMode}`,
        `驾驶模式：${preference.driveMode ?? '未填写'}`,
        `景点偏好：${preference.scenicPreference}`,
        `出发城市：${preference.departureCity}`,
        `同行类型：${preference.companionType}`,
        `偏好旅行天数：${preference.travelDays}`,
        `天气模式：${preference.weatherMode}`,
      ].join('\n')
    : `临时偏好：${input.temporaryPreference ?? '未填写'}`

  return [
    {
      role: 'system' as const,
      content:
        '你是一个中文智能旅游规划助手。请根据用户输入生成实用、清晰、可执行的旅行方案。不要编造具体价格，不要承诺景区一定开放。输出必须使用 Markdown。',
    },
    {
      role: 'user' as const,
      content: [
        '请生成一份单城市旅行方案。',
        '',
        '## 用户输入',
        `目标城市：${input.targetCity}`,
        `出发城市：${input.departureCity ?? preference?.departureCity ?? '未填写'}`,
        `旅行天数：${travelDays ?? '未填写'}`,
        `天气模式：${input.weatherMode ?? preference?.weatherMode ?? '参考天气'}`,
        '',
        '## 用户偏好',
        preferenceText,
        '',
        '## 输出要求',
        '- 第一行必须是一级标题，格式为：# 城市 天数 天智能旅行方案',
        '- 必须包含：方案概览、每日安排、交通建议、天气提示、注意事项',
        '- 每日安排要按 Day 1、Day 2 的形式写',
        '- 内容要适合课程项目演示，表达自然，不要提到“mock”',
        '- 如果天气信息不足，请说明需要出行前核对天气，不要编造实时天气',
        '',
        '## 当前兜底方案参考',
        fallbackPlan.plan.content,
      ].join('\n'),
    },
  ]
}

function buildPreferencePromptText(
  preference: PreferenceSnapshot | null,
  temporaryPreference: string | null,
) {
  if (!preference) {
    return `临时偏好：${temporaryPreference ?? '未填写'}`
  }

  return [
    `偏好卡片名称：${preference.cardName}`,
    `旅行风格：${preference.travelStyle}`,
    `交通方式：${preference.transportMode}`,
    `驾驶模式：${preference.driveMode ?? '未填写'}`,
    `景点偏好：${preference.scenicPreference}`,
    `出发城市：${preference.departureCity}`,
    `同行类型：${preference.companionType}`,
    `偏好旅行天数：${preference.travelDays}`,
    `天气模式：${preference.weatherMode}`,
  ].join('\n')
}

function buildDrivePlanPrompt(
  input: NormalizedDrivePlanInput,
  preference: PreferenceSnapshot | null,
  fallbackPlan: DrivePlanBuildResult,
) {
  const routeCities = [
    input.departureCity,
    ...input.waypointCities,
    input.destinationCity,
  ]

  return [
    {
      role: 'system' as const,
      content:
        '你是一个中文自驾旅行路线规划助手。请根据用户输入生成安全、清晰、可执行的多城市自驾路线方案。不要编造实时路况、精确距离、具体价格或景区一定开放的信息。输出必须使用 Markdown。',
    },
    {
      role: 'user' as const,
      content: [
        '请生成一份多城市自驾路线方案。',
        '',
        '## 用户输入',
        `出发城市：${input.departureCity}`,
        `目的城市：${input.destinationCity}`,
        `途经城市：${input.waypointCities.length ? input.waypointCities.join('、') : '无'}`,
        `城市顺序：${routeCities.join(' -> ')}`,
        `旅行天数：${input.travelDays}`,
        `天气模式：${input.weatherMode ?? preference?.weatherMode ?? '参考天气'}`,
        '',
        '## 用户偏好',
        buildPreferencePromptText(preference, input.temporaryPreference),
        '',
        '## 输出要求',
        '- 第一行必须是一级标题，格式为：# 出发城市到目的城市 天数 天自驾路线方案',
        '- 必须包含：路线概览、城市顺序、每日安排、自驾建议、天气提示、注意事项',
        '- 每日安排要按 Day 1、Day 2 的形式写',
        '- 自驾建议要强调安全、休息、停车、补给和机动时间',
        '- 内容要适合课程项目演示，表达自然，不要提到“mock”',
        '- 如果缺少实时天气、路况或距离，请明确提醒出行前核对，不要编造实时信息',
        '',
        '## 当前兜底方案参考',
        fallbackPlan.plan.content,
      ].join('\n'),
    },
  ]
}

function buildOptimizePlanPrompt(
  originalRecord: Awaited<ReturnType<typeof getTravelRecordSnapshot>>,
  input: NormalizedOptimizePlanInput,
  fallbackPlan: OptimizePlanBuildResult,
) {
  const originalTitle =
    originalRecord.resultTitle ?? `${originalRecord.recordType} #${originalRecord.id}`

  return [
    {
      role: 'system' as const,
      content:
        '你是一个中文旅行方案优化助手。请基于用户已有旅行方案和新增优化要求，生成一份更合适的优化版方案。不要覆盖原方案，不要编造实时价格、天气或景区一定开放的信息。输出必须使用 Markdown。',
    },
    {
      role: 'user' as const,
      content: [
        '请基于原历史记录生成优化版旅行方案。',
        '',
        '## 原方案信息',
        `历史记录 ID：${originalRecord.id}`,
        `原记录类型：${originalRecord.recordType}`,
        `原方案标题：${originalTitle}`,
        `原输入摘要：${originalRecord.inputSummary}`,
        `原天气信息：${originalRecord.weatherInfo ?? '未记录'}`,
        '',
        '## 优化要求',
        input.optimizeRequirement,
        '',
        '## 原方案全文',
        originalRecord.resultContent,
        '',
        '## 输出要求',
        '- 第一行必须是一级标题，建议格式为：# 原方案标题 - 优化版',
        '- 必须包含：原方案来源、优化要求、优化摘要、调整后的重点安排、天气与风险提示、注意事项',
        '- 优化时尽量保留原方案已有城市、天数和主要结构，只针对用户要求进行调整',
        '- 内容要适合课程项目演示，表达自然，不要提到“mock”',
        '- 如果天气或开放信息不足，请提醒用户出行前核对，不要编造实时信息',
        '',
        '## 当前兜底方案参考',
        fallbackPlan.plan.content,
      ].join('\n'),
    },
  ]
}

function getSummaryFromLlmContent(content: string, fallbackSummary: string) {
  const firstParagraph = content
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('#'))

  return firstParagraph ?? fallbackSummary
}

async function buildCityPlanWithLlmFallback(
  input: NormalizedCityPlanInput,
  preference: PreferenceSnapshot | null,
) {
  const fallbackPlan = buildMockCityPlan(input, preference)
  const llmInfo = getPublicLlmInfo()

  if (!isLlmConfigured()) {
    return {
      ...fallbackPlan,
      generationMode: 'mock' as const,
      model: llmInfo.model,
    }
  }

  try {
    const content = await generateLlmText({
      messages: buildCityPlanPrompt(input, preference, fallbackPlan),
      temperature: 0.7,
    })

    return {
      ...fallbackPlan,
      plan: {
        title: fallbackPlan.plan.title,
        summary: getSummaryFromLlmContent(content, fallbackPlan.plan.summary),
        content,
      },
      inputSummary: `${fallbackPlan.inputSummary}；生成方式：${llmInfo.model}`,
      generationMode: 'llm' as const,
      model: llmInfo.model,
    }
  } catch (error) {
    if (error instanceof LlmError) {
      console.warn(`[LLM fallback] ${error.message}`)
    } else {
      console.warn('[LLM fallback] 未知大模型调用错误')
    }

    return {
      ...fallbackPlan,
      inputSummary: `${fallbackPlan.inputSummary}；生成方式：mock fallback`,
      generationMode: 'mock-fallback' as const,
      model: llmInfo.model,
    }
  }
}

async function buildDrivePlanWithLlmFallback(
  input: NormalizedDrivePlanInput,
  preference: PreferenceSnapshot | null,
) {
  const fallbackPlan = buildMockDrivePlan(input, preference)
  const llmInfo = getPublicLlmInfo()

  if (!isLlmConfigured()) {
    return {
      ...fallbackPlan,
      generationMode: 'mock' as const,
      model: llmInfo.model,
    }
  }

  try {
    const content = await generateLlmText({
      messages: buildDrivePlanPrompt(input, preference, fallbackPlan),
      temperature: 0.7,
    })

    return {
      ...fallbackPlan,
      plan: {
        title: fallbackPlan.plan.title,
        summary: getSummaryFromLlmContent(content, fallbackPlan.plan.summary),
        content,
      },
      inputSummary: `${fallbackPlan.inputSummary}；生成方式：${llmInfo.model}`,
      generationMode: 'llm' as const,
      model: llmInfo.model,
    }
  } catch (error) {
    if (error instanceof LlmError) {
      console.warn(`[LLM fallback] ${error.message}`)
    } else {
      console.warn('[LLM fallback] 未知大模型调用错误')
    }

    return {
      ...fallbackPlan,
      inputSummary: `${fallbackPlan.inputSummary}；生成方式：mock fallback`,
      generationMode: 'mock-fallback' as const,
      model: llmInfo.model,
    }
  }
}

function buildMockDrivePlan(
  input: NormalizedDrivePlanInput,
  preference: PreferenceSnapshot | null,
) {
  const routeCities = [
    input.departureCity,
    ...input.waypointCities,
    input.destinationCity,
  ]
  const routeText = routeCities.join(' -> ')
  const travelStyle = preference?.travelStyle ?? input.temporaryPreference ?? '轻松均衡'
  const transportMode = preference?.transportMode ?? '自驾'
  const driveMode = preference?.driveMode ?? '弹性自驾'
  const scenicPreference =
    preference?.scenicPreference ?? input.temporaryPreference ?? '综合体验'
  const companionType = preference?.companionType ?? '未指定同行人'
  const weatherMode = input.weatherMode ?? preference?.weatherMode ?? '参考天气'
  const preferenceLabel = preference
    ? `偏好卡片「${preference.cardName}」`
    : '临时偏好'
  const title = `${input.departureCity}到${input.destinationCity} ${input.travelDays} 天自驾路线方案`
  const summary = [
    `本次 mock 自驾规划路线为：${routeText}。`,
    `方案参考${preferenceLabel}，整体风格为${travelStyle}，交通方式为${transportMode}，驾驶模式为${driveMode}。`,
    `景点偏好侧重${scenicPreference}，同行类型为${companionType}。`,
  ].join('')
  const weatherInfo = `${weatherMode}：本阶段使用 mock 天气与路况提示。实际开发时可替换为真实天气、地图或路线服务，外部服务失败不应阻断主规划。`
  const content = [
    `# ${title}`,
    '',
    '## 路线概览',
    summary,
    '',
    '## 城市顺序',
    routeCities.map((city, index) => `${index + 1}. ${city}`).join('\n'),
    '',
    '## 每日安排',
    buildDriveDailySchedule(routeCities, input.travelDays),
    '',
    '## 自驾建议',
    `建议采用「${driveMode}」节奏推进，每天预留机动时间，优先保证驾驶安全和休息质量。`,
    `如果实际使用${transportMode}以外的方式，应在后续真实规划阶段重新计算交通耗时。`,
    '',
    '## 天气提示',
    weatherInfo,
    '',
    '## 注意事项',
    '- 当前结果由 mock 模板生成，用于验证多城市自驾规划主链路。',
    '- 后续接入地图服务后，可补充真实距离、驾驶时长、路况和停车建议。',
    '- 长途驾驶请合理安排休息，避免疲劳驾驶，并提前确认目的地停车条件。',
  ].join('\n')

  return {
    plan: {
      title,
      summary,
      content,
    },
    inputSummary: [
      `路线：${routeText}`,
      `旅行天数：${input.travelDays}`,
      `偏好来源：${preferenceLabel}`,
      `偏好摘要：${scenicPreference}`,
    ].join('；'),
    weatherInfo,
    cardId: preference?.id ?? null,
  }
}

async function buildOptimizedPlanWithLlmFallback(
  originalRecord: Awaited<ReturnType<typeof getTravelRecordSnapshot>>,
  input: NormalizedOptimizePlanInput,
) {
  const fallbackPlan = buildMockOptimizedPlan(originalRecord, input)
  const llmInfo = getPublicLlmInfo()

  if (!isLlmConfigured()) {
    return {
      ...fallbackPlan,
      generationMode: 'mock' as const,
      model: llmInfo.model,
    }
  }

  try {
    const content = await generateLlmText({
      messages: buildOptimizePlanPrompt(originalRecord, input, fallbackPlan),
      temperature: 0.65,
    })

    return {
      ...fallbackPlan,
      plan: {
        title: fallbackPlan.plan.title,
        summary: getSummaryFromLlmContent(content, fallbackPlan.plan.summary),
        content,
      },
      inputSummary: `${fallbackPlan.inputSummary}；生成方式：${llmInfo.model}`,
      generationMode: 'llm' as const,
      model: llmInfo.model,
    }
  } catch (error) {
    if (error instanceof LlmError) {
      console.warn(`[LLM fallback] ${error.message}`)
    } else {
      console.warn('[LLM fallback] 未知大模型调用错误')
    }

    return {
      ...fallbackPlan,
      inputSummary: `${fallbackPlan.inputSummary}；生成方式：mock fallback`,
      generationMode: 'mock-fallback' as const,
      model: llmInfo.model,
    }
  }
}

function buildMockOptimizedPlan(
  originalRecord: Awaited<ReturnType<typeof getTravelRecordSnapshot>>,
  input: NormalizedOptimizePlanInput,
) {
  const originalTitle =
    originalRecord.resultTitle ?? `${originalRecord.recordType} #${originalRecord.id}`
  const title = `${originalTitle} - 优化版`
  const summary = [
    `基于历史记录 #${originalRecord.id}「${originalTitle}」进行 mock 优化。`,
    `本次优化重点：${input.optimizeRequirement}。`,
    '当前阶段使用固定模板模拟优化结果，后续可替换为真实大语言模型生成。',
  ].join('')
  const weatherInfo =
    originalRecord.weatherInfo ??
    '未记录天气信息；本阶段优化不会额外调用天气服务。'
  const content = [
    `# ${title}`,
    '',
    '## 原方案来源',
    `- 原历史记录 ID：${originalRecord.id}`,
    `- 原记录类型：${originalRecord.recordType}`,
    `- 原方案标题：${originalTitle}`,
    '',
    '## 优化要求',
    input.optimizeRequirement,
    '',
    '## 优化摘要',
    summary,
    '',
    '## 调整后的重点安排',
    '- 优先保留原方案中已经形成的城市、天数和主要路线结构，避免推倒重来。',
    `- 围绕「${input.optimizeRequirement}」调整每日节奏、交通切换和游玩强度。`,
    '- 对容易产生疲劳、排队或交通不确定性的安排增加缓冲时间。',
    '- 将餐饮、休息、天气变化和临时调整空间纳入方案说明。',
    '',
    '## 原方案内容参考',
    originalRecord.resultContent,
    '',
    '## 天气与风险提示',
    weatherInfo,
    '',
    '## 注意事项',
    '- 当前优化结果由 mock 模板生成，用于验证方案优化链路。',
    '- 后续接入真实大语言模型后，可在此处根据原方案全文和用户要求生成更自然的改写版本。',
    '- 优化结果会作为新的历史记录保存，原始方案不会被覆盖。',
  ].join('\n')

  return {
    plan: {
      title,
      summary,
      content,
    },
    inputSummary: [
      `原历史记录 ID：${originalRecord.id}`,
      `原记录类型：${originalRecord.recordType}`,
      `优化要求：${input.optimizeRequirement}`,
    ].join('；'),
    weatherInfo,
    cardId: originalRecord.cardId,
  }
}

export async function generateCityPlan(userId: number, input: unknown) {
  const normalizedInput = normalizeCityPlanInput(input)
  const preference = normalizedInput.cardId
    ? await getPreferenceSnapshot(userId, normalizedInput.cardId)
    : null
  const planResult = await buildCityPlanWithLlmFallback(
    normalizedInput,
    preference,
  )

  const record = await prisma.travelRecord.create({
    data: {
      userId,
      cardId: planResult.cardId,
      recordType: 'single-city-plan',
      inputSummary: planResult.inputSummary,
      resultTitle: planResult.plan.title,
      resultContent: planResult.plan.content,
      weatherInfo: planResult.weatherInfo,
    },
  })

  return {
    plan: planResult.plan,
    record,
    generationMode: planResult.generationMode,
    model: planResult.model,
  }
}

export async function optimizePlan(userId: number, input: unknown) {
  const normalizedInput = normalizeOptimizePlanInput(input)
  const originalRecord = await getTravelRecordSnapshot(
    userId,
    normalizedInput.recordId,
  )
  const planResult = await buildOptimizedPlanWithLlmFallback(
    originalRecord,
    normalizedInput,
  )

  const record = await prisma.travelRecord.create({
    data: {
      userId,
      cardId: planResult.cardId,
      recordType: 'optimized-plan',
      inputSummary: planResult.inputSummary,
      resultTitle: planResult.plan.title,
      resultContent: planResult.plan.content,
      weatherInfo: planResult.weatherInfo,
    },
  })

  return {
    plan: planResult.plan,
    record,
    generationMode: planResult.generationMode,
    model: planResult.model,
  }
}

export async function generateDrivePlan(userId: number, input: unknown) {
  const normalizedInput = normalizeDrivePlanInput(input)
  const preference = normalizedInput.cardId
    ? await getPreferenceSnapshot(userId, normalizedInput.cardId)
    : null
  const planResult = await buildDrivePlanWithLlmFallback(
    normalizedInput,
    preference,
  )

  const record = await prisma.travelRecord.create({
    data: {
      userId,
      cardId: planResult.cardId,
      recordType: 'multi-city-drive-plan',
      inputSummary: planResult.inputSummary,
      resultTitle: planResult.plan.title,
      resultContent: planResult.plan.content,
      weatherInfo: planResult.weatherInfo,
    },
  })

  return {
    plan: planResult.plan,
    record,
    generationMode: planResult.generationMode,
    model: planResult.model,
  }
}
