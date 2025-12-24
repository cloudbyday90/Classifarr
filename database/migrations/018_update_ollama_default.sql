-- Migration: Update Ollama default host to localhost
-- Fixes issue where prior default 'ollama' or full URL persists for users wanting 'localhost'

UPDATE ai_provider_config
SET
    ollama_host = 'localhost'
WHERE
    ollama_host = 'http://ollama:11434'
    OR ollama_host = 'ollama';