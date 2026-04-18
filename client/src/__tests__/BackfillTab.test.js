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

let consoleErrorSpy;

vi.mock('../api', () => ({
  default: {
    getHeartbeatSettings: vi.fn(),
    updateHeartbeatSettings: vi.fn(),
    getBackfillConfig: vi.fn(),
    getBackfillStatus: vi.fn(),
    updateBackfillConfig: vi.fn(),
    startManualBackfill: vi.fn(),
    pauseManualBackfill: vi.fn(),
    resumeManualBackfill: vi.fn(),
    clearManualBackfill: vi.fn()
  }
}));

describe('BackfillTab.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    global.alert = vi.fn();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.useRealTimers();
  });

  const mountComponent = () => mount(BackfillTab);

  const mockConfigEndpoints = () => {
    api.getHeartbeatSettings.mockResolvedValue({
      heartbeat_timeout: 30000, heartbeat_interval: 5000, max_wait_time: 60000
    });
    api.getBackfillConfig.mockResolvedValue({
      data: {
        realtime_embedding_enabled: true,
        idle_backfill_enabled: true,
        idle_threshold: 30000,
        idle_batch_size: 10,
        scheduled_backfill_enabled: true,
        scheduled_backfill_time: '02:00',
        scheduled_backfill_batch_size: 100,
        scheduled_backfill_max_duration: 3600000
      }
    });
    api.getBackfillStatus.mockResolvedValue({
      data: {
        manual: { status: 'running', processed: 10, total: 100, eta: 120 },
        embeddingAvailability: {
          status: 'available',
          cooldownUntil: null,
          lastError: null,
          failureCount: 0
        },
        pending: 7,
        pendingBreakdown: { text: 2, image: 5 }
      }
    });
    api.updateHeartbeatSettings.mockResolvedValue({ data: { success: true } });
    api.updateBackfillConfig.mockResolvedValue({ data: { success: true } });
    api.startManualBackfill.mockResolvedValue({ data: { success: true } });
    api.pauseManualBackfill.mockResolvedValue({ data: { success: true } });
    api.resumeManualBackfill.mockResolvedValue({ data: { success: true } });
    api.clearManualBackfill.mockResolvedValue({ data: { success: true } });
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

  it('shows provider cooldown state and disables start and resume', async () => {
    api.getHeartbeatSettings.mockResolvedValue({
      heartbeat_timeout: 30000, heartbeat_interval: 5000, max_wait_time: 60000
    });
    api.getBackfillConfig.mockResolvedValue({
      data: {
        realtime_embedding_enabled: true,
        idle_backfill_enabled: true,
        idle_threshold: 30000,
        idle_batch_size: 10,
        scheduled_backfill_enabled: true,
        scheduled_backfill_time: '02:00',
        scheduled_backfill_batch_size: 100,
        scheduled_backfill_max_duration: 3600000
      }
    });
    api.getBackfillStatus.mockResolvedValue({
      data: {
        manual: { status: 'paused', processed: 10, total: 100, eta: 120 },
        embeddingAvailability: {
          status: 'cooldown',
          cooldownUntil: '2026-03-28T00:00:00.000Z',
          lastError: 'connect ETIMEDOUT 192.168.50.95:11434',
          failureCount: 4
        },
        pending: 7,
        pendingBreakdown: { text: 2, image: 5 }
      }
    });

    const wrapper = mountComponent();
    await flushPromises();

    expect(wrapper.text()).toContain('Embedding provider cooling down');
    expect(wrapper.text()).toContain('connect ETIMEDOUT 192.168.50.95:11434');
    expect(wrapper.text()).toContain('Failure count: 4');

    const buttons = wrapper.findAll('button');
    expect(buttons[0].attributes('disabled')).toBeDefined();
    expect(buttons[2].attributes('disabled')).toBeDefined();

    wrapper.unmount();
  });

  it('saves heartbeat and scheduled backfill settings with the converted duration', async () => {
    mockConfigEndpoints();

    const wrapper = mountComponent();
    await flushPromises();

    const numberInputs = wrapper.findAll('input[type="number"]');
    await numberInputs[0].setValue('45000');
    await numberInputs[1].setValue('7000');
    await numberInputs[2].setValue('90000');
    await numberInputs[6].setValue('90');

    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('Save Queue Settings'));
    await saveButton.trigger('click');
    await flushPromises();

    expect(api.updateHeartbeatSettings).toHaveBeenCalledWith({
      heartbeat_timeout: 45000,
      heartbeat_interval: 7000,
      max_wait_time: 90000
    });
    expect(api.updateBackfillConfig).toHaveBeenCalledWith(expect.objectContaining({
      realtime_embedding_enabled: true,
      idle_backfill_enabled: true,
      scheduled_backfill_enabled: true,
      scheduled_backfill_max_duration: 5400000
    }));
    expect(wrapper.text()).toContain('Queue settings saved successfully');

    wrapper.unmount();
  });

  it('alerts when starting manual backfill fails', async () => {
    mockConfigEndpoints();
    api.getBackfillStatus.mockResolvedValueOnce({
      data: {
        manual: { status: 'idle', processed: 0, total: 0, eta: null },
        embeddingAvailability: { status: 'available' },
        pending: 7,
        pendingBreakdown: { text: 2, image: 5 }
      }
    });
    api.startManualBackfill.mockRejectedValueOnce({
      response: {
        data: {
          error: 'provider is cooling down'
        }
      }
    });

    const wrapper = mountComponent();
    await flushPromises();

    const startButton = wrapper.findAll('button').find((button) => button.text() === 'Start');
    await startButton.trigger('click');
    await flushPromises();

    expect(api.startManualBackfill).toHaveBeenCalledWith({});
    expect(global.alert).toHaveBeenCalledWith('provider is cooling down');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to start backfill:', expect.anything());

    wrapper.unmount();
  });

  it('runs pause, resume, and clear actions against the manual backfill controls', async () => {
    mockConfigEndpoints();

    const wrapper = mountComponent();
    await flushPromises();

    api.getBackfillStatus.mockResolvedValueOnce({
      data: {
        manual: { status: 'paused', processed: 10, total: 100, eta: 120 },
        embeddingAvailability: { status: 'available' },
        pending: 7,
        pendingBreakdown: { text: 2, image: 5 }
      }
    });

    let buttons = wrapper.findAll('button');
    await buttons[1].trigger('click');
    await flushPromises();

    api.getBackfillStatus.mockResolvedValueOnce({
      data: {
        manual: { status: 'idle', processed: 0, total: 0, eta: null },
        embeddingAvailability: { status: 'available' },
        pending: 0,
        pendingBreakdown: { text: 0, image: 0 }
      }
    });
    buttons = wrapper.findAll('button');
    await buttons[2].trigger('click');
    await flushPromises();

    api.getBackfillStatus.mockResolvedValueOnce({
      data: {
        manual: { status: 'idle', processed: 0, total: 0, eta: null },
        embeddingAvailability: { status: 'available' },
        pending: 0,
        pendingBreakdown: { text: 0, image: 0 }
      }
    });
    buttons = wrapper.findAll('button');
    await buttons[3].trigger('click');
    await flushPromises();

    expect(api.pauseManualBackfill).toHaveBeenCalledTimes(1);
    expect(api.resumeManualBackfill).toHaveBeenCalledTimes(1);
    expect(api.clearManualBackfill).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });
});
