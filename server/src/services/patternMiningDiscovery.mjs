export function extractPatternValue(rawValue) {
    if (!rawValue) {
        return null;
    }

    if (typeof rawValue !== 'string') {
        return rawValue;
    }

    try {
        const parsed = JSON.parse(rawValue);
        if (parsed && typeof parsed === 'object') {
            return parsed.name || parsed.tag || parsed.title || null;
        }
        return parsed;
    } catch {
        return rawValue;
    }
}

export async function discoverStudioPatterns(db, logger, extractValue, upsertPattern) {
    try {
        const result = await db.query(`
            WITH normalized_studios AS (
                SELECT
                    CASE
                        WHEN jsonb_typeof(company) = 'object'
                            THEN COALESCE(company->>'name', company->>'tag', company->>'title')
                        WHEN jsonb_typeof(company) = 'string'
                            THEN trim(both '"' from company::text)
                        ELSE NULL
                    END AS studio,
                    ch.library_id,
                    ch.library_name
                FROM classification_history ch
                CROSS JOIN LATERAL jsonb_array_elements(
                    CASE
                        WHEN jsonb_typeof(ch.metadata->'production_companies') = 'array'
                            THEN ch.metadata->'production_companies'
                        ELSE '[]'::jsonb
                    END
                ) AS company
                WHERE ch.library_id IS NOT NULL
                AND ch.metadata->'production_companies' IS NOT NULL
            )
            SELECT
                studio,
                library_id,
                library_name,
                COUNT(*) as support_count,
                COUNT(*) * 100.0 / NULLIF((
                    SELECT COUNT(*)
                    FROM classification_history ch2
                    WHERE ch2.library_id = normalized_studios.library_id
                ), 0) as confidence
            FROM normalized_studios
            WHERE studio IS NOT NULL
            GROUP BY studio, library_id, library_name
            HAVING COUNT(*) >= 3
            AND COUNT(*) * 100.0 / NULLIF((
                SELECT COUNT(*)
                FROM classification_history ch2
                WHERE ch2.library_id = normalized_studios.library_id
            ), 0) >= 70.0
        `);

        let discovered = 0;
        for (const row of result.rows) {
            try {
                const studioName = extractValue(row.studio);
                if (!studioName) {
                    continue;
                }

                await upsertPattern(
                    'studio',
                    studioName,
                    row.library_id,
                    row.library_name,
                    parseFloat(row.confidence),
                    parseInt(row.support_count)
                );
                discovered++;
            } catch (error) {
                logger.debug('Failed to upsert studio pattern', { error: error.message });
            }
        }

        return { discovered };
    } catch (error) {
        logger.error('Studio pattern discovery failed', { error: error.message });
        return { discovered: 0, error: error.message };
    }
}

export async function discoverFranchisePatterns(db, logger, upsertPattern) {
    try {
        const result = await db.query(`
            SELECT 
                CASE 
                    WHEN jsonb_typeof(metadata->'belongs_to_collection') = 'object' 
                    THEN metadata->'belongs_to_collection'->>'name'
                    ELSE metadata->>'belongs_to_collection'
                END as franchise,
                library_id,
                library_name,
                COUNT(*) as support_count,
                COUNT(*) * 100.0 / NULLIF((
                    SELECT COUNT(*) 
                    FROM classification_history ch2 
                    WHERE ch2.library_id = ch.library_id
                ), 0) as confidence
            FROM classification_history ch
            WHERE library_id IS NOT NULL
            AND metadata->'belongs_to_collection' IS NOT NULL
            GROUP BY franchise, library_id, library_name
            HAVING COUNT(*) >= 2
            AND COUNT(*) * 100.0 / NULLIF((
                SELECT COUNT(*) 
                FROM classification_history ch2 
                WHERE ch2.library_id = ch.library_id
            ), 0) >= 80.0
        `);

        let discovered = 0;
        for (const row of result.rows) {
            if (row.franchise) {
                try {
                    await upsertPattern(
                        'franchise',
                        row.franchise,
                        row.library_id,
                        row.library_name,
                        parseFloat(row.confidence),
                        parseInt(row.support_count)
                    );
                    discovered++;
                } catch (error) {
                    logger.debug('Failed to upsert franchise pattern', { error: error.message });
                }
            }
        }

        return { discovered };
    } catch (error) {
        logger.error('Franchise pattern discovery failed', { error: error.message });
        return { discovered: 0, error: error.message };
    }
}

export async function discoverGenrePatterns(db, logger, extractValue, upsertPattern) {
    try {
        const result = await db.query(`
            WITH normalized_genres AS (
                SELECT
                    CASE
                        WHEN jsonb_typeof(genre_item) = 'object'
                            THEN COALESCE(genre_item->>'name', genre_item->>'tag', genre_item->>'title')
                        WHEN jsonb_typeof(genre_item) = 'string'
                            THEN trim(both '"' from genre_item::text)
                        ELSE NULL
                    END AS genre,
                    ch.library_id,
                    ch.library_name
                FROM classification_history ch
                CROSS JOIN LATERAL jsonb_array_elements(
                    CASE
                        WHEN jsonb_typeof(ch.metadata->'genres') = 'array'
                            THEN ch.metadata->'genres'
                        ELSE '[]'::jsonb
                    END
                ) AS genre_item
                WHERE ch.library_id IS NOT NULL
                AND ch.metadata->'genres' IS NOT NULL
            )
            SELECT
                genre,
                library_id,
                library_name,
                COUNT(*) as support_count,
                COUNT(*) * 100.0 / NULLIF((
                    SELECT COUNT(*)
                    FROM classification_history ch2
                    WHERE ch2.library_id = normalized_genres.library_id
                ), 0) as confidence
            FROM normalized_genres
            WHERE genre IS NOT NULL
            GROUP BY genre, library_id, library_name
            HAVING COUNT(*) >= 5
            AND COUNT(*) * 100.0 / NULLIF((
                SELECT COUNT(*)
                FROM classification_history ch2
                WHERE ch2.library_id = normalized_genres.library_id
            ), 0) >= 60.0
        `);

        let discovered = 0;
        for (const row of result.rows) {
            try {
                const genreName = extractValue(row.genre);
                if (!genreName) {
                    continue;
                }

                await upsertPattern(
                    'genre',
                    genreName,
                    row.library_id,
                    row.library_name,
                    parseFloat(row.confidence),
                    parseInt(row.support_count)
                );
                discovered++;
            } catch (error) {
                logger.debug('Failed to upsert genre pattern', { error: error.message });
            }
        }

        return { discovered };
    } catch (error) {
        logger.error('Genre pattern discovery failed', { error: error.message });
        return { discovered: 0, error: error.message };
    }
}

export async function discoverCertificationPatterns(db, logger, upsertPattern) {
    try {
        const result = await db.query(`
            SELECT 
                metadata->>'certification' as certification,
                library_id,
                library_name,
                COUNT(*) as support_count,
                COUNT(*) * 100.0 / NULLIF((
                    SELECT COUNT(*) 
                    FROM classification_history ch2 
                    WHERE ch2.library_id = ch.library_id
                ), 0) as confidence
            FROM classification_history ch
            WHERE library_id IS NOT NULL
            AND metadata->>'certification' IS NOT NULL
            AND metadata->>'certification' != ''
            GROUP BY certification, library_id, library_name
            HAVING COUNT(*) >= 5
            AND COUNT(*) * 100.0 / NULLIF((
                SELECT COUNT(*) 
                FROM classification_history ch2 
                WHERE ch2.library_id = ch.library_id
            ), 0) >= 65.0
        `);

        let discovered = 0;
        for (const row of result.rows) {
            try {
                await upsertPattern(
                    'certification',
                    row.certification,
                    row.library_id,
                    row.library_name,
                    parseFloat(row.confidence),
                    parseInt(row.support_count)
                );
                discovered++;
            } catch (error) {
                logger.debug('Failed to upsert certification pattern', { error: error.message });
            }
        }

        return { discovered };
    } catch (error) {
        logger.error('Certification pattern discovery failed', { error: error.message });
        return { discovered: 0, error: error.message };
    }
}
