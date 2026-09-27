/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { mount, flushPromises } from '@vue/test-utils'
import { ref, defineComponent } from 'vue'
import { expect, it, vi } from 'vitest'
import { useLibraryIngestionStatus } from '@/composables/useLibraryIngestionStatus'
const mock = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/api/libraryCatalogApi', () => ({ getLibrary: (...args) => mock.get(...args) }))

it('uses nonpersistent SWR, loads after setup, and preserves edited settings', async () => {
  localStorage.clear()
  const library = ref(null), requesting = ref(false)
  let status
  mock.get.mockResolvedValue({ name: 'server name', item_count: 7, ingestion_status: { state: 'complete' } })
  const wrapper = mount(defineComponent({ setup() { status = useLibraryIngestionStatus(library, requesting); return () => null } }))
  await flushPromises()
  expect(mock.get).not.toHaveBeenCalled()
  library.value = { id: 10, name: 'unsaved name', ingestion_status: { state: 'retry_wait' } }
  await flushPromises()
  expect(mock.get).toHaveBeenCalledWith(10)
  expect(library.value).toMatchObject({ name: 'unsaved name', item_count: 7, ingestion_status: { state: 'complete' } })
  expect(status.isSyncing.value).toBe(false)
  expect(localStorage.length).toBe(0)
  const calls = mock.get.mock.calls.length
  wrapper.unmount()
  await status.refresh()
  expect(mock.get).toHaveBeenCalledTimes(calls)
})
