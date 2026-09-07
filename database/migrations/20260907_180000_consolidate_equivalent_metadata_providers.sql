-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Data-only repair: retain every credential row; never reconcile distinct settings.
-- Use the same lock order as backup restore. Migration execution owns the transaction.
LOCK TABLE public.tmdb_config, public.omdb_config, public.tavily_config IN SHARE ROW EXCLUSIVE MODE;

WITH equivalent AS (
    SELECT MAX(id) AS selected_id FROM public.tmdb_config t WHERE is_active = true
    HAVING COUNT(*) > 1 AND COUNT(DISTINCT (to_jsonb(t) - ARRAY['id', 'created_at', 'updated_at'])) = 1
)
UPDATE public.tmdb_config SET is_active = false
WHERE is_active = true AND id <> (SELECT selected_id FROM equivalent);

-- Counts may have accrued on different equivalent rows. Sum today's use conservatively.
-- Leave historical row counters intact and saturate instead of overflowing integer storage.
WITH equivalent AS MATERIALIZED (
    SELECT MAX(id) AS selected_id,
        LEAST(2147483647::bigint, COALESCE(SUM(GREATEST(COALESCE(requests_today, 0), 0))
            FILTER (WHERE last_reset_date = CURRENT_DATE), 0))::integer AS requests_today
    FROM public.omdb_config t WHERE is_active = true
    HAVING COUNT(*) > 1 AND COUNT(DISTINCT (to_jsonb(t) -
        ARRAY['id', 'created_at', 'updated_at', 'requests_today', 'last_reset_date'])) = 1
), retained AS (
    UPDATE public.omdb_config t SET requests_today = e.requests_today, last_reset_date = CURRENT_DATE
    FROM equivalent e WHERE t.id = e.selected_id RETURNING t.id
)
UPDATE public.omdb_config SET is_active = false
WHERE is_active = true AND id <> (SELECT id FROM retained);

WITH equivalent AS (
    SELECT MAX(id) AS selected_id FROM public.tavily_config t WHERE is_active = true
    HAVING COUNT(*) > 1 AND COUNT(DISTINCT (to_jsonb(t) - ARRAY['id', 'created_at', 'updated_at'])) = 1
)
UPDATE public.tavily_config SET is_active = false
WHERE is_active = true AND id <> (SELECT selected_id FROM equivalent);
