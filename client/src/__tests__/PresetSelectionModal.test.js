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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import PresetSelectionModal from '../components/policies/PresetSelectionModal.vue';
import api from '../api';

// Mock the API
vi.mock('../api', () => ({
  default: {
    get: vi.fn()
  }
}));

describe('PresetSelectionModal.vue', () => {
  const mockLibrary = {
    id: 1,
    name: 'Sci-Fi Movies'
  };

  const mockPresets = [
    {
      id: 1,
      name: 'Sci-Fi',
      icon: '🚀',
      category: 'genres',
      description: 'Science fiction content',
      source: 'builtin'
    },
    {
      id: 2,
      name: 'Space Opera',
      icon: '🌌',
      category: 'genres',
      description: 'Epic space adventures',
      source: 'builtin'
    },
    {
      id: 3,
      name: 'Custom Preset',
      icon: '⭐',
      category: 'custom',
      description: 'My custom preset',
      source: 'custom'
    }
  ];

  const mockSuggestedPresets = [
    {
      id: 1,
      name: 'Sci-Fi',
      icon: '🚀',
      match_score: 90,
      match_reasons: ['Library name match']
    },
    {
      id: 2,
      name: 'Space Opera',
      icon: '🌌',
      match_score: 75,
      match_reasons: ['Related genre']
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: [] });
  });

  describe('Component Lifecycle', () => {
    it('renders without crashing when closed', () => {
      const wrapper = mount(PresetSelectionModal, {
        props: {
          modelValue: false,
          library: mockLibrary,
          existingPresetIds: []
        },
        global: {
          stubs: {
            Teleport: true
          }
        }
      });
      expect(wrapper.exists()).toBe(true);
    });

    it('opens modal when modelValue is true', async () => {
      api.get.mockResolvedValue({ data: mockPresets });
      const wrapper = mount(PresetSelectionModal, {
        props: {
          modelValue: true,
          library: mockLibrary,
          existingPresetIds: []
        },
        attachTo: document.body
      });
      await flushPromises();
      expect(wrapper.vm.isOpen).toBe(true);
    });

    it('loads presets when modal opens', async () => {
      api.get.mockResolvedValue({ data: mockPresets });
      const wrapper = mount(PresetSelectionModal, {
        props: {
          modelValue: true,
          library: mockLibrary,
          existingPresetIds: []
        },
        attachTo: document.body
      });
      await flushPromises();
      expect(wrapper.vm.allPresets.length).toBeGreaterThan(0);
    });
  });

  describe('Suggested Presets', () => {
    it('loads suggested presets when library is provided', async () => {
      api.get.mockImplementation((url) => {
        if (url === '/presets/all?include_custom=true') {
          return Promise.resolve({ data: mockPresets });
        }
        if (url.includes('/policies/presets/suggest/')) {
          return Promise.resolve({ data: { suggestions: mockSuggestedPresets } });
        }
        return Promise.resolve({ data: [] });
      });

      const wrapper = mount(PresetSelectionModal, {
        props: {
          modelValue: true,
          library: mockLibrary,
          existingPresetIds: []
        },
        attachTo: document.body
      });
      await flushPromises();
      
      expect(wrapper.vm.suggestedPresets.length).toBe(2);
      expect(wrapper.vm.suggestedPresets[0].match_score).toBe(90);
    });

    it('does not load suggestions when library is null', async () => {
      api.get.mockResolvedValue({ data: mockPresets });

      const wrapper = mount(PresetSelectionModal, {
        props: {
          modelValue: true,
          library: null,
          existingPresetIds: []
        },
        attachTo: document.body
      });
      await flushPromises();
      
      expect(wrapper.vm.suggestedPresets.length).toBe(0);
    });

    it('can add all suggested presets at once', async () => {
      api.get.mockImplementation((url) => {
        if (url === '/presets/all?include_custom=true') {
          return Promise.resolve({ data: mockPresets });
        }
        if (url.includes('/policies/presets/suggest/')) {
          return Promise.resolve({ data: { suggestions: mockSuggestedPresets } });
        }
        return Promise.resolve({ data: [] });
      });

      const wrapper = mount(PresetSelectionModal, {
        props: {
          modelValue: true,
          library: mockLibrary,
          existingPresetIds: []
        },
        attachTo: document.body
      });
      await flushPromises();
      
      expect(wrapper.vm.selectedPresets.length).toBe(0);
      wrapper.vm.addAllSuggested();
      expect(wrapper.vm.selectedPresets.length).toBe(2);
    });
  });

  describe('Category Filtering', () => {
    it('creates category tabs from presets', async () => {
      api.get.mockResolvedValue({ data: mockPresets });
      const wrapper = mount(PresetSelectionModal, {
        props: {
          modelValue: true,
          library: mockLibrary,
          existingPresetIds: []
        },
        attachTo: document.body
      });
      await flushPromises();
      
      expect(wrapper.vm.categoryTabs.length).toBeGreaterThan(0);
      expect(wrapper.vm.categoryTabs[0].value).toBe('all');
    });

    it('includes "My Presets" category when custom presets exist', async () => {
      api.get.mockResolvedValue({ data: mockPresets });
      const wrapper = mount(PresetSelectionModal, {
        props: {
          modelValue: true,
          library: mockLibrary,
          existingPresetIds: []
        },
        attachTo: document.body
      });
      await flushPromises();
      
      const customCategory = wrapper.vm.categoryTabs.find(c => c.value === 'custom');
      expect(customCategory).toBeDefined();
      expect(customCategory.label).toBe('My Presets');
    });

    it('filters presets by category', async () => {
      api.get.mockResolvedValue({ data: mockPresets });
      const wrapper = mount(PresetSelectionModal, {
        props: {
          modelValue: true,
          library: mockLibrary,
          existingPresetIds: []
        },
        attachTo: document.body
      });
      await flushPromises();
      
      wrapper.vm.selectedCategory = 'genres';
      await wrapper.vm.$nextTick();
      
      const filtered = wrapper.vm.filteredPresets;
      expect(filtered.every(p => p.category === 'genres')).toBe(true);
    });

    it('filters custom presets when "custom" category selected', async () => {
      api.get.mockResolvedValue({ data: mockPresets });
      const wrapper = mount(PresetSelectionModal, {
        props: {
          modelValue: true,
          library: mockLibrary,
          existingPresetIds: []
        },
        attachTo: document.body
      });
      await flushPromises();
      
      wrapper.vm.selectedCategory = 'custom';
      await wrapper.vm.$nextTick();
      
      const filtered = wrapper.vm.filteredPresets;
      expect(filtered.every(p => p.source === 'custom')).toBe(true);
    });
  });

  describe('Search Functionality', () => {
    it('filters presets based on search query', async () => {
      api.get.mockResolvedValue({ data: mockPresets });
      const wrapper = mount(PresetSelectionModal, {
        props: {
          modelValue: true,
          library: mockLibrary,
          existingPresetIds: []
        },
        attachTo: document.body
      });
      await flushPromises();
      
      wrapper.vm.searchQuery = 'Sci-Fi';
      await wrapper.vm.$nextTick();
      
      const filtered = wrapper.vm.filteredPresets;
      expect(filtered.length).toBeLessThanOrEqual(mockPresets.length);
      expect(filtered.some(p => p.name.includes('Sci-Fi'))).toBe(true);
    });
  });

  describe('Preset Selection', () => {
    it('can select and deselect presets', async () => {
      api.get.mockResolvedValue({ data: mockPresets });
      const wrapper = mount(PresetSelectionModal, {
        props: {
          modelValue: true,
          library: mockLibrary,
          existingPresetIds: []
        },
        attachTo: document.body
      });
      await flushPromises();
      
      const presets = wrapper.vm.allPresets;
      if (presets && presets.length > 0) {
        const preset = presets[0];
        
        // Initially not selected
        expect(wrapper.vm.isSelected(preset.id)).toBe(false);
        
        // Select
        wrapper.vm.togglePreset(preset);
        expect(wrapper.vm.isSelected(preset.id)).toBe(true);
        expect(wrapper.vm.selectedPresets.length).toBe(1);
        
        // Deselect
        wrapper.vm.togglePreset(preset);
        expect(wrapper.vm.isSelected(preset.id)).toBe(false);
        expect(wrapper.vm.selectedPresets.length).toBe(0);
      }
    });

    it('excludes presets that already exist in policy', async () => {
      api.get.mockResolvedValue({ data: mockPresets });
      const wrapper = mount(PresetSelectionModal, {
        props: {
          modelValue: true,
          library: mockLibrary,
          existingPresetIds: [1] // Preset 1 already exists
        },
        attachTo: document.body
      });
      await flushPromises();
      
      // allPresets should filter out existing presets
      const hasExistingPreset = wrapper.vm.allPresets.find(p => p.id === 1);
      expect(hasExistingPreset).toBeUndefined();
    });

    it('does not allow selecting presets already in policy', async () => {
      api.get.mockResolvedValue({ data: mockPresets });
      const preset = { ...mockPresets[0], id: 99 };
      
      const wrapper = mount(PresetSelectionModal, {
        props: {
          modelValue: true,
          library: mockLibrary,
          existingPresetIds: [99]
        },
        attachTo: document.body
      });
      await flushPromises();
      
      wrapper.vm.togglePreset(preset);
      expect(wrapper.vm.selectedPresets.length).toBe(0);
    });
  });

  describe('Modal Actions', () => {
    it('emits confirm event with selected presets', async () => {
      api.get.mockResolvedValue({ data: mockPresets });
      const wrapper = mount(PresetSelectionModal, {
        props: {
          modelValue: true,
          library: mockLibrary,
          existingPresetIds: []
        },
        attachTo: document.body
      });
      await flushPromises();
      
      const presets = wrapper.vm.allPresets;
      if (presets && presets.length > 0) {
        wrapper.vm.togglePreset(presets[0]);
        wrapper.vm.confirm();
        
        expect(wrapper.emitted('confirm')).toBeTruthy();
        expect(wrapper.emitted('confirm')[0][0].length).toBe(1);
      }
    });

    it('emits update:modelValue when closing', async () => {
      api.get.mockResolvedValue({ data: mockPresets });
      const wrapper = mount(PresetSelectionModal, {
        props: {
          modelValue: true,
          library: mockLibrary,
          existingPresetIds: []
        },
        attachTo: document.body
      });
      await flushPromises();
      
      wrapper.vm.close();
      
      expect(wrapper.emitted('update:modelValue')).toBeTruthy();
      expect(wrapper.emitted('update:modelValue')[0]).toEqual([false]);
    });

    it('clears selection when closing', async () => {
      api.get.mockResolvedValue({ data: mockPresets });
      const wrapper = mount(PresetSelectionModal, {
        props: {
          modelValue: true,
          library: mockLibrary,
          existingPresetIds: []
        },
        attachTo: document.body
      });
      await flushPromises();
      
      const presets = wrapper.vm.allPresets;
      if (presets && presets.length > 0) {
        wrapper.vm.togglePreset(presets[0]);
        expect(wrapper.vm.selectedPresets.length).toBe(1);
        
        wrapper.vm.close();
        expect(wrapper.vm.selectedPresets.length).toBe(0);
      }
    });
  });

  describe('API Integration', () => {
    it('loads presets when modal opens', async () => {
      api.get.mockResolvedValue({ data: mockPresets });
      
      const wrapper = mount(PresetSelectionModal, {
        props: {
          modelValue: false,
          library: mockLibrary,
          existingPresetIds: []
        },
        attachTo: document.body
      });
      
      await wrapper.setProps({ modelValue: true });
      await flushPromises();
      
      expect(api.get).toHaveBeenCalledWith('/presets/all?include_custom=true');
    });

    it('loads suggestions when library is provided', async () => {
      api.get.mockImplementation((url) => {
        if (url === '/presets/all?include_custom=true') {
          return Promise.resolve({ data: mockPresets });
        }
        if (url.includes('/policies/presets/suggest/')) {
          return Promise.resolve({ data: { suggestions: mockSuggestedPresets } });
        }
        return Promise.resolve({ data: [] });
      });
      
      const wrapper = mount(PresetSelectionModal, {
        props: {
          modelValue: false,
          library: mockLibrary,
          existingPresetIds: []
        },
        attachTo: document.body
      });
      
      await wrapper.setProps({ modelValue: true });
      await flushPromises();
      
      expect(api.get).toHaveBeenCalledWith(`/policies/presets/suggest/${mockLibrary.id}`);
    });

    it('handles API errors gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      api.get.mockRejectedValue(new Error('API Error'));
      
      const wrapper = mount(PresetSelectionModal, {
        props: {
          modelValue: true,
          library: mockLibrary,
          existingPresetIds: []
        },
        attachTo: document.body
      });
      await flushPromises();
      
      expect(wrapper.exists()).toBe(true);
      consoleError.mockRestore();
    });
  });
});
