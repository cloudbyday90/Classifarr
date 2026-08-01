import { jest } from '@jest/globals';
import {
  POLICY_OPERATOR_WORKFLOW_READ_UNAVAILABLE_CODE,
  assertPolicyOperatorWorkflowReadResponse,
} from '../routes/policyOperatorWorkflowReadResponse.mjs';
import {
  createPolicyOperatorWorkflowReadService,
} from '../services/policyOperatorWorkflowReadService.mjs';

async function buildWorkflowRead() {
  const service = createPolicyOperatorWorkflowReadService({
    loadProfileEvidence: jest.fn().mockResolvedValue({ ok: false }),
  });

  return service.getWorkflow({
    library: { id: 6, name: 'Holiday Movies', media_type: 'movie' },
    routing: { configured: true, routeReady: true, targetName: 'radarr library mapping' },
    intentSignalSources: {
      starterTemplateSuggestions: [{
        templateId: 'holiday',
        templateName: 'Holiday',
        signalType: 'keywords',
        value: 'Christmas',
        explanation: 'Suggested by the optional Holiday starter template.',
      }],
    },
  });
}

describe('policyOperatorWorkflowReadResponse', () => {
  test('accepts a canonical display projection without logging template internals', async () => {
    const logger = { error: jest.fn() };
    const result = await buildWorkflowRead();

    expect(assertPolicyOperatorWorkflowReadResponse({ result, libraryId: 6, logger }))
      .toEqual({ ok: true, issueCount: 0, issues: [] });
    expect(logger.error).not.toHaveBeenCalled();
  });

  test('fails closed and logs only audit identifiers when starter-template provenance leaks', async () => {
    const logger = { error: jest.fn() };
    const result = await buildWorkflowRead();
    const candidate = result.observedProfile.intentSignalProjection.options.find(option => (
      option.sourceId === 'suggested_from_starter_template'
    ));
    candidate.templateId = 'holiday';

    let error;
    try {
      assertPolicyOperatorWorkflowReadResponse({ result, libraryId: 6, logger });
    } catch (caughtError) {
      error = caughtError;
    }

    expect(error).toMatchObject({
      name: 'ServiceUnavailableError',
      statusCode: 503,
      code: POLICY_OPERATOR_WORKFLOW_READ_UNAVAILABLE_CODE,
    });
    expect(logger.error).toHaveBeenCalledWith('Policy operator workflow read failed validation', {
      libraryId: 6,
      auditRiskIds: ['invalid_intent_signal_option_projection'],
    });
  });
});
