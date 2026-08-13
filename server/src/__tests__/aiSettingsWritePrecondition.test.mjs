/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';
import {
  AI_SETTINGS_STALE_WRITE_CODE,
  AI_SETTINGS_WRITE_PRECONDITION_REQUIRED_CODE,
  createAiSettingsWritePreconditionService,
  isAiSettingsWritePreconditionError,
} from '../services/aiSettingsWritePrecondition.mjs';

const WRITE_TAG = 'f6778de1-8322-42c4-a8d6-5072b8c03f83';
const NEXT_WRITE_TAG = '47d97f8d-a454-4ae0-b70d-e9ca6b5941cc';

function getThrownError(action) {
  try {
    action();
  } catch (error) {
    return error;
  }

  throw new Error('Expected the action to throw.');
}

describe('AI settings write precondition service', () => {
  test('issues a strong opaque ETag without exposing the private revision', () => {
    const service = createAiSettingsWritePreconditionService();

    expect(service.issueForConfiguration({
      configuration_revision: '9223372036854775807',
      configuration_write_tag: WRITE_TAG,
    })).toBe(`"${WRITE_TAG}"`);
  });

  test('requires a precondition before a configuration write can proceed', () => {
    const service = createAiSettingsWritePreconditionService();

    expect(getThrownError(() => service.assertCurrent({
      providedPrecondition: undefined,
      configuration: { configuration_write_tag: WRITE_TAG },
    }))).toMatchObject({
      code: AI_SETTINGS_WRITE_PRECONDITION_REQUIRED_CODE,
      httpStatus: 428,
      reloadRequired: true,
    });
  });

  test.each([
    '*',
    'W/"f6778de1-8322-42c4-a8d6-5072b8c03f83"',
    '"not-a-uuid"',
    `"${NEXT_WRITE_TAG}"`,
  ])('fails closed with one stale-write outcome for %s', (providedPrecondition) => {
    const service = createAiSettingsWritePreconditionService();

    expect(getThrownError(() => service.assertCurrent({
      providedPrecondition,
      configuration: { configuration_write_tag: WRITE_TAG },
    }))).toMatchObject({
      code: AI_SETTINGS_STALE_WRITE_CODE,
      httpStatus: 412,
      reloadRequired: true,
    });
  });

  test('accepts exactly the current opaque tag and supports the no-row bootstrap state', () => {
    const service = createAiSettingsWritePreconditionService();
    const current = service.issueForConfiguration({ configuration_write_tag: WRITE_TAG });
    const bootstrap = service.issueForConfiguration(null);

    expect(service.assertCurrent({
      providedPrecondition: `  ${current}  `,
      configuration: { configuration_write_tag: WRITE_TAG },
    })).toBe(current);
    expect(service.assertCurrent({
      providedPrecondition: bootstrap,
      configuration: null,
    })).toBe(bootstrap);
  });

  test('treats only documented precondition outcomes as recoverable conflicts', () => {
    expect(isAiSettingsWritePreconditionError({ code: AI_SETTINGS_STALE_WRITE_CODE })).toBe(true);
    expect(isAiSettingsWritePreconditionError({ code: AI_SETTINGS_WRITE_PRECONDITION_REQUIRED_CODE })).toBe(true);
    expect(isAiSettingsWritePreconditionError(new Error('database failed'))).toBe(false);
  });
});
