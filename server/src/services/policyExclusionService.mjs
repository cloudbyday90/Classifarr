/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
class PolicyExclusionService {

  hasStrictSignalConstraint(config) {
    if (!config || config.strict !== true) {
      return false;
    }
    const hasRequireAny = Array.isArray(config.require_any) && config.require_any.length > 0;
    const hasExclude    = Array.isArray(config.exclude)     && config.exclude.length > 0;
    return hasRequireAny || hasExclude;
  }

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

  applyMediaTypeFilter(policies, itemMediaType) {
    if (!itemMediaType) {
      return { candidatePolicies: policies, skipped: 0 };
    }

    const candidatePolicies = policies.filter(
      p => p.library_media_type?.toLowerCase() === itemMediaType
    );
    return { candidatePolicies, skipped: policies.length - candidatePolicies.length };
  }

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
          break;
        }
      }
    }

    return { languageConflicts, languageConflictPolicyIds };
  }

  filterValidEvaluations(evaluations, languageConflictIds = new Set()) {
    return evaluations.filter(
      e => e.score > 0 && !languageConflictIds.has(e.policy_id ?? e.id)
    );
  }
}

export { PolicyExclusionService };
export const policyExclusionService = new PolicyExclusionService();
