export async function createPolicyEngineIntegrationFixture(db, options = {}) {
    const {
        mediaServerType = 'plex',
        mediaServerName = 'Test Media Server',
        mediaServerUrl = 'http://localhost:32400',
        mediaServerApiKey = 'test-api-key',
        libraryExternalIdPrefix = 'test-policy-lib',
        libraryName = 'Test Policy Library',
        libraryMediaType = 'movie',
        presetKeyPrefix = 'test_action_movies',
        presetName = 'Test Action Movies',
        presetSignals = {},
        policyName = 'Test Policy',
        policyValues = {},
        presetLinkWeight = 1.0,
    } = options;

    const mediaServerResult = await db.query(`
        INSERT INTO media_server (type, name, url, api_key)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING
        RETURNING id
    `, [mediaServerType, mediaServerName, mediaServerUrl, mediaServerApiKey]);

    const insertedMediaServer = mediaServerResult.rows.length > 0;
    const mediaServerId = insertedMediaServer
        ? mediaServerResult.rows[0].id
        : (await db.query('SELECT id FROM media_server LIMIT 1')).rows[0]?.id;

    if (!mediaServerId) {
        throw new Error('Unable to resolve integration media server for policy-engine fixture');
    }

    const libraryResult = await db.query(`
        INSERT INTO libraries (media_server_id, external_id, name, media_type, is_active)
        VALUES ($1, $2 || '-' || gen_random_uuid()::text, $3, $4, true)
        RETURNING id
    `, [mediaServerId, libraryExternalIdPrefix, libraryName, libraryMediaType]);
    const libraryId = libraryResult.rows[0].id;

    const presetResult = await db.query(`
        INSERT INTO content_presets (key, name, signals, is_system)
        VALUES (
            LEFT($1, 41) || '-' || LEFT(REPLACE(gen_random_uuid()::text, '-', ''), 8),
            $2,
            $3::jsonb,
            false
        )
        RETURNING id
    `, [presetKeyPrefix, presetName, JSON.stringify(presetSignals)]);
    const presetId = presetResult.rows[0].id;

    const resolvedPolicyValues = {
        enabled: true,
        auto_classify_threshold: 85,
        prompt_threshold: 60,
        trust_patterns: true,
        trust_rag: true,
        trust_history: true,
        preset_weight: 0.4,
        profile_weight: 0.0,
        pattern_weight: 0.3,
        rag_weight: 0.2,
        history_weight: 0.1,
        ...policyValues,
    };

    const policyResult = await db.query(`
        INSERT INTO library_policies (
            library_id,
            name,
            enabled,
            auto_classify_threshold,
            prompt_threshold,
            trust_patterns,
            trust_rag,
            trust_history,
            preset_weight,
            profile_weight,
            pattern_weight,
            rag_weight,
            history_weight
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
    `, [
        libraryId,
        policyName,
        resolvedPolicyValues.enabled,
        resolvedPolicyValues.auto_classify_threshold,
        resolvedPolicyValues.prompt_threshold,
        resolvedPolicyValues.trust_patterns,
        resolvedPolicyValues.trust_rag,
        resolvedPolicyValues.trust_history,
        resolvedPolicyValues.preset_weight,
        resolvedPolicyValues.profile_weight,
        resolvedPolicyValues.pattern_weight,
        resolvedPolicyValues.rag_weight,
        resolvedPolicyValues.history_weight,
    ]);
    const policyId = policyResult.rows[0].id;

    await db.query(`
        INSERT INTO policy_presets (policy_id, preset_id, weight)
        VALUES ($1, $2, $3)
    `, [policyId, presetId, presetLinkWeight]);

    return {
        mediaServerId,
        libraryId,
        presetId,
        policyId,
        cleanup: async () => {
            await db.query('DELETE FROM policy_presets WHERE policy_id = $1', [policyId]);
            await db.query('DELETE FROM library_policies WHERE id = $1', [policyId]);
            await db.query('DELETE FROM content_presets WHERE id = $1', [presetId]);
            await db.query('DELETE FROM libraries WHERE id = $1', [libraryId]);
            if (insertedMediaServer) {
                await db.query('DELETE FROM media_server WHERE id = $1', [mediaServerId]);
            }
        },
    };
}
