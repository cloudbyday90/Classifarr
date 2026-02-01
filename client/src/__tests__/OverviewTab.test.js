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

  describe('Issue 2: Test Connection displays dimensions correctly', () => {
    it('displays dimensions in success message after test connection', async () => {
      const mockStatusData = { 
        data: { 
          providerOnline: true, 
          stats: {}, 
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

      api.post.mockResolvedValue({
        data: {
          success: true,
          dims: 768,
          latency: 123,
          provider: 'ollama',
          model: 'nomic-embed-text'
        }
      });

      const wrapper = mountComponent();
      await flushPromises();

      const testButton = wrapper.findAll('button').find(b => b.text().includes('Test Connection'));
      expect(testButton).toBeDefined();
      
      await testButton.trigger('click');
      await flushPromises();

      // Should show dimensions in the test result
      expect(wrapper.text()).toContain('768');
      expect(wrapper.text()).toContain('dimensions');
    });

    it('handles test connection failure gracefully', async () => {
      const mockStatusData = { 
        data: { 
          providerOnline: true, 
          stats: {}, 
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

      api.post.mockResolvedValue({
        data: {
          success: false,
          error: 'Connection failed'
        }
      });

      const wrapper = mountComponent();
      await flushPromises();

      const testButton = wrapper.findAll('button').find(b => b.text().includes('Test Connection'));
      await testButton.trigger('click');
      await flushPromises();

      // Should show error message
      expect(wrapper.text()).toContain('Connection failed');
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
      expect(wrapper.text()).toContain('Embedding Provider');
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
