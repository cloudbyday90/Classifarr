/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import ArrConfigWarning from '../components/settings/ArrConfigWarning.vue'

const wrappers = []
const row = (type = 'Radarr', id = 1, name = `${type} Main`) => ({
  type, id, name, missingField: 'quality_profile_id',
})

async function render(loadStatus = vi.fn().mockResolvedValue({ incompleteConfigs: [] })) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: ['/', '/settings/radarr', '/settings/sonarr'].map(path => ({ path, component: { template: '<div />' } })),
  })
  await router.push('/')
  await router.isReady()
  const wrapper = mount(ArrConfigWarning, { props: { loadStatus }, global: { plugins: [router] } })
  wrappers.push(wrapper)
  await flushPromises()
  return { wrapper, router, loadStatus }
}

afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  vi.restoreAllMocks()
})

describe('ArrConfigWarning', () => {
  it.each([null, undefined, {}, { incompleteConfigs: [] }, { incompleteConfigs: 'invalid' }])(
    'keeps the optional warning hidden for empty or malformed status %j', async status => {
      const { wrapper, loadStatus } = await render(vi.fn().mockResolvedValue(status))
      expect(wrapper.exists()).toBe(true)
      expect(wrapper.find('h3').exists()).toBe(false)
      expect(loadStatus).toHaveBeenCalledExactlyOnceWith()
    },
  )

  it.each(['Radarr', 'Sonarr'])('renders and navigates a %s warning with a real link', async type => {
    const { wrapper, router } = await render(vi.fn().mockResolvedValue({ incompleteConfigs: [row(type)] }))
    expect(wrapper.get('h3').text()).toBe('Incomplete Configuration Detected')
    expect(wrapper.text()).toContain(`${type} Main`)
    expect(wrapper.text()).toContain('missing a Quality Profile')
    expect(wrapper.get('[aria-hidden="true"]').text()).toBe('⚠️')
    const link = wrapper.get('a')
    expect(link.text()).toBe(`Configure ${type} Now`)
    expect(link.attributes('href')).toBe(`/settings/${type.toLowerCase()}`)
    await link.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe(`/settings/${type.toLowerCase()}`)
  })

  it('preserves separate instances and provider-scoped IDs, without duplicate keys', async () => {
    const { wrapper } = await render(vi.fn().mockResolvedValue({ incompleteConfigs: [
      row('Radarr', 1, '4K'), row('Radarr', 2, 'HD'), row('Sonarr', 1, 'TV'), row('Radarr', 1, 'duplicate'),
    ] }))
    expect(wrapper.findAll('strong').map(node => node.text())).toEqual(['4K', 'HD', 'TV'])
    expect(wrapper.findAll('a').map(node => node.attributes('href'))).toEqual([
      '/settings/radarr', '/settings/radarr', '/settings/sonarr',
    ])
  })

  it('does not mislabel unsupported providers or missing fields as a quality-profile warning', async () => {
    const { wrapper } = await render(vi.fn().mockResolvedValue({ incompleteConfigs: [
      row('Unknown'), { ...row(), missingField: 'api_key' }, row('Sonarr'),
    ] }))
    expect(wrapper.findAll('a')).toHaveLength(1)
    expect(wrapper.get('a').attributes('href')).toBe('/settings/sonarr')
    expect(wrapper.text()).not.toContain('Unknown')
  })

  it('falls back for a missing name and renders supplied names as text, not markup', async () => {
    const name = '<img src=x onerror="alert(1)">'
    const { wrapper } = await render(vi.fn().mockResolvedValue({ incompleteConfigs: [row('Radarr', 1, null), row('Sonarr', 1, name)] }))
    expect(wrapper.text()).toContain('Radarr 1')
    expect(wrapper.text()).toContain(name)
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('dismisses with a named non-submit button without reloading status', async () => {
    const { wrapper, loadStatus } = await render(vi.fn().mockResolvedValue({ incompleteConfigs: [row()] }))
    const dismiss = wrapper.get('button[title="Dismiss"]')
    expect(dismiss.attributes('type')).toBe('button')
    expect(dismiss.attributes('aria-label')).toBe('Dismiss incomplete configuration warning')
    expect(dismiss.text()).toBe('✕')
    await dismiss.trigger('click')
    await flushPromises()
    expect(wrapper.find('h3').exists()).toBe(false)
    expect(loadStatus).toHaveBeenCalledExactlyOnceWith()
  })

  it('handles rejected loads without leaking raw transport errors', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { wrapper } = await render(vi.fn().mockRejectedValue(new Error('private provider response')))
    expect(wrapper.find('h3').exists()).toBe(false)
    expect(log).toHaveBeenCalledExactlyOnceWith('Failed to check arr config status')
  })

  it('handles synchronous loader failure without breaking Dashboard', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { wrapper } = await render(() => { throw new Error('transport setup failure') })
    expect(wrapper.find('h3').exists()).toBe(false)
    expect(log).toHaveBeenCalledExactlyOnceWith('Failed to check arr config status')
  })

  it('does not inspect a late response after unmount', async () => {
    let resolve
    const pending = new Promise(complete => { resolve = complete })
    const read = vi.fn(() => [row()])
    const { wrapper } = await render(() => pending)
    wrapper.unmount()
    resolve({ get incompleteConfigs() { return read() } })
    await flushPromises()
    expect(read).not.toHaveBeenCalled()
  })

  it('does not log a late rejection after unmount', async () => {
    let reject
    const pending = new Promise((resolve, fail) => { reject = fail })
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { wrapper } = await render(() => pending)
    wrapper.unmount()
    reject(new Error('late failure'))
    await flushPromises()
    expect(log).not.toHaveBeenCalled()
  })
})
