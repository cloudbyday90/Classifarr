export async function getCertificationDistribution(db, logger, libraryId) {
    try {
        const result = await db.query(`
            SELECT 
                COALESCE(content_rating, 'Unknown') as certification,
                COUNT(*) as count,
                ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as percentage
            FROM media_server_items
            WHERE library_id = $1
            GROUP BY content_rating
            ORDER BY count DESC
            LIMIT 10
        `, [libraryId]);

        return result.rows;
    } catch (error) {
        logger.error('Failed to get certification distribution', {
            libraryId,
            error: error.message
        });
        return [];
    }
}

export async function getGenreDistribution(db, logger, libraryId) {
    try {
        const result = await db.query(`
            SELECT 
                genre,
                COUNT(*) as count,
                ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as percentage
            FROM media_server_items,
                 unnest(genres) as genre
            WHERE library_id = $1
              AND genres IS NOT NULL
            GROUP BY genre
            ORDER BY count DESC
            LIMIT 10
        `, [libraryId]);

        return result.rows;
    } catch (error) {
        logger.error('Failed to get genre distribution', {
            libraryId,
            error: error.message
        });
        return [];
    }
}

export async function getStudioDistribution(db, logger, libraryId) {
    try {
        const result = await db.query(`
            SELECT 
                COALESCE(studio, 'Unknown') as studio,
                COUNT(*) as count,
                ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as percentage
            FROM media_server_items
            WHERE library_id = $1
            AND studio IS NOT NULL
            AND studio != ''
            GROUP BY studio
            ORDER BY count DESC
            LIMIT 5
        `, [libraryId]);

        return result.rows;
    } catch (error) {
        logger.error('Failed to get studio distribution', {
            libraryId,
            error: error.message
        });
        return [];
    }
}

export async function getLanguageDistribution(db, logger, libraryId) {
    try {
        const result = await db.query(`
            SELECT 
                COALESCE(
                    metadata->>'original_language', 
                    'Unknown'
                ) as language,
                COUNT(*) as count,
                ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as percentage
            FROM media_server_items
            WHERE library_id = $1
            GROUP BY metadata->>'original_language'
            ORDER BY count DESC
            LIMIT 5
        `, [libraryId]);

        return result.rows;
    } catch (error) {
        logger.error('Failed to get language distribution', {
            libraryId,
            error: error.message
        });
        return [];
    }
}

export async function getTotalItems(db, logger, libraryId) {
    try {
        const result = await db.query(`
            SELECT COUNT(*)::int as total
            FROM media_server_items
            WHERE library_id = $1
        `, [libraryId]);

        return result.rows[0]?.total || 0;
    } catch (error) {
        logger.error('Failed to get total items', {
            libraryId,
            error: error.message
        });
        return 0;
    }
}
