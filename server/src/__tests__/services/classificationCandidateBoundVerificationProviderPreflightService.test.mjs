import { describe, expect, jest, test } from '@jest/globals';
import {
  createCandidateBoundVerificationProviderPreflightService,
} from '../../services/classificationCandidateBoundVerificationProviderPreflightService.mjs';

describe('candidate-bound verification provider preflight service', () => {
  test('saved Ollama status adds pending diagnostics without changing the capability verdict', async () => {
    const database = { query: jest.fn(async () => ({ rows: [] })) };
    const service = createCandidateBoundVerificationProviderPreflightService({ database,
      loadConfiguration: async () => ({ primary_provider: 'ollama' }),
      buildPreflight: () => ({ statusId: 'not_checked' }),
    });
    expect(await service.getPreflight({ presentationContext: 'saved_configuration' })).toMatchObject({
      statusId: 'not_checked', automaticVerification: { status: 'pending', reason: 'pending' },
    });
    expect(database.query).toHaveBeenCalledTimes(1);
    expect(await service.getPreflight({ presentationContext: 'saved_configuration', proposedConfiguration: {} }))
      .toEqual({ statusId: 'not_checked' });
    expect(database.query).toHaveBeenCalledTimes(1);
  });
  test('loads only the stored projection and never invokes a provider', async () => {
    const database = { query: jest.fn() };
    const loadConfiguration = jest.fn().mockResolvedValue({
      primary_provider: 'gemini',
      model: 'gemini-3-pro-preview',
    });
    const buildPreflight = jest.fn().mockReturnValue({
      statusId: 'verification_ready',
    });
    const service = createCandidateBoundVerificationProviderPreflightService({
      database,
      loadConfiguration,
      buildPreflight,
    });

    await expect(service.getPreflight({
      proposedConfiguration: { ollama_fallback_enabled: false },
    })).resolves.toEqual({ statusId: 'verification_ready' });

    expect(loadConfiguration).toHaveBeenCalledWith(database);
    expect(buildPreflight).toHaveBeenCalledWith({
      existingConfiguration: {
        primary_provider: 'gemini',
        model: 'gemini-3-pro-preview',
      },
      proposedConfiguration: { ollama_fallback_enabled: false },
    });
    expect(database.query).not.toHaveBeenCalled();
  });

  test('forwards the saved-configuration presentation context without a proposal', async () => {
    const database = { query: jest.fn() };
    const loadConfiguration = jest.fn().mockResolvedValue({ primary_provider: 'gemini' });
    const buildPreflight = jest.fn().mockReturnValue({ statusId: 'verification_ready' });
    const service = createCandidateBoundVerificationProviderPreflightService({
      database,
      loadConfiguration,
      buildPreflight,
    });

    await service.getPreflight({ presentationContext: 'saved_configuration' });

    expect(buildPreflight).toHaveBeenCalledWith({
      existingConfiguration: { primary_provider: 'gemini' },
      proposedConfiguration: undefined,
      presentationContext: 'saved_configuration',
    });
  });
});
