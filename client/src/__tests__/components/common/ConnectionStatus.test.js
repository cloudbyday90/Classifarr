/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ConnectionStatus from '@/components/common/ConnectionStatus.vue'

describe('ConnectionStatus', () => {
  let wrapper
  afterEach(() => {
    wrapper?.unmount()
    vi.useRealTimers()
  })

  it.each([
    ['idle', 'Not Connected', 'border-gray-700'],
    ['testing', 'Connecting to Example', 'border-blue-700'],
    ['success', 'Connected Successfully', 'border-green-700'],
    ['error', 'Connection Failed', 'border-red-700'],
    ['unknown', 'Configuration Saved', 'border-gray-600'],
    ['warning', 'Warning', 'border-yellow-700'],
  ])('renders the %s state', (status, message, border) => {
    wrapper = mount(ConnectionStatus, { props: { status, serviceName: 'Example' } })
    expect(wrapper.text()).toContain(message)
    expect(wrapper.classes()).toContain(border)
  })

  it('preserves the default and unsupported-status presentations', async () => {
    wrapper = mount(ConnectionStatus)
    expect(wrapper.text()).toContain('Not Connected')
    await wrapper.setProps({ status: 'testing' })
    expect(wrapper.text()).toContain('Connecting to service')
    await wrapper.setProps({ status: 'future-state' })
    expect(wrapper.text()).toBe('')
  })

  it('renders text errors from existing settings callers without prop warnings', async () => {
    const warn = vi.fn()
    wrapper = mount(ConnectionStatus, {
      props: { status: 'error', error: 'Connection failed: Request rejected' },
      global: { config: { warnHandler: warn } },
    })
    expect(wrapper.text()).toContain('Connection failed: Request rejected')
    await wrapper.setProps({ status: 'warning', error: 'Please test your connection.' })
    expect(wrapper.text()).toContain('Please test your connection.')
    expect(warn).not.toHaveBeenCalled()
  })

  it('renders structured codes and troubleshooting, then clears stale details', async () => {
    wrapper = mount(ConnectionStatus, { props: {
      status: 'error',
      error: { code: 'ECONNREFUSED', message: 'Cannot connect', troubleshooting: ['Check the host', 'Check the port'] },
    } })
    expect(wrapper.text()).toContain('ECONNREFUSED: Cannot connect')
    expect(wrapper.findAll('li').map(tip => tip.text())).toEqual(['Check the host', 'Check the port'])
    await wrapper.setProps({ error: { message: 'Try again' } })
    expect(wrapper.text()).toContain('Try again')
    expect(wrapper.find('ul').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('ECONNREFUSED')
    await wrapper.setProps({ error: null })
    expect(wrapper.text()).toBe('❌ Connection Failed')
  })

  it('shows structured warning messages without dumping unrelated properties', () => {
    wrapper = mount(ConnectionStatus, { props: {
      status: 'warning', error: { code: 'PARTIAL', message: 'Check configuration', internal: 'not for display' },
    } })
    expect(wrapper.text()).toContain('PARTIAL: Check configuration')
    expect(wrapper.text()).not.toContain('not for display')
  })

  it('renders structured and text success details', async () => {
    wrapper = mount(ConnectionStatus, { props: { status: 'success', details: {
      serverName: 'Example', version: '1.2.3', additionalInfo: { Libraries: 10, Ready: true },
    } } })
    expect(wrapper.findAll('.flex.justify-between').map(row =>
      row.findAll('span').map(span => span.text()),
    )).toEqual([['Server:', 'Example'], ['Version:', '1.2.3'], ['Libraries:', '10'], ['Ready:', 'true']])
    await wrapper.setProps({ details: 'Connection successful!' })
    expect(wrapper.text()).toContain('Connection successful!')
    expect(wrapper.text()).not.toContain('Server:')
  })

  it.each([['success', 'details'], ['error', 'error'], ['warning', 'error']])(
    'escapes %s text payloads', (status, field) => {
      const text = '<img src=x onerror="alert(1)">'
      wrapper = mount(ConnectionStatus, { props: { status, [field]: text } })
      expect(wrapper.text()).toContain(text)
      expect(wrapper.find('img').exists()).toBe(false)
    },
  )

  it('keeps timestamp boundaries and only shows them after success', async () => {
    vi.useFakeTimers()
    const now = new Date('2026-10-12T12:00:00Z')
    vi.setSystemTime(now)
    wrapper = mount(ConnectionStatus, { props: { status: 'success', lastChecked: now } })
    expect(wrapper.text()).toContain('Last checked: Just now')
    await wrapper.setProps({ lastChecked: new Date(now.getTime() - 60_000) })
    expect(wrapper.text()).toContain('Last checked: 1 minutes ago')
    const earlier = new Date(now.getTime() - 3_600_000)
    await wrapper.setProps({ lastChecked: earlier })
    expect(wrapper.text()).toContain(`Last checked: ${earlier.toLocaleTimeString()}`)
    await wrapper.setProps({ status: 'testing' })
    expect(wrapper.text()).not.toContain('Last checked:')
    await wrapper.setProps({ status: 'success', lastChecked: null })
    expect(wrapper.text()).not.toContain('Last checked:')
  })
})
