-- v0.37.0: Event Detection Presets
-- ═══════════════════════════════════════════════════════════════════════════
-- This migration migrates event detection from hardcoded detectEventContent()
-- to PolicyEngine presets, enabling policy-based event classification.
-- 
-- Related Issue: #98 (AI Optimization & Event Detection Migration)
-- Parent Epic: #82 (v0.37.0 Formula-Based Classification Engine)
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ============================================================================
-- EVENT DETECTION PRESETS - 6 new presets
-- ============================================================================
-- These presets replace the hardcoded event detection logic in detectEventContent()
-- Event types: holiday, sports, ppv, concert, standup, awards
-- ============================================================================

INSERT INTO content_presets (key, name, description, icon, category, signals, is_system, display_order)
VALUES
-- Holiday Content
('event_holiday', 'Holiday & Seasonal', 'Christmas, Halloween, and seasonal content', '🎄', 'events',
 '{"keywords": {"require_any": ["christmas", "xmas", "santa", "santa claus", "north pole", "reindeer", "rudolph", "frosty", "snowman", "christmas eve", "yuletide", "noel", "nativity", "scrooge", "grinch", "krampus", "nutcracker", "polar express", "mistletoe", "candy cane", "gingerbread", "halloween", "trick or treat", "haunted", "hanukkah", "chanukah", "kwanzaa", "thanksgiving", "easter", "valentines day", "new years eve"], "weight": 2.0}, "base_confidence": 95}',
 true, 200),

-- Sports Content
('event_sports', 'Sports & Athletics', 'Sports events, documentaries, and athletics', '🏈', 'events',
 '{"keywords": {"require_any": ["nfl", "nba", "mlb", "nhl", "mls", "fifa", "uefa", "premier league", "super bowl", "world series", "stanley cup", "world cup", "championship", "playoffs", "tournament", "olympics", "olympic games", "espn", "sports documentary", "football game", "basketball game", "baseball game", "hockey game", "soccer match", "tennis match", "golf tournament", "motorsports", "nascar", "formula 1", "f1", "grand prix", "marathon", "30 for 30"], "weight": 2.0}, "genres": {"prefer": ["Sport", "Documentary"], "weight": 0.5}, "base_confidence": 92}',
 true, 201),

-- PPV/Combat Sports
('event_ppv', 'PPV & Combat Sports', 'UFC, MMA, boxing, wrestling events', '🥊', 'events',
 '{"keywords": {"require_any": ["ufc", "mma", "ultimate fighting", "bellator", "pride fc", "one championship", "mixed martial arts", "cage fight", "octagon", "boxing", "heavyweight", "middleweight", "welterweight", "title fight", "championship bout", "knockout", "wwe", "wrestling", "wrestlemania", "royal rumble", "summerslam", "aew", "pro wrestling", "smackdown", "pay per view", "ppv", "fight night", "main event"], "weight": 2.0}, "base_confidence": 93}',
 true, 202),

-- Concert/Live Music
('event_concert', 'Concert & Live Music', 'Live concerts, music festivals, performances', '🎵', 'events',
 '{"keywords": {"require_any": ["concert", "live performance", "live tour", "world tour", "music festival", "coachella", "lollapalooza", "glastonbury", "rock concert", "pop concert", "symphony", "orchestra", "unplugged", "acoustic session", "mtv unplugged", "live album", "concert film", "tour documentary"], "weight": 2.0}, "genres": {"prefer": ["Music", "Documentary"], "weight": 0.5}, "base_confidence": 90}',
 true, 203),

-- Stand-up Comedy
('event_standup', 'Stand-up Comedy', 'Comedy specials and stand-up performances', '🎤', 'events',
 '{"keywords": {"require_any": ["stand-up", "standup", "comedy special", "netflix special", "hbo special", "live at the apollo", "def comedy jam", "comedian", "comedy tour", "comedy central", "roast", "just for laughs", "improv", "one-man show", "one-woman show"], "weight": 2.0}, "genres": {"prefer": ["Comedy"], "weight": 0.8}, "base_confidence": 90}',
 true, 204),

-- Awards Shows
('event_awards', 'Awards & Ceremonies', 'Award shows, galas, red carpet events', '🏆', 'events',
 '{"keywords": {"require_any": ["oscars", "academy awards", "emmys", "golden globes", "grammys", "tony awards", "bafta", "mtv awards", "vma", "ama", "billboard awards", "peoples choice", "critics choice", "sag awards", "bet awards", "award ceremony", "award show", "red carpet"], "weight": 2.0}, "base_confidence": 88}',
 true, 205)

ON CONFLICT (key) DO UPDATE SET
    signals = EXCLUDED.signals,
    description = EXCLUDED.description,
    display_order = EXCLUDED.display_order;

-- ============================================================================
-- MIGRATION HELPER: Auto-attach event presets to libraries with event_detection_type
-- ============================================================================
-- This function migrates existing libraries using event_detection_type to use
-- the new event presets via PolicyEngine
-- ============================================================================

DO $$
DECLARE
    lib_record RECORD;
    preset_key TEXT;
    preset_id_val INTEGER;
    policy_id_val INTEGER;
    event_type_mapping JSONB := '{
        "holiday": "event_holiday",
        "sports": "event_sports",
        "ppv": "event_ppv",
        "concert": "event_concert",
        "standup": "event_standup",
        "awards": "event_awards"
    }'::jsonb;
BEGIN
    -- Loop through libraries with event_detection_type set
    FOR lib_record IN 
        SELECT l.id, l.name, l.event_detection_type
        FROM libraries l
        WHERE l.event_detection_type IS NOT NULL
    LOOP
        -- Get corresponding preset key
        preset_key := event_type_mapping->>lib_record.event_detection_type;
        
        IF preset_key IS NULL THEN
            RAISE NOTICE 'Unknown event_detection_type: % for library %', 
                lib_record.event_detection_type, lib_record.name;
            CONTINUE;
        END IF;
        
        -- Get preset ID
        SELECT id INTO preset_id_val
        FROM content_presets
        WHERE key = preset_key;
        
        IF preset_id_val IS NULL THEN
            RAISE NOTICE 'Preset not found: % for library %', preset_key, lib_record.name;
            CONTINUE;
        END IF;
        
        -- Get or create policy for this library
        SELECT id INTO policy_id_val
        FROM library_policies
        WHERE library_id = lib_record.id
        LIMIT 1;
        
        IF policy_id_val IS NULL THEN
            -- Create policy for this library
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
                pattern_weight,
                rag_weight,
                history_weight
            ) VALUES (
                lib_record.id,
                lib_record.name || ' Policy',
                true,
                85,
                60,
                true,
                true,
                true,
                0.40,
                0.30,
                0.20,
                0.10
            )
            RETURNING id INTO policy_id_val;
            
            RAISE NOTICE 'Created policy for library: %', lib_record.name;
        END IF;
        
        -- Attach event preset to policy with high weight
        INSERT INTO policy_presets (policy_id, preset_id, weight, sort_order)
        VALUES (policy_id_val, preset_id_val, 1.5, 0)
        ON CONFLICT (policy_id, preset_id) DO UPDATE
        SET weight = 1.5, sort_order = 0;
        
        RAISE NOTICE 'Attached event preset % to library % via policy',
            preset_key, lib_record.name;
    END LOOP;
    
    RAISE NOTICE 'Event detection migration complete';
END $$;

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Check that event presets were created successfully
DO $$
DECLARE
    preset_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO preset_count FROM content_presets WHERE category = 'events';
    RAISE NOTICE 'Event presets created: %', preset_count;
    
    IF preset_count < 6 THEN
        RAISE WARNING 'Expected 6 event presets, found %', preset_count;
    END IF;
END $$;
