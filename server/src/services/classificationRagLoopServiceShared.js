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

const path = require('path');

const ROOT_PACKAGE_PATH = path.resolve(__dirname, '../../../package.json');

let APP_VERSION = 'unknown';
try {
	APP_VERSION = require(ROOT_PACKAGE_PATH).version || 'unknown';
} catch {
	APP_VERSION = 'unknown';
}

function getCurrentAppVersion(appVersion = APP_VERSION) {
	return process.env.APP_VERSION || appVersion || 'unknown';
}

function getCurrentImageTag() {
	return process.env.IMAGE_TAG || process.env.DOCKER_IMAGE_TAG || null;
}

function buildAutoFallbackIncidentPayload({
	incidentId,
	triggeredAt,
	evaluation,
	previousMode,
	nextMode,
	currentVersion,
	imageTag,
	diagnostics,
	stateSnapshot,
}) {
	return {
		incident_id: incidentId,
		triggered_at: triggeredAt,
		from_mode: previousMode,
		to_mode: nextMode,
		app_version: currentVersion,
		image_tag: imageTag || null,
		node_version: process.version,
		thresholds: evaluation.thresholds,
		observed_metrics: {
			...evaluation.observedMetrics,
			consecutive_breach_reason_codes: evaluation.breachReasonCodes,
		},
		top_reason_codes: diagnostics.topReasonCodes,
		recent_correlation_ids: diagnostics.recentCorrelationIds,
		fallback_state: {
			auto_fallback_enabled: stateSnapshot.autoFallbackEnabled,
			auto_recover_enabled: stateSnapshot.autoRecoverEnabled,
			cooldown_until: stateSnapshot.cooldownUntil || null,
		},
		redaction_version: 1,
	};
}

function buildFreshSecondPassBaseResult(baselineResult = {}) {
	return {
		...baselineResult,
		needs_clarification: false,
		clarification: null,
		policy_question: null,
		pending_reason: null,
	};
}

function buildPolicyRecheckCandidate({
	baselineResult = {},
	libraries = [],
	policyResult,
	ragContext,
	adoptionReason,
}) {
	const preferredLibraryId =
		policyResult?.library?.library_id ||
		policyResult?.ranked?.[0]?.library_id ||
		baselineResult?.library?.id ||
		null;
	const nextLibrary = libraries.find((library) => library.id === preferredLibraryId) || baselineResult.library || null;
	const nextAction = policyResult?.action || null;
	const shouldClarify = nextAction === 'prompt_confirm' || nextAction === 'prompt_select';
	const nextResult = buildFreshSecondPassBaseResult(baselineResult);

	return {
		...nextResult,
		library: nextLibrary,
		confidence: Math.max(
			Number(baselineResult?.confidence || 0),
			Number(policyResult?.confidence || 0),
		),
		method: nextAction === 'auto_classify' ? 'policy_auto' : 'policy_recheck',
		reason: adoptionReason || `Policy re-check: ${nextAction || 'updated'}`,
		needs_clarification: shouldClarify,
		policyResult: policyResult || baselineResult.policyResult,
		ragContext: ragContext || baselineResult.ragContext,
	};
}

function buildAiRerunCandidate({
	baselineResult = {},
	aiRerunMatch = {},
	libraries,
	signalContext,
	policyResult,
	ragContext,
}) {
	const nextResult = buildFreshSecondPassBaseResult(baselineResult);

	return {
		...nextResult,
		...aiRerunMatch,
		method: aiRerunMatch.verified_by_ai ? 'ai_verified' : 'ai_rerun',
		libraries: baselineResult.libraries || libraries,
		signalContext: baselineResult.signalContext || signalContext || null,
		policyResult: policyResult || baselineResult.policyResult || null,
		ragContext: ragContext || baselineResult.ragContext || null,
	};
}

module.exports = {
	APP_VERSION,
	getCurrentAppVersion,
	getCurrentImageTag,
	buildAutoFallbackIncidentPayload,
	buildFreshSecondPassBaseResult,
	buildPolicyRecheckCandidate,
	buildAiRerunCandidate,
};
