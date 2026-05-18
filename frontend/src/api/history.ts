export type TravelRecordSummary = {
  id: number
  userId: number
  cardId: number | null
  recordType: string
  inputSummary: string
  resultTitle: string | null
  weatherInfo: string | null
  createdAt: string
  updatedAt: string
}

export type TravelRecord = TravelRecordSummary & {
  resultContent: string
}

export type TravelRecordInput = {
  recordType: string
  inputSummary: string
  resultTitle: string | null
  resultContent: string
  weatherInfo: string | null
  cardId: number | null
}

type ApiResponse<T> = {
  code: number
  message: string
  data: T | null
}

type HistoryListResponse = {
  records: TravelRecordSummary[]
}

type HistoryRecordResponse = {
  record: TravelRecord
}

type DeleteHistoryResponse = {
  record: {
    id: number
  }
}

export class HistoryApiError extends Error {
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
    throw new HistoryApiError(response.status, '服务返回格式异常')
  }

  if (!response.ok || body.code !== 0 || !body.data) {
    throw new HistoryApiError(
      response.status,
      body.message || '请求失败，请稍后重试',
    )
  }

  return body.data
}

async function requestHistory<T>(
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
    throw new HistoryApiError(0, '无法连接到后端服务')
  }

  return parseApiResponse<T>(response)
}

export async function fetchTravelRecords(token: string) {
  return requestHistory<HistoryListResponse>('/api/history', token)
}

export async function fetchTravelRecordDetail(token: string, id: number) {
  return requestHistory<HistoryRecordResponse>(`/api/history/${id}`, token)
}

export async function createTravelRecord(
  token: string,
  input: TravelRecordInput,
) {
  return requestHistory<HistoryRecordResponse>('/api/history', token, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateTravelRecordTitle(
  token: string,
  id: number,
  resultTitle: string | null,
) {
  return requestHistory<HistoryRecordResponse>(`/api/history/${id}/title`, token, {
    method: 'PUT',
    body: JSON.stringify({ resultTitle }),
  })
}

export async function deleteTravelRecord(token: string, id: number) {
  return requestHistory<DeleteHistoryResponse>(`/api/history/${id}`, token, {
    method: 'DELETE',
  })
}
