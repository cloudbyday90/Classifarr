/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';
import { sendArrConfigErrorResponse } from '../routes/helpers/arrConfigSupport.mjs';

describe('arrConfigSupport', () => {
  test('applies the shared ARR config error response shape', () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    sendArrConfigErrorResponse(res, new Error('arr config failed'));

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'arr config failed' });
  });
});
