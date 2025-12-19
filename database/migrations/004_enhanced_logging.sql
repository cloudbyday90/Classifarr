-- Enhanced Error Logging for Bug Reports
CREATE TABLE error_log (
    id SERIAL PRIMARY KEY,
    error_id UUID DEFAULT gen_random_uuid() UNIQUE,  -- Unique ID for bug reports
    level VARCHAR(10) NOT NULL CHECK (level IN ('ERROR', 'WARN', 'INFO', 'DEBUG')),
    module VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    stack_trace TEXT,
    request_context JSONB,  -- { url, method, params, body, userId, ip }
    system_context JSONB,   -- { nodeVersion, appVersion, uptime, memoryUsage }
    metadata JSONB,         -- Additional context (tmdbId, libraryId, etc.)
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_error_log_error_id ON error_log(error_id);
CREATE INDEX idx_error_log_level ON error_log(level);
CREATE INDEX idx_error_log_module ON error_log(module);
CREATE INDEX idx_error_log_created_at ON error_log(created_at DESC);
CREATE INDEX idx_error_log_resolved ON error_log(resolved);

-- Application Event Log (for activity tracking)
CREATE TABLE app_log (
    id SERIAL PRIMARY KEY,
    level VARCHAR(10) NOT NULL,
    module VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_app_log_level ON app_log(level);
CREATE INDEX idx_app_log_created_at ON app_log(created_at DESC);

-- Log retention settings
INSERT INTO settings (key, value) VALUES
('log_retention_days', '30'),
('error_log_retention_days', '90'),
('log_level', 'INFO')
ON CONFLICT (key) DO NOTHING;
