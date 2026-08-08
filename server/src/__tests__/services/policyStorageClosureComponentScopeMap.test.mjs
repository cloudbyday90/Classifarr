import {
  POLICY_STORAGE_INSTANCE_CUTOVER_COMPONENT_IDS,
  buildPolicyStorageClosureComponentScopeMap,
  getPolicyStorageClosureComponentEvidenceScope,
} from '../../services/policyStorageClosureComponentScopeMap.mjs';

describe('policyStorageClosureComponentScopeMap', () => {
  test('classifies compatibility-removal workflow identifiers as active-installation evidence', () => {
    expect(POLICY_STORAGE_INSTANCE_CUTOVER_COMPONENT_IDS).toEqual(expect.arrayContaining([
      'compatibility_path_deletion_readiness',
      'compatibility_removal_completion_audit',
      'post_removal_runtime_verification',
    ]));
    expect(POLICY_STORAGE_INSTANCE_CUTOVER_COMPONENT_IDS.every(componentId => (
      getPolicyStorageClosureComponentEvidenceScope(componentId) === 'active_installation'
    ))).toBe(true);
    expect(getPolicyStorageClosureComponentEvidenceScope('native_schema_contract'))
      .toBe('repository');
  });

  test('excludes active-installation components from implementation readiness while retaining them for final closure', () => {
    const componentScopeMap = buildPolicyStorageClosureComponentScopeMap({
      implementationComponents: [
        { componentId: 'native_schema_contract' },
        { componentId: 'compatibility_removal_completion_audit' },
        'native_schema_contract',
      ],
    });

    expect(componentScopeMap.implementationReadiness).toEqual({
      scope: 'repository',
      componentIds: ['native_schema_contract'],
      componentCount: 1,
    });
    expect(componentScopeMap.instanceCutover).toEqual({
      scope: 'active_installation',
      componentIds: POLICY_STORAGE_INSTANCE_CUTOVER_COMPONENT_IDS,
      componentCount: POLICY_STORAGE_INSTANCE_CUTOVER_COMPONENT_IDS.length,
      requiredForStorageClosure: true,
    });
  });
});
