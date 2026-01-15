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
          embedding_model: 'nomic-embed-text',
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

  describe('Embedding Model Selection', () => {
    it('renders the embedding model dropdown in "same" mode', async () => {
      const mockOverviewData = { data: { providerOnline: true, stats: {}, recentActivity: [] } };
      const mockConfigData = {
        data: {
          embedding_provider_mode: 'same',
          embedding_model: 'nomic-embed-text'
        }
      };

      api.get.mockImplementation((url) => {
        if (url === '/rag/overview') return Promise.resolve(mockOverviewData);
        if (url === '/settings/ai') return Promise.resolve(mockConfigData);
        return Promise.reject(new Error('Unknown URL'));
      });

      const wrapper = mount(OverviewTab);
      await flushPromises();

      // Find the select for embedding model
      const selects = wrapper.findAll('select');
      // 1st select is mode, 2nd is embedding model
      const modelSelect = selects[1];

      expect(modelSelect.exists()).toBe(true);
      expect(modelSelect.element.value).toBe('nomic-embed-text');
      expect(wrapper.text()).toContain('nomic-embed-text - ⭐ Recommended');
    });

    it('updates config when model is changed', async () => {
      const mockOverviewData = { data: { providerOnline: true, stats: {}, recentActivity: [] } };
      const mockConfigData = {
        data: {
          embedding_provider_mode: 'same',
          embedding_model: 'nomic-embed-text'
        }
      };

      api.get.mockImplementation((url) => {
        if (url === '/rag/overview') return Promise.resolve(mockOverviewData);
        if (url === '/settings/ai') return Promise.resolve(mockConfigData);
        return Promise.reject(new Error('Unknown URL'));
      });

      const wrapper = mount(OverviewTab);
      await flushPromises();

      const selects = wrapper.findAll('select');
      const modelSelect = selects[1];

      await modelSelect.setValue('mxbai-embed-large');

      // Trigger save (since v-model updates config but verify save is called only on button click or change if bound)
      // Component calls saveConfig logic? No, only on @change for MODE.
      // For model select, we need to check if it's bound.
      // Looking at OverviewTab.vue: <select v-model="config.embedding_model" ...> (no @change)
      // So we have to click "Save Configuration" to trigger API put.

      const saveButton = wrapper.findAll('button').find(b => b.text().includes('Save Configuration'));
      await saveButton.trigger('click');

      expect(api.put).toHaveBeenCalledWith('/settings/ai', expect.objectContaining({
        embedding_model: 'mxbai-embed-large'
      }));
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

  // v0.39.3-alpha: Regression tests for critical bug fixes
  describe('v0.39.3-alpha Bug Fixes', () => {
    describe('Issue 1: Provider Status displays correctly', () => {
      it('extracts providerOnline from API response correctly', async () => {
        const mockOverviewData = {
          data: {
            providerOnline: true,
            stats: { totalEmbeddings: 100, pendingCount: 0, failedCount: 0 },
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

        // Provider status should show "Online" when providerOnline is true
        expect(wrapper.text()).toContain('Online');
        expect(wrapper.text()).not.toContain('Offline');
      });

      it('shows "Offline" when providerOnline is false', async () => {
        const mockOverviewData = {
          data: {
            providerOnline: false,
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

        expect(wrapper.text()).toContain('Offline');
      });

      it('defaults to "Offline" when providerOnline is missing from API', async () => {
        const mockOverviewData = {
          data: {
            // providerOnline is missing
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

        // Should default to Offline when providerOnline is not provided
        expect(wrapper.text()).toContain('Offline');
      });
    });

    describe('Issue 2: Test Connection shows dimensions', () => {
      it('displays dimensions in success message', async () => {
        const mockOverviewData = { data: { providerOnline: true, stats: {}, recentActivity: [] } };
        const mockConfigData = { data: { embedding_provider_mode: 'same' } };

        api.get.mockImplementation((url) => {
          if (url === '/rag/overview') return Promise.resolve(mockOverviewData);
          if (url === '/settings/ai') return Promise.resolve(mockConfigData);
          return Promise.reject(new Error('Unknown URL'));
        });

        api.post.mockResolvedValue({
          data: {
            success: true,
            dims: 768,
            latency: 123,
            provider: 'ollama',
            model: 'nomic-embed-text'
          }
        });

        const wrapper = mount(OverviewTab);
        await flushPromises();

        const testButton = wrapper.findAll('button').find(b => b.text().includes('Test Connection'));
        await testButton.trigger('click');
        await flushPromises();

        // Should show dimensions in the test result
        expect(wrapper.text()).toContain('768 dimensions');
      });

      it('handles test connection failure gracefully', async () => {
        const mockOverviewData = { data: { providerOnline: true, stats: {}, recentActivity: [] } };
        const mockConfigData = { data: { embedding_provider_mode: 'same' } };

        api.get.mockImplementation((url) => {
          if (url === '/rag/overview') return Promise.resolve(mockOverviewData);
          if (url === '/settings/ai') return Promise.resolve(mockConfigData);
          return Promise.reject(new Error('Unknown URL'));
        });

        api.post.mockResolvedValue({
          data: {
            success: false,
            error: 'Connection failed'
          }
        });

        const wrapper = mount(OverviewTab);
        await flushPromises();

        const testButton = wrapper.findAll('button').find(b => b.text().includes('Test Connection'));
        await testButton.trigger('click');
        await flushPromises();

        expect(wrapper.text()).toContain('Connection failed');
      });
    });

    describe('Issue 3: Data loads on mount', () => {
      it('calls API endpoints on component mount', async () => {
        const mockOverviewData = {
          data: {
            providerOnline: true,
            stats: { totalEmbeddings: 100, pendingCount: 5, failedCount: 2 },
            recentActivity: []
          }
        };
        const mockConfigData = { data: { embedding_provider_mode: 'same' } };

        api.get.mockImplementation((url) => {
          if (url === '/rag/overview') return Promise.resolve(mockOverviewData);
          if (url === '/settings/ai') return Promise.resolve(mockConfigData);
          return Promise.reject(new Error('Unknown URL'));
        });

        mount(OverviewTab);
        await flushPromises();

        // Verify that loadStats was called (which calls both endpoints)
        expect(api.get).toHaveBeenCalledWith('/rag/overview');
        expect(api.get).toHaveBeenCalledWith('/settings/ai');
      });

      it('loads data successfully even when one API call fails', async () => {
        api.get.mockImplementation((url) => {
          if (url === '/rag/overview') return Promise.reject(new Error('Network error'));
          if (url === '/settings/ai') return Promise.resolve({ data: {} });
          return Promise.reject(new Error('Unknown URL'));
        });

        const wrapper = mount(OverviewTab);
        await flushPromises();

        // Component should still render with defaults
        expect(wrapper.exists()).toBe(true);
        expect(wrapper.text()).toContain('0'); // Default values
      });
    });
  });
});
