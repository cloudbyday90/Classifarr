/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
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
import ArrConfigWarning from '../components/settings/ArrConfigWarning.vue';

// Create mock push function
const mockPush = vi.fn();

// Mock API
vi.mock('../api', () => ({
  default: {
    genericRequest: vi.fn()
  }
}));

// Mock router
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush
  })
}));

import api from '../api';

describe('ArrConfigWarning.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders without crashing when no incomplete configs', async () => {
      api.genericRequest.mockResolvedValueOnce({
        data: { incompleteConfigs: [] }
      });

      const wrapper = mount(ArrConfigWarning);
      await flushPromises();

      expect(wrapper.exists()).toBe(true);
    });

    it('does not display warning when all configs are complete', async () => {
      api.genericRequest.mockResolvedValueOnce({
        data: { incompleteConfigs: [] }
      });

      const wrapper = mount(ArrConfigWarning);
      await flushPromises();

      expect(wrapper.find('.bg-yellow-900\\/30').exists()).toBe(false);
    });

    it('displays warning banner when incomplete configs exist', async () => {
      api.genericRequest.mockResolvedValueOnce({
        data: {
          incompleteConfigs: [
            { type: 'Radarr', name: 'Radarr 4K', id: 1, missingField: 'quality_profile_id' }
          ]
        }
      });

      const wrapper = mount(ArrConfigWarning);
      await flushPromises();

      expect(wrapper.find('.bg-yellow-900\\/30').exists()).toBe(true);
      expect(wrapper.text()).toContain('Incomplete Configuration Detected');
    });

    it('displays warning icon', async () => {
      api.genericRequest.mockResolvedValueOnce({
        data: {
          incompleteConfigs: [
            { type: 'Radarr', name: 'Radarr Main', id: 1, missingField: 'quality_profile_id' }
          ]
        }
      });

      const wrapper = mount(ArrConfigWarning);
      await flushPromises();

      expect(wrapper.text()).toContain('⚠️');
    });
  });

  describe('Incomplete Configs Display', () => {
    it('displays single Radarr incomplete config', async () => {
      api.genericRequest.mockResolvedValueOnce({
        data: {
          incompleteConfigs: [
            { type: 'Radarr', name: 'Radarr 4K', id: 1, missingField: 'quality_profile_id' }
          ]
        }
      });

      const wrapper = mount(ArrConfigWarning);
      await flushPromises();

      expect(wrapper.text()).toContain('Radarr 4K');
      expect(wrapper.text()).toContain('missing a Quality Profile');
      expect(wrapper.text()).toContain('Configure Radarr Now');
    });

    it('displays single Sonarr incomplete config', async () => {
      api.genericRequest.mockResolvedValueOnce({
        data: {
          incompleteConfigs: [
            { type: 'Sonarr', name: 'Sonarr Anime', id: 2, missingField: 'quality_profile_id' }
          ]
        }
      });

      const wrapper = mount(ArrConfigWarning);
      await flushPromises();

      expect(wrapper.text()).toContain('Sonarr Anime');
      expect(wrapper.text()).toContain('missing a Quality Profile');
      expect(wrapper.text()).toContain('Configure Sonarr Now');
    });

    it('displays multiple incomplete configs', async () => {
      api.genericRequest.mockResolvedValueOnce({
        data: {
          incompleteConfigs: [
            { type: 'Radarr', name: 'Radarr 4K', id: 1, missingField: 'quality_profile_id' },
            { type: 'Sonarr', name: 'Sonarr HD', id: 2, missingField: 'quality_profile_id' }
          ]
        }
      });

      const wrapper = mount(ArrConfigWarning);
      await flushPromises();

      expect(wrapper.text()).toContain('Radarr 4K');
      expect(wrapper.text()).toContain('Sonarr HD');
      expect(wrapper.text()).toContain('Configure Radarr Now');
      expect(wrapper.text()).toContain('Configure Sonarr Now');
    });

    it('uses unique keys for multiple configs', async () => {
      api.genericRequest.mockResolvedValueOnce({
        data: {
          incompleteConfigs: [
            { type: 'Radarr', name: 'Radarr 1', id: 1, missingField: 'quality_profile_id' },
            { type: 'Radarr', name: 'Radarr 2', id: 2, missingField: 'quality_profile_id' }
          ]
        }
      });

      const wrapper = mount(ArrConfigWarning);
      await flushPromises();

      // Check that both configs are rendered (both buttons exist)
      const buttons = wrapper.findAll('button');
      const radarrButtons = buttons.filter(b => b.text().includes('Configure Radarr Now'));
      expect(radarrButtons.length).toBe(2);
    });
  });

  describe('Navigation', () => {
    it('navigates to Radarr settings when Configure Radarr Now is clicked', async () => {
      api.genericRequest.mockResolvedValueOnce({
        data: {
          incompleteConfigs: [
            { type: 'Radarr', name: 'Radarr 4K', id: 1, missingField: 'quality_profile_id' }
          ]
        }
      });

      const wrapper = mount(ArrConfigWarning);
      await flushPromises();

      const configureButton = wrapper.find('button.bg-yellow-600');
      await configureButton.trigger('click');

      expect(mockPush).toHaveBeenCalledWith('/settings/radarr');
    });

    it('navigates to Sonarr settings when Configure Sonarr Now is clicked', async () => {
      api.genericRequest.mockResolvedValueOnce({
        data: {
          incompleteConfigs: [
            { type: 'Sonarr', name: 'Sonarr HD', id: 2, missingField: 'quality_profile_id' }
          ]
        }
      });

      const wrapper = mount(ArrConfigWarning);
      await flushPromises();

      const configureButton = wrapper.find('button.bg-yellow-600');
      await configureButton.trigger('click');

      expect(mockPush).toHaveBeenCalledWith('/settings/sonarr');
    });
  });

  describe('Dismiss Functionality', () => {
    it('hides warning when dismiss button is clicked', async () => {
      api.genericRequest.mockResolvedValueOnce({
        data: {
          incompleteConfigs: [
            { type: 'Radarr', name: 'Radarr Main', id: 1, missingField: 'quality_profile_id' }
          ]
        }
      });

      const wrapper = mount(ArrConfigWarning);
      await flushPromises();

      expect(wrapper.find('.bg-yellow-900\\/30').exists()).toBe(true);

      const dismissButton = wrapper.find('button[title="Dismiss"]');
      await dismissButton.trigger('click');

      expect(wrapper.find('.bg-yellow-900\\/30').exists()).toBe(false);
    });

    it('displays dismiss button with correct icon', async () => {
      api.genericRequest.mockResolvedValueOnce({
        data: {
          incompleteConfigs: [
            { type: 'Radarr', name: 'Radarr Main', id: 1, missingField: 'quality_profile_id' }
          ]
        }
      });

      const wrapper = mount(ArrConfigWarning);
      await flushPromises();

      const dismissButton = wrapper.find('button[title="Dismiss"]');
      expect(dismissButton.exists()).toBe(true);
      expect(dismissButton.text()).toContain('✕');
    });
  });

  describe('API Integration', () => {
    it('calls API endpoint on mount', async () => {
      api.genericRequest.mockResolvedValueOnce({
        data: { incompleteConfigs: [] }
      });

      mount(ArrConfigWarning);
      await flushPromises();

      expect(api.genericRequest).toHaveBeenCalledWith('get', '/api/settings/arr-config-status');
    });

    it('handles API errors gracefully', async () => {
      api.genericRequest.mockRejectedValueOnce(new Error('Network error'));
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const wrapper = mount(ArrConfigWarning);
      await flushPromises();

      // Should not crash and should not display warning
      expect(wrapper.exists()).toBe(true);
      expect(wrapper.find('.bg-yellow-900\\/30').exists()).toBe(false);

      consoleError.mockRestore();
    });

    it('does not call API if already dismissed', async () => {
      api.genericRequest.mockResolvedValueOnce({
        data: {
          incompleteConfigs: [
            { type: 'Radarr', name: 'Radarr Main', id: 1, missingField: 'quality_profile_id' }
          ]
        }
      });

      const wrapper = mount(ArrConfigWarning);
      await flushPromises();

      // Dismiss the warning
      const dismissButton = wrapper.find('button[title="Dismiss"]');
      await dismissButton.trigger('click');

      // Clear mock to reset call count
      api.genericRequest.mockClear();

      // Component should not call API again even if checkIncompleteConfigs is triggered
      expect(wrapper.find('.bg-yellow-900\\/30').exists()).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('handles missing config name gracefully', async () => {
      api.genericRequest.mockResolvedValueOnce({
        data: {
          incompleteConfigs: [
            { type: 'Radarr', name: null, id: 1, missingField: 'quality_profile_id' }
          ]
        }
      });

      const wrapper = mount(ArrConfigWarning);
      await flushPromises();

      // Should still render, even if name is null
      expect(wrapper.find('.bg-yellow-900\\/30').exists()).toBe(true);
    });

    it('handles null response data', async () => {
      api.genericRequest.mockResolvedValueOnce({
        data: null
      });

      const wrapper = mount(ArrConfigWarning);
      await flushPromises();

      expect(wrapper.exists()).toBe(true);
      expect(wrapper.find('.bg-yellow-900\\/30').exists()).toBe(false);
    });

    it('handles undefined incompleteConfigs', async () => {
      api.genericRequest.mockResolvedValueOnce({
        data: {}
      });

      const wrapper = mount(ArrConfigWarning);
      await flushPromises();

      expect(wrapper.exists()).toBe(true);
      expect(wrapper.find('.bg-yellow-900\\/30').exists()).toBe(false);
    });
  });
});
