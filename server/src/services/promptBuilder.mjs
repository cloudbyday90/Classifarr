/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import promptBuilderShared from './promptBuilder.shared.js';
import libraryProfileService from './libraryProfileService.mjs';

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

const promptBuilder = createPromptBuilder({ libraryProfileService });

export default promptBuilder;
export {
	PromptBuilder,
	createPromptBuilder,
	safeJSONParse,
	LOW_CONFIDENCE_THRESHOLD,
	CLOSE_RACE_SCORE_DELTA,
	STRONG_SCORE_THRESHOLD,
	PATTERN_REINFORCEMENT_THRESHOLD,
	MAX_SUGGESTIONS,
	DARK_KEYWORDS,
};
