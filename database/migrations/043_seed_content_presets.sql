-- v0.37.0: Content Presets Seed Data
-- ═══════════════════════════════════════════════════════════════════════════
-- This migration seeds the content_presets table with 46 comprehensive
-- presets covering all categories for real-world Plex/Emby/Jellyfin library
-- classification.
-- 
-- Related Issue: #95
-- Depends on: #91 (PR #105) - Policy Database Schema
-- Parent Epic: #82 (v0.37.0 Formula-Based Classification Engine)
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ============================================================================
-- SIGNAL SCHEMA REFERENCE (TypeScript)
-- ============================================================================
-- interface PresetSignals {
--     certifications?: {
--         mode: 'include' | 'exclude' | 'max';
--         include?: string[];
--         exclude?: string[];
--         max?: string;
--         weight?: number;
--     };
--     genres?: {
--         prefer?: string[];
--         require_any?: string[];
--         require_all?: string[];
--         exclude?: string[];
--         weight?: number;
--     };
--     keywords?: {
--         prefer?: string[];
--         require_any?: string[];
--         exclude?: string[];
--         weight?: number;
--     };
--     studios?: {
--         prefer?: string[];
--         require_any?: string[];
--         exclude?: string[];
--         weight?: number;
--     };
--     release_year?: {
--         min?: number;
--         max?: number;
--         weight?: number;
--     };
--     vote_average?: {
--         min?: number;
--         max?: number;
--         weight?: number;
--     };
--     runtime?: {
--         min_minutes?: number;
--         max_minutes?: number;
--         weight?: number;
--     };
--     language?: {
--         prefer?: string[];
--         require_any?: string[];
--         exclude?: string[];
--         weight?: number;
--     };
--     media_type?: {
--         include: ('movie' | 'tv')[];
--     };
-- }
-- ============================================================================

-- ============================================================================
-- CONTENT PRESETS SEED DATA
-- ============================================================================
-- Insert system presets with idempotency using ON CONFLICT
-- user_id = NULL for system presets (allows unique constraint to work)
-- ============================================================================

INSERT INTO content_presets (key, name, description, icon, category, signals, is_system, display_order)
VALUES
-- ============================================================================
-- CATEGORY: AUDIENCE (display_order 1-4)
-- ============================================================================
('family_friendly', 'Family-Friendly', 'Content suitable for all ages. Excludes R-rated and adult content.', '👨‍👩‍👧‍👦', 'audience',
 '{"certifications": {"mode": "include", "include": ["G", "PG", "PG-13", "TV-Y", "TV-Y7", "TV-G", "TV-PG", "TV-14"], "exclude": ["R", "NC-17", "TV-MA"], "weight": 1.5}, "genres": {"prefer": ["Animation", "Family", "Comedy", "Adventure"], "exclude": ["Horror"], "weight": 1.0}, "keywords": {"exclude": ["gore", "explicit", "adult", "violence", "drug use"], "weight": 0.5}}',
 true, 1),

('kids_only', 'Kids Only', 'Content specifically for young children (ages 2-7).', '🧒', 'audience',
 '{"certifications": {"mode": "include", "include": ["G", "TV-Y", "TV-Y7", "TV-G"], "weight": 2.0}, "genres": {"require_any": ["Animation", "Family"], "weight": 1.5}, "runtime": {"max_minutes": 120, "weight": 0.3}, "keywords": {"prefer": ["children", "kids", "educational", "cartoon"], "exclude": ["scary", "dark", "violence"], "weight": 0.8}}',
 true, 2),

('teen', 'Teen Content', 'Content appropriate for teenagers (13-17).', '🎒', 'audience',
 '{"certifications": {"mode": "include", "include": ["PG", "PG-13", "TV-PG", "TV-14"], "weight": 1.5}, "genres": {"prefer": ["Action", "Adventure", "Comedy", "Science Fiction", "Fantasy"], "weight": 1.0}}',
 true, 3),

('adult_only', 'Adult Only', 'Mature content for adults only (18+).', '🔞', 'audience',
 '{"certifications": {"mode": "include", "include": ["R", "NC-17", "TV-MA"], "weight": 2.0}, "genres": {"prefer": ["Thriller", "Horror", "Crime", "Drama"], "weight": 0.8}, "keywords": {"prefer": ["mature", "adult", "graphic"], "weight": 0.5}}',
 true, 4),

-- ============================================================================
-- CATEGORY: GENRE (display_order 10-24)
-- ============================================================================
('animated', 'Animated Content', 'All animation including cartoons, CGI, and anime.', '🎨', 'genre',
 '{"genres": {"require_any": ["Animation"], "weight": 2.0}, "keywords": {"prefer": ["animated", "animation", "cartoon", "cgi", "pixar", "dreamworks", "ghibli"], "weight": 0.5}}',
 true, 10),

('anime', 'Anime', 'Japanese animation specifically.', '⛩️', 'genre',
 '{"genres": {"require_any": ["Animation"], "weight": 1.0}, "keywords": {"require_any": ["anime"], "prefer": ["manga", "shonen", "seinen", "shojo", "ghibli", "japanese animation"], "weight": 1.5}, "language": {"prefer": ["ja"], "weight": 1.0}}',
 true, 11),

('action_adventure', 'Action & Adventure', 'High-energy action and adventure content.', '💥', 'genre',
 '{"genres": {"require_any": ["Action", "Adventure"], "prefer": ["Thriller"], "weight": 2.0}, "keywords": {"prefer": ["action", "adventure", "hero", "battle", "fight", "explosion"], "weight": 0.5}}',
 true, 12),

('comedy', 'Comedy', 'Comedies, sitcoms, and humorous content.', '😂', 'genre',
 '{"genres": {"require_any": ["Comedy"], "weight": 2.0}, "keywords": {"prefer": ["funny", "humor", "comedy", "parody", "satire"], "weight": 0.5}}',
 true, 13),

('horror_scary', 'Horror & Scary', 'Horror movies and scary content.', '👻', 'genre',
 '{"genres": {"require_any": ["Horror"], "prefer": ["Thriller"], "weight": 2.0}, "keywords": {"prefer": ["horror", "scary", "slasher", "supernatural", "haunted", "zombie", "vampire", "ghost"], "weight": 1.0}}',
 true, 14),

('drama', 'Drama', 'Dramatic films and series.', '🎭', 'genre',
 '{"genres": {"require_any": ["Drama"], "exclude": ["Comedy"], "weight": 2.0}}',
 true, 15),

('romance', 'Romance', 'Romantic movies and series.', '💕', 'genre',
 '{"genres": {"require_any": ["Romance"], "prefer": ["Drama", "Comedy"], "weight": 2.0}, "keywords": {"prefer": ["love", "romance", "romantic", "relationship"], "weight": 0.5}}',
 true, 16),

('scifi', 'Science Fiction', 'Science fiction and futuristic content.', '🚀', 'genre',
 '{"genres": {"require_any": ["Science Fiction"], "prefer": ["Adventure", "Action"], "weight": 2.0}, "keywords": {"prefer": ["sci-fi", "space", "future", "alien", "robot", "technology"], "weight": 0.5}}',
 true, 17),

('fantasy', 'Fantasy', 'Fantasy and magical content.', '🧙', 'genre',
 '{"genres": {"require_any": ["Fantasy"], "prefer": ["Adventure", "Action"], "weight": 2.0}, "keywords": {"prefer": ["magic", "wizard", "dragon", "mythical", "supernatural", "fairy tale"], "weight": 0.5}}',
 true, 18),

('documentary', 'Documentary', 'Documentaries and non-fiction.', '📚', 'genre',
 '{"genres": {"require_any": ["Documentary"], "weight": 2.0}, "keywords": {"prefer": ["documentary", "real", "true story", "biography"], "weight": 0.5}}',
 true, 19),

('crime_mystery', 'Crime & Mystery', 'Crime dramas, mysteries, and thrillers.', '🔍', 'genre',
 '{"genres": {"require_any": ["Crime", "Mystery"], "prefer": ["Thriller", "Drama"], "weight": 2.0}, "keywords": {"prefer": ["detective", "murder", "investigation", "crime", "police"], "weight": 0.5}}',
 true, 20),

('western', 'Western', 'Western films and series.', '🤠', 'genre',
 '{"genres": {"require_any": ["Western"], "weight": 2.0}, "keywords": {"prefer": ["cowboy", "western", "frontier", "wild west"], "weight": 0.5}}',
 true, 21),

('musical', 'Musical', 'Musicals and music-focused content.', '🎵', 'genre',
 '{"genres": {"require_any": ["Music"], "weight": 2.0}, "keywords": {"prefer": ["musical", "singing", "dance", "broadway", "concert"], "weight": 1.0}}',
 true, 22),

('sports', 'Sports', 'Sports movies and documentaries.', '⚽', 'genre',
 '{"genres": {"require_any": ["Sports"], "weight": 2.0}, "keywords": {"prefer": ["sports", "football", "basketball", "baseball", "soccer", "athlete"], "weight": 0.8}}',
 true, 23),

('war', 'War', 'War films and military content.', '⚔️', 'genre',
 '{"genres": {"require_any": ["War"], "prefer": ["History", "Drama", "Action"], "weight": 2.0}, "keywords": {"prefer": ["war", "military", "soldier", "battle", "army"], "weight": 0.5}}',
 true, 24),

-- ============================================================================
-- CATEGORY: TEMPORAL (display_order 40-44)
-- ============================================================================
('classic_films', 'Classic Films', 'Movies released before 1980.', '🎞️', 'temporal',
 '{"release_year": {"max": 1979, "weight": 2.0}, "media_type": {"include": ["movie"]}}',
 true, 40),

('golden_age', 'Golden Age (1930-1960)', 'Films from Hollywood Golden Age.', '🌟', 'temporal',
 '{"release_year": {"min": 1930, "max": 1960, "weight": 2.0}, "media_type": {"include": ["movie"]}}',
 true, 41),

('80s', '1980s', 'Content from the 1980s.', '📼', 'temporal',
 '{"release_year": {"min": 1980, "max": 1989, "weight": 2.0}}',
 true, 42),

('90s', '1990s', 'Content from the 1990s.', '💿', 'temporal',
 '{"release_year": {"min": 1990, "max": 1999, "weight": 2.0}}',
 true, 43),

('recent_releases', 'Recent Releases', 'Content from the last 2 years.', '🆕', 'temporal',
 '{"release_year": {"min": 2025, "weight": 2.0}}',
 true, 44),

-- ============================================================================
-- CATEGORY: QUALITY (display_order 50-51)
-- ============================================================================
('highly_rated', 'Highly Rated', 'Content with 7.0+ rating on TMDB.', '⭐', 'quality',
 '{"vote_average": {"min": 7.0, "weight": 1.5}}',
 true, 50),

('hidden_gems', 'Hidden Gems', 'Lesser-known but highly rated content.', '💎', 'quality',
 '{"vote_average": {"min": 7.0, "weight": 1.5}, "keywords": {"prefer": ["indie", "independent", "art house"], "weight": 0.5}}',
 true, 51),

-- ============================================================================
-- CATEGORY: FRANCHISE (display_order 55-61)
-- ============================================================================
('marvel_mcu', 'Marvel MCU', 'Marvel Cinematic Universe films and shows.', '🦸', 'franchise',
 '{"studios": {"require_any": ["Marvel Studios"], "weight": 2.0}, "keywords": {"prefer": ["marvel", "mcu", "avengers", "superhero"], "weight": 1.0}}',
 true, 55),

('dc_universe', 'DC Universe', 'DC Comics films and shows.', '🦇', 'franchise',
 '{"studios": {"require_any": ["DC Entertainment", "DC Films", "DC Studios"], "weight": 2.0}, "keywords": {"prefer": ["dc", "batman", "superman", "justice league", "superhero"], "weight": 1.0}}',
 true, 56),

('star_wars', 'Star Wars', 'Star Wars films and series.', '🌌', 'franchise',
 '{"studios": {"require_any": ["Lucasfilm"], "weight": 1.5}, "keywords": {"require_any": ["star wars"], "prefer": ["jedi", "sith", "force", "skywalker"], "weight": 2.0}}',
 true, 57),

('disney', 'Disney', 'Walt Disney Animation Studios films.', '🏰', 'franchise',
 '{"studios": {"require_any": ["Walt Disney Pictures", "Walt Disney Animation Studios"], "weight": 2.0}}',
 true, 58),

('pixar', 'Pixar', 'Pixar Animation Studios films.', '🎯', 'franchise',
 '{"studios": {"require_any": ["Pixar"], "weight": 2.0}}',
 true, 59),

('ghibli', 'Studio Ghibli', 'Studio Ghibli animated films.', '🌸', 'franchise',
 '{"studios": {"require_any": ["Studio Ghibli"], "weight": 2.0}, "keywords": {"prefer": ["ghibli", "miyazaki"], "weight": 1.0}}',
 true, 60),

('dreamworks', 'DreamWorks', 'DreamWorks Animation films.', '🌙', 'franchise',
 '{"studios": {"require_any": ["DreamWorks Animation"], "weight": 2.0}}',
 true, 61),

-- ============================================================================
-- CATEGORY: REGIONAL (display_order 70-74)
-- ============================================================================
('hollywood', 'Hollywood', 'American/Hollywood productions.', '🇺🇸', 'regional',
 '{"language": {"require_any": ["en"], "weight": 1.5}, "studios": {"prefer": ["Warner Bros.", "Universal Pictures", "Paramount", "20th Century Studios", "Sony Pictures"], "weight": 1.0}}',
 true, 70),

('british', 'British', 'British productions.', '🇬🇧', 'regional',
 '{"language": {"require_any": ["en"], "weight": 0.5}, "studios": {"prefer": ["BBC", "Working Title", "Aardman"], "weight": 1.5}, "keywords": {"prefer": ["british", "uk", "england", "bbc"], "weight": 1.0}}',
 true, 71),

('bollywood', 'Bollywood', 'Indian/Bollywood productions.', '🇮🇳', 'regional',
 '{"language": {"require_any": ["hi", "ta", "te"], "weight": 2.0}, "keywords": {"prefer": ["bollywood", "indian"], "weight": 1.0}}',
 true, 72),

('korean', 'Korean', 'Korean films and dramas.', '🇰🇷', 'regional',
 '{"language": {"require_any": ["ko"], "weight": 2.0}, "keywords": {"prefer": ["korean", "k-drama", "kdrama"], "weight": 1.0}}',
 true, 73),

('foreign', 'Foreign/International', 'Non-English language films.', '🌍', 'regional',
 '{"language": {"exclude": ["en"], "weight": 2.0}}',
 true, 74),

-- ============================================================================
-- CATEGORY: SEASONAL (display_order 80-81)
-- ============================================================================
('christmas_holiday', 'Christmas & Holiday', 'Christmas and holiday seasonal content.', '🎄', 'seasonal',
 '{"keywords": {"require_any": ["christmas", "holiday", "santa", "xmas"], "prefer": ["winter", "snow", "festive"], "weight": 2.0}, "genres": {"prefer": ["Family", "Comedy", "Romance"], "weight": 0.5}}',
 true, 80),

('halloween', 'Halloween', 'Halloween and spooky seasonal content.', '🎃', 'seasonal',
 '{"keywords": {"require_any": ["halloween"], "prefer": ["spooky", "scary", "witch", "monster", "haunted"], "weight": 2.0}, "genres": {"prefer": ["Horror", "Thriller", "Fantasy"], "weight": 0.8}}',
 true, 81),

-- ============================================================================
-- CATEGORY: TV-SPECIFIC (display_order 85-90)
-- ============================================================================
('tv_sitcom', 'Sitcoms', 'Situation comedies with short episodes.', '📺', 'tv',
 '{"media_type": {"include": ["tv"]}, "genres": {"require_any": ["Comedy"], "weight": 1.5}, "runtime": {"max_minutes": 35, "weight": 1.0}, "keywords": {"prefer": ["sitcom", "laugh track", "comedy series"], "weight": 0.5}}',
 true, 85),

('tv_drama', 'Drama Series', 'Dramatic TV series.', '🎬', 'tv',
 '{"media_type": {"include": ["tv"]}, "genres": {"require_any": ["Drama"], "exclude": ["Comedy"], "weight": 2.0}}',
 true, 86),

('tv_reality', 'Reality TV', 'Reality and competition shows.', '🏆', 'tv',
 '{"media_type": {"include": ["tv"]}, "genres": {"require_any": ["Reality"], "weight": 2.0}, "keywords": {"prefer": ["reality", "competition", "contest", "dating"], "weight": 1.0}}',
 true, 87),

('tv_animated', 'Animated Series', 'Animated TV series (non-anime).', '✏️', 'tv',
 '{"media_type": {"include": ["tv"]}, "genres": {"require_any": ["Animation"], "weight": 2.0}, "keywords": {"exclude": ["anime"], "weight": 0.5}}',
 true, 88),

('tv_anime', 'Anime Series', 'Japanese animated TV series.', '🎌', 'tv',
 '{"media_type": {"include": ["tv"]}, "genres": {"require_any": ["Animation"], "weight": 1.0}, "keywords": {"require_any": ["anime"], "weight": 2.0}, "language": {"prefer": ["ja"], "weight": 1.0}}',
 true, 89),

('tv_miniseries', 'Miniseries', 'Limited series and miniseries.', '📖', 'tv',
 '{"media_type": {"include": ["tv"]}, "keywords": {"prefer": ["miniseries", "limited series", "mini-series"], "weight": 2.0}}',
 true, 90)

ON CONFLICT (key, user_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    category = EXCLUDED.category,
    signals = EXCLUDED.signals,
    is_system = EXCLUDED.is_system,
    display_order = EXCLUDED.display_order,
    updated_at = NOW();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Log successful completion
DO $$
DECLARE
    preset_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO preset_count FROM content_presets WHERE is_system = true;
    RAISE NOTICE 'Content Presets Seed Migration (043) completed successfully';
    RAISE NOTICE 'Total system presets: %', preset_count;
    RAISE NOTICE 'Categories seeded: audience (4), genre (15), temporal (5), quality (2), franchise (7), regional (5), seasonal (2), tv (6)';
END $$;

COMMIT;
