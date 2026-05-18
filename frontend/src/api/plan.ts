import type { TravelRecord } from './history'

export type CityPlanInput = {
  targetCity: string
  departureCity: string | null
  travelDays: number | null
  cardId: number | null
  temporaryPreference: string | null
  weatherMode: string | null
}

export type DrivePlanInput = {
  departureCity: string
  destinationCity: string
  waypointCities: string[]
  travelDays: number
  cardId: number | null
  temporaryPreference: string | null
  weatherMode: string | null
}

export type OptimizePlanInput = {
  recordId: number
  optimizeRequirement: string
}

export type PlanResult = {
  title: string
  summary: string
  content: string
}

export type CityPlanResult = PlanResult

export type GenerationMode = 'llm' | 'mock' | 'mock-fallback'

export type LlmStatus = {
  configured: boolean
  model: string
}

type ApiResponse<T> = {
  code: number
  message: string
  data: T | null
}

type CityPlanResponse = {
  plan: PlanResult
  record: TravelRecord
  generationMode: GenerationMode
  model: string
}

type DrivePlanResponse = {
  plan: PlanResult
  record: TravelRecord
  generationMode: GenerationMode
  model: string
}

type OptimizePlanResponse = {
  plan: PlanResult
  record: TravelRecord
  generationMode: GenerationMode
  model: string
}

export class PlanApiError extends Error {
  readonly statusCode: number

  constructor(statusCode: number, message: string) {
    super(message)
    this.statusCode = statusCode
  }
}

function getAuthHeaders(token: string) {
  return {
    authorization: `Bearer ${token}`,
  }
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  let body: ApiResponse<T> | null = null

  try {
    body = (await response.json()) as ApiResponse<T>
  } catch {
    throw new PlanApiError(response.status, '服务返回格式异常')
  }

  if (!response.ok || body.code !== 0 || !body.data) {
    throw new PlanApiError(
      response.status,
      body.message || '请求失败，请稍后重试',
    )
  }

  return body.data
}

export async function generateCityPlan(token: string, input: CityPlanInput) {
  let response: Response

  try {
    response = await fetch('/api/plan/city', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...getAuthHeaders(token),
      },
      body: JSON.stringify(input),
    })
  } catch {
    throw new PlanApiError(0, '无法连接到后端服务')
  }

  return parseApiResponse<CityPlanResponse>(response)
}

export async function fetchLlmStatus(token: string) {
  let response: Response

  try {
    response = await fetch('/api/plan/llm-status', {
      headers: getAuthHeaders(token),
    })
  } catch {
    throw new PlanApiError(0, '无法连接到后端服务')
  }

  return parseApiResponse<LlmStatus>(response)
}

export async function generateDrivePlan(token: string, input: DrivePlanInput) {
  let response: Response

  try {
    response = await fetch('/api/plan/drive', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...getAuthHeaders(token),
      },
      body: JSON.stringify(input),
    })
  } catch {
    throw new PlanApiError(0, '无法连接到后端服务')
  }

  return parseApiResponse<DrivePlanResponse>(response)
}

export async function optimizePlan(token: string, input: OptimizePlanInput) {
  let response: Response

  try {
    response = await fetch('/api/plan/optimize', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...getAuthHeaders(token),
      },
      body: JSON.stringify(input),
    })
  } catch {
    throw new PlanApiError(0, '无法连接到后端服务')
  }

  return parseApiResponse<OptimizePlanResponse>(response)
}
