-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
-- GNU General Public License for more details.
--
-- You should have received a copy of the GNU General Public License
-- along with this program. If not, see <https://www.gnu.org/licenses/>.

-- Migration 075: Add Backup & Restore Tables
-- ═══════════════════════════════════════════════════════════════════════════
-- Description: Creates tables for backup audit trail and scheduled backups
-- Issue: #186 - Backup & Restore System

-- Backup audit trail
CREATE TABLE IF NOT EXISTS backup_audit (
  id SERIAL PRIMARY KEY,
  operation VARCHAR(50) NOT NULL, -- 'export', 'import', 'delete', 'download'
  backup_type VARCHAR(20) NOT NULL, -- 'encrypted', 'plaintext'
  filename VARCHAR(255) NOT NULL,
  file_size BIGINT, -- size in bytes
  status VARCHAR(20) NOT NULL, -- 'success', 'failed'
  error_message TEXT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ip_address INET,
  metadata JSONB, -- Additional context (e.g., restore mode, options)
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backup_audit_operation ON backup_audit(operation);
CREATE INDEX IF NOT EXISTS idx_backup_audit_user ON backup_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_backup_audit_created ON backup_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_audit_status ON backup_audit(status);

-- Backup schedules (for future automated backups)
CREATE TABLE IF NOT EXISTS backup_schedules (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  cron_schedule VARCHAR(100) NOT NULL, -- e.g., '0 2 * * *' for 2am daily
  backup_type VARCHAR(20) NOT NULL DEFAULT 'encrypted', -- 'encrypted', 'plaintext'
  password_encrypted TEXT, -- Encrypted password for automated backups
  include_patterns BOOLEAN DEFAULT true,
  retention_days INTEGER DEFAULT 30, -- Auto-delete backups older than this
  is_enabled BOOLEAN DEFAULT true,
  last_run_at TIMESTAMP,
  last_run_status VARCHAR(20), -- 'success', 'failed'
  last_run_error TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backup_schedules_enabled ON backup_schedules(is_enabled);
CREATE INDEX IF NOT EXISTS idx_backup_schedules_last_run ON backup_schedules(last_run_at DESC);
