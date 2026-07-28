/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';

import {
  clearPolicyNativeProfileRefreshCircuitsForLibrary,
  recordPolicyNativeProfileRefreshCircuitFailure,
  startPolicyNativeProfileRefreshCircuitProbe,
} from '../../services/policyNativeProfileRefreshCircuitRepository.mjs';

const NOW = new Date('2026-07-28T12:00:00.000Z');
const SOURCE_EVENT_ID = 'library-profile:8:stale_profile:2026-07-25T12:00:00.000Z';

function circuitRow(overrides = {}) {
  return {
    circuit_state: 'closed',
    consecutive_failure_count: 0,
    last_terminal_outbox_id: null,
    last_failure_code: null,
    opened_at: null,
    next_probe_at: null,
    probe_outbox_id: null,
    ...overrides,
  };
}

describe('policyNativeProfileRefreshCircuitRepository', () => {
  test('records and locks a terminal failure with parameterized circuit persistence', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [circuitRow()] })
        .mockResolvedValueOnce({ rows: [circuitRow({
          circuit_state: 'open',
          consecutive_failure_count: 3,
          last_terminal_outbox_id: '93',
          last_failure_code: 'profile_refresh_unknown_failed',
          opened_at: '2026-07-28T12:00:00.000Z',
          next_probe_at: '2026-07-28T14:00:00.000Z',
        })] }),
    };

    await expect(recordPolicyNativeProfileRefreshCircuitFailure({
      client,
      libraryId: 8,
      sourceEventId: SOURCE_EVENT_ID,
      failedOutboxId: 93,
      failureCount: 3,
      failureCode: 'profile_refresh_unknown_failed',
      now: NOW,
    })).resolves.toMatchObject({
      ready: true,
      opened: true,
      circuit: { circuitState: 'open', lastTerminalOutboxId: 93 },
    });

    expect(client.query.mock.calls[0][0]).toContain('ON CONFLICT (library_id, source_event_id) DO NOTHING');
    expect(client.query.mock.calls[1][0]).toContain('FOR UPDATE');
    expect(client.query.mock.calls[2][0]).toContain('last_terminal_outbox_id = $3');
    expect(client.query.mock.calls[2][1]).toEqual(expect.arrayContaining([
      'open',
      3,
      93,
      'profile_refresh_unknown_failed',
      8,
      SOURCE_EVENT_ID,
    ]));
  });

  test('starts one probe only from a locked due open circuit', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [circuitRow({
          circuit_state: 'open',
          consecutive_failure_count: 3,
          last_terminal_outbox_id: '93',
          last_failure_code: 'profile_refresh_unknown_failed',
          opened_at: '2026-07-28T12:00:00.000Z',
          next_probe_at: '2026-07-28T14:00:00.000Z',
        })] })
        .mockResolvedValueOnce({ rows: [circuitRow({
          circuit_state: 'half_open',
          consecutive_failure_count: 3,
          last_terminal_outbox_id: '93',
          last_failure_code: 'profile_refresh_unknown_failed',
          opened_at: '2026-07-28T12:00:00.000Z',
          probe_outbox_id: '94',
        })] }),
    };

    await expect(startPolicyNativeProfileRefreshCircuitProbe({
      client,
      libraryId: 8,
      sourceEventId: SOURCE_EVENT_ID,
      probeOutboxId: 94,
      now: new Date('2026-07-28T14:00:00.000Z'),
    })).resolves.toMatchObject({
      ready: true,
      circuit: { circuitState: 'half_open', probeOutboxId: 94 },
    });
    expect(client.query.mock.calls[0][0]).toContain('FOR UPDATE');
    expect(client.query.mock.calls[1][1]).toEqual(expect.arrayContaining([
      'half_open',
      94,
    ]));
  });

  test('clears all runtime circuits after any successful profile refresh for the library', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [{ library_id: '8' }] }) };

    await expect(clearPolicyNativeProfileRefreshCircuitsForLibrary({
      client,
      libraryId: 8,
    })).resolves.toBe(1);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM policy_native_profile_refresh_circuits'),
      [8],
    );
  });
});
