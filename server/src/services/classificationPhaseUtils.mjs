export const PHASES = [
    'queued',
    'metadata_fetch',
    'policy_eval',
    'rag_analysis',
    'signal_combine',
    'ai_analysis',
    'decision',
    'notification'
];

export const PHASE_METADATA = {
    queued: { icon: '⏳', label: 'Queued', description: 'Item received, waiting to be processed' },
    metadata_fetch: { icon: '📥', label: 'Metadata Fetch', description: 'Fetching TMDB/TVDB metadata' },
    policy_eval: { icon: '📋', label: 'Policy Evaluation', description: 'Running PolicyEngine matching' },
    rag_analysis: { icon: '🧠', label: 'RAG Analysis', description: 'Running embeddings similarity search' },
    signal_combine: { icon: '⚖️', label: 'Signal Combination', description: 'Combining scores from all engines' },
    ai_analysis: { icon: '🤖', label: 'AI Analysis', description: 'Running AI classification analysis' },
    decision: { icon: '✅', label: 'Decision', description: 'Final classification decision made' },
    notification: { icon: '📤', label: 'Notification', description: 'Sending to *arr / notifications' }
};

export function parsePayload(rawPayload) {
    if (!rawPayload) return {};
    if (typeof rawPayload === 'object') return rawPayload;
    if (typeof rawPayload !== 'string') return {};

    try {
        const parsed = JSON.parse(rawPayload);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

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

export function buildPhaseList(task) {
    let history = parsePhaseHistory(task.phase_history);

    const currentPhaseIndex = PHASES.indexOf(task.current_phase);

    return PHASES.map((phase, index) => {
        const historyEntry = history.find(h => h.phase === phase);

        if (historyEntry) {
            const status = historyEntry.status === 'skipped' ? 'skipped' : 'complete';
            return {
                name: phase,
                ...historyEntry,
                status,
                ...PHASE_METADATA[phase]
            };
        } else if (index === currentPhaseIndex) {
            return {
                name: phase,
                status: 'in_progress',
                started_at: task.phase_started_at,
                ...PHASE_METADATA[phase]
            };
        } else {
            return {
                name: phase,
                status: 'pending',
                ...PHASE_METADATA[phase]
            };
        }
    });
}

export function resolveSkippedPhases(input = {}) {
    const requested = Array.isArray(input.requested) ? input.requested : [];
    if (requested.length === 0) {
        return [];
    }

    const history = Array.isArray(input.history) ? input.history : [];
    const currentPhase = input.currentPhase || null;
    const targetPhase = input.targetPhase || null;
    const currentPhaseIndex = PHASES.indexOf(currentPhase);
    const targetPhaseIndex = PHASES.indexOf(targetPhase);
    const historicalPhases = new Set(history.map((entry) => entry.phase));
    const boundedForwardTransition = currentPhaseIndex >= 0
        && targetPhaseIndex >= 0
        && targetPhaseIndex > currentPhaseIndex;

    return [...new Set(requested)]
        .filter((phase) => isValidPhase(phase))
        .filter((phase) => phase !== currentPhase && phase !== targetPhase)
        .filter((phase) => !historicalPhases.has(phase))
        .filter((phase) => {
            if (!boundedForwardTransition) {
                return true;
            }
            const phaseIndex = PHASES.indexOf(phase);
            return phaseIndex > currentPhaseIndex && phaseIndex < targetPhaseIndex;
        })
        .sort((a, b) => PHASES.indexOf(a) - PHASES.indexOf(b));
}

export function isValidPhase(phase) {
    return PHASES.includes(phase);
}

export function getPhaseMetadata() {
    return PHASES.map(phase => ({
        name: phase,
        index: PHASES.indexOf(phase) + 1,
        ...PHASE_METADATA[phase]
    }));
}

export function getPhaseCount() {
    return PHASES.length;
}
