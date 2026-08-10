import { policyQuestionBuilder } from './policyQuestionBuilder.mjs';
import { isRequireAllConfirmationsEnabled } from './clarificationThresholdManager.mjs';
import { normalizePolicyRuntimeQuestion } from './policyRuntimeQuestionNormalizer.mjs';
import {
    evaluateClassificationRouteSafety,
    isAiAuthorityRoutingBlocked,
    isCurrentDeterministicPolicyAuto,
} from './classificationRouteSafetyGate.mjs';

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

export { isAiAuthorityRoutingBlocked, isCurrentDeterministicPolicyAuto };

export async function ensureDecisionQuestion({ metadata, result, policyResult = null, libraries = [], ragContext = null }) {
	if (!result || result.needs_retry) {
		return result;
	}

	const effectivePolicyResult = result.policyResult || policyResult || null;
	const requireAllConfirmations = await isRequireAllConfirmationsEnabled();
	const routeSafety = evaluateClassificationRouteSafety({
		result,
		policyResult: effectivePolicyResult,
		requireAllConfirmations,
	});
	const requiresDecisionQuestion = routeSafety.automatic_route_allowed === false;

	if (!requiresDecisionQuestion) {
		result.route_safety = null;
		result.needs_clarification = false;
		result.clarification = null;
		result.policy_question = null;
		result.pending_reason = null;
		return result;
	}

	const existingQuestion = result.policy_question || result.clarification || null;
	if (existingQuestion) {
		const normalizedQuestion = normalizePolicyRuntimeQuestion({
			question: existingQuestion,
			metadata,
			result,
			policyResult: effectivePolicyResult,
			libraries,
		});
		result.needs_clarification = true;
		result.route_safety = routeSafety;
		result.clarification = normalizedQuestion;
		result.policy_question = normalizedQuestion;
		result.pending_reason = routeSafety.primary_gate?.pendingReason ||
			(normalizedQuestion.problem_summary || result.pending_reason || result.reason || null);
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

	const normalizedQuestion = normalizePolicyRuntimeQuestion({
		question: policyQuestion,
		metadata,
		result,
		policyResult: effectivePolicyResult,
		libraries,
	});
	result.needs_clarification = true;
	result.route_safety = routeSafety;
	result.clarification = normalizedQuestion;
	result.policy_question = normalizedQuestion;
	result.pending_reason = routeSafety.primary_gate?.pendingReason || normalizedQuestion.problem_summary;

	return result;
}
