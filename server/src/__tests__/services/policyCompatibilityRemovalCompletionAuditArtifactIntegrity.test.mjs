import {
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_INTEGRITY_RISK_IDS,
  validatePolicyCompatibilityRemovalCompletionAuditArtifactIntegrity,
} from '../../services/policyCompatibilityRemovalCompletionAuditArtifactIntegrity.mjs';
import {
  buildPolicyCompatibilityRemovalCompletionAuditArtifactFingerprint,
} from '../../services/policyCompatibilityRemovalCompletionAuditArtifactFingerprint.mjs';
import {
  buildCompletionAuditArtifactFixture,
} from './policyCompatibilityRemovalCompletionAuditArtifactFixture.mjs';

describe('policyCompatibilityRemovalCompletionAuditArtifactIntegrity', () => {
  test('accepts a current fingerprint-valid artifact that replays exactly', async () => {
    const completionAuditArtifact = await buildCompletionAuditArtifactFixture();
    const integrity =
      await validatePolicyCompatibilityRemovalCompletionAuditArtifactIntegrity({
        completionAuditArtifact,
      });

    expect(integrity.ok).toBe(true);
    expect(integrity.audit).toEqual(completionAuditArtifact.audit);
    expect(integrity.artifactFingerprint)
      .toBe(completionAuditArtifact.artifactFingerprint.fingerprint);
  });

  test('rejects an artifact whose bounded contents were changed', async () => {
    const completionAuditArtifact = structuredClone(
      await buildCompletionAuditArtifactFixture()
    );
    completionAuditArtifact.auditSummary.manifestRemovedCount = 0;
    const integrity =
      await validatePolicyCompatibilityRemovalCompletionAuditArtifactIntegrity({
        completionAuditArtifact,
      });

    expect(integrity.ok).toBe(false);
    expect(integrity.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_INTEGRITY_RISK_IDS
            .COMPLETION_AUDIT_ARTIFACT_INVALID,
      }),
    ]));
  });

  test('rejects a re-fingerprinted artifact when its stored audit cannot replay', async () => {
    const completionAuditArtifact = structuredClone(
      await buildCompletionAuditArtifactFixture()
    );
    completionAuditArtifact.auditSummary.manifestRemovedCount = 0;
    completionAuditArtifact.artifactFingerprint =
      buildPolicyCompatibilityRemovalCompletionAuditArtifactFingerprint({
        artifact: completionAuditArtifact,
      });
    const integrity =
      await validatePolicyCompatibilityRemovalCompletionAuditArtifactIntegrity({
        completionAuditArtifact,
      });

    expect(integrity.ok).toBe(false);
    expect(integrity.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_INTEGRITY_RISK_IDS
            .COMPLETION_AUDIT_REPLAY_MISMATCH,
      }),
    ]));
  });

  test('rejects artifacts that do not retain the inputs required for replay', async () => {
    const completionAuditArtifact = structuredClone(
      await buildCompletionAuditArtifactFixture()
    );
    delete completionAuditArtifact.executionPlan;
    completionAuditArtifact.artifactFingerprint =
      buildPolicyCompatibilityRemovalCompletionAuditArtifactFingerprint({
        artifact: completionAuditArtifact,
      });
    const integrity =
      await validatePolicyCompatibilityRemovalCompletionAuditArtifactIntegrity({
        completionAuditArtifact,
      });

    expect(integrity.ok).toBe(false);
    expect(integrity.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_INTEGRITY_RISK_IDS
            .COMPLETION_AUDIT_ARTIFACT_NOT_REPLAYABLE,
      }),
    ]));
  });
});
