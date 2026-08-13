import { describe, expect, jest, test } from '@jest/globals';
import {
  createCandidateBoundVerificationProviderPreflightService,
} from '../../services/classificationCandidateBoundVerificationProviderPreflightService.mjs';

describe('candidate-bound verification provider preflight service', () => {
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
