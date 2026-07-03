export const STAGES = [
    'queued',
    'metadata_fetch',
    'policy_eval',
    'rag_analysis',
    'signal_combine',
    'ai_analysis',
    'decision',
    'notification'
];

export const STAGE_METADATA = {
    queued: { icon: '⏳', label: 'Queued', description: 'Item received, waiting to be processed' },
    metadata_fetch: { icon: '📥', label: 'Metadata Fetch', description: 'Fetching TMDB/TVDB metadata' },
    policy_eval: { icon: '📋', label: 'Policy Evaluation', description: 'Running PolicyEngine matching' },
    rag_analysis: { icon: '🧠', label: 'RAG Analysis', description: 'Running embeddings similarity search' },
    signal_combine: { icon: '⚖️', label: 'Signal Combination', description: 'Combining scores from all engines' },
    ai_analysis: { icon: '🤖', label: 'AI Analysis', description: 'Running AI classification analysis' },
    decision: { icon: '✅', label: 'Decision', description: 'Final classification decision made' },
    notification: { icon: '📤', label: 'Notification', description: 'Sending to *arr / notifications' }
};

export const PHASES = STAGES;
export const PHASE_METADATA = STAGE_METADATA;

export { parsePayload } from '../utils/queueHelpers.mjs';

export function parsePhaseHistory(rawHistory) {
    let history = rawHistory || [];

    if (typeof history === 'string') {
        try {
            history = JSON.parse(history);
        } catch {
            history = [];
        }
    }

    return history;
}

function firstDisplayString(values = []) {
    for (const value of values) {
        if (typeof value !== 'string') continue;
        const trimmed = value.trim();
        if (!trimmed) continue;
        if (trimmed.toLowerCase() === 'unknown') continue;
        return trimmed;
    }
    return null;
}

function firstDisplayNumber(values = []) {
    for (const value of values) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
        if (typeof value === 'string' && value.trim()) {
            const parsed = Number(value);
            if (Number.isFinite(parsed)) return parsed;
        }
    }
    return null;
}

export function extractDisplayInfo(payload = {}) {
    const media = payload?.media && typeof payload.media === 'object' ? payload.media : {};
    const metadata = payload?.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};

    return {
        title: firstDisplayString([
            payload?.title,
            media?.title,
            media?.name,
            metadata?.title,
            metadata?.name,
            payload?.subject
        ]) || 'Unknown',
        year: firstDisplayNumber([
            payload?.year,
            media?.year,
            metadata?.year
        ]),
        mediaType: firstDisplayString([
            payload?.media_type,
            media?.media_type,
            metadata?.media_type
        ])
    };
}

export function buildStageList(task) {
    let history = parsePhaseHistory(task.phase_history);

    const currentStageIndex = STAGES.indexOf(task.current_phase);

    return STAGES.map((stage, index) => {
        const historyEntry = history.find(h => h.phase === stage);

        if (historyEntry) {
            const status = historyEntry.status === 'skipped' ? 'skipped' : 'complete';
            return {
                name: stage,
                ...historyEntry,
                status,
                ...STAGE_METADATA[stage]
            };
        } else if (index === currentStageIndex) {
            return {
                name: stage,
                status: 'in_progress',
                started_at: task.phase_started_at,
                ...STAGE_METADATA[stage]
            };
        } else {
            return {
                name: stage,
                status: 'pending',
                ...STAGE_METADATA[stage]
            };
        }
    });
}

export function buildPhaseList(task) {
    return buildStageList(task);
}

export function resolveSkippedStages(input = {}) {
    const requested = Array.isArray(input.requested) ? input.requested : [];
    if (requested.length === 0) {
        return [];
    }

    const history = Array.isArray(input.history) ? input.history : [];
    const currentPhase = input.currentPhase || null;
    const targetPhase = input.targetPhase || null;
    const currentStageIndex = STAGES.indexOf(currentPhase);
    const targetStageIndex = STAGES.indexOf(targetPhase);
    const historicalPhases = new Set(history.map((entry) => entry.phase));
    const boundedForwardTransition = currentStageIndex >= 0
        && targetStageIndex >= 0
        && targetStageIndex > currentStageIndex;

    return [...new Set(requested)]
        .filter((stage) => isValidStage(stage))
        .filter((stage) => stage !== currentPhase && stage !== targetPhase)
        .filter((stage) => !historicalPhases.has(stage))
        .filter((stage) => {
            if (!boundedForwardTransition) {
                return true;
            }
            const stageIndex = STAGES.indexOf(stage);
            return stageIndex > currentStageIndex && stageIndex < targetStageIndex;
        })
        .sort((a, b) => STAGES.indexOf(a) - STAGES.indexOf(b));
}

export function resolveSkippedPhases(input = {}) {
    return resolveSkippedStages(input);
}

export function isValidStage(phase) {
    return STAGES.includes(phase);
}

export function isValidPhase(phase) {
    return isValidStage(phase);
}

export function getStageMetadata() {
    return STAGES.map(stage => ({
        name: stage,
        index: STAGES.indexOf(stage) + 1,
        ...STAGE_METADATA[stage]
    }));
}

export function getPhaseMetadata() {
    return getStageMetadata();
}

export function getStageCount() {
    return STAGES.length;
}

export function getPhaseCount() {
    return getStageCount();
}
