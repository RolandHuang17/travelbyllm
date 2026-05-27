import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { app } from '../app'

describe('spots routes', () => {
  it('returns complete detail content for every home scenic spot', async () => {
    const response = await request(app).get('/api/spots/home')

    expect(response.status).toBe(200)
    expect(response.body.data.spots).toHaveLength(100)

    for (const spot of response.body.data.spots) {
      expect(spot.detail).toEqual(
        expect.objectContaining({
          overview: expect.any(String),
          averageTemperature: expect.any(String),
          visitRecommendation: expect.any(String),
          photoSpots: expect.any(Array),
          ticketPrice: expect.any(String),
          openingHours: expect.any(String),
        }),
      )
      expect(spot.detail.overview.trim()).not.toBe('')
      expect(spot.detail.averageTemperature.trim()).not.toBe('')
      expect(spot.detail.visitRecommendation.trim()).not.toBe('')
      expect(spot.detail.ticketPrice.trim()).not.toBe('')
      expect(spot.detail.openingHours.trim()).not.toBe('')
      expect(spot.detail.photoSpots.length).toBeGreaterThan(0)
    }
  })
})
