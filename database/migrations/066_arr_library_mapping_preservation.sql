-- Migration: 066_arr_library_mapping_preservation.sql
-- Description: Add support for preserving *arr library mappings during CARSA (Clear And ReSyncAll)
-- Version: 0.40.0
-- Fixes: #177

-- Add app_notifications table for user notifications about mapping failures
CREATE TABLE IF NOT EXISTS app_notifications (
    id SERIAL PRIMARY KEY,
    type VARCHAR(20) NOT NULL CHECK (type IN ('info', 'warning', 'error', 'success')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    read_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_app_notifications_unread ON app_notifications (is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_notifications_created ON app_notifications (created_at DESC);
