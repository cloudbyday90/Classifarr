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

  test('builds stage-only API fields', () => {
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
    });
    expect(result.stages).toBe(stages);
    expect(result).not.toHaveProperty('currentPhase');
    expect(result).not.toHaveProperty('phases');
  });

  test('builds stage-only websocket events', () => {
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
    });
    expect(result).not.toHaveProperty('phase');
  });
});
