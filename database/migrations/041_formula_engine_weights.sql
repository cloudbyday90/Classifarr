-- v0.37.0: Formula-Based Classification Engine Configuration
-- ═══════════════════════════════════════════════════════════════════════════
-- This migration adds formula weight columns for the new formula-based
-- classification engine and changes pattern mining to be enabled by default
-- ═══════════════════════════════════════════════════════════════════════════

-- Add formula weight columns (recommended to sum to 1.0 for normalized scoring)
-- Pattern weight: contribution from historical pattern matches
ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS formula_pattern_weight REAL DEFAULT 0.40;

-- Rule weight: contribution from custom library rules
ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS formula_rule_weight REAL DEFAULT 0.30;

-- RAG weight: contribution from RAG similarity matching
ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS formula_rag_weight REAL DEFAULT 0.20;

-- History weight: contribution from classification history
ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS formula_history_weight REAL DEFAULT 0.10;

-- Change pattern mining default to true (was false, now standard behavior)
ALTER TABLE ai_provider_config
ALTER COLUMN pattern_mining_enabled SET DEFAULT true;

-- Enable patterns for existing installs that haven't opted in yet
-- This allows existing users to benefit from the new formula engine
UPDATE ai_provider_config 
SET pattern_mining_enabled = true 
WHERE pattern_mining_enabled IS NOT TRUE;

-- Add CHECK constraint to ensure formula weights sum to approximately 1.0
-- Using 0.99 to 1.01 range to allow for floating point precision
ALTER TABLE ai_provider_config
ADD CONSTRAINT formula_weights_sum_check
CHECK (
    formula_pattern_weight + formula_rule_weight + 
    formula_rag_weight + formula_history_weight 
    BETWEEN 0.99 AND 1.01
);

-- Add comments for documentation
COMMENT ON COLUMN ai_provider_config.formula_pattern_weight IS 'Formula weight for pattern matching (0.0-1.0, default 0.40)';
COMMENT ON COLUMN ai_provider_config.formula_rule_weight IS 'Formula weight for library rules (0.0-1.0, default 0.30)';
COMMENT ON COLUMN ai_provider_config.formula_rag_weight IS 'Formula weight for RAG similarity (0.0-1.0, default 0.20)';
COMMENT ON COLUMN ai_provider_config.formula_history_weight IS 'Formula weight for history matching (0.0-1.0, default 0.10)';
COMMENT ON COLUMN ai_provider_config.pattern_mining_enabled IS 'Enable pattern-based classification (default true as of v0.37.0)';
