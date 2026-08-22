import { jest } from '@jest/globals';

jest.unstable_mockModule('../services/auth.mjs', () => ({
  verifyToken: jest.fn(),
}));

const { isAllowedSweepRoute } = await import('../middleware/auth.mjs');
const { LOCAL_AI_POLICY_SWEEP_ALLOWED_API_ROUTES } =
  await import('../services/localAiPolicySweepAccess.mjs');

function request(method, path) {
  return { method, path };
}

describe('local AI policy sweep route authorization', () => {
  test('allows only exact method-and-route grants', () => {
    expect(isAllowedSweepRoute(
      request('GET', '/api/queue/tasks/19/decision-witness'),
      LOCAL_AI_POLICY_SWEEP_ALLOWED_API_ROUTES,
    )).toBe(true);
    expect(isAllowedSweepRoute(
      request('POST', '/api/requests/submit'),
      LOCAL_AI_POLICY_SWEEP_ALLOWED_API_ROUTES,
    )).toBe(true);
    expect(isAllowedSweepRoute(
      request('PUT', '/api/settings'),
      LOCAL_AI_POLICY_SWEEP_ALLOWED_API_ROUTES,
    )).toBe(true);
  });

  test('denies queue mutations, sibling paths, and malformed dynamic identifiers', () => {
    expect(isAllowedSweepRoute(
      request('POST', '/api/queue/task/19/cancel'),
      LOCAL_AI_POLICY_SWEEP_ALLOWED_API_ROUTES,
    )).toBe(false);
    expect(isAllowedSweepRoute(
      request('GET', '/api/queue/tasks/19/classify'),
      LOCAL_AI_POLICY_SWEEP_ALLOWED_API_ROUTES,
    )).toBe(false);
    expect(isAllowedSweepRoute(
      request('GET', '/api/queue/tasks/0/decision-witness'),
      LOCAL_AI_POLICY_SWEEP_ALLOWED_API_ROUTES,
    )).toBe(false);
    expect(isAllowedSweepRoute(
      request('GET', '/api/policies'),
      LOCAL_AI_POLICY_SWEEP_ALLOWED_API_ROUTES,
    )).toBe(false);
  });
});
