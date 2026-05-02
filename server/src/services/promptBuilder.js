/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const promptBuilderShared = require('./promptBuilder.shared');

const {
    PromptBuilder,
    createPromptBuilder,
    safeJSONParse,
    LOW_CONFIDENCE_THRESHOLD,
    CLOSE_RACE_SCORE_DELTA,
    STRONG_SCORE_THRESHOLD,
    PATTERN_REINFORCEMENT_THRESHOLD,
    MAX_SUGGESTIONS,
    DARK_KEYWORDS,
} = promptBuilderShared;

const promptBuilder = createPromptBuilder();

module.exports = promptBuilder;
module.exports.PromptBuilder = PromptBuilder;
module.exports.createPromptBuilder = createPromptBuilder;
module.exports.safeJSONParse = safeJSONParse;
module.exports.LOW_CONFIDENCE_THRESHOLD = LOW_CONFIDENCE_THRESHOLD;
module.exports.CLOSE_RACE_SCORE_DELTA = CLOSE_RACE_SCORE_DELTA;
module.exports.STRONG_SCORE_THRESHOLD = STRONG_SCORE_THRESHOLD;
module.exports.PATTERN_REINFORCEMENT_THRESHOLD = PATTERN_REINFORCEMENT_THRESHOLD;
module.exports.MAX_SUGGESTIONS = MAX_SUGGESTIONS;
module.exports.DARK_KEYWORDS = DARK_KEYWORDS;
