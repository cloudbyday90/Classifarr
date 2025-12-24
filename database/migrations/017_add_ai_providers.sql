-- Unified AI provider configuration
-- Supports Ollama (local) and cloud providers (OpenAI, OpenRouter, LiteLLM, Custom)

CREATE TABLE IF NOT EXISTS ai_provider_config (
    id SERIAL PRIMARY KEY,

-- Primary provider settings
primary_provider VARCHAR(50) DEFAULT 'none', -- 'none', 'ollama', 'openai', 'openrouter', 'litellm', 'custom'
api_endpoint VARCHAR(500),
api_key VARCHAR(500),
model VARCHAR(100),
temperature DECIMAL(3, 2) DEFAULT 0.7,
max_tokens INTEGER DEFAULT 2000,

-- Budget controls (for cloud providers)
monthly_budget_usd DECIMAL(10, 2),
current_month_usage_usd DECIMAL(10, 6) DEFAULT 0,
budget_alert_threshold INTEGER DEFAULT 80,
pause_on_budget_exhausted BOOLEAN DEFAULT true,
last_budget_reset DATE DEFAULT CURRENT_DATE,

-- Ollama fallback settings

ollama_fallback_enabled BOOLEAN DEFAULT false,
    ollama_for_basic_tasks BOOLEAN DEFAULT false,
    ollama_for_budget_exhausted BOOLEAN DEFAULT true,
    ollama_host VARCHAR(200) DEFAULT 'localhost',
    ollama_port INTEGER DEFAULT 11434,
    ollama_model VARCHAR(100) DEFAULT 'llama3.2',
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Token usage tracking (per-request, for cost tracking)
CREATE TABLE IF NOT EXISTS ai_usage_log (
    id SERIAL PRIMARY KEY,
    provider VARCHAR(50),
    model VARCHAR(100),
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    cost_usd DECIMAL(10, 6),
    request_type VARCHAR(50), -- 'classification', 'enrichment', etc.
    item_title VARCHAR(500),
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Monthly usage summary (for quick stats)
CREATE TABLE IF NOT EXISTS ai_usage_monthly (
    id SERIAL PRIMARY KEY,
    year_month VARCHAR(7), -- '2024-12'
    provider VARCHAR(50),
    total_requests INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_cost_usd DECIMAL(10, 6) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (year_month, provider)
);

-- Insert default config row (no provider configured)
INSERT INTO
    ai_provider_config (id, primary_provider)
SELECT 1, 'none'
WHERE
    NOT EXISTS (
        SELECT 1
        FROM ai_provider_config
        WHERE
            id = 1
    );