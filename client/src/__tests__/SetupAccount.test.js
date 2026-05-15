/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SetupAccount from '@/views/SetupAccount.vue'
import api from '@/api'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push })
}))

vi.mock('@/api', () => ({
  default: {
    createAdmin: vi.fn()
  }
}))

function mountView() {
  return mount(SetupAccount)
}

describe('SetupAccount.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    api.createAdmin.mockResolvedValue({
      data: {
        success: true,
        refreshToken: 'refresh-token-value'
      }
    })
  })

  it('keeps submit disabled until password rules and confirmation pass', async () => {
    const wrapper = mountView()

    const submitButton = wrapper.find('button[type="submit"]')
    expect(submitButton.element.disabled).toBe(true)

    await wrapper.find('input[autocomplete="username"]').setValue('admin')
    await wrapper.find('input[autocomplete="new-password"]').setValue('weak')
    const passwordInputs = wrapper.findAll('input[autocomplete="new-password"]')
    await passwordInputs[1].setValue('weak')

    expect(submitButton.element.disabled).toBe(true)
    expect(wrapper.text()).toContain('At least 8 characters')
    expect(wrapper.text()).toContain('One uppercase letter')
    expect(wrapper.text()).toContain('One special character (!@#$%^&*)')
  })

  it('toggles password visibility and shows mismatch feedback', async () => {
    const wrapper = mountView()

    const passwordInputs = wrapper.findAll('input[autocomplete="new-password"]')
    expect(passwordInputs[0].attributes('type')).toBe('password')
    expect(passwordInputs[1].attributes('type')).toBe('password')

    const toggleButton = wrapper.find('button[type="button"]')
    await toggleButton.trigger('click')

    expect(wrapper.findAll('input[autocomplete="new-password"]')[0].attributes('type')).toBe('text')
    expect(wrapper.findAll('input[autocomplete="new-password"]')[1].attributes('type')).toBe('text')

    await wrapper.find('input[autocomplete="username"]').setValue('admin')
    await wrapper.findAll('input[autocomplete="new-password"]')[0].setValue('StrongPass1!')
    await wrapper.findAll('input[autocomplete="new-password"]')[1].setValue('DifferentPass1!')

    expect(wrapper.text()).toContain('Passwords do not match')
  })

  it('creates the admin account, stores the refresh token, and redirects', async () => {
    const wrapper = mountView()

    await wrapper.find('input[autocomplete="username"]').setValue('admin')
    await wrapper.findAll('input[autocomplete="new-password"]')[0].setValue('StrongPass1!')
    await wrapper.findAll('input[autocomplete="new-password"]')[1].setValue('StrongPass1!')

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(api.createAdmin).toHaveBeenCalledWith({
      username: 'admin',
      password: 'StrongPass1!',
      confirmPassword: 'StrongPass1!'
    })
    expect(sessionStorage.getItem('classifarr_refresh_token')).toBe('refresh-token-value')
    expect(push).toHaveBeenCalledWith('/')
  })

  it('redirects without storing a token when the response omits refreshToken', async () => {
    api.createAdmin.mockResolvedValueOnce({
      data: {
        success: true
      }
    })

    const wrapper = mountView()

    await wrapper.find('input[autocomplete="username"]').setValue('admin')
    await wrapper.findAll('input[autocomplete="new-password"]')[0].setValue('StrongPass1!')
    await wrapper.findAll('input[autocomplete="new-password"]')[1].setValue('StrongPass1!')

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(sessionStorage.getItem('classifarr_refresh_token')).toBeNull()
    expect(push).toHaveBeenCalledWith('/')
  })

  it('surfaces API errors and clears the loading state', async () => {
    api.createAdmin.mockRejectedValueOnce({
      response: {
        data: {
          error: 'Username already exists'
        }
      }
    })

    const wrapper = mountView()

    await wrapper.find('input[autocomplete="username"]').setValue('admin')
    await wrapper.findAll('input[autocomplete="new-password"]')[0].setValue('StrongPass1!')
    await wrapper.findAll('input[autocomplete="new-password"]')[1].setValue('StrongPass1!')

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('Username already exists')
    expect(wrapper.find('button[type="submit"]').text()).toContain('Create Admin Account')
    expect(push).not.toHaveBeenCalled()
  })

  it('does not submit when the form is invalid', async () => {
    const wrapper = mountView()

    await wrapper.find('input[autocomplete="username"]').setValue('admin')
    await wrapper.findAll('input[autocomplete="new-password"]')[0].setValue('StrongPass1!')
    await wrapper.findAll('input[autocomplete="new-password"]')[1].setValue('Mismatch1!')

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(api.createAdmin).not.toHaveBeenCalled()
  })
})