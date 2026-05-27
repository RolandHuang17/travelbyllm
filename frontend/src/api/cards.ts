export type PreferenceCard = {
  id: number
  userId: number
  cardName: string
  travelStyle: string
  transportMode: string
  driveMode: string | null
  scenicPreference: string
  departureCity: string
  companionType: string
  travelDays: number
  startDate: string | null
  weatherMode: string
  createdAt: string
  updatedAt: string
}

export type PreferenceCardInput = {
  cardName: string
  travelStyle: string
  transportMode: string
  driveMode: string | null
  scenicPreference: string
  departureCity: string
  companionType: string
  travelDays: number
  startDate: string | null
  weatherMode: string
}

type ApiResponse<T> = {
  code: number
  message: string
  data: T | null
}

type CardsResponse = {
  cards: PreferenceCard[]
}

type CardResponse = {
  card: PreferenceCard
}

type DeleteCardResponse = {
  card: {
    id: number
  }
}

export class CardsApiError extends Error {
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
    throw new CardsApiError(response.status, '服务返回格式异常')
  }

  if (!response.ok || body.code !== 0 || !body.data) {
    throw new CardsApiError(
      response.status,
      body.message || '请求失败，请稍后重试',
    )
  }

  return body.data
}

async function requestCards<T>(
  url: string,
  token: string,
  options: RequestInit = {},
) {
  let response: Response

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        'content-type': 'application/json',
        ...getAuthHeaders(token),
        ...options.headers,
      },
    })
  } catch {
    throw new CardsApiError(0, '无法连接到后端服务')
  }

  return parseApiResponse<T>(response)
}

export async function fetchPreferenceCards(token: string) {
  return requestCards<CardsResponse>('/api/cards', token)
}

export async function fetchPreferenceCard(token: string, id: number) {
  return requestCards<CardResponse>(`/api/cards/${id}`, token)
}

export async function createPreferenceCard(
  token: string,
  input: PreferenceCardInput,
) {
  return requestCards<CardResponse>('/api/cards', token, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updatePreferenceCard(
  token: string,
  id: number,
  input: PreferenceCardInput,
) {
  return requestCards<CardResponse>(`/api/cards/${id}`, token, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deletePreferenceCard(token: string, id: number) {
  return requestCards<DeleteCardResponse>(`/api/cards/${id}`, token, {
    method: 'DELETE',
  })
}
