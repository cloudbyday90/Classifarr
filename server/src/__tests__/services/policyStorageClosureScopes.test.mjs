import {
  POLICY_STORAGE_CLOSURE_SCOPE_IDS,
  buildPolicyStorageClosureScopes,
  isPolicyStorageImplementationReady,
  isPolicyStorageInstanceCutoverReady,
} from '../../services/policyStorageClosureScopes.mjs';

describe('policyStorageClosureScopes', () => {
  test('keeps repository implementation readiness independent of instance cutover', () => {
    const scopes = buildPolicyStorageClosureScopes({
      implementationReadiness: {
        statusId: 'ready',
        ready: true,
        validationOk: true,
        riskCount: 0,
        risks: [],
      },
      finalRemovalAudit: {
        statusId: 'blocked_by_unconverted_policies',
        complete: false,
        validationOk: true,
        integrityOk: true,
        risks: [{ riskId: 'unconverted_policies' }],
      },
    });

    expect(scopes.implementationReadiness).toEqual({
      scope: POLICY_STORAGE_CLOSURE_SCOPE_IDS.REPOSITORY,
      statusId: 'ready',
      ready: true,
      validationOk: true,
      riskCount: 0,
      risks: [],
    });
    expect(scopes.instanceCutover).toEqual({
      scope: POLICY_STORAGE_CLOSURE_SCOPE_IDS.ACTIVE_INSTALLATION,
      requiredForStorageClosure: true,
      statusId: 'blocked_by_unconverted_policies',
      ready: false,
      integrityOk: true,
      validationOk: true,
      riskCount: 1,
      risks: [{ riskId: 'unconverted_policies' }],
    });
    expect(isPolicyStorageImplementationReady(scopes)).toBe(true);
    expect(isPolicyStorageInstanceCutoverReady(scopes)).toBe(false);
  });
});
