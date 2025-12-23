/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 * 
 * Scheduler Service
 * Handles periodic background tasks
 */

const cron = require('node-cron');
const db = require('../config/database');
const { createLogger } = require('../utils/logger');
const queueService = require('./queueService');
const mediaSyncService = require('./mediaSync');
const discordBot = require('./discordBot');
const ollamaService = require('./ollama');

const logger = createLogger('SchedulerService');

class SchedulerService {
    constructor() {
        this.tasks = new Map();
    }

    /**
     * Initialize scheduled tasks
     */
    init() {
        logger.info('Initializing scheduler...');

        // Run gap analysis every hour
        // This finds items that haven't been analyzed and queues them
        this.schedule('gap-analysis', '0 * * * *', () => this.runGapAnalysis());

        // Also run on startup after a delay
        setTimeout(() => this.runGapAnalysis(), 30000); // 30s delay

        // Run library watchdog every 5 minutes to catch empty libraries
        this.schedule('library-watchdog', '*/5 * * * *', () => this.runLibraryWatchdog());

        // Run watchdog shortly after startup
        setTimeout(() => this.runLibraryWatchdog(), 5000);

        // Auto-learn rules every 30 minutes for libraries with enough content
        this.schedule('auto-learn-rules', '*/30 * * * *', () => this.runAutoLearnRules());

        // Run auto-learn after startup (2 min delay to let gap analysis start first)
        setTimeout(() => this.runAutoLearnRules(), 120000);

        // Smart suggestion notifications every 2 hours
        this.schedule('smart-suggestion-check', '0 */2 * * *', () => this.runSmartSuggestionCheck());

        // Run smart suggestions after startup (5 min delay)
        setTimeout(() => this.runSmartSuggestionCheck(), 300000);
    }

    /**
     * Schedule a task
     * @param {string} name - Task name
     * @param {string} cronExpression - Cron expression
     * @param {Function} handler - Task handler
     */
    schedule(name, cronExpression, handler) {
        if (this.tasks.has(name)) {
            this.tasks.get(name).stop();
        }

        const task = cron.schedule(cronExpression, async () => {
            logger.info(`Starting scheduled task: ${name}`);
            try {
                await handler();
                logger.info(`Completed scheduled task: ${name}`);
            } catch (error) {
                logger.error(`Failed scheduled task: ${name}`, { error: error.message });
            }
        });

        this.tasks.set(name, task);
        logger.info(`Scheduled task registered: ${name} (${cronExpression})`);
    }

    /**
     * Run Gap Analysis specifically
     */
    async runGapAnalysis() {
        try {
            // Find items that have NO content analysis
            // Limit to 500 at a time to prevent flooding the queue
            const result = await db.query(
                `SELECT msi.id, msi.title, msi.metadata, msi.genres, msi.tags, msi.content_rating, msi.tmdb_id,
                        msi.library_id, l.name as library_name, l.media_type
         FROM media_server_items msi
         JOIN libraries l ON msi.library_id = l.id
         WHERE msi.metadata->'content_analysis' IS NULL
         LIMIT 500`
            );

            if (result.rows.length === 0) {
                logger.debug('Gap analysis: No unanalyzed items found');
                return;
            }

            logger.info(`Gap analysis: Found ${result.rows.length} unanalyzed items. Queueing for analysis...`);

            for (const item of result.rows) {
                await queueService.enqueue('classification', {
                    title: item.title,
                    overview: item.metadata?.summary || '',
                    genres: typeof item.genres === 'string' ? JSON.parse(item.genres) : (item.genres || []),
                    keywords: typeof item.tags === 'string' ? JSON.parse(item.tags) : (item.tags || []),
                    content_rating: item.content_rating,
                    original_language: 'en',
                    tmdb_id: item.tmdb_id,
                    itemId: item.id, // Pass internal ID for efficient updating
                    source_library_id: item.library_id, // Pass source library for direct matching
                    source_library_name: item.library_name,
                    media: { media_type: item.media_type || 'movie' } // Include media_type for correct TMDB lookup
                }, {
                    priority: 5, // Lower priority than user actions
                    source: 'gap_analysis'
                });
            }

        } catch (error) {
            logger.error('Error running gap analysis', { error: error.message });
        }
    }

    /**
     * Check for empty libraries and trigger sync
     */
    async runLibraryWatchdog() {
        try {
            // Get all active libraries
            const libraries = await db.query('SELECT id, name FROM libraries WHERE is_active = true');

            for (const library of libraries.rows) {
                // Check if library is empty
                const countResult = await db.query(
                    'SELECT COUNT(*) FROM media_server_items WHERE library_id = $1',
                    [library.id]
                );
                const count = parseInt(countResult.rows[0].count);

                if (count === 0) {
                    // Check if sync is already running
                    const statusResult = await db.query(
                        `SELECT id FROM media_server_sync_status 
                         WHERE library_id = $1 AND status = 'running'
                         ORDER BY created_at DESC LIMIT 1`,
                        [library.id]
                    );

                    if (statusResult.rows.length === 0) {
                        logger.info(`Watchdog: Library ${library.name} (${library.id}) is empty. Triggering auto-sync...`);
                        // Run in background, don't await completion here
                        mediaSyncService.syncLibrary(library.id).catch(err => {
                            logger.error(`Watchdog: Auto-sync failed for ${library.name}`, { error: err.message });
                        });
                    }
                }
            }
        } catch (error) {
            logger.error('Error running library watchdog', { error: error.message });
        }
    }

    /**
     * Auto-learn rules for libraries with enough analyzed content
     * Runs automatically when libraries have 50+ items but no rules
     */
    async runAutoLearnRules() {
        try {
            // Find libraries with 50+ items but no rules
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

                    // Analyze library content patterns
                    const analysis = await db.query(`
                        SELECT 
                            array_agg(DISTINCT content_rating) FILTER (WHERE content_rating IS NOT NULL) as ratings,
                            array_agg(DISTINCT g) FILTER (WHERE g IS NOT NULL) as genres,
                            array_agg(DISTINCT msi.metadata->>'original_language') FILTER (WHERE msi.metadata->>'original_language' IS NOT NULL) as languages
                        FROM media_server_items msi
                            LEFT JOIN LATERAL UNNEST(msi.genres) as g ON true
                        WHERE msi.library_id = $1
                    `, [library.id]);

                    // Analyze keyword patterns
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
                    let rulesCreated = 0;

                    // Create rating rule if consistent
                    if (data.ratings && data.ratings.length > 0 && data.ratings.length <= 5) {
                        await db.query(`
                            INSERT INTO library_rules (library_id, rule_type, operator, value, description, is_exception, is_active, priority)
                            VALUES ($1, 'rating', 'includes', $2, $3, false, true, 10)
                            ON CONFLICT DO NOTHING
                        `, [library.id, data.ratings.join(','), `Auto: Ratings ${data.ratings.join(', ')}`]);
                        rulesCreated++;
                    }

                    // Create genre rule if dominant genres exist
                    if (data.genres && data.genres.length > 0 && data.genres.length <= 10) {
                        const topGenres = data.genres.slice(0, 5);
                        await db.query(`
                            INSERT INTO library_rules (library_id, rule_type, operator, value, description, is_exception, is_active, priority)
                            VALUES ($1, 'genre', 'includes', $2, $3, false, true, 10)
                            ON CONFLICT DO NOTHING
                        `, [library.id, topGenres.join(','), `Auto: Genres ${topGenres.join(', ')}`]);
                        rulesCreated++;
                    }

                    // Create language rule if non-English dominant
                    if (data.languages && data.languages.length === 1 && data.languages[0] !== 'en') {
                        await db.query(`
                            INSERT INTO library_rules (library_id, rule_type, operator, value, description, is_exception, is_active, priority)
                            VALUES ($1, 'language', 'equals', $2, $3, false, true, 10)
                            ON CONFLICT DO NOTHING
                        `, [library.id, data.languages[0], `Auto: Language ${data.languages[0]}`]);
                        rulesCreated++;
                    }

                    // Keyword Rules
                    const christmasRatio = parseInt(kw.christmas_count) / total;
                    const holidayRatio = parseInt(kw.holiday_count) / total;
                    const hallmarkRatio = parseInt(kw.hallmark_count) / total;

                    if (christmasRatio >= 0.3) {
                        await db.query(`
                            INSERT INTO library_rules (library_id, rule_type, operator, value, description, is_exception, is_active, priority)
                            VALUES ($1, 'keyword', 'contains', 'christmas,xmas,holiday,santa,snowman,elf', $2, false, true, 10)
                            ON CONFLICT DO NOTHING
                        `, [library.id, `Auto: Christmas Content`]);
                        rulesCreated++;
                    } else if (holidayRatio >= 0.3) {
                        await db.query(`
                            INSERT INTO library_rules (library_id, rule_type, operator, value, description, is_exception, is_active, priority)
                            VALUES ($1, 'keyword', 'contains', 'holiday,christmas,seasonal', $2, false, true, 10)
                            ON CONFLICT DO NOTHING
                        `, [library.id, `Auto: Holiday Content`]);
                        rulesCreated++;
                    }

                    if (hallmarkRatio >= 0.3) {
                        await db.query(`
                            INSERT INTO library_rules (library_id, rule_type, operator, value, description, is_exception, is_active, priority)
                            VALUES ($1, 'keyword', 'contains', 'hallmark', $2, false, true, 10)
                            ON CONFLICT DO NOTHING
                        `, [library.id, `Auto: Hallmark Productions`]);
                        rulesCreated++;
                    }

                    // Anime Detection
                    const libraryName = library.name.toLowerCase();
                    const hasAnimeGenre = data.genres && (
                        data.genres.includes('Animation') ||
                        data.genres.includes('Anime') ||
                        data.genres.some(g => g && g.toLowerCase().includes('anime'))
                    );
                    const isJapanese = data.languages && data.languages.includes('ja');
                    const libraryIsAnime = libraryName.includes('anime');

                    if ((hasAnimeGenre && isJapanese) || (hasAnimeGenre && libraryIsAnime)) {
                        // Add Japanese language rule if not already present
                        await db.query(`
                            INSERT INTO library_rules (library_id, rule_type, operator, value, description, is_exception, is_active, priority)
                            VALUES ($1, 'language', 'equals', 'ja', 'Auto: Japanese Anime Content', false, true, 10)
                            ON CONFLICT DO NOTHING
                        `, [library.id]);
                        rulesCreated++;

                        // Add Animation/Anime genre rule
                        await db.query(`
                            INSERT INTO library_rules (library_id, rule_type, operator, value, description, is_exception, is_active, priority)
                            VALUES ($1, 'genre', 'includes', 'Animation,Anime', 'Auto: Anime/Animation', false, true, 10)
                            ON CONFLICT DO NOTHING
                        `, [library.id]);
                        rulesCreated++;
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

    /**
     * Check libraries for smart suggestions and notify via Discord
     * Runs every 2 hours to analyze libraries and suggest rules
     */
    async runSmartSuggestionCheck() {
        try {
            // Find libraries with analyzed content but room for new rules
            const result = await db.query(`
                SELECT l.id, l.name, l.media_type,
                       COUNT(msi.id) as total_items,
                       COUNT(msi.id) FILTER (WHERE msi.metadata->'content_analysis' IS NOT NULL) as analyzed_items,
                       (SELECT COUNT(*) FROM library_rules_v2 WHERE library_id = l.id) as rule_count
                FROM libraries l
                LEFT JOIN media_server_items msi ON l.id = msi.library_id
                WHERE l.is_active = true
                GROUP BY l.id, l.name, l.media_type
                HAVING COUNT(msi.id) >= 20
                   AND COUNT(msi.id) FILTER (WHERE msi.metadata->'content_analysis' IS NOT NULL) >= 10
            `);

            if (result.rows.length === 0) {
                logger.debug('Smart suggestion check: No eligible libraries found');
                return;
            }

            logger.info(`Smart suggestion check: Found ${result.rows.length} libraries to analyze`);

            for (const library of result.rows) {
                try {
                    // Generate smart suggestions for this library
                    const suggestions = await this.generateSmartSuggestions(library.id);

                    // Only notify if we have high-confidence suggestions
                    const highConfidence = suggestions.filter(s => s.confidence >= 70);

                    if (highConfidence.length > 0) {
                        logger.info(`Smart suggestion check: Found ${highConfidence.length} high-confidence suggestions for ${library.name}`);

                        // Send Discord notification
                        await discordBot.sendSmartSuggestionNotification(library, highConfidence);
                    }
                } catch (libError) {
                    logger.error(`Smart suggestion check: Failed for ${library.name}`, { error: libError.message });
                }
            }
        } catch (error) {
            logger.error('Error running smart suggestion check', { error: error.message });
        }
    }

    /**
     * Generate smart suggestions for a library using AI analysis
     */
    async generateSmartSuggestions(libraryId) {
        try {
            // Gather content analysis stats
            const statsResult = await db.query(`
                SELECT 
                    l.name as library_name,
                    l.media_type,
                    COUNT(msi.id) as total_items,
                    COUNT(msi.id) FILTER (WHERE msi.metadata->'content_analysis' IS NOT NULL) as analyzed_items
                FROM libraries l
                LEFT JOIN media_server_items msi ON l.id = msi.library_id
                WHERE l.id = $1
                GROUP BY l.id, l.name, l.media_type
            `, [libraryId]);

            if (statsResult.rows.length === 0) return [];
            const stats = statsResult.rows[0];

            // Get content type distribution
            const contentTypes = await db.query(`
                SELECT 
                    msi.metadata->'content_analysis'->>'type' as type,
                    COUNT(*) as count
                FROM media_server_items msi
                WHERE msi.library_id = $1
                  AND msi.metadata->'content_analysis'->>'type' IS NOT NULL
                GROUP BY msi.metadata->'content_analysis'->>'type'
                ORDER BY count DESC
                LIMIT 10
            `, [libraryId]);

            // Get genre distribution
            const genres = await db.query(`
                SELECT g as genre, COUNT(*) as count
                FROM media_server_items msi, UNNEST(msi.genres) as g
                WHERE msi.library_id = $1 AND g IS NOT NULL
                GROUP BY g
                ORDER BY count DESC
                LIMIT 10
            `, [libraryId]);

            // Build data-driven suggestions
            const suggestions = [];

            // Suggest based on dominant content types
            for (const ct of contentTypes.rows) {
                const ratio = parseInt(ct.count) / parseInt(stats.total_items);
                if (ratio >= 0.3) {
                    suggestions.push({
                        name: `${ct.type} Content`,
                        conditions: [{ field: 'content_type', operator: 'equals', value: ct.type }],
                        confidence: Math.round(ratio * 100),
                        reasoning: `${Math.round(ratio * 100)}% of items are classified as ${ct.type}`
                    });
                }
            }

            // Suggest based on dominant genres
            for (const g of genres.rows.slice(0, 3)) {
                const ratio = parseInt(g.count) / parseInt(stats.total_items);
                if (ratio >= 0.4) {
                    suggestions.push({
                        name: `${g.genre} Genre`,
                        conditions: [{ field: 'genre', operator: 'contains', value: g.genre }],
                        confidence: Math.round(ratio * 100),
                        reasoning: `${Math.round(ratio * 100)}% of items have ${g.genre} genre`
                    });
                }
            }

            // Try LLM-enhanced suggestions if Ollama is configured
            try {
                const ollamaConfig = await ollamaService.getConfig();
                if (ollamaConfig.enabled) {
                    const prompt = `Analyze this library data and suggest 2-3 classification rules:
                    Library: "${stats.library_name}" (${stats.media_type})
                    Total Items: ${stats.total_items}, Analyzed: ${stats.analyzed_items}
                    Content Types: ${contentTypes.rows.map(c => `${c.type}: ${c.count}`).join(', ') || 'None'}
                    Top Genres: ${genres.rows.map(g => `${g.genre}: ${g.count}`).join(', ') || 'None'}
                    
                    Respond with JSON only: {"suggestions": [{"name": "...", "confidence": 85, "reasoning": "..."}]}`;

                    const response = await ollamaService.generate(prompt, ollamaConfig.model || 'qwen3:14b', 0.3);
                    const match = response.match(/\{[\s\S]*\}/);
                    if (match) {
                        const parsed = JSON.parse(match[0]);
                        if (parsed.suggestions) {
                            suggestions.push(...parsed.suggestions.filter(s => s.confidence >= 60));
                        }
                    }
                }
            } catch (llmError) {
                logger.debug('LLM suggestions unavailable', { error: llmError.message });
            }

            return suggestions.slice(0, 5); // Max 5 suggestions
        } catch (error) {
            logger.error('Failed to generate smart suggestions', { error: error.message });
            return [];
        }
    }
}

module.exports = new SchedulerService();
