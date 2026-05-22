export async function enrichWithTavily({ db, tavilyService, logger }, item, apiKey) {
    try {
        const searchQuery = item.imdb_id
            ? `IMDb ${item.imdb_id}`
            : `${item.title} ${item.year || ''} IMDb rating`;

        const searchResult = await tavilyService.search(searchQuery, {
            apiKey,
            searchDepth: 'basic',
            maxResults: 3
        });

        const results = searchResult?.results || [];
        if (!results || results.length === 0) {
            return { success: false, error: 'No results found' };
        }

        const imdbData = extractImdbData(results, item.title);

        if (imdbData) {
            await db.query(`
          UPDATE media_server_items 
          SET metadata = jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{tavily_imdb}',
            $2::jsonb
          )
          WHERE id = $1
        `, [item.media_item_id, JSON.stringify(imdbData)]);

            return { success: true, data: imdbData };
        }

        return { success: false, error: 'Could not extract IMDb data' };
    } catch (error) {
        if (error.status === 432) {
            logger.info('Tavily monthly quota reached during enrichment retry; deferring item', {
                status: error.status,
                item: item.title
            });
            return {
                success: false,
                error: error.message,
                deferUntilMonthlyReset: true
            };
        }

        logger.error('Tavily enrichment failed', {
            status: error.status || null,
            error: error.message,
            item: item.title
        });
        return { success: false, error: error.message };
    }
}

export function extractImdbData(results, _title) {
    for (const result of results) {
        const content = result.content || result.snippet || '';
        const url = result.url || '';

        const imdbMatch = url.match(/imdb\.com\/title\/(tt\d+)/i);

        if (imdbMatch) {
            const data = {
                imdb_id: imdbMatch[1],
                source: 'tavily',
                url: url,
                fetched_at: new Date().toISOString()
            };

            const ratingMatch = content.match(/(\d+\.?\d*)\/10/);
            if (ratingMatch) {
                data.rating = parseFloat(ratingMatch[1]);
            }

            const genrePatterns = [
                /\b(Action|Adventure|Animation|Biography|Comedy|Crime|Documentary|Drama|Family|Fantasy|History|Horror|Music|Musical|Mystery|Romance|Sci-Fi|Sport|Thriller|War|Western)\b/gi
            ];
            const genres = [];
            for (const pattern of genrePatterns) {
                const matches = content.match(pattern);
                if (matches) {
                    genres.push(...matches.map(g => g.charAt(0).toUpperCase() + g.slice(1).toLowerCase()));
                }
            }
            if (genres.length > 0) {
                data.genres = [...new Set(genres)];
            }

            return data;
        }
    }

    return null;
}
