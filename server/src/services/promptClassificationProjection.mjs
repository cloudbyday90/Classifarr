/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export function projectPromptClassification(classification) {
    const metadata = typeof classification.metadata === 'string'
        ? JSON.parse(classification.metadata) : classification.metadata || {};
    const details = metadata.classification_details || {};
    return {
        metadata,
        evaluation: {
            action: 'prompt_select',
            confidence: Number(classification.confidence ?? 0),
            ranked: Array.isArray(details.ranked_candidates) ? details.ranked_candidates : [],
            scores: details.scores || {},
        },
    };
}
