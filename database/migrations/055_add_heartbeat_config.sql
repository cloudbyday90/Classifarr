-- Add heartbeat configuration columns to ai_provider_config
-- These control the provider lock system that prevents Ollama resource contention

ALTER TABLE ai_provider_config
  ADD COLUMN IF NOT EXISTS heartbeat_timeout INTEGER DEFAULT 30000;
  
ALTER TABLE ai_provider_config
  ADD COLUMN IF NOT EXISTS heartbeat_interval INTEGER DEFAULT 5000;
  
ALTER TABLE ai_provider_config
  ADD COLUMN IF NOT EXISTS max_wait_time INTEGER DEFAULT 60000;

-- Initialize values for existing row if they don't exist
UPDATE ai_provider_config 
SET 
  heartbeat_timeout = COALESCE(heartbeat_timeout, 30000),
  heartbeat_interval = COALESCE(heartbeat_interval, 5000),
  max_wait_time = COALESCE(max_wait_time, 60000)
WHERE id = 1;
