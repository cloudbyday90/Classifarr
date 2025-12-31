-- v0.35.0: Restore error_log Table
-- ═══════════════════════════════════════════════════════════════════════════
--
-- CRITICAL: This migration restores the error_log table that was incorrectly
-- dropped in migration 034_cleanup_unused_tables.sql.
--
-- The error_log table IS ACTIVELY USED by:
--   - server/src/utils/logger.js - Logger.persistToDb() writes ERROR/WARN logs
--   - server/src/routes/logs.js - Error Logs UI, export, stats, cleanup
--   - client/src/views/settings/ErrorLogs.vue - Error Logs settings page
--
-- DO NOT DROP THIS TABLE IN FUTURE CLEANUP MIGRATIONS!
-- ═══════════════════════════════════════════════════════════════════════════

-- Restore error_log table (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS error_log ( id SERIAL PRIMARY KEY,

-- Unique error ID for external reference (bug reports, Discord messages)
error_id UUID DEFAULT gen_random_uuid () UNIQUE,

-- Log level: ERROR, WARN, INFO, DEBUG
level VARCHAR(10) NOT NULL CHECK (
    level IN (
        'ERROR',
        'WARN',
        'INFO',
        'DEBUG'
    )
),

-- Module that generated the error (e.g., 'classification', 'ollama', 'queue')
module VARCHAR(100) NOT NULL,

-- Human-readable error message
message TEXT NOT NULL,

-- Stack trace for debugging
stack_trace TEXT,

-- Request context (method, url, headers, user) - helps reproduce issues
request_context JSONB,

-- System context (node version, memory, hostname) - helps diagnose env issues
system_context JSONB,

-- Additional metadata (sanitized, sensitive fields redacted)
metadata JSONB,

-- Resolution tracking for error management
resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Recreate indexes (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_error_log_error_id ON error_log (error_id);

CREATE INDEX IF NOT EXISTS idx_error_log_level ON error_log (level);

CREATE INDEX IF NOT EXISTS idx_error_log_module ON error_log (module);

CREATE INDEX IF NOT EXISTS idx_error_log_created_at ON error_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_error_log_resolved ON error_log (resolved);

-- Log the migration
COMMENT ON
TABLE error_log IS 'Application error/warning logs for debugging and bug reports. Used by Settings > Error Logs UI. DO NOT DROP.';