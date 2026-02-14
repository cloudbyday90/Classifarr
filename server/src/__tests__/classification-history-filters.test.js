/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

const request = require('supertest')
const express = require('express')

jest.mock('../config/database', () => ({
  query: jest.fn(),
  pool: { connect: jest.fn() },
}))

jest.mock('../services/classification', () => ({}))
jest.mock('../services/reclassificationService', () => ({}))
jest.mock('../services/clarificationService', () => ({}))
jest.mock('../services/patternReinforcementService', () => ({}))
jest.mock('../services/libraryProfileService', () => ({}))
jest.mock('../services/signalCollector', () => ({ PATTERN_SIGNAL_TYPES: [] }))

const db = require('../config/database')
const classificationRouter = require('../routes/classification')

const app = express()
app.use(express.json())
app.use('/api/classification', classificationRouter)

describe('Classification history filters', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('applies search and date range filters to history query', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [
          { id: 1, title: 'Motorvalley', media_type: 'tv', library_name: 'TV Shows' },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ total: '1' }],
      })

    const response = await request(app)
      .get('/api/classification/history')
      .query({
        page: 1,
        limit: 50,
        media_type: 'tv',
        library_id: 10,
        method: 'policy_engine',
        search: 'motor',
        date_from: '2026-02-10',
        date_to: '2026-02-12',
      })
      .expect(200)

    expect(response.body.pagination).toMatchObject({
      page: 1,
      limit: 50,
      total: 1,
      totalPages: 1,
    })

    const [historyQueryText, historyQueryParams] = db.query.mock.calls[0]
    expect(historyQueryText).toContain('ch.title ILIKE')
    expect(historyQueryText).toContain('ch.created_at >=')
    expect(historyQueryText).toContain("ch.created_at < ($")
    expect(historyQueryParams).toEqual([
      'tv',
      '10',
      'policy_engine',
      '%motor%',
      '2026-02-10',
      '2026-02-12',
      50,
      0,
    ])
  })

  test('normalizes page/limit bounds', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })

    const response = await request(app)
      .get('/api/classification/history')
      .query({ page: 0, limit: 999 })
      .expect(200)

    expect(response.body.pagination.page).toBe(1)
    expect(response.body.pagination.limit).toBe(200)

    const [, historyQueryParams] = db.query.mock.calls[0]
    const limitArg = historyQueryParams[historyQueryParams.length - 2]
    const offsetArg = historyQueryParams[historyQueryParams.length - 1]
    expect(limitArg).toBe(200)
    expect(offsetArg).toBe(0)
  })
})
