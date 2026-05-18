import { Router, type Request, type Response } from 'express'
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../middleware/authMiddleware'
import { getPublicLlmInfo } from '../services/llmService'
import {
  generateCityPlan,
  generateDrivePlan,
  optimizePlan,
  PlanError,
} from '../services/planService'
import { sendError, sendSuccess } from '../utils/apiResponse'

const planRouter = Router()

function getAuthRequest(request: Request) {
  return request as unknown as AuthenticatedRequest
}

function handlePlanError(response: Response, error: unknown) {
  if (error instanceof PlanError) {
    return sendError(response, error.statusCode, error.message)
  }

  console.error(error)
  return sendError(response, 500, '旅行方案生成失败，请稍后重试')
}

planRouter.use(requireAuth)

planRouter.get('/llm-status', (_request, response) =>
  sendSuccess(response, 'ok', getPublicLlmInfo()),
)

planRouter.post('/city', async (request, response) => {
  try {
    const { authUser } = getAuthRequest(request)
    const result = await generateCityPlan(authUser.id, request.body)

    return sendSuccess(response, '生成成功', result)
  } catch (error) {
    return handlePlanError(response, error)
  }
})

planRouter.post('/drive', async (request, response) => {
  try {
    const { authUser } = getAuthRequest(request)
    const result = await generateDrivePlan(authUser.id, request.body)

    return sendSuccess(response, '生成成功', result)
  } catch (error) {
    return handlePlanError(response, error)
  }
})

planRouter.post('/optimize', async (request, response) => {
  try {
    const { authUser } = getAuthRequest(request)
    const result = await optimizePlan(authUser.id, request.body)

    return sendSuccess(response, '优化成功', result)
  } catch (error) {
    return handlePlanError(response, error)
  }
})

export { planRouter }
