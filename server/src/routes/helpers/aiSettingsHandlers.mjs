/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import * as encryptionModule from '../../utils/encryption.mjs';
import {
  getDefaultAiSettingsConfig,
  validateAiSettingsPayloadKeys,
} from './aiSettingsHelpers.mjs';
import { persistAiSettingsConfig } from './aiSettingsPersistence.mjs';
import { finalizeAiSettingsResponseConfig } from './aiSettingsResponseSupport.mjs';

export function createAiSettingsHandlers({
  db,
  logger,
  cloudLLMService,
  aiRouterService,
  ollamaService,
  embeddingProvider,
  embeddingRouter,
  getRagLoopDefaultConfig,
  validateAndNormalizeRagLoopConfig,
  validateRagLoopConfigPayloadKeys,
  resolveRequestApiKey,
  encryptValue = encryptionModule.encryptValue,
  formatEncryptedValue = encryptionModule.formatEncryptedValue,
  parseEncryptedValue = encryptionModule.parseEncryptedValue,
  decryptValue = encryptionModule.decryptValue,
}) {
  return {
    async getConfig(_req, res) {
      try {
        const result = await db.query('SELECT * FROM ai_provider_config WHERE id = 1');

        if (result.rows.length === 0) {
          return res.json(getDefaultAiSettingsConfig(getRagLoopDefaultConfig));
        }

        const config = result.rows[0];
        const { normalizedConfig } = validateAndNormalizeRagLoopConfig(config, config);
        finalizeAiSettingsResponseConfig({
          config,
          normalizedConfig,
          config,
          parseEncryptedValue,
          decryptValue,
          stripInternalState: true,
        });

        return res.json(config);
      } catch (error) {
        if (error.code === '42P01') {
          return res.json(getDefaultAiSettingsConfig(getRagLoopDefaultConfig, {
            table_not_ready: true,
          }));
        }
        return res.status(500).json({ error: error.message });
      }
    },

    async updateConfig(req, res) {
      const ragLoopConfigKeyValidation = validateRagLoopConfigPayloadKeys(req.body || {});
      if (!ragLoopConfigKeyValidation.valid) {
        return res.status(400).json({
          error: 'Unsupported RAG loop configuration keys in payload. Please reload the page and try again.',
          unknown_rag_loop_config_keys: ragLoopConfigKeyValidation.unknownKeys,
          disallowed_rag_loop_override_keys: ragLoopConfigKeyValidation.disallowedKeys,
        });
      }

      const aiSettingsKeyValidation = validateAiSettingsPayloadKeys(req.body || {}, getRagLoopDefaultConfig());
      if (!aiSettingsKeyValidation.valid) {
        return res.status(400).json({
          error: 'Unsupported AI settings keys in payload. Please reload the page and try again.',
          unknown_ai_settings_keys: aiSettingsKeyValidation.unknownKeys,
        });
      }

      try {
        const config = await db.withTransaction(async (client) => {
          return persistAiSettingsConfig({
            client,
            body: req.body,
            logger,
            validateAndNormalizeRagLoopConfig,
            encryptValue,
            formatEncryptedValue,
          });
        }); // end withTransaction

        aiRouterService.clearCache();
        ollamaService.resetConfig();
        embeddingProvider.resetConfig();
        embeddingRouter.resetConfig();

        finalizeAiSettingsResponseConfig({
          config,
          config,
          parseEncryptedValue,
          decryptValue,
        });

        return res.json(config);
      } catch (error) {
        if (error.httpStatus) {
          return res.status(error.httpStatus).json({ error: error.message, currentSum: error.currentSum });
        }
        return res.status(500).json({ error: error.message });
      }
    },

    async testConnection(req, res) {
      try {
        const { primary_provider, api_endpoint, api_key } = req.body;
        const testApiKey = await resolveRequestApiKey({
          dbOrClient: db,
          table: 'ai_provider_config',
          submittedApiKey: api_key,
          allowStoredFallback: true,
        });

        if (!testApiKey) {
          return res.status(400).json({ success: false, error: 'API key is required' });
        }

        const result = await cloudLLMService.testConnection({
          primary_provider,
          api_endpoint,
          api_key: testApiKey,
        });

        return res.json(result);
      } catch (error) {
        return res.json({ success: false, error: error.message });
      }
    },

    async getModels(req, res) {
      try {
        const { primary_provider, api_endpoint, api_key } = req.body;
        const actualApiKey = await resolveRequestApiKey({
          dbOrClient: db,
          table: 'ai_provider_config',
          submittedApiKey: api_key,
          allowStoredFallback: true,
        });

        if (!actualApiKey) {
          return res.status(400).json({ success: false, error: 'API key is required', models: [] });
        }

        const models = await cloudLLMService.getModels({
          primary_provider,
          api_endpoint,
          api_key: actualApiKey,
        });

        return res.json({ success: true, models });
      } catch (error) {
        return res.json({ success: false, error: error.message, models: [] });
      }
    },

    async getUsage(_req, res) {
      try {
        const currentResult = await db.query(`
            SELECT 
                COUNT(*) as total_requests,
                SUM(total_tokens) as total_tokens,
                SUM(cost_usd) as total_cost,
                AVG(cost_usd) as avg_cost_per_call,
                SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_requests
            FROM ai_usage_log
            WHERE created_at >= date_trunc('month', CURRENT_DATE)
              AND success = true
        `);

        const lastMonthResult = await db.query(`
            SELECT * FROM ai_usage_monthly 
            WHERE year_month = to_char(CURRENT_DATE - interval '1 month', 'YYYY-MM')
        `);

        const budgetResult = await db.query(`
            SELECT monthly_budget_usd, current_month_usage_usd, budget_alert_threshold
            FROM ai_provider_config WHERE id = 1
        `);

        const recentResult = await db.query(`
            SELECT provider, model, total_tokens, cost_usd, request_type, item_title, success, created_at
            FROM ai_usage_log
            ORDER BY created_at DESC
            LIMIT 20
        `);

        const current = currentResult.rows[0] || {};
        const lastMonth = lastMonthResult.rows[0] || {};
        const budget = budgetResult.rows[0] || {};

        return res.json({
          currentMonth: {
            requests: parseInt(current.total_requests) || 0,
            tokens: parseInt(current.total_tokens) || 0,
            cost: parseFloat(current.total_cost) || 0,
            avgCostPerCall: parseFloat(current.avg_cost_per_call) || 0,
            successRate: current.total_requests > 0
              ? Math.round((current.successful_requests / current.total_requests) * 100)
              : 100,
          },
          lastMonth: {
            requests: parseInt(lastMonth.total_requests) || 0,
            tokens: parseInt(lastMonth.total_tokens) || 0,
            cost: parseFloat(lastMonth.total_cost_usd) || 0,
          },
          budget: {
            limit: parseFloat(budget.monthly_budget_usd) || null,
            used: parseFloat(budget.current_month_usage_usd) || 0,
            alertThreshold: budget.budget_alert_threshold || 80,
            percentUsed: budget.monthly_budget_usd
              ? Math.round((budget.current_month_usage_usd / budget.monthly_budget_usd) * 100)
              : 0,
          },
          recentRequests: recentResult.rows,
        });
      } catch (error) {
        if (error.code === '42P01') {
          return res.json({
            currentMonth: { requests: 0, tokens: 0, cost: 0, avgCostPerCall: 0 },
            lastMonth: { requests: 0, tokens: 0, cost: 0 },
            budget: { limit: null, used: 0, alertThreshold: 80 },
            recentRequests: [],
          });
        }
        return res.status(500).json({ error: error.message });
      }
    },

    async getStatus(_req, res) {
      try {
        const status = await aiRouterService.getStatus();
        return res.json(status);
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    },

    async resetUsage(_req, res) {
      try {
        await cloudLLMService.resetMonthlyUsage();
        return res.json({ success: true, message: 'Monthly usage reset successfully' });
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    },
  };
}

