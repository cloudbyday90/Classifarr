/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetDataRequest = vi.fn()
const mockPost = vi.fn()
const mockPut = vi.fn()

vi.mock('../../api/core', () => ({
  getDataRequest: (...args) => mockGetDataRequest(...args),
  apiClient: {
    post: (...args) => mockPost(...args),
    put: (...args) => mockPut(...args),
  },
}))

import {
  getLibraries,
  getLibraryOverlap,
  getLibraryObservationHealth,
  getLibraryObservationHistory,
  getLibrary,
  updateLibrary,
  syncLibrary,
  getSyncStatus,
} from '../../api/libraryCatalogApi'

describe('libraryCatalogApi', () => {
  it('loads unwrapped observation history through the central GET helper', async () => {
    const report = { activity: [], samples: [{ libraryCoverage: [
      { libraryId: 7, comparison: 'population_changed', delta: null },
    ] }], librarySampling: { version: 'library.observation_sampling.v3', rowLimitPerVisit: 20000 },
    librarySamples: [{ libraryId: 19, status: 'in_progress', scannedRows: 20000, delta: null }] }
    mockGetDataRequest.mockResolvedValueOnce(report)
    expect(await getLibraryObservationHistory()).toBe(report)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/libraries/observation-history')
  })
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads the unwrapped read-only overlap summary', async () => {
    const report = { status: 'available', pairs: [] }
    mockGetDataRequest.mockResolvedValueOnce(report)
    expect(await getLibraryOverlap()).toEqual(report)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/libraries/overlap')
  })

  it('loads the unwrapped read-only observation health summary', async () => {
    const report = { status: 'available', libraries: [] }
    mockGetDataRequest.mockResolvedValueOnce(report)
    expect(await getLibraryObservationHealth()).toEqual(report)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/libraries/observation-health')
  })

  it('getLibraries calls getDataRequest with /libraries', async () => {
    const libs = [{ id: 1, name: 'Movies' }, { id: 2, name: 'TV Shows' }]
    mockGetDataRequest.mockResolvedValueOnce(libs)
    const result = await getLibraries()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/libraries')
    expect(result).toEqual(libs)
  })

  it('getLibrary calls getDataRequest with id in URL', async () => {
    const lib = { id: 5, name: 'Anime', mediaType: 'series' }
    mockGetDataRequest.mockResolvedValueOnce(lib)
    const result = await getLibrary(5)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/libraries/5')
    expect(result).toEqual(lib)
  })

  it('updateLibrary calls PUT with id in URL and data', async () => {
    const data = { name: 'Updated Library', enabled: true }
    mockPut.mockResolvedValueOnce({ data: { updated: true } })
    const result = await updateLibrary(3, data)
    expect(mockPut).toHaveBeenCalledWith('/libraries/3', data)
    expect(result).toEqual({ data: { updated: true } })
  })

  it('syncLibrary calls POST with id in URL and empty default options', async () => {
    mockPost.mockResolvedValueOnce({ data: { syncing: true } })
    const result = await syncLibrary(7)
    expect(mockPost).toHaveBeenCalledWith('/libraries/7/sync', {})
    expect(result).toEqual({ data: { syncing: true } })
  })

  it('syncLibrary passes provided options', async () => {
    const options = { force: true, deepScan: true }
    mockPost.mockResolvedValueOnce({ data: { syncing: true } })
    await syncLibrary(7, options)
    expect(mockPost).toHaveBeenCalledWith('/libraries/7/sync', options)
  })

  it('getSyncStatus calls getDataRequest with /sync/status', async () => {
    const status = { isRunning: true, type: 'library_sync', progress: 50 }
    mockGetDataRequest.mockResolvedValueOnce(status)
    const result = await getSyncStatus()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/sync/status')
    expect(result).toEqual(status)
  })
})
