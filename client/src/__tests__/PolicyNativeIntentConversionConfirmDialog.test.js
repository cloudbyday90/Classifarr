/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import PolicyNativeIntentConversionConfirmDialog from '@/components/policies/PolicyNativeIntentConversionConfirmDialog.vue'

beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.open = true
    }
  }

  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close() {
      this.open = false
      this.dispatchEvent(new Event('close'))
    }
  }
})

function mountDialog(props = {}) {
  return mount(PolicyNativeIntentConversionConfirmDialog, {
    attachTo: document.body,
    props: {
      modelValue: true,
      selectedCandidates: [{ policyId: 4, policyName: 'Family Movies', libraryName: 'Movies' }],
      confirmationValue: 'CONVERT_NATIVE_INTENT',
      isApplying: false,
      ...props,
    },
  })
}

describe('PolicyNativeIntentConversionConfirmDialog.vue', () => {
  it('shows selected policy scope and keeps the conversion action disabled until confirmation matches', async () => {
    const wrapper = mountDialog()
    await nextTick()

    expect(wrapper.text()).toContain('Family Movies, Movies')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()

    await wrapper.get('input').setValue('CONVERT_NATIVE_INTENT')

    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
  })

  it('emits the exact confirmation after form submission', async () => {
    const wrapper = mountDialog()
    await wrapper.get('input').setValue('CONVERT_NATIVE_INTENT')

    await wrapper.get('form').trigger('submit.prevent')

    expect(wrapper.emitted('confirm')).toEqual([['CONVERT_NATIVE_INTENT']])
  })

  it('emits a close update when cancellation is requested', async () => {
    const wrapper = mountDialog()

    await wrapper.get('button[type="button"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toContainEqual([false])
  })
})
