/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { normalizeMetadataListLower } from '../utils/metadataNormalization.mjs';

const logger = createLogger('SchedulerService');

export async function runAutoLearnRules() {
    try {
        const result = await db.query(`
            SELECT l.id, l.name, l.media_type, COUNT(msi.id) as item_count
            FROM libraries l
            LEFT JOIN media_server_items msi ON l.id = msi.library_id
            LEFT JOIN library_rules lr ON l.id = lr.library_id
            WHERE l.is_active = true
            GROUP BY l.id, l.name, l.media_type
            HAVING COUNT(msi.id) >= 50 AND COUNT(lr.id) = 0
        `);

        if (result.rows.length === 0) {
            logger.debug('Auto-learn: No libraries need rule learning');
            return;
        }

        logger.info(`Auto-learn: Found ${result.rows.length} libraries ready for rule learning`);

        for (const library of result.rows) {
            try {
                logger.info(`Auto-learn: Learning rules for library "${library.name}" (${library.item_count} items)`);

                const analysis = await db.query(`
                    SELECT 
                        array_agg(DISTINCT content_rating) FILTER (WHERE content_rating IS NOT NULL) as ratings,
                        array_agg(DISTINCT g) FILTER (WHERE g IS NOT NULL) as genres,
                        array_agg(DISTINCT msi.metadata->>'original_language') FILTER (WHERE msi.metadata->>'original_language' IS NOT NULL) as languages
                    FROM media_server_items msi
                        LEFT JOIN LATERAL UNNEST(msi.genres) as g ON true
                    WHERE msi.library_id = $1
                `, [library.id]);

                const keywordAnalysis = await db.query(`
                    SELECT 
                        COUNT(*) FILTER (WHERE LOWER(title) LIKE '%christmas%' OR LOWER(title) LIKE '%xmas%') as christmas_count,
                        COUNT(*) FILTER (WHERE LOWER(title) LIKE '%holiday%') as holiday_count,
                        COUNT(*) FILTER (WHERE LOWER(title) LIKE '%hallmark%' OR LOWER(msi.studio) LIKE '%hallmark%') as hallmark_count,
                        COUNT(*) as total
                    FROM media_server_items msi
                    WHERE msi.library_id = $1
                `, [library.id]);

                const data = analysis.rows[0];
                const kw = keywordAnalysis.rows[0];
                const total = parseInt(kw.total) || 1;

                const rulesToInsert = [];

                if (data.ratings && data.ratings.length > 0 && data.ratings.length <= 5) {
                    rulesToInsert.push({
                        rule_type: 'rating',
                        operator: 'includes',
                        value: data.ratings.join(','),
                        description: `Auto: Ratings ${data.ratings.join(', ')}`
                    });
                }

                if (data.genres && data.genres.length > 0 && data.genres.length <= 10) {
                    const topGenres = data.genres.slice(0, 5);
                    rulesToInsert.push({
                        rule_type: 'genre',
                        operator: 'includes',
                        value: topGenres.join(','),
                        description: `Auto: Genres ${topGenres.join(', ')}`
                    });
                }

                if (data.languages && data.languages.length === 1 && data.languages[0] !== 'en') {
                    rulesToInsert.push({
                        rule_type: 'language',
                        operator: 'equals',
                        value: data.languages[0],
                        description: `Auto: Language ${data.languages[0]}`
                    });
                }

                const christmasRatio = parseInt(kw.christmas_count) / total;
                const holidayRatio = parseInt(kw.holiday_count) / total;
                const hallmarkRatio = parseInt(kw.hallmark_count) / total;

                if (christmasRatio >= 0.3) {
                    rulesToInsert.push({
                        rule_type: 'keyword',
                        operator: 'contains',
                        value: 'christmas,xmas,holiday,santa,snowman,elf',
                        description: 'Auto: Christmas Content'
                    });
                } else if (holidayRatio >= 0.3) {
                    rulesToInsert.push({
                        rule_type: 'keyword',
                        operator: 'contains',
                        value: 'holiday,christmas,seasonal',
                        description: 'Auto: Holiday Content'
                    });
                }

                if (hallmarkRatio >= 0.3) {
                    rulesToInsert.push({
                        rule_type: 'keyword',
                        operator: 'contains',
                        value: 'hallmark',
                        description: 'Auto: Hallmark Productions'
                    });
                }

                const libraryName = library.name.toLowerCase();
                const normalizedGenres = normalizeMetadataListLower(data.genres);
                const hasAnimeGenre = normalizedGenres.includes('animation')
                    || normalizedGenres.includes('anime')
                    || normalizedGenres.some((g) => g.includes('anime'));
                const isJapanese = data.languages && data.languages.includes('ja');
                const libraryIsAnime = libraryName.includes('anime');

                if ((hasAnimeGenre && isJapanese) || (hasAnimeGenre && libraryIsAnime)) {
                    rulesToInsert.push({
                        rule_type: 'language',
                        operator: 'equals',
                        value: 'ja',
                        description: 'Auto: Japanese Anime Content'
                    });
                    rulesToInsert.push({
                        rule_type: 'genre',
                        operator: 'includes',
                        value: 'Animation,Anime',
                        description: 'Auto: Anime/Animation'
                    });
                }

                const rulesCreated = rulesToInsert.length;
                if (rulesCreated > 0) {
                    await db.query(`
                        INSERT INTO library_rules
                            (library_id, rule_type, operator, value, description, is_exception, is_active, priority)
                        SELECT $1,
                               UNNEST($2::text[]),
                               UNNEST($3::text[]),
                               UNNEST($4::text[]),
                               UNNEST($5::text[]),
                               false, true, 10
                        ON CONFLICT DO NOTHING
                    `, [
                        library.id,
                        rulesToInsert.map((r) => r.rule_type),
                        rulesToInsert.map((r) => r.operator),
                        rulesToInsert.map((r) => r.value),
                        rulesToInsert.map((r) => r.description)
                    ]);
                }

                logger.info(`Auto-learn: Created ${rulesCreated} rules for "${library.name}"`);
            } catch (libError) {
                logger.error(`Auto-learn: Failed to learn rules for ${library.name}`, { error: libError.message });
            }
        }
    } catch (error) {
        logger.error('Error running auto-learn rules', { error: error.message });
    }
}
