export const AUTH_TOKEN_STORAGE_KEY = 'travelbyllm_auth_token'

export type AuthUser = {
  id: number
  username: string
  email: string | null
  emailVerifiedAt: string | null
  nickname: string | null
  avatarPreset: string | null
  avatarUrl: string | null
  loginCount: number
  lastLoginAt: string | null
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
  identifier: string
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

type UpdateProfileInput = {
  nickname: string
  avatarPreset?: string | null
}

type ChangePasswordInput = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

type UpdateProfileResponse = {
  user: AuthUser
}

type ChangePasswordResponse = Record<string, never>
type AvatarResponse = {
  user: AuthUser
}

type RequestEmailBindingInput = {
  email: string
  currentPassword: string
}

type RequestEmailBindingResponse = {
  challengeId: string
  expiresAt: string
  retryAfterSeconds: number
}

type ConfirmEmailBindingInput = {
  challengeId: string
  code: string
}

type ConfirmEmailBindingResponse = {
  user: AuthUser
}

type RequestPasswordResetInput = {
  identifier: string
}

type ResetPasswordInput = {
  challengeId: string
  token: string
  newPassword: string
  confirmPassword: string
}

type EmptyResponse = Record<string, never>

export class AuthApiError extends Error {
  readonly statusCode: number

  constructor(statusCode: number, message: string) {
    super(message)
    this.statusCode = statusCode
  }
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  let body: ApiResponse<T> | null = null

  try {
    body = (await response.json()) as ApiResponse<T>
  } catch {
    throw new AuthApiError(response.status, '服务返回格式异常')
  }

  if (!response.ok || body.code !== 0 || !body.data) {
    throw new AuthApiError(
      response.status,
      body.message || '请求失败，请稍后重试',
    )
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
    throw new AuthApiError(0, '无法连接到后端服务')
  }

  return parseApiResponse<T>(response)
}

async function putJsonWithAuth<T>(url: string, token: string, data: unknown) {
  let response: Response

  try {
    response = await fetch(url, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(data),
    })
  } catch {
    throw new AuthApiError(0, '无法连接到后端服务')
  }

  return parseApiResponse<T>(response)
}

async function postJsonWithAuth<T>(url: string, token: string, data: unknown) {
  let response: Response

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(data),
    })
  } catch {
    throw new AuthApiError(0, '无法连接到后端服务')
  }

  return parseApiResponse<T>(response)
}

async function deleteWithAuth<T>(url: string, token: string) {
  let response: Response

  try {
    response = await fetch(url, {
      method: 'DELETE',
      headers: {
        authorization: `Bearer ${token}`,
      },
    })
  } catch {
    throw new AuthApiError(0, '无法连接到后端服务')
  }

  return parseApiResponse<T>(response)
}

export async function register(input: RegisterInput) {
  return postJson<RegisterResponse>('/api/auth/register', input)
}

export async function login(input: LoginInput) {
  return postJson<LoginResponse>('/api/auth/login', {
    identifier: input.identifier,
    username: input.identifier,
    password: input.password,
  })
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
    throw new AuthApiError(0, '无法连接到后端服务')
  }

  return parseApiResponse<CurrentUserResponse>(response)
}

export async function updateProfile(token: string, input: UpdateProfileInput) {
  return putJsonWithAuth<UpdateProfileResponse>(
    '/api/auth/profile',
    token,
    input,
  )
}

export async function changePassword(
  token: string,
  input: ChangePasswordInput,
) {
  return putJsonWithAuth<ChangePasswordResponse>(
    '/api/auth/password',
    token,
    input,
  )
}

export async function requestEmailBinding(
  token: string,
  input: RequestEmailBindingInput,
) {
  return postJsonWithAuth<RequestEmailBindingResponse>(
    '/api/auth/email/bind/request',
    token,
    input,
  )
}

export async function confirmEmailBinding(
  token: string,
  input: ConfirmEmailBindingInput,
) {
  return postJsonWithAuth<ConfirmEmailBindingResponse>(
    '/api/auth/email/bind/confirm',
    token,
    input,
  )
}

export async function requestPasswordReset(input: RequestPasswordResetInput) {
  return postJson<EmptyResponse>('/api/auth/password/forgot', input)
}

export async function resetPassword(input: ResetPasswordInput) {
  return postJson<EmptyResponse>('/api/auth/password/reset', input)
}

export async function uploadAvatar(token: string, file: File) {
  const formData = new FormData()

  formData.append('avatar', file)

  let response: Response

  try {
    response = await fetch('/api/auth/avatar', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
      },
      body: formData,
    })
  } catch {
    throw new AuthApiError(0, '无法连接到后端服务')
  }

  return parseApiResponse<AvatarResponse>(response)
}

export async function deleteAvatar(token: string) {
  return deleteWithAuth<AvatarResponse>('/api/auth/avatar', token)
}
