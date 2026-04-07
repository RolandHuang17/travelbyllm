export type HealthStatus = {
  status: 'ok'
  service: string
  database: 'ok'
  timestamp: string
}

type HealthError = {
  status: 'error'
  message?: string
}

export async function fetchHealthStatus(): Promise<HealthStatus> {
  const response = await fetch('/api/health')

  if (!response.ok) {
    let message = '后端服务暂时不可用'

    try {
      const error = (await response.json()) as HealthError

      if (error.message) {
        message = error.message
      }
    } catch {
      // Ignore invalid JSON and fall back to the default message.
    }

    throw new Error(message)
  }

  return (await response.json()) as HealthStatus
}
