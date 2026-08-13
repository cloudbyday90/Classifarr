/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildCandidateBoundVerificationCapabilityChangeReceipt,
  getCandidateBoundVerificationCapabilityReceiptStatus,
} from '../../services/classificationCandidateBoundVerificationCapabilityChangeReceipt.mjs';

const INELIGIBLE_CONFIGURATION = Object.freeze({
  primary_provider: 'none',
  model: '',
});

const VERIFICATION_READY_CONFIGURATION = Object.freeze({
  primary_provider: 'gemini',
  model: 'gemini-2.5-pro',
});

describe('candidate-bound verification capability change receipt', () => {
  test('records only an actor, status transition, version, and configuration revision', () => {
    const receipt = buildCandidateBoundVerificationCapabilityChangeReceipt({
      beforeConfiguration: {
        ...INELIGIBLE_CONFIGURATION,
        api_key: 'before-secret',
        api_endpoint: 'https://before.example.test',
      },
      afterConfiguration: {
        ...VERIFICATION_READY_CONFIGURATION,
        api_key: 'after-secret',
        api_endpoint: 'https://after.example.test',
      },
      actorId: 'user:42',
      configurationRevision: 12,
    });

    expect(receipt).toEqual({
      version: 'classification.candidate_bound_verification_capability_change_receipt.v1',
      actorId: 'user:42',
      beforeStatusId: 'primary_path_ineligible',
      afterStatusId: 'verification_ready',
      configurationRevision: 12,
    });
    expect(JSON.stringify(receipt)).not.toContain('secret');
    expect(JSON.stringify(receipt)).not.toContain('example.test');
    expect(receipt).not.toHaveProperty('provider');
    expect(receipt).not.toHaveProperty('model');
  });

  test('does not create a receipt when a save leaves the capability status unchanged', () => {
    expect(buildCandidateBoundVerificationCapabilityChangeReceipt({
      beforeConfiguration: INELIGIBLE_CONFIGURATION,
      afterConfiguration: {
        ...INELIGIBLE_CONFIGURATION,
        api_key: 'different-but-private',
      },
      actorId: 'user:42',
      configurationRevision: 13,
    })).toBeNull();
  });

  test('requires a stable actor identity and a positive normalized revision', () => {
    const baseRequest = {
      beforeConfiguration: INELIGIBLE_CONFIGURATION,
      afterConfiguration: VERIFICATION_READY_CONFIGURATION,
      actorId: 'user:42',
      configurationRevision: 1,
    };

    expect(() => buildCandidateBoundVerificationCapabilityChangeReceipt({
      ...baseRequest,
      actorId: 'operator:42',
    })).toThrow('actor ID is invalid');
    expect(() => buildCandidateBoundVerificationCapabilityChangeReceipt({
      ...baseRequest,
      configurationRevision: '1',
    })).toThrow('configuration revision is invalid');
  });

  test('projects stored statuses through fixed server-owned labels', () => {
    expect(getCandidateBoundVerificationCapabilityReceiptStatus('verification_ready')).toEqual({
      statusId: 'verification_ready',
      label: 'Strict verification is available',
    });
    expect(() => getCandidateBoundVerificationCapabilityReceiptStatus('provider:gpt-5')).toThrow(
      'status ID is invalid',
    );
  });
});
