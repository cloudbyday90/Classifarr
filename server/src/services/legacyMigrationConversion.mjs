export function determineMatchField(conditions) {
    if (conditions.field) return conditions.field;
    if (conditions.studio) return 'studio';
    if (conditions.collection) return 'collection';
    if (conditions.network) return 'network';
    if (conditions.genres) return 'genres';
    if (conditions.keywords) return 'keywords';
    if (conditions.certification) return 'certification';
    if (conditions.tmdb_id) return 'tmdb_id';
    return 'custom';
}

export function determineMatchValue(conditions) {
    if (conditions.value) {
        return Array.isArray(conditions.value)
            ? conditions.value.join('|')
            : conditions.value;
    }

    if (conditions.studio) return conditions.studio;
    if (conditions.collection) return conditions.collection;
    if (conditions.network) return conditions.network;

    if (conditions.genres) {
        return Array.isArray(conditions.genres)
            ? conditions.genres.join('|')
            : conditions.genres;
    }
    if (conditions.keywords) {
        return Array.isArray(conditions.keywords)
            ? conditions.keywords.join('|')
            : conditions.keywords;
    }
    if (conditions.certification) return conditions.certification;
    if (conditions.tmdb_id) return conditions.tmdb_id.toString();

    return JSON.stringify(conditions);
}

export function ruleToOverride(rule) {
    const conditions = rule.rule_json || {};

    return {
        override_type: 'include',
        match_field: determineMatchField(conditions),
        match_value: determineMatchValue(conditions),
        priority: rule.priority || 100,
        enabled: true,
        reason: `Migrated from legacy rule: ${rule.name}`,
        original_rule_id: rule.id
    };
}
