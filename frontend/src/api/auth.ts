export const AUTH_TOKEN_STORAGE_KEY = 'travelbyllm_auth_token'

export type AuthUser = {
  id: number
  username: string
  createdAt: string
}

type ApiResponse<T> = {
  code: number
  message: string
  data: T | null
}

type RegisterInput = {
  username: string
  password: string
  confirmPassword: string
}

type LoginInput = {
  username: string
  password: string
}

type RegisterResponse = {
  user: AuthUser
}

type LoginResponse = {
  user: AuthUser
  token: string
}

type CurrentUserResponse = {
  user: AuthUser
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  let body: ApiResponse<T> | null = null

  try {
    body = (await response.json()) as ApiResponse<T>
  } catch {
    throw new Error('服务返回格式异常')
  }

  if (!response.ok || body.code !== 0 || !body.data) {
    throw new Error(body.message || '请求失败，请稍后重试')
  }

  return body.data
}

async function postJson<T>(url: string, data: unknown): Promise<T> {
  let response: Response

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(data),
    })
  } catch {
    throw new Error('无法连接到后端服务')
  }

  return parseApiResponse<T>(response)
}

export async function register(input: RegisterInput) {
  return postJson<RegisterResponse>('/api/auth/register', input)
}

export async function login(input: LoginInput) {
  return postJson<LoginResponse>('/api/auth/login', input)
}

export async function fetchCurrentUser(token: string) {
  let response: Response

  try {
    response = await fetch('/api/auth/me', {
      headers: {
        authorization: `Bearer ${token}`,
      },
    })
  } catch {
    throw new Error('无法连接到后端服务')
  }

  return parseApiResponse<CurrentUserResponse>(response)
}
