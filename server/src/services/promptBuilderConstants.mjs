import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('PromptBuilder');

export const STRONG_SCORE_THRESHOLD = 70;
export const PATTERN_REINFORCEMENT_THRESHOLD = 50;
export const MAX_SUGGESTIONS = 3;
export const DARK_KEYWORDS = ['horror', 'dark', 'scary', 'violent'];

export function safeJSONParse(value, defaultValue = null) {
    if (typeof value !== 'string') {
        return value || defaultValue;
    }
    try {
        return JSON.parse(value);
    } catch (error) {
        logger.warn('Failed to parse JSON', { value, error: error.message });
        return defaultValue;
    }
}
