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

const policyQuestionBuilder = require('./policyQuestionBuilder');

function normalizeSettings(settings) {
	if (!settings) {
		return {};
	}
	if (typeof settings === 'string') {
		try {
			const parsed = JSON.parse(settings);
			return parsed && typeof parsed === 'object' ? parsed : {};
		} catch (_error) {
			return {};
		}
	}
	return settings;
}

function parseStrictInteger(value) {
	if (typeof value === 'number') {
		return Number.isSafeInteger(value) ? value : null;
	}

	if (typeof value !== 'string') {
		return null;
	}

	const normalized = value.trim();
	if (!/^\d+$/.test(normalized)) {
		return null;
	}

	const parsed = Number.parseInt(normalized, 10);
	return Number.isSafeInteger(parsed) ? parsed : null;
}

function parsePositiveInteger(value) {
	const parsed = parseStrictInteger(value);
	return parsed !== null && parsed > 0 ? parsed : null;
}

function parseNonNegativeInteger(value) {
	const parsed = parseStrictInteger(value);
	return parsed !== null && parsed >= 0 ? parsed : null;
}

function normalizeQualityProfileId(value) {
	return parsePositiveInteger(value);
}

function isSettingsEmpty(settings) {
	const normalized = normalizeSettings(settings);
	return !normalized || Object.keys(normalized).length === 0;
}

function suggestSeriesType(metadata, appliedLabels = []) {
	if (appliedLabels.includes('anime') ||
		(metadata.original_language === 'ja' && appliedLabels.includes('animation'))) {
		return 'anime';
	}

	const dailyLabels = ['late_night', 'talk', 'news', 'game_show', 'soap_opera'];
	if (dailyLabels.some((label) => appliedLabels.includes(label))) {
		return 'daily';
	}

	return 'standard';
}

async function ensureDecisionQuestion({ metadata, result, policyResult = null, libraries = [], ragContext = null }) {
	if (!result || result.needs_retry) {
		return result;
	}

	const requiresDecisionQuestion = Boolean(
		result.needs_clarification ||
		result.method === 'fallback' ||
		(result.confidence && result.confidence < 70)
	);

	if (!requiresDecisionQuestion) {
		result.needs_clarification = false;
		result.clarification = null;
		result.policy_question = null;
		result.pending_reason = null;
		return result;
	}

	const existingQuestion = result.policy_question || result.clarification || null;
	if (existingQuestion) {
		result.needs_clarification = true;
		result.clarification = result.clarification || existingQuestion;
		result.policy_question = result.policy_question || existingQuestion;
		result.pending_reason = result.pending_reason || existingQuestion.problem_summary || result.reason || null;
		return result;
	}

	const effectivePolicyResult = result.policyResult || policyResult || null;
	const policyQuestion = await policyQuestionBuilder.build({
		metadata,
		policyResult: effectivePolicyResult,
		libraries,
		suggestedLibrary: result.library || null,
		ragContext,
		aiResult: result,
		relatedEvidenceSummary: result.signalContext?.relatedEvidenceSummary ?? null,
	});

	if (policyQuestion) {
		result.needs_clarification = true;
		result.clarification = policyQuestion;
		result.policy_question = policyQuestion;
		result.pending_reason = policyQuestion.problem_summary;
	}

	return result;
}

module.exports = {
	ensureDecisionQuestion,
	isSettingsEmpty,
	normalizeQualityProfileId,
	normalizeSettings,
	parseNonNegativeInteger,
	parsePositiveInteger,
	suggestSeriesType,
};
