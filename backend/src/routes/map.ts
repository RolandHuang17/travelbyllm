import { Router, type Response } from 'express'
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../middleware/authMiddleware'
import {
  createFavoritePlace,
  deleteFavoritePlace,
  FavoritePlaceError,
  listFavoritePlaces,
  normalizeFavoritePlaceId,
  updateFavoritePlace,
} from '../services/favoritePlaceService'
import { createDriveRoutePreview, MapError } from '../services/mapService'
import { sendError, sendSuccess } from '../utils/apiResponse'

const mapRouter = Router()

function handleMapError(response: Response, error: unknown) {
  if (error instanceof MapError) {
    return sendError(response, error.statusCode, error.message)
  }

  if (error instanceof FavoritePlaceError) {
    return sendError(response, error.statusCode, error.message)
  }

  console.error(error)
  return sendError(response, 500, '地图服务调用失败，请稍后重试')
}

mapRouter.use(requireAuth)

mapRouter.post('/drive-preview', async (request, response) => {
  try {
    const result = await createDriveRoutePreview(request.body)

    return sendSuccess(response, 'ok', result)
  } catch (error) {
    return handleMapError(response, error)
  }
})

mapRouter.get('/favorites', async (request, response) => {
  const { authUser } = request as AuthenticatedRequest

  try {
    const favoritePlaces = await listFavoritePlaces(authUser.id)

    return sendSuccess(response, 'ok', { favoritePlaces })
  } catch (error) {
    return handleMapError(response, error)
  }
})

mapRouter.post('/favorites', async (request, response) => {
  const { authUser } = request as AuthenticatedRequest

  try {
    const favoritePlace = await createFavoritePlace(authUser.id, request.body)

    return sendSuccess(response, '收藏成功', { favoritePlace }, 201)
  } catch (error) {
    return handleMapError(response, error)
  }
})

mapRouter.put('/favorites/:id', async (request, response) => {
  const { authUser } = request as unknown as AuthenticatedRequest

  try {
    const favoritePlaceId = normalizeFavoritePlaceId(request.params.id)
    const favoritePlace = await updateFavoritePlace(
      authUser.id,
      favoritePlaceId,
      request.body,
    )

    return sendSuccess(response, '收藏已更新', { favoritePlace })
  } catch (error) {
    return handleMapError(response, error)
  }
})

mapRouter.delete('/favorites/:id', async (request, response) => {
  const { authUser } = request as unknown as AuthenticatedRequest

  try {
    const favoritePlaceId = normalizeFavoritePlaceId(request.params.id)
    const deletedFavoritePlace = await deleteFavoritePlace(
      authUser.id,
      favoritePlaceId,
    )

    return sendSuccess(response, '收藏已删除', deletedFavoritePlace)
  } catch (error) {
    return handleMapError(response, error)
  }
})

export { mapRouter }
