/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Login from '../views/Login.vue'

const mockPush = vi.fn()
const mockRouteQuery = { expired: undefined, redirect: undefined }
const mockToast = { warning: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() }

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => ({ query: mockRouteQuery }),
}))

vi.mock('../api', () => ({
  default: { login: vi.fn() },
}))

vi.mock('../stores/toast', () => ({
  useToast: () => mockToast,
}))

import api from '../api'

describe('Login.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRouteQuery.expired = undefined
    mockRouteQuery.redirect = undefined
  })

  // ── Rendering ──────────────────────────────────────────────────────────────

  describe('rendering', () => {
    it('renders the sign-in form', () => {
      const wrapper = mount(Login)
      expect(wrapper.find('form').exists()).toBe(true)
      expect(wrapper.find('input[autocomplete="username"]').exists()).toBe(true)
      expect(wrapper.find('input[autocomplete="current-password"]').exists()).toBe(true)
    })

    it('renders the Remember Me checkbox unchecked by default', () => {
      const wrapper = mount(Login)
      const checkbox = wrapper.find('#rememberMe')
      expect(checkbox.exists()).toBe(true)
      expect(checkbox.element.checked).toBe(false)
    })

    it('renders the Remember Me label', () => {
      const wrapper = mount(Login)
      expect(wrapper.find('label[for="rememberMe"]').text()).toContain('Remember me')
    })

    it('submit button is disabled when fields are empty', () => {
      const wrapper = mount(Login)
      expect(wrapper.find('button[type="submit"]').element.disabled).toBe(true)
    })

    it('submit button is enabled when both fields are filled', async () => {
      const wrapper = mount(Login)
      await wrapper.find('input[autocomplete="username"]').setValue('admin')
      await wrapper.find('input[autocomplete="current-password"]').setValue('Password1!')
      expect(wrapper.find('button[type="submit"]').element.disabled).toBe(false)
    })
  })

  // ── Session-expired toast ──────────────────────────────────────────────────

  describe('expired session', () => {
    it('shows warning toast when ?expired=true is in the query', async () => {
      mockRouteQuery.expired = 'true'
      mount(Login)
      await flushPromises()
      expect(mockToast.warning).toHaveBeenCalledWith('Session expired. Please log in again.')
    })

    it('does not show warning toast when query flag is absent', async () => {
      mount(Login)
      await flushPromises()
      expect(mockToast.warning).not.toHaveBeenCalled()
    })
  })

  // ── Login submission ───────────────────────────────────────────────────────

  describe('login submission', () => {
    it('calls api.login with identifier, password, and rememberMe=false by default', async () => {
      api.login.mockResolvedValueOnce({ data: { success: true } })
      const wrapper = mount(Login)

      await wrapper.find('input[autocomplete="username"]').setValue('admin')
      await wrapper.find('input[autocomplete="current-password"]').setValue('Password1!')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(api.login).toHaveBeenCalledWith('admin', 'Password1!', false)
    })

    it('passes rememberMe=true when the checkbox is checked', async () => {
      api.login.mockResolvedValueOnce({ data: { success: true } })
      const wrapper = mount(Login)

      await wrapper.find('input[autocomplete="username"]').setValue('admin')
      await wrapper.find('input[autocomplete="current-password"]').setValue('Password1!')
      await wrapper.find('#rememberMe').setValue(true)
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(api.login).toHaveBeenCalledWith('admin', 'Password1!', true)
    })

    it('redirects to / on successful login', async () => {
      api.login.mockResolvedValueOnce({ data: { success: true } })
      const wrapper = mount(Login)

      await wrapper.find('input[autocomplete="username"]').setValue('admin')
      await wrapper.find('input[autocomplete="current-password"]').setValue('Password1!')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(mockPush).toHaveBeenCalledWith('/')
    })

    it('redirects to ?redirect query param on successful login', async () => {
      mockRouteQuery.redirect = '/settings'
      api.login.mockResolvedValueOnce({ data: { success: true } })
      const wrapper = mount(Login)

      await wrapper.find('input[autocomplete="username"]').setValue('admin')
      await wrapper.find('input[autocomplete="current-password"]').setValue('Password1!')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(mockPush).toHaveBeenCalledWith('/settings')
    })

    it('does not call api.login when fields are empty', async () => {
      const wrapper = mount(Login)
      await wrapper.find('form').trigger('submit')
      await flushPromises()
      expect(api.login).not.toHaveBeenCalled()
    })

    it('shows error message on failed login', async () => {
      api.login.mockRejectedValueOnce({
        response: { data: { error: 'Invalid credentials' } },
      })
      const wrapper = mount(Login)

      await wrapper.find('input[autocomplete="username"]').setValue('admin')
      await wrapper.find('input[autocomplete="current-password"]').setValue('wrongpass')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(wrapper.text()).toContain('Invalid credentials')
    })

    it('shows fallback error message when server provides no message', async () => {
      api.login.mockRejectedValueOnce(new Error('Network Error'))
      const wrapper = mount(Login)

      await wrapper.find('input[autocomplete="username"]').setValue('admin')
      await wrapper.find('input[autocomplete="current-password"]').setValue('pass')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(wrapper.text()).toContain('Login failed')
    })

    it('shows lockout message including minute countdown', async () => {
      const lockoutMsg = 'Account temporarily locked due to too many failed login attempts. Try again in 8 minutes.'
      api.login.mockRejectedValueOnce({
        response: { data: { error: lockoutMsg } },
      })
      const wrapper = mount(Login)

      await wrapper.find('input[autocomplete="username"]').setValue('admin')
      await wrapper.find('input[autocomplete="current-password"]').setValue('wrongpass')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(wrapper.text()).toContain('temporarily locked')
      expect(wrapper.text()).toContain('8 minutes')
    })

    it('does not redirect when api.login returns success: false', async () => {
      api.login.mockResolvedValueOnce({ data: { success: false } })
      const wrapper = mount(Login)

      await wrapper.find('input[autocomplete="username"]').setValue('admin')
      await wrapper.find('input[autocomplete="current-password"]').setValue('Password1!')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(mockPush).not.toHaveBeenCalled()
    })

    it('shows loading state while submitting', async () => {
      let resolve
      api.login.mockReturnValueOnce(new Promise(r => { resolve = r }))
      const wrapper = mount(Login)

      await wrapper.find('input[autocomplete="username"]').setValue('admin')
      await wrapper.find('input[autocomplete="current-password"]').setValue('Password1!')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(wrapper.find('button[type="submit"]').text()).toBe('Signing in...')
      resolve({ data: { success: true } })
      await flushPromises()
      expect(wrapper.find('button[type="submit"]').text()).toBe('Sign In')
    })
  })

  // ── Password visibility toggle ─────────────────────────────────────────────

  describe('password visibility toggle', () => {
    it('toggles password field to text type when eye button is clicked', async () => {
      const wrapper = mount(Login)
      const passwordInput = wrapper.find('input[autocomplete="current-password"]')
      expect(passwordInput.attributes('type')).toBe('password')

      await wrapper.find('button[type="button"]').trigger('click')
      expect(passwordInput.attributes('type')).toBe('text')

      await wrapper.find('button[type="button"]').trigger('click')
      expect(passwordInput.attributes('type')).toBe('password')
    })
  })
})
