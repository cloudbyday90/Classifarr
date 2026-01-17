/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2026 cloudbyday90
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
import Modal from '../components/common/Modal.vue'
import Button from '../components/common/Button.vue'

describe('ClearResyncDialog.vue', () => {
  let wrapper

  beforeEach(() => {
    wrapper = mount(ClearResyncDialog, {
      global: {
        components: {
          Modal,
          Button
        }
      }
    })
  })

  it('renders without crashing', () => {
    expect(wrapper.exists()).toBe(true)
  })

  it('displays warning about what will be deleted', () => {
    const text = wrapper.text()
    expect(text).toContain('Stop any active sync operation')
    expect(text).toContain('Delete ALL classification history and embeddings')
    expect(text).toContain('Delete ALL library data and collections')
    expect(text).toContain('Re-sync everything fresh from your media server')
  })

  it('displays information about preserved settings', () => {
    const text = wrapper.text()
    expect(text).toContain('Policies and presets will be preserved')
    expect(text).toContain('AI provider settings will be preserved')
    expect(text).toContain('Discord settings will be preserved')
    expect(text).toContain('Radarr/Sonarr connections will be preserved')
    expect(text).toContain('Radarr/Sonarr library mappings will be auto-restored')
  })

  it('displays note about RAG embeddings', () => {
    const text = wrapper.text()
    expect(text).toContain('RAG embeddings will be cleared')
    expect(text).toContain('rebuild automatically')
  })

  it('has cancel button', () => {
    const buttons = wrapper.findAllComponents(Button)
    const cancelButton = buttons.find(b => b.text().includes('Cancel'))
    expect(cancelButton.exists()).toBe(true)
  })

  it('has confirm button with correct text', () => {
    const buttons = wrapper.findAllComponents(Button)
    const confirmButton = buttons.find(b => b.text().includes('Clear & Re-sync All'))
    expect(confirmButton.exists()).toBe(true)
  })

  it('emits confirm event when confirm button is clicked', async () => {
    // Open the dialog first
    wrapper.vm.open()
    await wrapper.vm.$nextTick()

    const buttons = wrapper.findAllComponents(Button)
    const confirmButton = buttons.find(b => b.text().includes('Clear & Re-sync All'))
    
    await confirmButton.trigger('click')
    
    expect(wrapper.emitted('confirm')).toBeTruthy()
    expect(wrapper.emitted('confirm')).toHaveLength(1)
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
})
