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
import { createPinia } from 'pinia';
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

// Mock the toast store
vi.mock('../stores/toast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn()
  })
}));

describe('OverviewTab.vue - v0.39.3-alpha Bug Fix Regression Tests', () => {
  let pinia;

  beforeEach(() => {
    vi.clearAllMocks();
    pinia = createPinia();
  });

  // Helper function to mount component with Pinia
  const mountComponent = (options = {}) => {
    return mount(OverviewTab, {
      global: {
        plugins: [pinia],
        ...options.global
      },
      ...options
    });
  };

  describe('Issue 1: Provider Status correctly displays providerOnline from API', () => {
    it('shows "Online" when providerOnline is true', async () => {
      const mockStatusData = {
        data: {
          providerOnline: true,
          stats: {
            totalEmbeddings: 100,
            pendingCount: 0,
            failedCount: 0
          },
          recentActivity: []
        }
      };

      api.get.mockImplementation((url) => {
        if (url === '/rag/status') return Promise.resolve(mockStatusData);
        if (url === '/settings/ai') return Promise.resolve({ data: {} });
        return Promise.reject(new Error('Unknown URL'));
      });

      const wrapper = mountComponent();
      await flushPromises();

      // Provider status should show "Online" when providerOnline is true
      expect(wrapper.text()).toContain('Online');
      expect(wrapper.text()).not.toContain('Offline');
    });

    it('shows "Offline" when providerOnline is false', async () => {
      const mockStatusData = {
        data: {
          providerOnline: false,
          stats: {
            totalEmbeddings: 0,
            pendingCount: 0,
            failedCount: 0
          },
          recentActivity: []
        }
      };

      api.get.mockImplementation((url) => {
        if (url === '/rag/status') return Promise.resolve(mockStatusData);
        if (url === '/settings/ai') return Promise.resolve({ data: {} });
        return Promise.reject(new Error('Unknown URL'));
      });

      const wrapper = mountComponent();
      await flushPromises();

      expect(wrapper.text()).toContain('Offline');
      expect(wrapper.text()).not.toContain('Online');
    });

    it('defaults to "Offline" when providerOnline is missing from API', async () => {
      const mockStatusData = {
        data: {
          // providerOnline is missing
          stats: {
            totalEmbeddings: 0,
            pendingCount: 0,
            failedCount: 0
          },
          recentActivity: []
        }
      };

      api.get.mockImplementation((url) => {
        if (url === '/rag/status') return Promise.resolve(mockStatusData);
        if (url === '/settings/ai') return Promise.resolve({ data: {} });
        return Promise.reject(new Error('Unknown URL'));
      });

      const wrapper = mountComponent();
      await flushPromises();

      // Should default to Offline when providerOnline is not provided
      expect(wrapper.text()).toContain('Offline');
    });
  });

  describe('Issue 2: Image summary renders sizing and mode', () => {
    it('displays image size and model in the summary', async () => {
      const mockStatusData = {
        data: {
          providerOnline: true,
          stats: {},
          recentActivity: [],
          image: {
            enabled: true,
            providerOnline: true,
            provider: 'local',
            model: 'ViT-L-14',
            stats: { total: 1, pending: 0 }
          }
        }
      };
      const mockConfigData = {
        data: {
          embedding_provider_mode: 'same',
          image_embedding_provider_mode: 'separate_local',
          image_embedding_image_size: 512,
          image_embedding_rps: 2,
          image_embedding_concurrency: 2
        }
      };

      api.get.mockImplementation((url) => {
        if (url === '/rag/status') return Promise.resolve(mockStatusData);
        if (url === '/settings/ai') return Promise.resolve(mockConfigData);
        return Promise.reject(new Error('Unknown URL'));
      });

      const wrapper = mountComponent();
      await flushPromises();

      expect(wrapper.text()).toContain('Image Embedding Summary');
      expect(wrapper.text()).toContain('ViT-L-14');
      expect(wrapper.text()).toContain('512 px');
    });

    it('shows disabled image mode gracefully', async () => {
      const mockStatusData = {
        data: {
          providerOnline: true,
          stats: {},
          recentActivity: [],
          image: {
            enabled: false,
            providerOnline: false,
            provider: 'unknown',
            model: null,
            stats: { total: 0, pending: 0 }
          }
        }
      };
      const mockConfigData = {
        data: {
          embedding_provider_mode: 'same',
          image_embedding_provider_mode: 'disabled'
        }
      };

      api.get.mockImplementation((url) => {
        if (url === '/rag/status') return Promise.resolve(mockStatusData);
        if (url === '/settings/ai') return Promise.resolve(mockConfigData);
        return Promise.reject(new Error('Unknown URL'));
      });

      const wrapper = mountComponent();
      await flushPromises();

      expect(wrapper.text()).toContain('Disabled');
      expect(wrapper.text()).toContain('Image Embedding Summary');
    });

    it('shows not configured when image embeddings are setup-pending', async () => {
      const mockStatusData = {
        data: {
          providerOnline: true,
          stats: {},
          recentActivity: [],
          image: {
            enabled: true,
            providerOnline: false,
            providerConfigured: true,
            status: 'not_configured',
            provider: 'local',
            model: 'ViT-B-16',
            stats: { total: 0, pending: 6588 }
          }
        }
      };
      const mockConfigData = {
        data: {
          embedding_provider_mode: 'same',
          image_embedding_provider_mode: 'separate_local'
        }
      };

      api.get.mockImplementation((url) => {
        if (url === '/rag/status') return Promise.resolve(mockStatusData);
        if (url === '/settings/ai') return Promise.resolve(mockConfigData);
        if (url === '/rag/backfill/status') return Promise.resolve({ data: {} });
        return Promise.reject(new Error('Unknown URL'));
      });

      const wrapper = mountComponent();
      await flushPromises();

      expect(wrapper.text()).toContain('Not configured');
    });
  });

  describe('Issue 3: Data loads on mount (loadStats called)', () => {
    it('calls correct API endpoints on component mount', async () => {
      const mockStatusData = {
        data: {
          providerOnline: true,
          stats: { 
            totalEmbeddings: 100, 
            pendingCount: 5, 
            failedCount: 2 
          },
          recentActivity: []
        }
      };
      const mockConfigData = { 
        data: { 
          embedding_provider_mode: 'same' 
        } 
      };

      api.get.mockImplementation((url) => {
        if (url === '/rag/status') return Promise.resolve(mockStatusData);
        if (url === '/settings/ai') return Promise.resolve(mockConfigData);
        return Promise.reject(new Error('Unknown URL'));
      });

      mountComponent();
      await flushPromises();

      // Verify that loadStats was called (which calls both endpoints)
      expect(api.get).toHaveBeenCalledWith('/rag/status');
      expect(api.get).toHaveBeenCalledWith('/settings/ai');
    });

    it('renders with data from API', async () => {
      const mockStatusData = {
        data: {
          providerOnline: true,
          stats: {
            totalEmbeddings: 1234,
            pendingCount: 5,
            failedCount: 2
          },
          recentActivity: []
        }
      };

      api.get.mockImplementation((url) => {
        if (url === '/rag/status') return Promise.resolve(mockStatusData);
        if (url === '/settings/ai') return Promise.resolve({ data: {} });
        return Promise.reject(new Error('Unknown URL'));
      });

      const wrapper = mountComponent();
      await flushPromises();

      // Should display the data
      expect(wrapper.text()).toContain('1,234'); // totalEmbeddings formatted
      expect(wrapper.text()).toContain('5'); // pendingCount
      expect(wrapper.text()).toContain('2'); // failedCount
    });

    it('loads data successfully even when one API call fails', async () => {
      api.get.mockImplementation((url) => {
        if (url === '/rag/status') return Promise.reject(new Error('Network error'));
        if (url === '/settings/ai') return Promise.resolve({ data: {} });
        return Promise.reject(new Error('Unknown URL'));
      });

      const wrapper = mountComponent();
      await flushPromises();

      // Component should still render with defaults
      expect(wrapper.exists()).toBe(true);
      expect(wrapper.text()).toContain('0'); // Default values
      expect(wrapper.text()).toContain('Offline'); // Default offline status
    });
  });

  describe('General functionality', () => {
    it('renders without crashing when API returns complete data', async () => {
      const mockStatusData = {
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
        if (url === '/rag/status') return Promise.resolve(mockStatusData);
        if (url === '/settings/ai') return Promise.resolve(mockConfigData);
        return Promise.reject(new Error('Unknown URL'));
      });

      const wrapper = mountComponent();
      await flushPromises();

      expect(wrapper.exists()).toBe(true);
      expect(wrapper.text()).toContain('Provider Status');
      expect(wrapper.text()).toContain('Total Embeddings');
      expect(wrapper.text()).toContain('Text Embedding Summary');
      expect(wrapper.text()).toContain('Image Embedding Summary');
    });

    it('renders without crashing when API returns empty object', async () => {
      api.get.mockImplementation(() => Promise.resolve({ data: {} }));

      const wrapper = mountComponent();
      await flushPromises();

      expect(wrapper.exists()).toBe(true);
      expect(wrapper.text()).toContain('Offline'); // providerOnline defaults to false
      expect(wrapper.text()).toContain('0'); // stats default to 0
    });
  });
});
