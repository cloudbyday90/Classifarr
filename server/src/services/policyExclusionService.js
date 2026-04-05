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

/**
 * policyExclusionService.js
 *
 * Phase 3 PE-3 extraction: all policy candidate exclusion logic extracted from
 * PolicyEngine. This service is stateless and pure — it never queries the
 * database and never changes classification results.
 *
 * Extracted from policyEngine.js:
 *  - hasStrictSignalConstraint()    (was policyEngine line 659–668)
 *  - getStrictLanguageConflict()    (was policyEngine line 669–703)
 *  - applyMediaTypeFilter()         (was policyEngine evaluateItem lines 88–116)
 *  - detectLanguageConflicts()      (was policyEngine evaluateItem lines 148–198)
 *  - filterValidEvaluations()       (was policyEngine evaluateItem line 197)
 *
 * policyEngine.js delegates to this service. Behavior is unchanged.
 */

class PolicyExclusionService {

  // ── Signal-level checks (pure) ─────────────────────────────────────────────

  /**
   * Returns true when a language signal config is both strict AND has
   * at least one active require_any or exclude constraint. Advisory language
   * configs (strict = false) never hard-block a policy.
   *
   * @param {object|null} config — signals.language config object
   * @returns {boolean}
   */
  hasStrictSignalConstraint(config) {
    if (!config || config.strict !== true) {
      return false;
    }
    const hasRequireAny = Array.isArray(config.require_any) && config.require_any.length > 0;
    const hasExclude    = Array.isArray(config.exclude)     && config.exclude.length > 0;
    return hasRequireAny || hasExclude;
  }

  /**
   * Check whether an item's language conflicts with a preset's strict language
   * config. Returns a conflict descriptor or null when there is no conflict.
   *
   * @param {object|null} config      — signals.language config
   * @param {string}      itemLanguage — item.original_language (already lowercased by caller)
   * @returns {{ type: string, requiredLanguages: string[], excludedLanguages: string[] } | null}
   */
  getStrictLanguageConflict(config, itemLanguage) {
    if (!itemLanguage || !this.hasStrictSignalConstraint(config)) {
      return null;
    }

    const normalizedLanguage = String(itemLanguage).toLowerCase();
    const requiredLanguages  = Array.isArray(config?.require_any)
      ? config.require_any.map(lang => String(lang).toLowerCase())
      : [];
    const excludedLanguages  = Array.isArray(config?.exclude)
      ? config.exclude.map(lang => String(lang).toLowerCase())
      : [];

    if (requiredLanguages.length > 0 && !requiredLanguages.includes(normalizedLanguage)) {
      return { type: 'require_any_mismatch', requiredLanguages, excludedLanguages };
    }

    if (excludedLanguages.includes(normalizedLanguage)) {
      return { type: 'excluded_language', requiredLanguages, excludedLanguages };
    }

    return null;
  }

  // ── Candidate-level filters ────────────────────────────────────────────────

  /**
   * Filter the full policy list to only policies that match the item's
   * media_type. When itemMediaType is absent, all policies pass through
   * (backwards-compatible behaviour).
   *
   * @param {object[]} policies    — full list of active policies
   * @param {string|null} itemMediaType — item.media_type (already lowercased by caller)
   * @returns {{ candidatePolicies: object[], skipped: number }}
   */
  applyMediaTypeFilter(policies, itemMediaType) {
    if (!itemMediaType) {
      return { candidatePolicies: policies, skipped: 0 };
    }

    const candidatePolicies = policies.filter(
      p => p.library_media_type?.toLowerCase() === itemMediaType
    );
    return { candidatePolicies, skipped: policies.length - candidatePolicies.length };
  }

  /**
   * Walk candidate policies and evaluations to detect strict language conflicts.
   * Returns the conflict list and the Set of policy IDs that are hard-blocked.
   *
   * Only explicitly strict language requirements can hard-block a policy.
   * Advisory language configs (strict=false) may lower scores but never exclude.
   *
   * @param {object[]} candidatePolicies — policies after media-type filter
   * @param {object[]} evaluations       — PolicyEngine per-policy score objects
   * @param {string}   itemLanguage      — item.original_language (already lowercased)
   * @returns {{ languageConflicts: object[], languageConflictPolicyIds: Set<number> }}
   */
  detectLanguageConflicts(candidatePolicies, evaluations, itemLanguage) {
    const languageConflicts       = [];
    const languageConflictPolicyIds = new Set();

    if (!itemLanguage) {
      return { languageConflicts, languageConflictPolicyIds };
    }

    const evaluationMap = new Map(evaluations.map(e => [e.policy_id ?? e.id, e]));

    for (const policy of candidatePolicies) {
      for (const preset of (policy.presets || [])) {
        const signals = preset.signals || {};
        const languageConflict = this.getStrictLanguageConflict(signals.language, itemLanguage);
        if (languageConflict) {
          languageConflicts.push({
            policy_id:          policy.id,
            policy_name:        policy.name,
            library_id:         policy.library_id,
            library_name:       policy.library_name,
            score:              evaluationMap.get(policy.id)?.score ?? 0,
            required_languages: languageConflict.requiredLanguages,
            excluded_languages: languageConflict.excludedLanguages,
            item_language:      itemLanguage
          });
          languageConflictPolicyIds.add(policy.id);
          break; // one conflict entry per policy is sufficient
        }
      }
    }

    return { languageConflicts, languageConflictPolicyIds };
  }

  /**
   * Filter the evaluations list to only include policies with score > 0 AND
   * no strict language conflict.
   *
   * @param {object[]} evaluations            — raw scored evaluations
   * @param {Set<number>} languageConflictIds — policy IDs that are hard-blocked
   * @returns {object[]}
   */
  filterValidEvaluations(evaluations, languageConflictIds = new Set()) {
    return evaluations.filter(
      e => e.score > 0 && !languageConflictIds.has(e.policy_id ?? e.id)
    );
  }
}

module.exports = new PolicyExclusionService();
module.exports.PolicyExclusionService = PolicyExclusionService;
