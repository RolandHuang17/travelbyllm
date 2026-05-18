import { Router, type Request, type Response } from 'express'
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../middleware/authMiddleware'
import {
  createTravelRecord,
  deleteTravelRecord,
  getTravelRecord,
  HistoryError,
  listTravelRecords,
  normalizeHistoryId,
  updateTravelRecordTitle,
} from '../services/historyService'
import { sendError, sendSuccess } from '../utils/apiResponse'

const historyRouter = Router()

function getAuthRequest(request: Request) {
  return request as unknown as AuthenticatedRequest
}

function handleHistoryError(response: Response, error: unknown) {
  if (error instanceof HistoryError) {
    return sendError(response, error.statusCode, error.message)
  }

  console.error(error)
  return sendError(response, 500, '历史记录操作失败，请稍后重试')
}

historyRouter.use(requireAuth)

historyRouter.get('/', async (request, response) => {
  try {
    const { authUser } = getAuthRequest(request)
    const records = await listTravelRecords(authUser.id)

    return sendSuccess(response, 'ok', { records })
  } catch (error) {
    return handleHistoryError(response, error)
  }
})

historyRouter.post('/', async (request, response) => {
  try {
    const { authUser } = getAuthRequest(request)
    const record = await createTravelRecord(authUser.id, request.body)

    return sendSuccess(response, '创建成功', { record }, 201)
  } catch (error) {
    return handleHistoryError(response, error)
  }
})

historyRouter.get('/:id', async (request, response) => {
  try {
    const { authUser } = getAuthRequest(request)
    const historyId = normalizeHistoryId(request.params.id)
    const record = await getTravelRecord(authUser.id, historyId)

    return sendSuccess(response, 'ok', { record })
  } catch (error) {
    return handleHistoryError(response, error)
  }
})

historyRouter.put('/:id/title', async (request, response) => {
  try {
    const { authUser } = getAuthRequest(request)
    const historyId = normalizeHistoryId(request.params.id)
    const record = await updateTravelRecordTitle(
      authUser.id,
      historyId,
      request.body,
    )

    return sendSuccess(response, '更新成功', { record })
  } catch (error) {
    return handleHistoryError(response, error)
  }
})

historyRouter.delete('/:id', async (request, response) => {
  try {
    const { authUser } = getAuthRequest(request)
    const historyId = normalizeHistoryId(request.params.id)
    const deletedRecord = await deleteTravelRecord(authUser.id, historyId)

    return sendSuccess(response, '删除成功', { record: deletedRecord })
  } catch (error) {
    return handleHistoryError(response, error)
  }
})

export { historyRouter }
