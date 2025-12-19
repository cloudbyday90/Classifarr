/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 * Licensed under GPL-3.0 - See LICENSE file for details.
 */

-- Enhanced Error Logging for Bug Reports
CREATE TABLE IF NOT EXISTS error_log (
    id SERIAL PRIMARY KEY,
    error_id UUID DEFAULT gen_random_uuid() UNIQUE,
    level VARCHAR(10) NOT NULL CHECK (level IN ('ERROR', 'WARN', 'INFO', 'DEBUG')),
    module VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    stack_trace TEXT,
    request_context JSONB,
    system_context JSONB,
    metadata JSONB,
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_error_log_error_id ON error_log(error_id);
CREATE INDEX IF NOT EXISTS idx_error_log_level ON error_log(level);
CREATE INDEX IF NOT EXISTS idx_error_log_module ON error_log(module);
CREATE INDEX IF NOT EXISTS idx_error_log_created_at ON error_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_log_resolved ON error_log(resolved);

CREATE TABLE IF NOT EXISTS app_log (
    id SERIAL PRIMARY KEY,
    level VARCHAR(10) NOT NULL,
    module VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_log_level ON app_log(level);
CREATE INDEX IF NOT EXISTS idx_app_log_created_at ON app_log(created_at DESC);

INSERT INTO settings (key, value) VALUES
('log_retention_days', '30'),
('error_log_retention_days', '90'),
('log_level', 'INFO')
ON CONFLICT (key) DO NOTHING;
