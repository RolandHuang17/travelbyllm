import { Router } from 'express'
import { listHomeScenicSpots } from '../services/homeScenicSpotService'
import { sendSuccess } from '../utils/apiResponse'

const spotsRouter = Router()

spotsRouter.get('/home', (_request, response) => {
  const spots = listHomeScenicSpots()

  return sendSuccess(response, 'ok', { spots })
})

export { spotsRouter }
