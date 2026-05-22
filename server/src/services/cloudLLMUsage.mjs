/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export async function logUsage({ db, logger }, usage) {
    try {
        await db.query(`
            INSERT INTO ai_usage_log 
            (provider, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, request_type, item_title, success, error_message)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
            usage.provider,
            usage.model,
            usage.promptTokens,
            usage.completionTokens,
            usage.totalTokens,
            usage.costUSD,
            usage.requestType,
            usage.itemTitle,
            usage.success,
            usage.errorMessage
        ]);
    } catch (error) {
        logger.error('Failed to log AI usage', { error: error.message });
    }
}

export async function logEmbeddingCost({ db, logger }, provider, model, tokens, costUSD) {
    try {
        await db.query(`
            INSERT INTO embedding_costs 
            (provider, model, tokens, items_embedded, cost_usd, period_start)
            VALUES ($1, $2, $3, 1, $4, CURRENT_DATE)
        `, [provider, model, tokens, costUSD]);
    } catch (error) {
        logger.warn('Failed to log embedding cost', { error: error.message });
    }
}

export async function updateMonthlyUsage({ db, logger }, cost) {
    try {
        await db.query(`
            UPDATE ai_provider_config 
            SET current_month_usage_usd = current_month_usage_usd + $1,
                updated_at = NOW()
            WHERE id = 1
        `, [cost]);
    } catch (error) {
        logger.error('Failed to update monthly usage', { error: error.message });
    }
}

export async function checkBudget({ db, logger }) {
    try {
        const result = await db.query(`
            SELECT monthly_budget_usd, current_month_usage_usd, pause_on_budget_exhausted
            FROM ai_provider_config WHERE id = 1
        `);

        if (result.rows.length === 0) return { exhausted: false };

        const config = result.rows[0];
        if (!config.monthly_budget_usd) return { exhausted: false };

        const exhausted = parseFloat(config.current_month_usage_usd) >= parseFloat(config.monthly_budget_usd);

        return {
            exhausted,
            shouldPause: exhausted && config.pause_on_budget_exhausted,
            usage: parseFloat(config.current_month_usage_usd),
            budget: parseFloat(config.monthly_budget_usd),
            percentUsed: Math.round((config.current_month_usage_usd / config.monthly_budget_usd) * 100)
        };
    } catch (error) {
        logger.error('Failed to check budget', { error: error.message });
        return { exhausted: false };
    }
}

export async function resetMonthlyUsage({ db, logger }) {
    try {
        const currentMonth = new Date().toISOString().slice(0, 7);

        await db.query(`
            INSERT INTO ai_usage_monthly (year_month, provider, total_requests, total_tokens, total_cost_usd)
            SELECT 
                $1,
                provider,
                COUNT(*),
                SUM(total_tokens),
                SUM(cost_usd)
            FROM ai_usage_log
            WHERE created_at >= date_trunc('month', CURRENT_DATE)
            GROUP BY provider
            ON CONFLICT (year_month, provider) 
            DO UPDATE SET 
                total_requests = EXCLUDED.total_requests,
                total_tokens = EXCLUDED.total_tokens,
                total_cost_usd = EXCLUDED.total_cost_usd
        `, [currentMonth]);

        await db.query(`
            UPDATE ai_provider_config 
            SET current_month_usage_usd = 0,
                last_budget_reset = CURRENT_DATE,
                updated_at = NOW()
            WHERE id = 1
        `);

        logger.info('Monthly AI usage reset completed');
    } catch (error) {
        logger.error('Failed to reset monthly usage', { error: error.message });
    }
}

export async function getUsageStats({ db, logger }) {
    try {
        const currentResult = await db.query(`
            SELECT 
                COUNT(*) as total_requests,
                SUM(total_tokens) as total_tokens,
                SUM(cost_usd) as total_cost,
                SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_requests
            FROM ai_usage_log
            WHERE created_at >= date_trunc('month', CURRENT_DATE)
        `);

        const lastMonthResult = await db.query(`
            SELECT * FROM ai_usage_monthly 
            WHERE year_month = to_char(CURRENT_DATE - interval '1 month', 'YYYY-MM')
        `);

        const budgetResult = await db.query(`
            SELECT monthly_budget_usd, current_month_usage_usd, budget_alert_threshold
            FROM ai_provider_config WHERE id = 1
        `);

        const current = currentResult.rows[0] || {};
        const lastMonth = lastMonthResult.rows[0] || {};
        const budget = budgetResult.rows[0] || {};

        return {
            currentMonth: {
                requests: parseInt(current.total_requests) || 0,
                tokens: parseInt(current.total_tokens) || 0,
                cost: parseFloat(current.total_cost) || 0,
                successRate: current.total_requests > 0
                    ? Math.round((current.successful_requests / current.total_requests) * 100)
                    : 100
            },
            lastMonth: {
                requests: parseInt(lastMonth.total_requests) || 0,
                tokens: parseInt(lastMonth.total_tokens) || 0,
                cost: parseFloat(lastMonth.total_cost_usd) || 0
            },
            budget: {
                limit: parseFloat(budget.monthly_budget_usd) || null,
                used: parseFloat(budget.current_month_usage_usd) || 0,
                alertThreshold: budget.budget_alert_threshold || 80
            }
        };
    } catch (error) {
        logger.error('Failed to get usage stats', { error: error.message });
        return null;
    }
}
