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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import BackfillTab from '../views/rag/BackfillTab.vue';
import api from '../api';

vi.mock('../api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn()
  }
}));

describe('BackfillTab.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mountComponent = () => mount(BackfillTab);

  const mockConfigEndpoints = () => {
    api.get.mockImplementation((url) => {
      if (url === '/settings/heartbeat') {
        return Promise.resolve({
          data: { heartbeat_timeout: 30000, heartbeat_interval: 5000, max_wait_time: 60000 }
        });
      }
      if (url === '/rag/backfill/realtime') {
        return Promise.resolve({ data: { realtime_embedding_enabled: true } });
      }
      if (url === '/rag/backfill/idle') {
        return Promise.resolve({ data: { idle_backfill_enabled: true, idle_threshold: 30000, idle_batch_size: 10 } });
      }
      if (url === '/rag/backfill/schedule') {
        return Promise.resolve({
          data: {
            scheduled_backfill_enabled: true,
            scheduled_backfill_time: '02:00',
            scheduled_backfill_batch_size: 100,
            scheduled_backfill_max_duration: 3600000
          }
        });
      }
      if (url === '/rag/backfill/status') {
        return Promise.resolve({
          data: {
            manual: { status: 'running', processed: 10, total: 100, eta: 120 },
            pending: 7,
            pendingBreakdown: { text: 2, image: 5 }
          }
        });
      }
      return Promise.reject(new Error(`Unknown URL: ${url}`));
    });
  };

  it('renders pending breakdown for text and image', async () => {
    mockConfigEndpoints();

    const wrapper = mountComponent();
    await flushPromises();

    expect(wrapper.text()).toContain('Pending Embeddings:');
    expect(wrapper.text()).toContain('Text 2');
    expect(wrapper.text()).toContain('Image 5');

    wrapper.unmount();
  });

  it('formats ETA from seconds to human readable', async () => {
    mockConfigEndpoints();

    const wrapper = mountComponent();
    await flushPromises();

    expect(wrapper.text()).toContain('ETA: 2m 0s');

    wrapper.unmount();
  });
});
