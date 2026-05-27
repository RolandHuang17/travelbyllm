import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../lib/prisma'
import { listPreferenceCards } from './cardService'

vi.mock('../lib/prisma', () => ({
  prisma: {
    preferenceCard: {
      findMany: vi.fn(),
    },
  },
}))

describe('listPreferenceCards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps cards in creation order so new cards are appended in the list', async () => {
    const findMany = vi.mocked(prisma.preferenceCard.findMany)

    findMany.mockResolvedValue([])

    await listPreferenceCards(12)

    expect(findMany).toHaveBeenCalledWith({
      where: {
        userId: 12,
      },
      orderBy: [
        {
          createdAt: 'asc',
        },
        {
          id: 'asc',
        },
      ],
    })
  })
})
