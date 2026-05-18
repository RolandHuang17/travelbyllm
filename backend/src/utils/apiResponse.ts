import type { Response } from 'express'

type ApiResponse<T> = {
  code: number
  message: string
  data: T | null
}

export function sendSuccess<T>(
  response: Response,
  message: string,
  data: T,
  statusCode = 200,
) {
  const body: ApiResponse<T> = {
    code: 0,
    message,
    data,
  }

  return response.status(statusCode).json(body)
}

export function sendError(
  response: Response,
  statusCode: number,
  message: string,
  code = statusCode,
) {
  const body: ApiResponse<null> = {
    code,
    message,
    data: null,
  }

  return response.status(statusCode).json(body)
}
