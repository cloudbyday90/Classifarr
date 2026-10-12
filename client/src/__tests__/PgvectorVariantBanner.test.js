/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import PgvectorVariantBanner from '../components/PgvectorVariantBanner.vue'

const key = 'pgvectorVariantBannerDismissed'
const status = { enabled: true, pgvectorVariant: 'generic', pgvectorBuild: 'generic' }
const wrappers = []
async function render(loadStatus = vi.fn().mockResolvedValue(status)) {
  const errorHandler = vi.fn()
  const wrapper = mount(PgvectorVariantBanner, { props: { loadStatus }, global: { config: { errorHandler } } })
  wrappers.push(wrapper)
  await flushPromises()
  return { wrapper, loadStatus, errorHandler }
}
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  vi.restoreAllMocks()
  sessionStorage.clear()
})

describe('PgvectorVariantBanner', () => {
  it('renders reported constraints and keeps the safeguard advice', async () => {
    const { wrapper, loadStatus } = await render()
    expect(wrapper.get('h3').text()).toBe('pgvector generic mode reported')
    expect(wrapper.text()).toContain('Restarting the same image will not add an optimized binary.')
    expect(wrapper.text()).toContain('Keep compatibility and container security safeguards enabled.')
    expect(loadStatus).toHaveBeenCalledExactlyOnceWith()
  })
  it.each([null, {}, { ...status, enabled: false }, { ...status, pgvectorVariant: 'avx2' }])(
    'stays hidden for unavailable or inapplicable status %j', async response => {
      const { wrapper } = await render(vi.fn().mockResolvedValue(response))
      expect(wrapper.find('h3').exists()).toBe(false)
    },
  )
  it('dismisses without submitting and preserves the existing session marker on remount', async () => {
    const { wrapper } = await render()
    const button = wrapper.get('button')
    expect(button.attributes('type')).toBe('button')
    expect(button.text()).toBe('Dismiss pgvector notice')
    await button.trigger('click')
    expect(wrapper.find('h3').exists()).toBe(false)
    expect(sessionStorage.getItem(key)).toBe('true')
    wrapper.unmount()
    const next = await render()
    expect(next.wrapper.find('h3').exists()).toBe(false)
    expect(next.loadStatus).not.toHaveBeenCalled()
  })
  it.each(['access', 'getItem', 'setItem'])('continues when storage %s fails', async method => {
    const fail = vi.fn(() => { throw new Error('storage blocked') })
    if (method === 'access') vi.spyOn(globalThis, 'sessionStorage', 'get').mockImplementation(fail)
    else vi.spyOn(sessionStorage, method).mockImplementation(fail)
    const { wrapper, errorHandler, loadStatus } = await render()
    expect(wrapper.find('h3').exists()).toBe(true)
    await wrapper.get('button').trigger('click')
    expect(wrapper.find('h3').exists()).toBe(false)
    expect(errorHandler).not.toHaveBeenCalled()
    expect(loadStatus).toHaveBeenCalledExactlyOnceWith()
    expect(fail).toHaveBeenCalled()
  })
  it('keeps rejected requests non-critical and does not log raw errors', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { wrapper, errorHandler } = await render(vi.fn().mockRejectedValue(new Error('private transport context')))
    expect(wrapper.find('h3').exists()).toBe(false)
    expect(errorHandler).not.toHaveBeenCalled()
    expect(log).not.toHaveBeenCalled()
  })
  it('does not inspect a late response after unmount', async () => {
    let resolve
    const pending = new Promise(done => { resolve = done })
    const read = vi.fn(() => true)
    const { wrapper } = await render(() => pending)
    wrapper.unmount()
    resolve({ get enabled() { return read() }, pgvectorVariant: 'generic' })
    await flushPromises()
    expect(read).not.toHaveBeenCalled()
  })
  it('handles a late rejection after unmount', async () => {
    let reject
    const pending = new Promise((resolve, fail) => { reject = fail })
    const { wrapper, errorHandler } = await render(() => pending)
    wrapper.unmount()
    reject(new Error('late error'))
    await flushPromises()
    expect(errorHandler).not.toHaveBeenCalled()
  })
})
