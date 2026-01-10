-- v0.37.0: Expand Content Presets (46 → 168)
-- ═══════════════════════════════════════════════════════════════════════════
-- This migration expands content presets from 46 to 168 comprehensive presets
-- covering all real-world classification scenarios for Plex/Emby/Jellyfin.
-- 
-- Related Issue: #95 (Content Presets)
-- Depends on: Migration 043 (Initial 46 Content Presets)
-- Parent Epic: #82 (v0.37.0 Formula-Based Classification Engine)
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ============================================================================
-- CONTENT PRESETS EXPANSION - 122 NEW PRESETS
-- ============================================================================
-- Insert system presets with idempotency using ON CONFLICT
-- user_id = NULL for system presets (allows unique constraint to work)
-- ============================================================================

INSERT INTO content_presets (key, name, description, icon, category, signals, is_system, display_order)
VALUES
-- ============================================================================
-- CATEGORY: AUDIENCE - 4 new presets (display_order 5-8)
-- ============================================================================
('kids_older', 'Older Kids', 'Content for ages 8-12, PG content appropriate for older children.', '🎒', 'audience',
 '{"certifications": {"mode": "include", "include": ["PG", "TV-PG"], "weight": 1.5}, "genres": {"prefer": ["Adventure", "Comedy", "Animation", "Family"], "weight": 1.0}, "keywords": {"prefer": ["kids", "children", "adventure"], "exclude": ["scary", "violence"], "weight": 0.5}}',
 true, 5),

('young_adult', 'Young Adult', 'Content for ages 17-25, PG-13/R rated young adult themes.', '🎓', 'audience',
 '{"certifications": {"mode": "include", "include": ["PG-13", "R", "TV-14"], "weight": 1.5}, "genres": {"prefer": ["Drama", "Romance", "Action", "Science Fiction"], "weight": 1.0}, "keywords": {"prefer": ["coming of age", "teen", "young adult"], "weight": 0.8}}',
 true, 6),

('date_night', 'Date Night', 'Romance and comedy content perfect for couples.', '💑', 'audience',
 '{"genres": {"require_any": ["Romance", "Comedy"], "prefer": ["Drama"], "exclude": ["Horror"], "weight": 2.0}, "keywords": {"prefer": ["romantic", "love", "relationship"], "exclude": ["gore", "violence"], "weight": 0.8}}',
 true, 7),

('background', 'Background Viewing', 'Light casual content suitable for background viewing.', '🛋️', 'audience',
 '{"genres": {"prefer": ["Comedy", "Reality", "Documentary"], "exclude": ["Horror", "Thriller"], "weight": 1.0}, "runtime": {"max_minutes": 45, "weight": 0.5}, "keywords": {"prefer": ["light", "casual", "relaxing"], "weight": 0.5}}',
 true, 8),

-- ============================================================================
-- CATEGORY: GENRE CORE - 5 new presets (display_order 25-29)
-- ============================================================================
('action', 'Action', 'High-octane action films and series.', '💥', 'genre',
 '{"genres": {"require_any": ["Action"], "weight": 2.0}, "keywords": {"prefer": ["action", "fight", "battle", "explosion", "chase"], "weight": 0.5}}',
 true, 25),

('thriller', 'Thriller', 'Suspenseful thriller content.', '😰', 'genre',
 '{"genres": {"require_any": ["Thriller"], "weight": 2.0}, "keywords": {"prefer": ["suspense", "tension", "thriller"], "weight": 0.5}}',
 true, 26),

('mystery', 'Mystery', 'Mystery and detective content.', '🔍', 'genre',
 '{"genres": {"require_any": ["Mystery"], "weight": 2.0}, "keywords": {"prefer": ["mystery", "detective", "investigation", "whodunit"], "weight": 0.5}}',
 true, 27),

('history', 'Historical', 'Historical films and series.', '🏛️', 'genre',
 '{"genres": {"require_any": ["History"], "weight": 2.0}, "keywords": {"prefer": ["historical", "period", "history", "based on true events"], "weight": 0.5}}',
 true, 28),

('biographical', 'Biographical', 'Biography and biopic content.', '📖', 'genre',
 '{"keywords": {"require_any": ["biography", "biopic", "based on true story"], "weight": 2.0}, "genres": {"prefer": ["Drama", "History"], "weight": 0.8}}',
 true, 29),

-- ============================================================================
-- CATEGORY: GENRE SUBGENRES - 25 new presets (display_order 30-54)
-- ============================================================================
('action_comedy', 'Action Comedy', 'Action films with comedic elements.', '🤣', 'genre',
 '{"genres": {"require_all": ["Action", "Comedy"], "weight": 2.0}}',
 true, 30),

('romantic_comedy', 'Romantic Comedy', 'Romantic comedies and rom-coms.', '💕', 'genre',
 '{"genres": {"require_all": ["Romance", "Comedy"], "weight": 2.0}}',
 true, 31),

('dark_comedy', 'Dark Comedy', 'Comedy with dark or morbid themes.', '🖤', 'genre',
 '{"genres": {"require_any": ["Comedy"], "weight": 1.0}, "keywords": {"require_any": ["dark comedy", "black comedy"], "weight": 2.0}}',
 true, 32),

('standup', 'Stand-Up Comedy', 'Stand-up comedy specials and performances.', '🎤', 'genre',
 '{"genres": {"require_any": ["Comedy"], "weight": 1.0}, "keywords": {"require_any": ["stand-up", "standup", "comedy special"], "weight": 2.0}}',
 true, 33),

('horror_comedy', 'Horror Comedy', 'Horror films with comedic elements.', '👻', 'genre',
 '{"genres": {"require_all": ["Horror", "Comedy"], "weight": 2.0}}',
 true, 34),

('slasher', 'Slasher', 'Slasher horror films.', '🔪', 'genre',
 '{"genres": {"require_any": ["Horror"], "weight": 1.5}, "keywords": {"require_any": ["slasher", "serial killer", "knife"], "weight": 2.0}}',
 true, 35),

('psychological_horror', 'Psychological Horror', 'Psychological and mind-bending horror.', '🧠', 'genre',
 '{"genres": {"require_any": ["Horror", "Thriller"], "weight": 1.5}, "keywords": {"require_any": ["psychological", "mind", "paranoia"], "weight": 2.0}}',
 true, 36),

('supernatural', 'Supernatural', 'Supernatural and paranormal content.', '👁️', 'genre',
 '{"keywords": {"require_any": ["supernatural", "paranormal", "ghost", "spirit"], "weight": 2.0}, "genres": {"prefer": ["Horror", "Thriller", "Fantasy"], "weight": 1.0}}',
 true, 37),

('monster', 'Monster Movies', 'Monster and creature features.', '🦖', 'genre',
 '{"keywords": {"require_any": ["monster", "creature", "kaiju"], "weight": 2.0}, "genres": {"prefer": ["Horror", "Science Fiction", "Action"], "weight": 1.0}}',
 true, 38),

('zombie', 'Zombie', 'Zombie films and series.', '🧟', 'genre',
 '{"keywords": {"require_any": ["zombie", "undead", "walking dead"], "weight": 2.0}, "genres": {"prefer": ["Horror", "Thriller"], "weight": 1.0}}',
 true, 39),

('vampire', 'Vampire', 'Vampire films and series.', '🧛', 'genre',
 '{"keywords": {"require_any": ["vampire", "dracula", "bloodsucker"], "weight": 2.0}, "genres": {"prefer": ["Horror", "Fantasy"], "weight": 1.0}}',
 true, 40),

('psychological_thriller', 'Psychological Thriller', 'Mind-bending psychological thrillers.', '😰', 'genre',
 '{"genres": {"require_any": ["Thriller"], "weight": 1.5}, "keywords": {"require_any": ["psychological", "mind game", "paranoia"], "weight": 2.0}}',
 true, 41),

('spy', 'Spy/Espionage', 'Spy and espionage thrillers.', '🕵️', 'genre',
 '{"keywords": {"require_any": ["spy", "espionage", "secret agent", "intelligence"], "weight": 2.0}, "genres": {"prefer": ["Thriller", "Action"], "weight": 1.0}}',
 true, 42),

('heist', 'Heist', 'Heist and caper films.', '💰', 'genre',
 '{"keywords": {"require_any": ["heist", "robbery", "caper", "theft"], "weight": 2.0}, "genres": {"prefer": ["Crime", "Thriller", "Action"], "weight": 1.0}}',
 true, 43),

('disaster', 'Disaster', 'Disaster and survival films.', '🌋', 'genre',
 '{"keywords": {"require_any": ["disaster", "earthquake", "tornado", "tsunami", "survival"], "weight": 2.0}, "genres": {"prefer": ["Action", "Thriller"], "weight": 1.0}}',
 true, 44),

('martial_arts', 'Martial Arts', 'Martial arts action films.', '🥋', 'genre',
 '{"keywords": {"require_any": ["martial arts", "kung fu", "karate", "wushu"], "weight": 2.0}, "genres": {"prefer": ["Action"], "weight": 1.0}}',
 true, 45),

('noir', 'Film Noir', 'Film noir and neo-noir.', '🎩', 'genre',
 '{"keywords": {"require_any": ["noir", "neo-noir", "detective noir"], "weight": 2.0}, "genres": {"prefer": ["Crime", "Thriller", "Mystery"], "weight": 1.0}}',
 true, 46),

('cyberpunk', 'Cyberpunk', 'Cyberpunk and tech-dystopia.', '🤖', 'genre',
 '{"keywords": {"require_any": ["cyberpunk", "cyber", "hacker", "dystopia"], "weight": 2.0}, "genres": {"prefer": ["Science Fiction"], "weight": 1.0}}',
 true, 47),

('space_opera', 'Space Opera', 'Epic space opera adventures.', '🌌', 'genre',
 '{"keywords": {"require_any": ["space opera", "space adventure", "galaxy"], "weight": 2.0}, "genres": {"require_any": ["Science Fiction"], "weight": 1.5}}',
 true, 48),

('post_apocalyptic', 'Post-Apocalyptic', 'Post-apocalyptic survival content.', '☢️', 'genre',
 '{"keywords": {"require_any": ["post-apocalyptic", "apocalypse", "wasteland", "end of world"], "weight": 2.0}, "genres": {"prefer": ["Science Fiction", "Action"], "weight": 1.0}}',
 true, 49),

('dystopian', 'Dystopian', 'Dystopian future scenarios.', '🏚️', 'genre',
 '{"keywords": {"require_any": ["dystopian", "dystopia", "totalitarian"], "weight": 2.0}, "genres": {"prefer": ["Science Fiction", "Drama"], "weight": 1.0}}',
 true, 50),

('superhero', 'Superhero', 'Superhero films and series.', '🦸', 'genre',
 '{"keywords": {"require_any": ["superhero", "super hero", "comic book"], "weight": 2.0}, "genres": {"prefer": ["Action", "Science Fiction", "Fantasy"], "weight": 1.0}}',
 true, 51),

('courtroom', 'Courtroom Drama', 'Legal and courtroom dramas.', '⚖️', 'genre',
 '{"keywords": {"require_any": ["courtroom", "legal", "lawyer", "trial"], "weight": 2.0}, "genres": {"prefer": ["Drama", "Crime"], "weight": 1.0}}',
 true, 52),

('medical', 'Medical Drama', 'Medical dramas and hospital settings.', '🏥', 'genre',
 '{"keywords": {"require_any": ["medical", "hospital", "doctor", "surgeon"], "weight": 2.0}, "genres": {"prefer": ["Drama"], "weight": 1.0}}',
 true, 53),

('political', 'Political', 'Political dramas and thrillers.', '🏛️', 'genre',
 '{"keywords": {"require_any": ["political", "politics", "election", "government"], "weight": 2.0}, "genres": {"prefer": ["Drama", "Thriller"], "weight": 1.0}}',
 true, 54),

-- ============================================================================
-- CATEGORY: GENRE SPECIAL INTEREST - 15 new presets (display_order 55-69)
-- ============================================================================
('true_crime', 'True Crime', 'True crime documentaries and series.', '🔎', 'genre',
 '{"keywords": {"require_any": ["true crime", "murder", "investigation"], "weight": 2.0}, "genres": {"prefer": ["Documentary", "Crime"], "weight": 1.0}}',
 true, 55),

('nature', 'Nature & Wildlife', 'Nature and wildlife documentaries.', '🦁', 'genre',
 '{"keywords": {"require_any": ["nature", "wildlife", "animal", "planet earth"], "weight": 2.0}, "genres": {"prefer": ["Documentary"], "weight": 1.0}}',
 true, 56),

('science', 'Science & Tech', 'Science and technology documentaries.', '🔬', 'genre',
 '{"keywords": {"require_any": ["science", "technology", "physics", "space", "cosmos"], "weight": 2.0}, "genres": {"prefer": ["Documentary"], "weight": 1.0}}',
 true, 57),

('travel', 'Travel & Culture', 'Travel and cultural documentaries.', '✈️', 'genre',
 '{"keywords": {"require_any": ["travel", "culture", "journey", "world"], "weight": 2.0}, "genres": {"prefer": ["Documentary"], "weight": 1.0}}',
 true, 58),

('food', 'Food & Cooking', 'Food and cooking content.', '🍳', 'genre',
 '{"keywords": {"require_any": ["food", "cooking", "chef", "culinary", "cuisine"], "weight": 2.0}, "genres": {"prefer": ["Documentary"], "weight": 1.0}}',
 true, 59),

('music_doc', 'Music Documentary', 'Music documentaries and biopics.', '🎸', 'genre',
 '{"keywords": {"require_any": ["music", "musician", "band", "singer"], "weight": 2.0}, "genres": {"require_any": ["Documentary", "Music"], "weight": 1.5}}',
 true, 60),

('art_culture', 'Art & Culture', 'Art and cultural documentaries.', '🎨', 'genre',
 '{"keywords": {"require_any": ["art", "artist", "painting", "sculpture", "museum"], "weight": 2.0}, "genres": {"prefer": ["Documentary"], "weight": 1.0}}',
 true, 61),

('faith_spiritual', 'Faith & Spiritual', 'Faith-based and spiritual content.', '🙏', 'genre',
 '{"keywords": {"require_any": ["faith", "spiritual", "religion", "christian", "gospel"], "weight": 2.0}, "genres": {"prefer": ["Documentary", "Drama"], "weight": 0.8}}',
 true, 62),

('educational', 'Educational', 'Educational and instructional content.', '📚', 'genre',
 '{"keywords": {"require_any": ["educational", "learning", "instructional", "tutorial"], "weight": 2.0}, "genres": {"prefer": ["Documentary"], "weight": 1.0}}',
 true, 63),

('conspiracy', 'Conspiracy/Unexplained', 'Conspiracy and unexplained mysteries.', '👽', 'genre',
 '{"keywords": {"require_any": ["conspiracy", "mystery", "unexplained", "paranormal", "ufo"], "weight": 2.0}, "genres": {"prefer": ["Documentary"], "weight": 1.0}}',
 true, 64),

('sports_doc', 'Sports Documentary', 'Sports documentaries and films.', '🏆', 'genre',
 '{"keywords": {"require_any": ["sports", "athlete", "championship"], "weight": 2.0}, "genres": {"require_any": ["Documentary", "Sports"], "weight": 1.5}}',
 true, 65),

('concert', 'Concert Films', 'Concert films and live performances.', '🎤', 'genre',
 '{"keywords": {"require_any": ["concert", "live performance", "tour"], "weight": 2.0}, "genres": {"prefer": ["Music", "Documentary"], "weight": 1.0}}',
 true, 66),

('behind_scenes', 'Behind the Scenes', 'Behind-the-scenes and making-of documentaries.', '🎬', 'genre',
 '{"keywords": {"require_any": ["behind the scenes", "making of", "documentary"], "weight": 2.0}, "genres": {"prefer": ["Documentary"], "weight": 1.0}}',
 true, 67),

('interview', 'Interview/Talk', 'Interview and talk-based content.', '💬', 'genre',
 '{"keywords": {"require_any": ["interview", "conversation", "talk"], "weight": 2.0}, "genres": {"prefer": ["Documentary"], "weight": 1.0}}',
 true, 68),

('essay', 'Video Essay', 'Video essays and analytical content.', '📝', 'genre',
 '{"keywords": {"require_any": ["video essay", "essay", "analysis", "critique"], "weight": 2.0}, "genres": {"prefer": ["Documentary"], "weight": 1.0}}',
 true, 69),

-- ============================================================================
-- CATEGORY: FRANCHISE - 18 new presets (display_order 70-88)
-- ============================================================================
('illumination', 'Illumination', 'Illumination Entertainment animated films.', '🍌', 'franchise',
 '{"studios": {"require_any": ["Illumination Entertainment", "Illumination"], "weight": 2.0}}',
 true, 70),

('sony_animation', 'Sony Animation', 'Sony Pictures Animation films.', '🕷️', 'franchise',
 '{"studios": {"require_any": ["Sony Pictures Animation"], "weight": 2.0}}',
 true, 71),

('laika', 'Laika', 'Laika stop-motion animated films.', '🎭', 'franchise',
 '{"studios": {"require_any": ["Laika"], "weight": 2.0}}',
 true, 73),

('blue_sky', 'Blue Sky', 'Blue Sky Studios animated films.', '🧊', 'franchise',
 '{"studios": {"require_any": ["Blue Sky Studios"], "weight": 2.0}}',
 true, 74),

('marvel_other', 'Marvel (Non-MCU)', 'Marvel films outside the MCU.', '🕷️', 'franchise',
 '{"keywords": {"require_any": ["marvel"], "weight": 2.0}, "studios": {"exclude": ["Marvel Studios"], "weight": 1.0}}',
 true, 75),

('star_trek', 'Star Trek', 'Star Trek films and series.', '🖖', 'franchise',
 '{"keywords": {"require_any": ["star trek", "enterprise", "starfleet"], "weight": 2.0}}',
 true, 76),

('harry_potter', 'Wizarding World', 'Harry Potter and Wizarding World films.', '⚡', 'franchise',
 '{"keywords": {"require_any": ["harry potter", "wizarding world", "fantastic beasts"], "weight": 2.0}}',
 true, 77),

('lotr', 'Middle-earth', 'Lord of the Rings and Middle-earth content.', '💍', 'franchise',
 '{"keywords": {"require_any": ["lord of the rings", "hobbit", "middle-earth"], "weight": 2.0}}',
 true, 78),

('james_bond', 'James Bond', 'James Bond 007 films.', '🍸', 'franchise',
 '{"keywords": {"require_any": ["james bond", "007"], "weight": 2.0}}',
 true, 79),

('fast_furious', 'Fast & Furious', 'Fast & Furious franchise films.', '🚗', 'franchise',
 '{"keywords": {"require_any": ["fast and furious", "fast & furious"], "weight": 2.0}}',
 true, 80),

('jurassic', 'Jurassic', 'Jurassic Park/World franchise films.', '🦖', 'franchise',
 '{"keywords": {"require_any": ["jurassic park", "jurassic world"], "weight": 2.0}}',
 true, 81),

('monsterverse', 'Monsterverse', 'Legendary Monsterverse films.', '🦍', 'franchise',
 '{"keywords": {"require_any": ["monsterverse", "godzilla", "kong"], "weight": 2.0}}',
 true, 82),

('conjuring', 'Conjuring Universe', 'The Conjuring Universe horror films.', '👁️', 'franchise',
 '{"keywords": {"require_any": ["conjuring", "annabelle", "nun", "valak"], "weight": 2.0}}',
 true, 83),

('a24', 'A24', 'A24 independent films.', '🅰️', 'franchise',
 '{"studios": {"require_any": ["A24"], "weight": 2.0}}',
 true, 84),

('blumhouse', 'Blumhouse', 'Blumhouse Productions horror films.', '🎃', 'franchise',
 '{"studios": {"require_any": ["Blumhouse Productions", "Blumhouse"], "weight": 2.0}}',
 true, 85),

('neon', 'Neon', 'Neon independent films.', '💡', 'franchise',
 '{"studios": {"require_any": ["Neon"], "weight": 2.0}}',
 true, 86),

('searchlight', 'Searchlight', 'Searchlight Pictures films.', '🔦', 'franchise',
 '{"studios": {"require_any": ["Searchlight Pictures", "Fox Searchlight"], "weight": 2.0}}',
 true, 87),

('focus', 'Focus Features', 'Focus Features films.', '🎯', 'franchise',
 '{"studios": {"require_any": ["Focus Features"], "weight": 2.0}}',
 true, 88),

-- ============================================================================
-- CATEGORY: TEMPORAL - 7 new presets (display_order 89-95)
-- ============================================================================
('silent_era', 'Silent Era', 'Silent films from before 1930.', '🎬', 'temporal',
 '{"release_year": {"max": 1929, "weight": 2.0}, "media_type": {"include": ["movie"]}}',
 true, 89),

('new_hollywood', 'New Hollywood', 'New Hollywood era films (1967-1980).', '🎥', 'temporal',
 '{"release_year": {"min": 1967, "max": 1980, "weight": 2.0}, "media_type": {"include": ["movie"]}}',
 true, 90),

('2000s', '2000s', 'Content from the 2000s decade.', '📀', 'temporal',
 '{"release_year": {"min": 2000, "max": 2009, "weight": 2.0}}',
 true, 91),

('2010s', '2010s', 'Content from the 2010s decade.', '📱', 'temporal',
 '{"release_year": {"min": 2010, "max": 2019, "weight": 2.0}}',
 true, 92),

('2020s', '2020s', 'Content from the 2020s decade.', '🦠', 'temporal',
 '{"release_year": {"min": 2020, "max": 2029, "weight": 2.0}}',
 true, 93),

('retro', 'Retro', 'Retro content from before 2000.', '📺', 'temporal',
 '{"release_year": {"max": 1999, "weight": 2.0}}',
 true, 94),

('modern', 'Modern', 'Modern content from 2000 onwards.', '🎬', 'temporal',
 '{"release_year": {"min": 2000, "weight": 2.0}}',
 true, 95),

-- ============================================================================
-- CATEGORY: QUALITY - 8 new presets (display_order 96-103)
-- ============================================================================
('critically_acclaimed', 'Critically Acclaimed', 'Critically acclaimed with high review scores.', '🏆', 'quality',
 '{"vote_average": {"min": 8.0, "weight": 2.0}}',
 true, 96),

('popular', 'Popular', 'Popular and widely watched content.', '📈', 'quality',
 '{"keywords": {"prefer": ["popular", "trending", "blockbuster"], "weight": 1.5}}',
 true, 97),

('cult_classic', 'Cult Classics', 'Cult classic films with devoted followings.', '🕯️', 'quality',
 '{"keywords": {"require_any": ["cult classic", "cult film"], "weight": 2.0}}',
 true, 98),

('award_winners', 'Award Winners', 'Award-winning films and series.', '🏅', 'quality',
 '{"keywords": {"prefer": ["oscar", "academy award", "emmy", "golden globe"], "weight": 1.5}, "vote_average": {"min": 7.5, "weight": 1.0}}',
 true, 99),

('indie', 'Independent', 'Independent and art house films.', '🎭', 'quality',
 '{"keywords": {"require_any": ["independent", "indie", "art house"], "weight": 2.0}}',
 true, 100),

('blockbuster', 'Blockbusters', 'Big-budget blockbuster films.', '💰', 'quality',
 '{"keywords": {"require_any": ["blockbuster", "big budget"], "weight": 1.5}, "genres": {"prefer": ["Action", "Science Fiction", "Adventure"], "weight": 0.8}}',
 true, 101),

('underrated', 'Underrated', 'Underrated and overlooked gems.', '🤫', 'quality',
 '{"keywords": {"require_any": ["underrated", "overlooked", "hidden"], "weight": 2.0}}',
 true, 102),

('so_bad_good', 'So Bad It''s Good', 'So bad they''re good, guilty pleasure films.', '🧀', 'quality',
 '{"keywords": {"require_any": ["so bad", "guilty pleasure", "campy"], "weight": 2.0}}',
 true, 103),

-- ============================================================================
-- CATEGORY: SEASONAL - 6 new presets (display_order 104-109)
-- ============================================================================
('thanksgiving', 'Thanksgiving', 'Thanksgiving-themed content.', '🦃', 'seasonal',
 '{"keywords": {"require_any": ["thanksgiving", "turkey day"], "weight": 2.0}, "genres": {"prefer": ["Family", "Comedy", "Drama"], "weight": 0.5}}',
 true, 104),

('valentines', 'Valentine''s Day', 'Valentine''s Day romantic content.', '💘', 'seasonal',
 '{"keywords": {"require_any": ["valentine", "valentines day"], "weight": 2.0}, "genres": {"prefer": ["Romance", "Comedy"], "weight": 1.0}}',
 true, 105),

('easter', 'Easter', 'Easter-themed family content.', '🐰', 'seasonal',
 '{"keywords": {"require_any": ["easter", "bunny", "egg"], "weight": 2.0}, "genres": {"prefer": ["Family", "Animation"], "weight": 0.5}}',
 true, 106),

('new_years', 'New Year''s', 'New Year''s celebration content.', '🎆', 'seasonal',
 '{"keywords": {"require_any": ["new year", "new years eve"], "weight": 2.0}, "genres": {"prefer": ["Comedy", "Romance", "Drama"], "weight": 0.5}}',
 true, 107),

('summer', 'Summer Vibes', 'Summer-themed light content.', '☀️', 'seasonal',
 '{"keywords": {"require_any": ["summer", "beach", "vacation"], "weight": 2.0}, "genres": {"prefer": ["Comedy", "Romance", "Adventure"], "weight": 0.5}}',
 true, 108),

('winter', 'Winter/Cozy', 'Winter and cozy content.', '❄️', 'seasonal',
 '{"keywords": {"require_any": ["winter", "snow", "cozy"], "weight": 2.0}, "genres": {"prefer": ["Drama", "Romance", "Family"], "weight": 0.5}}',
 true, 109),

-- ============================================================================
-- CATEGORY: REGIONAL - 20 new presets (display_order 110-129)
-- ============================================================================
('english', 'English', 'English-language content.', '🇺🇸', 'regional',
 '{"language": {"require_any": ["en"], "weight": 2.0}}',
 true, 110),

('australian', 'Australian', 'Australian productions.', '🇦🇺', 'regional',
 '{"language": {"require_any": ["en"], "weight": 1.0}, "keywords": {"prefer": ["australian", "australia", "aussie"], "weight": 1.5}}',
 true, 111),

('canadian', 'Canadian', 'Canadian productions.', '🇨🇦', 'regional',
 '{"language": {"require_any": ["en", "fr"], "weight": 1.0}, "keywords": {"prefer": ["canadian", "canada"], "weight": 1.5}}',
 true, 112),

('japanese', 'Japanese', 'Japanese films (non-anime).', '🇯🇵', 'regional',
 '{"language": {"require_any": ["ja"], "weight": 2.0}, "keywords": {"exclude": ["anime"], "weight": 1.0}}',
 true, 113),

('chinese', 'Chinese', 'Chinese-language films.', '🇨🇳', 'regional',
 '{"language": {"require_any": ["zh"], "weight": 2.0}}',
 true, 114),

('hong_kong', 'Hong Kong', 'Hong Kong cinema.', '🇭🇰', 'regional',
 '{"language": {"require_any": ["zh", "yue"], "weight": 2.0}, "keywords": {"prefer": ["hong kong"], "weight": 1.0}}',
 true, 115),

('taiwanese', 'Taiwanese', 'Taiwanese films.', '🇹🇼', 'regional',
 '{"language": {"require_any": ["zh"], "weight": 2.0}, "keywords": {"prefer": ["taiwanese", "taiwan"], "weight": 1.0}}',
 true, 116),

('indian', 'Indian', 'Indian films (Bollywood, Tollywood, etc).', '🇮🇳', 'regional',
 '{"language": {"require_any": ["hi", "ta", "te", "ml"], "weight": 2.0}}',
 true, 117),

('spanish', 'Spanish', 'Spanish-language films from Spain.', '🇪🇸', 'regional',
 '{"language": {"require_any": ["es"], "weight": 2.0}, "keywords": {"prefer": ["spanish", "spain"], "weight": 0.5}}',
 true, 118),

('latin_american', 'Latin American', 'Latin American films and series.', '🌎', 'regional',
 '{"language": {"require_any": ["es", "pt"], "weight": 2.0}, "keywords": {"prefer": ["latin", "latinoamérica"], "weight": 0.5}}',
 true, 119),

('mexican', 'Mexican', 'Mexican films and series.', '🇲🇽', 'regional',
 '{"language": {"require_any": ["es"], "weight": 2.0}, "keywords": {"prefer": ["mexican", "mexico"], "weight": 1.0}}',
 true, 120),

('brazilian', 'Brazilian', 'Brazilian films and series.', '🇧🇷', 'regional',
 '{"language": {"require_any": ["pt"], "weight": 2.0}, "keywords": {"prefer": ["brazilian", "brazil"], "weight": 1.0}}',
 true, 121),

('french', 'French', 'French-language films.', '🇫🇷', 'regional',
 '{"language": {"require_any": ["fr"], "weight": 2.0}}',
 true, 122),

('german', 'German', 'German-language films.', '🇩🇪', 'regional',
 '{"language": {"require_any": ["de"], "weight": 2.0}}',
 true, 123),

('italian', 'Italian', 'Italian-language films.', '🇮🇹', 'regional',
 '{"language": {"require_any": ["it"], "weight": 2.0}}',
 true, 124),

('scandinavian', 'Scandinavian', 'Scandinavian films and series.', '🇸🇪', 'regional',
 '{"language": {"require_any": ["sv", "no", "da", "fi"], "weight": 2.0}}',
 true, 125),

('russian', 'Russian', 'Russian-language films.', '🇷🇺', 'regional',
 '{"language": {"require_any": ["ru"], "weight": 2.0}}',
 true, 126),

('turkish', 'Turkish', 'Turkish-language films and series.', '🇹🇷', 'regional',
 '{"language": {"require_any": ["tr"], "weight": 2.0}}',
 true, 127),

('thai', 'Thai', 'Thai-language films and series.', '🇹🇭', 'regional',
 '{"language": {"require_any": ["th"], "weight": 2.0}}',
 true, 128),

('arabic', 'Arabic', 'Arabic-language films and series.', '🇸🇦', 'regional',
 '{"language": {"require_any": ["ar"], "weight": 2.0}}',
 true, 129),

-- ============================================================================
-- CATEGORY: TV - 14 new presets (display_order 130-143)
-- ============================================================================
('tv_procedural', 'Procedural', 'TV procedural dramas.', '🚔', 'tv',
 '{"media_type": {"include": ["tv"]}, "keywords": {"require_any": ["procedural", "case of the week"], "weight": 2.0}, "genres": {"prefer": ["Crime", "Drama"], "weight": 1.0}}',
 true, 130),

('tv_soap', 'Soap Opera', 'Soap operas and melodramas.', '💔', 'tv',
 '{"media_type": {"include": ["tv"]}, "keywords": {"require_any": ["soap opera", "telenovela"], "weight": 2.0}, "genres": {"prefer": ["Drama"], "weight": 1.0}}',
 true, 131),

('tv_anthology', 'Anthology', 'Anthology series.', '📚', 'tv',
 '{"media_type": {"include": ["tv"]}, "keywords": {"require_any": ["anthology", "anthology series"], "weight": 2.0}}',
 true, 132),

('tv_variety', 'Variety Show', 'Variety and sketch shows.', '🎪', 'tv',
 '{"media_type": {"include": ["tv"]}, "keywords": {"require_any": ["variety", "sketch"], "weight": 2.0}, "genres": {"prefer": ["Comedy"], "weight": 1.0}}',
 true, 133),

('tv_talk', 'Talk Show', 'Talk shows and interviews.', '🎙️', 'tv',
 '{"media_type": {"include": ["tv"]}, "keywords": {"require_any": ["talk show", "interview show"], "weight": 2.0}}',
 true, 134),

('tv_game', 'Game Show', 'Game shows and competitions.', '🎲', 'tv',
 '{"media_type": {"include": ["tv"]}, "keywords": {"require_any": ["game show", "quiz"], "weight": 2.0}}',
 true, 135),

('tv_news', 'News', 'News programs.', '📰', 'tv',
 '{"media_type": {"include": ["tv"]}, "keywords": {"require_any": ["news", "newscast"], "weight": 2.0}}',
 true, 136),

('tv_kids', 'Kids TV', 'Children''s television programs.', '🧒', 'tv',
 '{"media_type": {"include": ["tv"]}, "certifications": {"mode": "include", "include": ["TV-Y", "TV-Y7", "TV-G"], "weight": 2.0}, "genres": {"prefer": ["Family", "Animation"], "weight": 1.0}}',
 true, 137),

('tv_dating', 'Dating Shows', 'Dating and relationship reality shows.', '💕', 'tv',
 '{"media_type": {"include": ["tv"]}, "keywords": {"require_any": ["dating", "dating show", "bachelor"], "weight": 2.0}, "genres": {"prefer": ["Reality"], "weight": 1.0}}',
 true, 138),

('tv_cooking', 'Cooking Shows', 'Cooking and food competition shows.', '👨‍🍳', 'tv',
 '{"media_type": {"include": ["tv"]}, "keywords": {"require_any": ["cooking show", "chef", "baking"], "weight": 2.0}}',
 true, 139),

('tv_true_crime', 'True Crime Series', 'True crime TV series.', '🔎', 'tv',
 '{"media_type": {"include": ["tv"]}, "keywords": {"require_any": ["true crime"], "weight": 2.0}, "genres": {"prefer": ["Documentary", "Crime"], "weight": 1.0}}',
 true, 140),

('tv_late_night', 'Late Night', 'Late night talk and variety shows.', '🌙', 'tv',
 '{"media_type": {"include": ["tv"]}, "keywords": {"require_any": ["late night", "tonight show"], "weight": 2.0}}',
 true, 141),

('tv_daytime', 'Daytime', 'Daytime television programming.', '☀️', 'tv',
 '{"media_type": {"include": ["tv"]}, "keywords": {"require_any": ["daytime"], "weight": 2.0}}',
 true, 142),

('tv_documentary', 'Doc Series', 'Documentary television series.', '📚', 'tv',
 '{"media_type": {"include": ["tv"]}, "genres": {"require_any": ["Documentary"], "weight": 2.0}}',
 true, 143)

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
    new_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO preset_count FROM content_presets WHERE is_system = true;
    new_count := preset_count - 46;
    
    RAISE NOTICE 'Content Presets Expansion Migration (044) completed successfully';
    RAISE NOTICE 'Total system presets: % (added 122 new presets)', preset_count;
    RAISE NOTICE 'New presets by category:';
    RAISE NOTICE '  - Audience: +4 (kids_older, young_adult, date_night, background)';
    RAISE NOTICE '  - Genre Core: +5 (action, thriller, mystery, history, biographical)';
    RAISE NOTICE '  - Genre Subgenres: +25 (action_comedy, romantic_comedy, etc.)';
    RAISE NOTICE '  - Genre Special Interest: +15 (true_crime, nature, science, etc.)';
    RAISE NOTICE '  - Franchise: +18 (illumination, a24, blumhouse, etc.)';
    RAISE NOTICE '  - Temporal: +7 (silent_era, new_hollywood, 2000s, etc.)';
    RAISE NOTICE '  - Quality: +8 (critically_acclaimed, indie, blockbuster, etc.)';
    RAISE NOTICE '  - Seasonal: +6 (thanksgiving, valentines, easter, etc.)';
    RAISE NOTICE '  - Regional: +20 (english, australian, japanese, etc.)';
    RAISE NOTICE '  - TV: +14 (tv_procedural, tv_soap, tv_anthology, etc.)';
END $$;

COMMIT;
