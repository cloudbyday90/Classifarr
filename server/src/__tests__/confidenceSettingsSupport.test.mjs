/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';
import {
  buildConfidenceExportResponse,
  buildConfidenceSettingsResponse,
  buildInvalidConfidenceHistoryPaginationResponse,
  buildInvalidConfidenceSettingsArrayResponse,
  buildInvalidConfidenceSettingsObjectResponse,
  normalizeConfidenceHistoryPagination,
  normalizeConfidenceSettingsImportRequest,
  normalizeConfidenceSettingsUpdateRequest,
  sendConfidenceSettingsErrorResponse,
} from '../routes/helpers/confidenceSettingsSupport.mjs';

describe('confidenceSettingsSupport', () => {
  test('builds the confidence settings response keyed by setting_key', () => {
    expect(buildConfidenceSettingsResponse([
      {
        setting_key: 'classification_threshold',
        setting_value: '0.75',
        description: 'Classification threshold',
        default_value: '0.70',
      },
    ])).toEqual({
      classification_threshold: {
        value: '0.75',
        description: 'Classification threshold',
        default: '0.70',
      },
    });
  });

  test('builds invalid update and import request responses', () => {
    expect(buildInvalidConfidenceSettingsObjectResponse()).toEqual({
      status: 400,
      body: { error: 'Settings must be a valid object' },
    });
    expect(buildInvalidConfidenceSettingsArrayResponse()).toEqual({
      status: 400,
      body: { error: 'Settings must be an array' },
    });
  });

  test('normalizes valid update and import requests', () => {
    expect(normalizeConfidenceSettingsUpdateRequest({ classification_threshold: '0.8' })).toEqual({
      payload: { classification_threshold: '0.8' },
    });
    expect(normalizeConfidenceSettingsUpdateRequest(['bad'])).toEqual({
      errorResponse: buildInvalidConfidenceSettingsObjectResponse(),
    });

    expect(normalizeConfidenceSettingsImportRequest([{ setting_key: 'classification_threshold' }])).toEqual({
      payload: [{ setting_key: 'classification_threshold' }],
    });
    expect(normalizeConfidenceSettingsImportRequest({ bad: true })).toEqual({
      errorResponse: buildInvalidConfidenceSettingsArrayResponse(),
    });
  });

  test('normalizes history pagination and rejects invalid parameters', () => {
    expect(normalizeConfidenceHistoryPagination({ limit: '25', offset: '10' }, 1000)).toEqual({
      payload: { limit: 25, offset: 10 },
    });
    expect(normalizeConfidenceHistoryPagination({}, 1000)).toEqual({
      payload: { limit: 50, offset: 0 },
    });
    expect(buildInvalidConfidenceHistoryPaginationResponse(1000)).toEqual({
      status: 400,
      body: {
        error: "Invalid pagination parameters. 'limit' must be a positive integer up to 1000, and 'offset' must be a non-negative integer.",
      },
    });
    expect(normalizeConfidenceHistoryPagination({ limit: '0' }, 1000)).toEqual({
      errorResponse: buildInvalidConfidenceHistoryPaginationResponse(1000),
    });
  });

  test('builds confidence export payloads with metadata', () => {
    const exportPayload = buildConfidenceExportResponse([
      { setting_key: 'classification_threshold', setting_value: '0.75' },
    ], 'tester');

    expect(exportPayload.version).toBe('1.0');
    expect(exportPayload.exportedBy).toBe('tester');
    expect(exportPayload.settings).toEqual([
      { setting_key: 'classification_threshold', setting_value: '0.75' },
    ]);
    expect(typeof exportPayload.exportedAt).toBe('string');
  });

  test('applies confidence error responses for httpStatus and fallback failures', () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const badRequestError = new Error('Unknown confidence setting key: foo');
    badRequestError.httpStatus = 400;
    sendConfidenceSettingsErrorResponse(res, badRequestError, 'Failed to update settings');

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unknown confidence setting key: foo' });

    res.status.mockClear();
    res.json.mockClear();

    sendConfidenceSettingsErrorResponse(res, new Error('boom'), 'Failed to update settings');

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to update settings' });
  });
});