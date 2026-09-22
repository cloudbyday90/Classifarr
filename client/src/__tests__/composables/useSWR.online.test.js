/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { useSWR } from '../../composables/useSWR'

let wrapper
afterEach(() => {
  wrapper?.unmount()
  vi.restoreAllMocks()
})

it('uses real VueUse online events to resume SWR once and stops listening after unmount', async () => {
  // Other SWR unit tests mock useOnline. Keep this dependency contract real.
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  const fetcher = vi.fn().mockResolvedValue({ state: 'ready' })
  wrapper = mount(defineComponent({
    setup: () => useSWR('online-contract', fetcher, { persist: false, autoRetry: false }),
    template: '<div>{{ isOffline ? "offline" : "online" }}</div>',
  }))
  await flushPromises()
  expect(fetcher).toHaveBeenCalledTimes(1)
  window.dispatchEvent(new Event('offline'))
  await flushPromises()
  expect(wrapper.text()).toBe('offline')
  await wrapper.vm.refresh()
  expect(fetcher).toHaveBeenCalledTimes(1)
  window.dispatchEvent(new Event('online'))
  await flushPromises()
  expect(wrapper.text()).toBe('online')
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(wrapper.vm.data).toEqual({ state: 'ready' })
  wrapper.unmount()
  wrapper = null
  window.dispatchEvent(new Event('offline'))
  window.dispatchEvent(new Event('online'))
  await flushPromises()
  expect(fetcher).toHaveBeenCalledTimes(2)
})
