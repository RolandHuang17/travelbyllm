import { Router, type Request, type Response } from 'express'
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../middleware/authMiddleware'
import {
  CardError,
  createPreferenceCard,
  deletePreferenceCard,
  listPreferenceCards,
  normalizeCardId,
  updatePreferenceCard,
} from '../services/cardService'
import { sendError, sendSuccess } from '../utils/apiResponse'

const cardsRouter = Router()

function getAuthRequest(request: Request) {
  return request as unknown as AuthenticatedRequest
}

function handleCardsError(response: Response, error: unknown) {
  if (error instanceof CardError) {
    return sendError(response, error.statusCode, error.message)
  }

  console.error(error)
  return sendError(response, 500, '偏好卡片操作失败，请稍后重试')
}

cardsRouter.use(requireAuth)

cardsRouter.get('/', async (request, response) => {
  try {
    const { authUser } = getAuthRequest(request)
    const cards = await listPreferenceCards(authUser.id)

    return sendSuccess(response, 'ok', { cards })
  } catch (error) {
    return handleCardsError(response, error)
  }
})

cardsRouter.post('/', async (request, response) => {
  try {
    const { authUser } = getAuthRequest(request)
    const card = await createPreferenceCard(authUser.id, request.body)

    return sendSuccess(response, '创建成功', { card }, 201)
  } catch (error) {
    return handleCardsError(response, error)
  }
})

cardsRouter.put('/:id', async (request, response) => {
  try {
    const { authUser } = getAuthRequest(request)
    const cardId = normalizeCardId(request.params.id)
    const card = await updatePreferenceCard(authUser.id, cardId, request.body)

    return sendSuccess(response, '更新成功', { card })
  } catch (error) {
    return handleCardsError(response, error)
  }
})

cardsRouter.delete('/:id', async (request, response) => {
  try {
    const { authUser } = getAuthRequest(request)
    const cardId = normalizeCardId(request.params.id)
    const deletedCard = await deletePreferenceCard(authUser.id, cardId)

    return sendSuccess(response, '删除成功', { card: deletedCard })
  } catch (error) {
    return handleCardsError(response, error)
  }
})

export { cardsRouter }
