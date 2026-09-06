/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { TUNING_CONSTANTS } from './feedbackAnalysisUtils.mjs';
import { ValidationError } from '../utils/appError.mjs';

/** Resolve storage values without changing the caller's suggestion or configuration. */
export function resolveSuggestionConfig(policy, suggestion) {
    if (!suggestion.config || typeof suggestion.config !== 'object' || Array.isArray(suggestion.config)) {
        throw new ValidationError('Suggestion configuration must be an object');
    }
    const config = { ...suggestion.config };
    if (suggestion.type === 'adjust_threshold') {
        if (config.threshold_type === 'auto_classify') {
            config.current = policy.auto_classify_threshold;
            config.recommended = config.reason.includes('High false positive')
                ? Math.min(policy.auto_classify_threshold + TUNING_CONSTANTS.THRESHOLD_ADJUSTMENT,
                    TUNING_CONSTANTS.MAX_AUTO_CLASSIFY_THRESHOLD)
                : Math.max(policy.auto_classify_threshold - TUNING_CONSTANTS.THRESHOLD_ADJUSTMENT,
                    TUNING_CONSTANTS.MIN_AUTO_CLASSIFY_THRESHOLD);
        } else if (config.threshold_type === 'prompt') {
            config.current = policy.prompt_threshold;
            config.recommended = Math.max(policy.prompt_threshold - TUNING_CONSTANTS.THRESHOLD_ADJUSTMENT,
                TUNING_CONSTANTS.MIN_PROMPT_THRESHOLD);
        }
    } else if (suggestion.type === 'adjust_weight') {
        const weights = {
            preset: policy.preset_weight || 0.40,
            pattern: policy.pattern_weight || 0.30,
            rag: policy.rag_weight || 0.20,
            history: policy.history_weight || 0.10
        };
        config.current = weights[config.signal];
        config.recommended = config.reason.includes('Low accuracy')
            ? Math.max(config.current - TUNING_CONSTANTS.WEIGHT_ADJUSTMENT, TUNING_CONSTANTS.MIN_WEIGHT)
            : Math.min(config.current + TUNING_CONSTANTS.WEIGHT_ADJUSTMENT, TUNING_CONSTANTS.MAX_WEIGHT);
    }
    return config;
}
