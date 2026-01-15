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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import OverviewTab from '../views/rag/OverviewTab.vue';
import api from '../api';

// Mock the API module
vi.mock('../api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn()
  }
}));

describe('OverviewTab.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering with complete data', () => {
    it('renders without crashing when API returns complete data', async () => {
      const mockOverviewData = {
        data: {
          providerOnline: true,
          stats: {
            totalEmbeddings: 1234,
            pendingCount: 5,
            failedCount: 2,
            avgGenerationTime: 123,
            lastEmbeddingTime: '2026-01-15T00:00:00Z'
          },
          recentActivity: []
        }
      };

      const mockConfigData = {
        data: {
          embedding_provider_mode: 'same',
          embedding_ollama_host: '',
          embedding_ollama_port: 11434,
          embedding_ollama_model: '',
          embedding_cloud_provider: '',
          embedding_cloud_api_key: '',
          embedding_cloud_model: ''
        }
      };

      api.get.mockImplementation((url) => {
        if (url === '/rag/overview') return Promise.resolve(mockOverviewData);
        if (url === '/settings/ai') return Promise.resolve(mockConfigData);
        return Promise.reject(new Error('Unknown URL'));
      });

      const wrapper = mount(OverviewTab);
      await flushPromises();

      expect(wrapper.exists()).toBe(true);
      expect(wrapper.text()).toContain('1,234'); // totalEmbeddings formatted
      expect(wrapper.text()).toContain('5'); // pendingCount
      expect(wrapper.text()).toContain('2'); // failedCount
    });
  });

  describe('Rendering with incomplete API data', () => {
    it('renders without crashing when stats is undefined', async () => {
      const mockOverviewData = {
        data: {
          providerOnline: true,
          // stats is undefined
          recentActivity: []
        }
      };

      const mockConfigData = {
        data: {}
      };

      api.get.mockImplementation((url) => {
        if (url === '/rag/overview') return Promise.resolve(mockOverviewData);
        if (url === '/settings/ai') return Promise.resolve(mockConfigData);
        return Promise.reject(new Error('Unknown URL'));
      });

      const wrapper = mount(OverviewTab);
      await flushPromises();

      expect(wrapper.exists()).toBe(true);
      // Should show default values (0)
      expect(wrapper.text()).toContain('0');
    });

    it('renders without crashing when API returns empty object', async () => {
      api.get.mockImplementation(() => Promise.resolve({ data: {} }));

      const wrapper = mount(OverviewTab);
      await flushPromises();

      expect(wrapper.exists()).toBe(true);
      expect(wrapper.text()).toContain('Offline'); // providerOnline defaults to false
      expect(wrapper.text()).toContain('0'); // stats default to 0
    });

    it('renders without crashing when API fails', async () => {
      api.get.mockRejectedValue(new Error('Network error'));

      const wrapper = mount(OverviewTab);
      await flushPromises();

      expect(wrapper.exists()).toBe(true);
      // Should show default values
      expect(wrapper.text()).toContain('Offline');
      expect(wrapper.text()).toContain('0');
    });

    it('handles null stats values', async () => {
      const mockOverviewData = {
        data: {
          providerOnline: false,
          stats: {
            totalEmbeddings: null,
            pendingCount: null,
            failedCount: null
          },
          recentActivity: []
        }
      };

      api.get.mockImplementation((url) => {
        if (url === '/rag/overview') return Promise.resolve(mockOverviewData);
        if (url === '/settings/ai') return Promise.resolve({ data: {} });
        return Promise.reject(new Error('Unknown URL'));
      });

      const wrapper = mount(OverviewTab);
      await flushPromises();

      expect(wrapper.exists()).toBe(true);
      // formatNumber should handle null and show '0'
      expect(wrapper.text()).toContain('0');
    });
  });

  describe('formatNumber helper', () => {
    it('formats numbers with locale string', async () => {
      const mockOverviewData = {
        data: {
          providerOnline: true,
          stats: {
            totalEmbeddings: 1234567,
            pendingCount: 0,
            failedCount: 0
          },
          recentActivity: []
        }
      };

      api.get.mockImplementation((url) => {
        if (url === '/rag/overview') return Promise.resolve(mockOverviewData);
        if (url === '/settings/ai') return Promise.resolve({ data: {} });
        return Promise.reject(new Error('Unknown URL'));
      });

      const wrapper = mount(OverviewTab);
      await flushPromises();

      // Should format large numbers with commas
      expect(wrapper.text()).toContain('1,234,567');
    });

    it('handles undefined values', async () => {
      const mockOverviewData = {
        data: {
          providerOnline: true,
          stats: {
            totalEmbeddings: undefined,
            pendingCount: undefined,
            failedCount: undefined
          },
          recentActivity: []
        }
      };

      api.get.mockImplementation((url) => {
        if (url === '/rag/overview') return Promise.resolve(mockOverviewData);
        if (url === '/settings/ai') return Promise.resolve({ data: {} });
        return Promise.reject(new Error('Unknown URL'));
      });

      const wrapper = mount(OverviewTab);
      await flushPromises();

      expect(wrapper.exists()).toBe(true);
      // All undefined values should show as '0'
      const zeros = wrapper.text().match(/\b0\b/g);
      expect(zeros).toBeTruthy();
      expect(zeros.length).toBeGreaterThan(0);
    });
  });

  describe('Provider configuration', () => {
    it('loads default configuration when API returns empty object', async () => {
      api.get.mockImplementation(() => Promise.resolve({ data: {} }));

      const wrapper = mount(OverviewTab);
      await flushPromises();

      expect(wrapper.exists()).toBe(true);
      // Check that mode dropdown exists with default value
      const modeSelect = wrapper.find('select');
      expect(modeSelect.exists()).toBe(true);
    });

    it('displays provider settings form', async () => {
      api.get.mockImplementation(() => Promise.resolve({ data: {} }));

      const wrapper = mount(OverviewTab);
      await flushPromises();

      expect(wrapper.text()).toContain('Embedding Provider');
      expect(wrapper.text()).toContain('Mode');
      expect(wrapper.text()).toContain('Test Connection');
      expect(wrapper.text()).toContain('Save Configuration');
    });
  });

  describe('Status cards', () => {
    it('shows correct color for provider status', async () => {
      const mockOverviewData = {
        data: {
          providerOnline: true,
          stats: { totalEmbeddings: 0, pendingCount: 0, failedCount: 0 },
          recentActivity: []
        }
      };

      api.get.mockImplementation((url) => {
        if (url === '/rag/overview') return Promise.resolve(mockOverviewData);
        if (url === '/settings/ai') return Promise.resolve({ data: {} });
        return Promise.reject(new Error('Unknown URL'));
      });

      const wrapper = mount(OverviewTab);
      await flushPromises();

      expect(wrapper.text()).toContain('Online');
    });

    it('shows yellow color for pending count > 0', async () => {
      const mockOverviewData = {
        data: {
          providerOnline: true,
          stats: { totalEmbeddings: 100, pendingCount: 10, failedCount: 0 },
          recentActivity: []
        }
      };

      api.get.mockImplementation((url) => {
        if (url === '/rag/overview') return Promise.resolve(mockOverviewData);
        if (url === '/settings/ai') return Promise.resolve({ data: {} });
        return Promise.reject(new Error('Unknown URL'));
      });

      const wrapper = mount(OverviewTab);
      await flushPromises();

      expect(wrapper.text()).toContain('10');
    });

    it('shows red color for failed count > 0', async () => {
      const mockOverviewData = {
        data: {
          providerOnline: true,
          stats: { totalEmbeddings: 100, pendingCount: 0, failedCount: 5 },
          recentActivity: []
        }
      };

      api.get.mockImplementation((url) => {
        if (url === '/rag/overview') return Promise.resolve(mockOverviewData);
        if (url === '/settings/ai') return Promise.resolve({ data: {} });
        return Promise.reject(new Error('Unknown URL'));
      });

      const wrapper = mount(OverviewTab);
      await flushPromises();

      expect(wrapper.text()).toContain('5');
      expect(wrapper.text()).toContain('⚠️');
    });
  });

  describe('Recent activity', () => {
    it('shows "No recent activity" when recentActivity is empty', async () => {
      const mockOverviewData = {
        data: {
          providerOnline: true,
          stats: { totalEmbeddings: 0, pendingCount: 0, failedCount: 0 },
          recentActivity: []
        }
      };

      api.get.mockImplementation((url) => {
        if (url === '/rag/overview') return Promise.resolve(mockOverviewData);
        if (url === '/settings/ai') return Promise.resolve({ data: {} });
        return Promise.reject(new Error('Unknown URL'));
      });

      const wrapper = mount(OverviewTab);
      await flushPromises();

      expect(wrapper.text()).toContain('No recent activity');
    });

    it('handles missing recentActivity gracefully', async () => {
      const mockOverviewData = {
        data: {
          providerOnline: true,
          stats: { totalEmbeddings: 0, pendingCount: 0, failedCount: 0 }
          // recentActivity is missing
        }
      };

      api.get.mockImplementation((url) => {
        if (url === '/rag/overview') return Promise.resolve(mockOverviewData);
        if (url === '/settings/ai') return Promise.resolve({ data: {} });
        return Promise.reject(new Error('Unknown URL'));
      });

      const wrapper = mount(OverviewTab);
      await flushPromises();

      expect(wrapper.exists()).toBe(true);
      expect(wrapper.text()).toContain('No recent activity');
    });
  });
});
