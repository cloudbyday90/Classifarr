/*
 * Migration: Add Auto-Learning Tables
 * Description: Creates tables for tracking auto-learned preferences and learning conflicts
 * Issue: #240 - Discord Verification Learning & Policy Auto-Enhancement
 */

-- Auto-learned preferences tracking
CREATE TABLE IF NOT EXISTS auto_learned_preferences (
  id SERIAL PRIMARY KEY,
  library_id INTEGER NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  policy_id INTEGER REFERENCES library_policies(id) ON DELETE CASCADE,
  preference_type VARCHAR(50) NOT NULL, -- 'genre_prefer', 'keyword_prefer', 'studio_prefer'
  preference_value TEXT NOT NULL,
  confidence_count INTEGER NOT NULL DEFAULT 1, -- How many confirmations led to this
  source VARCHAR(50) NOT NULL DEFAULT 'user_feedback', -- 'user_feedback', 'pattern_detection'
  learned_from_user_id VARCHAR(100), -- Discord user ID or system user
  learned_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'reverted', 'manual_override'
  reverted_at TIMESTAMP,
  reverted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  revert_reason TEXT,
  
  CONSTRAINT unique_library_preference UNIQUE(library_id, preference_type, preference_value)
);

CREATE INDEX IF NOT EXISTS idx_auto_learned_library ON auto_learned_preferences(library_id);
CREATE INDEX IF NOT EXISTS idx_auto_learned_status ON auto_learned_preferences(status);
CREATE INDEX IF NOT EXISTS idx_auto_learned_type ON auto_learned_preferences(preference_type);

-- Learning conflicts tracking
CREATE TABLE IF NOT EXISTS learning_conflicts (
  id SERIAL PRIMARY KEY,
  library_id INTEGER NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  conflict_type VARCHAR(50) NOT NULL, -- 'intra_library_exclusion', 'inter_library_conflict'
  preference_type VARCHAR(50) NOT NULL,
  preference_value TEXT NOT NULL,
  existing_signal_type VARCHAR(50),
  existing_signal_value TEXT,
  confirm_count INTEGER DEFAULT 0,
  reject_count INTEGER DEFAULT 0,
  net_confidence INTEGER GENERATED ALWAYS AS (confirm_count - reject_count) STORED,
  resolution_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'resolved', 'ignored'
  resolution_action VARCHAR(50), -- 'blocked', 'allowed', 'manual_review'
  resolved_at TIMESTAMP,
  resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  conflict_detected_at TIMESTAMP DEFAULT NOW(),
  last_updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_conflicts_library ON learning_conflicts(library_id);
CREATE INDEX IF NOT EXISTS idx_learning_conflicts_status ON learning_conflicts(resolution_status);
CREATE INDEX IF NOT EXISTS idx_learning_conflicts_type ON learning_conflicts(conflict_type);

-- Add indexes for performance on policy_feedback_log queries
CREATE INDEX IF NOT EXISTS idx_policy_feedback_tmdb ON policy_feedback_log(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_policy_feedback_library ON policy_feedback_log(selected_library_id);
CREATE INDEX IF NOT EXISTS idx_policy_feedback_prompted_at ON policy_feedback_log(prompted_at);

-- Learning rate limit tracking (materialized view for performance)
CREATE TABLE IF NOT EXISTS learning_rate_limits (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  library_id INTEGER NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  learn_timestamp TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_user_library_timestamp UNIQUE(user_id, library_id, learn_timestamp)
);

CREATE INDEX IF NOT EXISTS idx_learning_rate_user ON learning_rate_limits(user_id, learn_timestamp);
CREATE INDEX IF NOT EXISTS idx_learning_rate_library ON learning_rate_limits(library_id, learn_timestamp);
