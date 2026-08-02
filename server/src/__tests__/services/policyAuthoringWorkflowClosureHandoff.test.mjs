import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  POLICY_AUTHORING_WORKFLOW_CLOSURE_RISK_IDS,
  POLICY_AUTHORING_WORKFLOW_CLOSURE_STATUS_IDS,
  buildPolicyAuthoringWorkflowClosureHandoff,
  listPolicyAuthoringLiveAuthoringHandoffs,
  listPolicyAuthoringWorkflowContractHandoffs,
  listPolicyAuthoringWorkflowClosureArtifactPaths,
} from '../../services/policyAuthoringWorkflowClosureHandoff.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../..');
const artifactExists = artifactPath => existsSync(resolve(repoRoot, artifactPath));

describe('policyAuthoringWorkflowClosureHandoff', () => {
  test('closes Phase 3R contracts without claiming live UI completion and hands off only 4R.1', () => {
    const closure = buildPolicyAuthoringWorkflowClosureHandoff({ artifactExists });

    expect(closure).toEqual(expect.objectContaining({
      ok: true,
      statusId: POLICY_AUTHORING_WORKFLOW_CLOSURE_STATUS_IDS.READY_FOR_LIVE_AUTHORING,
      issueCount: 0,
      completionAudit: expect.objectContaining({
        checkedServerContractCount: 13,
        checkedClientWorkflowComponentCount: 11,
      }),
      componentHandoffAudit: expect.objectContaining({
        ok: true,
        checkedCount: 24,
      }),
      liveAuthoringHandoffAudit: expect.objectContaining({
        ok: true,
        checkedCount: 9,
      }),
      nextStep: expect.objectContaining({
        stepId: 'live_entry_path_inventory',
      }),
    }));

    expect(listPolicyAuthoringWorkflowContractHandoffs().every(handoff => (
      handoff.statusId === 'complete' && handoff.liveUiOutcome === 'not_claimed'
    ))).toBe(true);
    expect(listPolicyAuthoringLiveAuthoringHandoffs().map(handoff => handoff.availability)).toEqual([
      'next',
      'blocked_by_sequence',
      'blocked_by_sequence',
      'blocked_by_sequence',
      'blocked_by_sequence',
      'blocked_by_sequence',
      'blocked_by_sequence',
      'blocked_by_sequence',
      'blocked_by_sequence',
    ]);
  });

  test('requires repository evidence for every design, source, and regression artifact', () => {
    const artifactPaths = listPolicyAuthoringWorkflowClosureArtifactPaths();

    expect(artifactPaths.length).toBeGreaterThan(0);
    expect(artifactPaths.filter(artifactPath => !artifactExists(artifactPath))).toEqual([]);

    const closure = buildPolicyAuthoringWorkflowClosureHandoff({
      artifactExists: artifactPath => artifactPath !== artifactPaths[0] && artifactExists(artifactPath),
    });

    expect(closure).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_AUTHORING_WORKFLOW_CLOSURE_STATUS_IDS.BLOCKED,
      issues: expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_AUTHORING_WORKFLOW_CLOSURE_RISK_IDS.ARTIFACT_MISSING,
          artifactPath: artifactPaths[0],
        }),
      ]),
    }));
  });

  test('fails closed when an active component handoff is incomplete, omitted, or claims a live interaction outcome', () => {
    const handoffs = listPolicyAuthoringWorkflowContractHandoffs();
    const claimedLiveHandoffs = handoffs.map(handoff => (
      handoff.recordId === 'policy_authoring_destination_flow'
        ? { ...handoff, liveUiOutcome: 'complete' }
        : handoff.recordId === 'policy_authoring_readiness'
          ? { ...handoff, statusId: 'missing_evidence' }
        : handoff
    ));
    const closure = buildPolicyAuthoringWorkflowClosureHandoff({
      artifactExists,
      componentHandoffs: claimedLiveHandoffs.filter(
        handoff => handoff.recordKey !== 'server_contract:policy_authoring_component_inventory',
      ),
    });

    expect(closure.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_AUTHORING_WORKFLOW_CLOSURE_RISK_IDS.COMPONENT_HANDOFF_MISSING,
      POLICY_AUTHORING_WORKFLOW_CLOSURE_RISK_IDS.COMPONENT_HANDOFF_INCOMPLETE,
      POLICY_AUTHORING_WORKFLOW_CLOSURE_RISK_IDS.LIVE_UI_COMPLETION_CLAIM,
    ]));
  });

  test('fails closed when a later Phase 4R task becomes eligible before 4R.1', () => {
    const liveAuthoringHandoffs = listPolicyAuthoringLiveAuthoringHandoffs().map(handoff => (
      handoff.taskId === 'workflow_presentation_adapter'
        ? { ...handoff, availability: 'next' }
        : handoff
    ));
    const closure = buildPolicyAuthoringWorkflowClosureHandoff({ artifactExists, liveAuthoringHandoffs });

    expect(closure.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_AUTHORING_WORKFLOW_CLOSURE_RISK_IDS.LIVE_AUTHORING_HANDOFF_INVALID_SEQUENCE,
        taskId: 'workflow_presentation_adapter',
      }),
    ]));
  });
});
