import { policyQuestionBuilder } from './policyQuestionBuilder.mjs';
import { isRequireAllConfirmationsEnabled } from './clarificationThresholdManager.mjs';
import { normalizePolicyDecisionThresholds } from '../utils/policyThresholds.mjs';

export function normalizeSettings(settings) {
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

export function parsePositiveInteger(value) {
	const parsed = parseStrictInteger(value);
	return parsed !== null && parsed > 0 ? parsed : null;
}

export function parseNonNegativeInteger(value) {
	const parsed = parseStrictInteger(value);
	return parsed !== null && parsed >= 0 ? parsed : null;
}

export function normalizeQualityProfileId(value) {
	return parsePositiveInteger(value);
}

export function isSettingsEmpty(settings) {
	const normalized = normalizeSettings(settings);
	return !normalized || Object.keys(normalized).length === 0;
}

export function suggestSeriesType(metadata, appliedLabels = []) {
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

export async function ensureDecisionQuestion({ metadata, result, policyResult = null, libraries = [], ragContext = null }) {
	if (!result || result.needs_retry) {
		return result;
	}

	const effectivePolicyResult = result.policyResult || policyResult || null;
	const requiresManualReview = Boolean(effectivePolicyResult?.decisionDiagnostics?.requires_manual_review);

	const ranked = effectivePolicyResult?.ranked || [];
	let policyAutoThreshold = null;
	if (result.library?.id && Array.isArray(ranked) && ranked.length > 0) {
		const row = ranked.find((entry) => entry && (entry.library_id === result.library.id || entry.id === result.library.id));
		if (row) {
			policyAutoThreshold = normalizePolicyDecisionThresholds(row).autoClassifyThreshold;
		}
	}

	const belowAutoRouteThreshold = Boolean(
		result.library &&
		result.method !== 'policy_auto' &&
		(typeof policyAutoThreshold !== 'number' || result.confidence < policyAutoThreshold)
	);

	const requireAllConfirmations = await isRequireAllConfirmationsEnabled();

	const requiresDecisionQuestion = Boolean(
		result.needs_clarification ||
		result.method === 'fallback' ||
		(result.confidence && result.confidence < 70) ||
		requiresManualReview ||
		belowAutoRouteThreshold ||
		(result.library && requireAllConfirmations)
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
