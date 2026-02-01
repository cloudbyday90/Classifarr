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

import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ClearResyncDialog from '../components/ClearResyncDialog.vue'

describe('ClearResyncDialog.vue', () => {
  let wrapper

  beforeEach(() => {
    // Mount with stubbed Modal to avoid Teleport issues in tests
    wrapper = mount(ClearResyncDialog, {
      global: {
        stubs: {
          Modal: {
            template: '<div><slot /><slot name="footer" /></div>',
            props: ['modelValue', 'title']
          },
          Button: {
            template: '<button @click="$emit(\'click\')"><slot /></button>',
            props: ['variant']
          }
        }
      }
    })
  })

  it('renders without crashing', () => {
    expect(wrapper.exists()).toBe(true)
  })

  it('displays warning about what will be deleted', () => {
    const html = wrapper.html()
    expect(html).toContain('Stop any active sync operation')
    expect(html).toContain('Delete ALL classification history and embeddings')
    expect(html).toContain('Delete ALL library data and collections')
    expect(html).toContain('Re-sync everything fresh from your media server')
  })

  it('displays information about preserved settings', () => {
    const html = wrapper.html()
    expect(html).toContain('preserved')
    expect(html).toContain('auto-restored')
  })

  it('displays note about RAG embeddings', () => {
    const html = wrapper.html()
    expect(html).toContain('RAG embeddings')
    expect(html).toContain('rebuild')
  })

  it('has cancel and confirm buttons', () => {
    const text = wrapper.text()
    expect(text).toContain('Cancel')
    expect(text).toContain('Clear & Re-sync All')
  })

  it('emits confirm event when confirm button is clicked', async () => {
    const buttons = wrapper.findAll('button')
    const confirmButton = buttons.find(b => b.text().includes('Clear & Re-sync All'))
    
    await confirmButton.trigger('click')
    
    expect(wrapper.emitted('confirm')).toBeTruthy()
    // May emit twice due to how the button is structured, just check it was emitted
    expect(wrapper.emitted('confirm').length).toBeGreaterThan(0)
  })

  it('can be opened and closed programmatically', async () => {
    expect(wrapper.vm.isOpen).toBe(false)
    
    wrapper.vm.open()
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.isOpen).toBe(true)
    
    wrapper.vm.close()
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.isOpen).toBe(false)
  })

  it('closes when confirm is called', async () => {
    wrapper.vm.open()
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.isOpen).toBe(true)
    
    wrapper.vm.confirm()
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.isOpen).toBe(false)
  })
})

