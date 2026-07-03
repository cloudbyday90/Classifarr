import {
  CLASSIFICATION_PROGRESS_STAGE_CONTRACT_VERSION,
  buildStageProgressEvent,
  buildStageProgressFields,
} from '../../services/classificationProgressStageContract.mjs';

describe('classificationProgressStageContract', () => {
  test('exports a durable stage contract version', () => {
    expect(CLASSIFICATION_PROGRESS_STAGE_CONTRACT_VERSION)
      .toBe('classification_progress.stage_contract.v1');
  });

  test('builds stage-first API fields with legacy phase aliases', () => {
    const stages = [{ name: 'queued', status: 'complete' }];
    const result = buildStageProgressFields({
      currentStage: 'queued',
      stageIndex: 1,
      totalStages: 8,
      stageStartedAt: '2026-07-03T10:00:00.000Z',
      stageDuration: 250,
      stages,
      stageMetadata: { label: 'Queued' },
    });

    expect(result).toMatchObject({
      currentStage: 'queued',
      stageIndex: 1,
      totalStages: 8,
      stageStartedAt: '2026-07-03T10:00:00.000Z',
      stageDuration: 250,
      stageMetadata: { label: 'Queued' },
      currentPhase: 'queued',
      phaseIndex: 1,
      totalPhases: 8,
      phaseStartedAt: '2026-07-03T10:00:00.000Z',
      phaseDuration: 250,
      phaseMetadata: { label: 'Queued' },
    });
    expect(result.stages).toBe(stages);
    expect(result.phases).toBe(stages);
  });

  test('builds stage-first websocket events with legacy phase aliases', () => {
    const result = buildStageProgressEvent({
      taskId: 123,
      stage: 'ai_analysis',
      stageIndex: 6,
      totalStages: 8,
      progress: 75,
      title: 'Mulan',
    });

    expect(result).toEqual({
      taskId: 123,
      title: 'Mulan',
      stage: 'ai_analysis',
      stageIndex: 6,
      totalStages: 8,
      progress: 75,
      phase: 'ai_analysis',
      phaseIndex: 6,
      totalPhases: 8,
    });
  });
});
