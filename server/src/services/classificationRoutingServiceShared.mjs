import { policyQuestionBuilder } from './policyQuestionBuilder.mjs';
import { isRequireAllConfirmationsEnabled } from './clarificationThresholdManager.mjs';
import { normalizePolicyDecisionThresholds } from '../utils/policyThresholds.mjs';
import { normalizePolicyRuntimeQuestion } from './policyRuntimeQuestionNormalizer.mjs';
import { requiresProviderRecoveryReview } from './classificationProviderRecovery.mjs';

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

function normalizeLibraryIdentifier(value) {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return String(value);
	}

	if (typeof value === 'string' && value.trim()) {
		return value.trim();
	}

	return null;
}

function getResultLibraryIdentifier(result = {}) {
	return normalizeLibraryIdentifier(
		result?.library?.id ?? result?.library?.library_id ?? result?.library_id,
	);
}

function getPolicyLibraryIdentifier(policyResult = {}) {
	const directLibraryIdentifier = normalizeLibraryIdentifier(
		policyResult?.library?.library_id ?? policyResult?.library?.id,
	);
	if (directLibraryIdentifier) {
		return directLibraryIdentifier;
	}

	return normalizeLibraryIdentifier(
		policyResult?.ranked?.[0]?.library_id ?? policyResult?.ranked?.[0]?.id,
	);
}

/**
 * A policy-auto route must originate from the current deterministic policy
 * evaluation, not from a method label carried by an upstream candidate.
 */
export function isCurrentDeterministicPolicyAuto(result = {}) {
	if (result?.method !== 'policy_auto' || result?.policyResult?.action !== 'auto_classify') {
		return false;
	}

	const resultLibraryIdentifier = getResultLibraryIdentifier(result);
	const policyLibraryIdentifier = getPolicyLibraryIdentifier(result.policyResult);

	return Boolean(
		resultLibraryIdentifier &&
		policyLibraryIdentifier &&
		resultLibraryIdentifier === policyLibraryIdentifier,
	);
}

/**
 * Model output may inform a candidate, but cannot independently authorize an
 * Arr route. Native policy evaluation remains a separately deterministic path.
 */
export function isAiAuthorityRoutingBlocked(result = {}) {
	const method = typeof result?.method === 'string' ? result.method : '';
	const isAiDerivedMethod = /^ai(?:_|$)/.test(method);

	return Boolean(
		isAiDerivedMethod ||
		result?.ai_authority?.sideEffects?.canRoute === false,
	);
}

export async function ensureDecisionQuestion({ metadata, result, policyResult = null, libraries = [], ragContext = null }) {
	if (!result || result.needs_retry) {
		return result;
	}

	const effectivePolicyResult = result.policyResult || policyResult || null;
	const requiresManualReview = Boolean(effectivePolicyResult?.decisionDiagnostics?.requires_manual_review);
	const requiresAuthorityReview = isAiAuthorityRoutingBlocked(result);
	const requiresRecoveryReview = requiresProviderRecoveryReview(result);
	const requiresPolicyProvenanceReview =
		result.method === 'policy_auto' && !isCurrentDeterministicPolicyAuto(result);

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
		requiresAuthorityReview ||
		requiresRecoveryReview ||
		requiresPolicyProvenanceReview ||
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
		const normalizedQuestion = normalizePolicyRuntimeQuestion({
			question: existingQuestion,
			metadata,
			result,
			policyResult: effectivePolicyResult,
			libraries,
		});
		result.needs_clarification = true;
		result.clarification = normalizedQuestion;
		result.policy_question = normalizedQuestion;
		result.pending_reason = normalizedQuestion.problem_summary || result.pending_reason || result.reason || null;
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
	result.clarification = normalizedQuestion;
	result.policy_question = normalizedQuestion;
	result.pending_reason = normalizedQuestion.problem_summary;

	return result;
}
