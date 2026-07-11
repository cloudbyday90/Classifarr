export const CLASSIFICATION_PROGRESS_STAGE_CONTRACT_VERSION =
    'classification_progress.stage_contract.v1';

export function buildStageProgressFields({
    currentStage = null,
    stageIndex = 0,
    totalStages = 0,
    stageStartedAt = null,
    stageDuration = 0,
    stages = [],
    stageMetadata = null,
} = {}) {
    const safeStageIndex = Number(stageIndex || 0);
    const safeTotalStages = Number(totalStages || 0);

    return {
        currentStage,
        stageIndex: safeStageIndex,
        totalStages: safeTotalStages,
        stageStartedAt,
        stageDuration,
        stages,
        stageMetadata,
    };
}

export function buildStageProgressEvent({
    stage = null,
    stageIndex = 0,
    totalStages = 0,
    progress = 0,
    ...rest
} = {}) {
    const safeStageIndex = Number(stageIndex || 0);
    const safeTotalStages = Number(totalStages || 0);

    return {
        ...rest,
        stage,
        stageIndex: safeStageIndex,
        totalStages: safeTotalStages,
        progress,
    };
}
