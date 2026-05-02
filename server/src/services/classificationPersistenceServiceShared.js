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

function buildRagLoopSummary(result = {}) {
	const trace = result?.ragLoopTrace || null;
	const logContext = result?.ragLoopLogContext || null;
	const events = Array.isArray(logContext?.events)
		? logContext.events
		: (Array.isArray(trace?.events) ? trace.events : []);

	if (!trace && events.length === 0) {
		return null;
	}

	const pickStageEvent = (stage) => {
		const stageEvents = events.filter((event) => event?.stage === stage);
		if (stageEvents.length === 0) {
			return null;
		}

		const preferred = stageEvents
			.slice()
			.reverse()
			.find((event) => event?.outcome !== 'retry' && !(stage === 'gate' && event?.outcome === 'strategy_selected'));

		const selected = preferred || stageEvents[stageEvents.length - 1];
		return {
			outcome: selected?.outcome || null,
			reason_code: selected?.reason_code || selected?.reasonCode || selected?.reason || null,
		};
	};

	const useFallbackDecision = trace === null && events.length > 0;
	const decisionOutcome = trace?.decision?.outcome || (useFallbackDecision ? 'baseline' : null);
	const pass1Diagnostics = trace?.diagnostics?.pass1 || {};
	const pass2Diagnostics = trace?.diagnostics?.pass2 || {};

	return {
		ran: trace?.ran === true || events.length > 0,
		mode: trace?.mode || logContext?.mode || null,
		trigger: trace?.trigger || logContext?.trigger || null,
		strategy: trace?.strategy || logContext?.strategy || null,
		decision_outcome: decisionOutcome,
		decision_reason: trace?.decision?.reason || (useFallbackDecision ? 'not_ran' : null),
		comparator: trace?.decision?.comparator || null,
		adopted: decisionOutcome === 'pass2' || decisionOutcome === 'policy',
		had_error: events.some((event) => event?.outcome === 'error'),
		pass1_match_count: Number.isFinite(Number(pass1Diagnostics.match_count ?? pass1Diagnostics.matchCount))
			? Number(pass1Diagnostics.match_count ?? pass1Diagnostics.matchCount)
			: null,
		pass1_top_similarity: Number.isFinite(Number(pass1Diagnostics.top_similarity ?? pass1Diagnostics.topSimilarity))
			? Number(pass1Diagnostics.top_similarity ?? pass1Diagnostics.topSimilarity)
			: null,
		pass2_match_count: Number.isFinite(Number(pass2Diagnostics.match_count ?? pass2Diagnostics.matchCount))
			? Number(pass2Diagnostics.match_count ?? pass2Diagnostics.matchCount)
			: null,
		pass2_top_similarity: Number.isFinite(Number(pass2Diagnostics.top_similarity ?? pass2Diagnostics.topSimilarity))
			? Number(pass2Diagnostics.top_similarity ?? pass2Diagnostics.topSimilarity)
			: null,
		stages: {
			gate: pickStageEvent('gate'),
			enrichment: pickStageEvent('enrichment'),
			retrieval_pass2: pickStageEvent('retrieval_pass2'),
			policy_recheck: pickStageEvent('policy_recheck'),
			ai_rerun: pickStageEvent('ai_rerun'),
		},
	};
}

module.exports = {
	buildRagLoopSummary,
};
