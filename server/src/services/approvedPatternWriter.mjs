/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/** Persist an explicitly approved legacy pattern using the caller's transaction. */
export async function upsertApprovedPattern(client, { type, value, libraryId, libraryName, confidence }) {
    const result = await client.query(`
        INSERT INTO discovered_patterns (
            pattern_type, pattern_value, library_id, library_name, confidence, status
        ) VALUES ($1, $2, $3, $4, $5, 'approved')
        ON CONFLICT (pattern_type, pattern_value, library_id) DO UPDATE
        SET confidence = GREATEST(discovered_patterns.confidence, EXCLUDED.confidence),
            library_name = EXCLUDED.library_name, status = 'approved', updated_at = NOW()
        RETURNING id
    `, [type, value, libraryId, libraryName, confidence]);
    if (!result.rows[0]?.id) throw new Error('Approved pattern was not persisted');
    return result.rows[0].id;
}
