type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type ChatCompletionChoice = {
  message?: {
    content?: string
  }
}

type ChatCompletionResponse = {
  choices?: ChatCompletionChoice[]
}

type ErrorResponse = {
  error?: {
    message?: string
  }
}

type GenerateTextInput = {
  messages: ChatMessage[]
  temperature?: number
  timeoutMs?: number
}

export class LlmError extends Error {}

function getLlmConfig() {
  const apiKey = process.env.DASHSCOPE_API_KEY ?? process.env.LLM_API_KEY
  const baseUrl =
    process.env.LLM_BASE_URL ??
    'https://dashscope.aliyuncs.com/compatible-mode/v1'
  const model = process.env.LLM_MODEL ?? 'qwen3.7-max'
  const timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? 120000)
  const enableThinking = parseBooleanEnv(
    process.env.LLM_ENABLE_THINKING,
    true,
  )

  return {
    apiKey,
    baseUrl: baseUrl.replace(/\/$/, ''),
    model,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 120000,
    enableThinking,
  }
}

function parseBooleanEnv(value: string | undefined, defaultValue: boolean) {
  if (value === undefined) {
    return defaultValue
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

export function isLlmConfigured() {
  const { apiKey } = getLlmConfig()

  return Boolean(apiKey)
}

export function getPublicLlmInfo() {
  const { apiKey, model } = getLlmConfig()

  return {
    configured: Boolean(apiKey),
    model,
  }
}

function getErrorResponseMessage(body: unknown) {
  if (!body || typeof body !== 'object') {
    return null
  }

  const errorBody = body as ErrorResponse

  return errorBody.error?.message ?? null
}

export async function generateLlmText({
  messages,
  temperature = 0.7,
  timeoutMs: timeoutMsOverride,
}: GenerateTextInput) {
  const { apiKey, baseUrl, model, timeoutMs, enableThinking } = getLlmConfig()
  const requestTimeoutMs =
    Number.isFinite(timeoutMsOverride) && timeoutMsOverride && timeoutMsOverride > 0
      ? timeoutMsOverride
      : timeoutMs

  if (!apiKey) {
    throw new LlmError('未配置大模型 API Key')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs)

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        stream: false,
        enable_thinking: enableThinking,
      }),
      signal: controller.signal,
    })

    let body: unknown = null

    try {
      body = (await response.json()) as ChatCompletionResponse
    } catch {
      throw new LlmError('大模型服务返回格式异常')
    }

    if (!response.ok) {
      const message = getErrorResponseMessage(body) ?? '大模型服务调用失败'

      throw new LlmError(message)
    }

    const content = (body as ChatCompletionResponse).choices?.[0]?.message
      ?.content

    if (!content?.trim()) {
      throw new LlmError('大模型返回内容为空')
    }

    return content.trim()
  } catch (error) {
    if (error instanceof LlmError) {
      throw error
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new LlmError('大模型服务调用超时')
    }

    throw new LlmError('大模型服务调用失败')
  } finally {
    clearTimeout(timeout)
  }
}
