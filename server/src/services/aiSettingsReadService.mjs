/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export function createAiSettingsReadService({ db, aiRouterService }) {
  return {
    async getUsageSummary() {
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

      return {
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
      };
    },

    getUsageFallback() {
      return {
        currentMonth: { requests: 0, tokens: 0, cost: 0, avgCostPerCall: 0 },
        lastMonth: { requests: 0, tokens: 0, cost: 0 },
        budget: { limit: null, used: 0, alertThreshold: 80 },
        recentRequests: [],
      };
    },

    async getStatus() {
      return aiRouterService.getStatus();
    },
  };
}
