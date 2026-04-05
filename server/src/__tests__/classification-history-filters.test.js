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
jest.mock('../services/classificationEvidenceReinforcementService', () => ({ reinforceOnAccept: jest.fn(), reinforceOnCorrection: jest.fn() }))
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
          { id: 1, title: 'Motorvalley', media_type: 'tv', library_name: 'TV Shows', total_count: '1' },
        ],
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
      // fallback COUNT for empty result set
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })

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

  test('returns real total when requested page is beyond last result', async () => {
    // Simulate page 5 of a dataset that only has 3 pages: data query returns
    // no rows because OFFSET exceeds the total, but the fallback COUNT should
    // report the actual total so the client can recover correct pagination.
    db.query
      .mockResolvedValueOnce({ rows: [] })            // page data query — out-of-range
      .mockResolvedValueOnce({ rows: [{ count: '42' }] }) // fallback COUNT query

    const response = await request(app)
      .get('/api/classification/history')
      .query({ page: 5, limit: 10 })
      .expect(200)

    expect(response.body.data).toEqual([])
    expect(response.body.pagination).toMatchObject({
      page: 5,
      limit: 10,
      total: 42,
      totalPages: 5,  // Math.ceil(42 / 10)
    })

    // Two queries: the paged data query and the fallback COUNT
    expect(db.query).toHaveBeenCalledTimes(2)
    const [countQueryText, countQueryParams] = db.query.mock.calls[1]
    expect(countQueryText).toContain('COUNT(*)')
    // COUNT query should NOT contain LIMIT or OFFSET params
    expect(countQueryParams).not.toContain(10)   // no limit
    expect(countQueryParams).not.toContain(40)   // no offset
  })

  test('uses single query (no fallback COUNT) when rows are returned', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [
          { id: 1, title: 'Alpha', media_type: 'movie', library_name: 'Movies', total_count: '3' },
          { id: 2, title: 'Beta',  media_type: 'movie', library_name: 'Movies', total_count: '3' },
        ],
      })

    const response = await request(app)
      .get('/api/classification/history')
      .query({ page: 1, limit: 10 })
      .expect(200)

    expect(response.body.pagination).toMatchObject({ total: 3, totalPages: 1 })
    // Only the single window-function query — no fallback COUNT
    expect(db.query).toHaveBeenCalledTimes(1)
    // total_count must be stripped from row objects
    expect(response.body.data[0]).not.toHaveProperty('total_count')
  })

  test('fallback COUNT reuses the same filter params (no LIMIT/OFFSET injected)', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '7' }] })

    await request(app)
      .get('/api/classification/history')
      .query({ page: 99, limit: 50, media_type: 'tv', library_id: 5 })
      .expect(200)

    const [, dataParams]  = db.query.mock.calls[0]  // paged query: [...filters, limit, offset]
    const [, countParams] = db.query.mock.calls[1]  // count query: [...filters only]

    // Count params should be data params minus the trailing limit and offset
    expect(countParams).toEqual(dataParams.slice(0, -2))
  })
})
