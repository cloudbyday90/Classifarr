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

export { parsePayload } from '../utils/queueHelpers.mjs';

export function parseStageHistory(rawHistory) {
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
    let history = parseStageHistory(task.stage_history);

    const currentStageIndex = STAGES.indexOf(task.current_stage);

    return STAGES.map((stage, index) => {
        const historyEntry = history.find(entry => entry.stage === stage);

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
                started_at: task.stage_started_at,
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

export function resolveSkippedStages(input = {}) {
    const requested = Array.isArray(input.requested) ? input.requested : [];
    if (requested.length === 0) {
        return [];
    }

    const history = Array.isArray(input.history) ? input.history : [];
    const currentStage = input.currentStage || null;
    const targetStage = input.targetStage || null;
    const currentStageIndex = STAGES.indexOf(currentStage);
    const targetStageIndex = STAGES.indexOf(targetStage);
    const historicalStages = new Set(history.map(entry => entry.stage));
    const boundedForwardTransition = currentStageIndex >= 0
        && targetStageIndex >= 0
        && targetStageIndex > currentStageIndex;

    return [...new Set(requested)]
        .filter((stage) => isValidStage(stage))
        .filter(stage => stage !== currentStage && stage !== targetStage)
        .filter(stage => !historicalStages.has(stage))
        .filter((stage) => {
            if (!boundedForwardTransition) {
                return true;
            }
            const stageIndex = STAGES.indexOf(stage);
            return stageIndex > currentStageIndex && stageIndex < targetStageIndex;
        })
        .sort((a, b) => STAGES.indexOf(a) - STAGES.indexOf(b));
}

export function isValidStage(stage) {
    return STAGES.includes(stage);
}

export function getStageMetadata() {
    return STAGES.map(stage => ({
        name: stage,
        index: STAGES.indexOf(stage) + 1,
        ...STAGE_METADATA[stage]
    }));
}

export function getStageCount() {
    return STAGES.length;
}
