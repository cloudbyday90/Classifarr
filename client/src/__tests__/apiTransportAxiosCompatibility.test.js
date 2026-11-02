/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, expect, it, vi } from 'vitest'
import axios, { AxiosError } from 'axios'
import { apiClient } from '../api/apiTransport.js'
import { CSRF_COOKIE_NAME } from '../utils/csrf.js'

afterEach(() => {
  document.cookie = `${CSRF_COOKIE_NAME}=; Max-Age=0; path=/`
  vi.restoreAllMocks()
})

it('real Axios preserves literal Link defaults alongside method buckets', async () => {
  const received = []
  const instance = axios.create({ headers: { Link: '</api/next>; rel="next"', post: { 'X-Method': 'post' } },
    adapter: async config => { received.push(config); return { data: {}, status: 200, statusText: 'OK', headers: {}, config } } })
  await instance.post('/fixture', {})
  expect(received[0].headers.get('Link')).toBe('</api/next>; rel="next"')
  expect(received[0].headers.get('X-Method')).toBe('post')
})

it('the unmocked central transport retains credentials, JSON and explicit CSRF headers', async () => {
  document.cookie = `${CSRF_COOKIE_NAME}=fixture-csrf; path=/`
  let received
  const response = await apiClient.post('/fixture', { value: 1 }, { adapter: async config => {
    received = config
    return { data: { saved: true }, status: 200, statusText: 'OK', headers: {}, config }
  } })
  expect(response.data).toEqual({ saved: true })
  expect(received.withCredentials).toBe(true)
  expect(received.headers.get('X-CSRF-Token')).toBe('fixture-csrf')
  expect(received.headers.get('Content-Type')).toBe('application/json')
  expect(received.data).toBe('{"value":1}')
})

it.each([401, 503, null])('explicit no-replay survives real Axios rejection %s', async status => {
  const refresh = vi.spyOn(axios, 'post')
  const adapter = vi.fn(async config => {
    const response = status ? { status, data: {}, headers: {}, config } : undefined
    throw new AxiosError('fixture refusal', 'ERR_NETWORK', config, undefined, response)
  })
  await expect(apiClient.post('/fixture', {}, { adapter, skipAutomaticRetry: true })).rejects.toBeInstanceOf(AxiosError)
  expect(adapter).toHaveBeenCalledTimes(1)
  expect(refresh).not.toHaveBeenCalled()
})

it('pre-aborted requests never dispatch through the real Axios core', async () => {
  const controller = new AbortController(), adapter = vi.fn()
  controller.abort()
  await expect(apiClient.get('/fixture', { adapter, signal: controller.signal, skipAutomaticRetry: true })).rejects.toMatchObject({ code: 'ERR_CANCELED' })
  expect(adapter).not.toHaveBeenCalled()
})
