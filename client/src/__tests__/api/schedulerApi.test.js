import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetDataRequest = vi.fn()
const mockPost = vi.fn()
const mockPut = vi.fn()
const mockDelete = vi.fn()

vi.mock('../../api/core', () => ({
  getDataRequest: (...args) => mockGetDataRequest(...args),
  apiClient: {
    post: (...args) => mockPost(...args),
    put: (...args) => mockPut(...args),
    delete: (...args) => mockDelete(...args),
  },
}))

import {
  getScheduledTasks,
  createScheduledTask,
  updateScheduledTask,
  deleteScheduledTask,
  runScheduledTask,
} from '../../api/schedulerApi'

describe('schedulerApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getScheduledTasks calls getDataRequest with /scheduler', async () => {
    const tasks = [{ id: 1, name: 'Sync', cron: '0 * * * *' }]
    mockGetDataRequest.mockResolvedValueOnce(tasks)
    const result = await getScheduledTasks()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/scheduler')
    expect(result).toEqual(tasks)
  })

  it('createScheduledTask calls POST with data', async () => {
    const data = { name: 'Cleanup', cron: '0 0 * * *' }
    mockPost.mockResolvedValueOnce({ data: { id: 2 } })
    await createScheduledTask(data)
    expect(mockPost).toHaveBeenCalledWith('/scheduler', data)
  })

  it('updateScheduledTask calls PUT with id and data', async () => {
    const data = { cron: '0 */2 * * *' }
    mockPut.mockResolvedValueOnce({ data: {} })
    await updateScheduledTask(3, data)
    expect(mockPut).toHaveBeenCalledWith('/scheduler/3', data)
  })

  it('deleteScheduledTask calls DELETE with id', async () => {
    mockDelete.mockResolvedValueOnce({ data: {} })
    await deleteScheduledTask(5)
    expect(mockDelete).toHaveBeenCalledWith('/scheduler/5')
  })

  it('runScheduledTask calls POST with id in URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { started: true } })
    await runScheduledTask(7)
    expect(mockPost).toHaveBeenCalledWith('/scheduler/7/run')
  })
})
