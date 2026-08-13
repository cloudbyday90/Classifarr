/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, expect, test } from '@jest/globals';

import {
  getHistoricRouteSafetyRefreshActorId,
  isHistoricRouteSafetyRefreshActorId,
} from '../../services/policyRuntimeHistoricRouteSafetyRefreshActorIdentity.mjs';

describe('policyRuntimeHistoricRouteSafetyRefreshActorIdentity', () => {
  test('derives a receipt owner only from a bounded authenticated user ID', () => {
    expect(getHistoricRouteSafetyRefreshActorId({ id: 17 })).toBe('user:17');
    expect(getHistoricRouteSafetyRefreshActorId({ id: 'admin-7' })).toBe('user:admin-7');
    expect(getHistoricRouteSafetyRefreshActorId({ id: '../admin' })).toBeNull();
    expect(getHistoricRouteSafetyRefreshActorId({})).toBeNull();
  });

  test('accepts only canonical server-owned receipt actor references', () => {
    expect(isHistoricRouteSafetyRefreshActorId('user:17')).toBe(true);
    expect(isHistoricRouteSafetyRefreshActorId('')).toBe(false);
    expect(isHistoricRouteSafetyRefreshActorId('user:17/other')).toBe(false);
  });
});
