/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, it, vi } from 'vitest'
const get = vi.fn()
vi.mock('../../api/core', () => ({ getDataRequest: (...args) => get(...args), apiClient: {} }))
import { getInventoryRecovery, getInventoryRecoveryPlexLink } from '../../api/inventoryRecoveryApi'
import mediaServerApi from '../../api/mediaServer'
beforeEach(() => vi.clearAllMocks())
it('unwraps bounded reads, encodes link paths and is available through the domain aggregator', async () => {
  get.mockResolvedValue({ items: [] })
  expect(await getInventoryRecovery()).toEqual({ items: [] })
  expect(get).toHaveBeenLastCalledWith('/inventory-recovery', { params: {}, skipAutomaticRetry: true })
  await getInventoryRecovery(25)
  expect(get).toHaveBeenLastCalledWith('/inventory-recovery', { params: { afterId: 25 }, skipAutomaticRetry: true })
  await getInventoryRecoveryPlexLink('1/2', 'case?x')
  expect(get).toHaveBeenLastCalledWith('/inventory-recovery/1%2F2/case%3Fx/plex-link', { skipAutomaticRetry: true })
  expect(mediaServerApi).toMatchObject({ getInventoryRecovery, getInventoryRecoveryPlexLink })
})
