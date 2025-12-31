-- v0.35.0: Database Cleanup - Remove unused legacy tables
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 🛑 CRITICAL WARNING 🛑
--
-- THIS MIGRATION IS DEPRECATED.
--
-- Originally intended to clean up unused tables, it was discovered that ALL
-- of these tables are still ACTIVELY USED by critical system components.
--
-- Running these DROP statements causes:
--   - Notification System Failure (notification_config)
--   - SSL Settings Failure (ssl_config)
--   - Classification Failure (library_rules* tables)
--   - Webhook Failure (media_requests)
--   - Error Logging Failure (error_log)
--   - AI Config Failure (ollama_config)
--
-- DO NOT UNCOMMENT THESE LINES UNDER ANY CIRCUMSTANCES.
-- Tables are restored in migrations 035, 036, and 037.
--
-- ═══════════════════════════════════════════════════════════════════════════

-- Safe migration using IF EXISTS for backward compatibility
-- These tables can be re-added in future versions if needed

-- Drop unused legacy library rules tables
-- (Unified into library_pattern_suggestions and Rule Builder)
-- DROP TABLE IF EXISTS library_rules CASCADE;
-- DROP TABLE IF EXISTS library_rules_v2 CASCADE;
-- DROP TABLE IF EXISTS library_custom_rules CASCADE;

-- Drop unused configuration tables
-- (ollama_config merged into ai_provider_config)
-- DROP TABLE IF EXISTS ollama_config CASCADE;

-- Drop unused/unimplemented feature tables
-- DROP TABLE IF EXISTS ssl_config CASCADE;
-- DROP TABLE IF EXISTS notification_config CASCADE;
-- DROP TABLE IF EXISTS learning_patterns CASCADE;
-- DROP TABLE IF EXISTS media_requests CASCADE;

-- Drop content_analysis_log (empty, analysis stored in metadata)
-- DROP TABLE IF EXISTS content_analysis_log CASCADE;

-- Drop empty error_log (errors stored in app_log)
-- DROP TABLE IF EXISTS error_log CASCADE;

-- Clean up arr_profiles_cache if empty (cache table)
-- DROP TABLE IF EXISTS arr_profiles_cache CASCADE;

COMMENT ON
TABLE schema_migrations IS 'Migration 034 DEPRECATED (Do nothing)';