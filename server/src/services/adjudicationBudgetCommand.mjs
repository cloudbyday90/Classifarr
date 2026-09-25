/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validateAdjudicationBudget, projectAdjudicationBudget } from './adjudicationBudgetContract.mjs';
import { createAdjudicationBudgetRepository } from './adjudicationBudgetRepository.mjs';
import { READ_ADJUDICATION_BUDGET_SQL } from './adjudicationBudgetSql.mjs';

export function parseAdjudicationBudgetCommand(values) {
  const configure = values['configure-source-pair-ai-budget'], status = values['source-pair-ai-budget-status'];
  const numeric = ['daily-calls','daily-tokens'];
  if (!configure && !status) {
    if (numeric.some(key => values[key] !== undefined)) throw new Error('adjudication_budget_mode_required');
    return null;
  }
  const allowed = configure ? ['configure-source-pair-ai-budget',...numeric] : ['source-pair-ai-budget-status'];
  if (Object.entries(values).some(([key,value]) => !allowed.includes(key) && value !== false)) throw new Error('adjudication_budget_modes_conflict');
  if (status) return { status: true };
  if (!numeric.every(key => /^(?:0|[1-9][0-9]{0,6})$/.test(values[key] ?? ''))) throw new Error('adjudication_budget_explicit_limits_required');
  return validateAdjudicationBudget({ dailyCalls: Number(values['daily-calls']), dailyTokens: Number(values['daily-tokens']) });
}
export async function runAdjudicationBudgetCommand(options) {
  const { LOG_CONFIG } = await import('../utils/logging/logConfig.mjs');
  if (LOG_CONFIG.level !== 'fatal' || LOG_CONFIG.fileLoggingEnabled !== false) throw new Error('adjudication_budget_private_logging_required');
  const db = await import('../config/database.mjs');
  try {
    const state = options.status ? (await db.query(READ_ADJUDICATION_BUDGET_SQL)).rows[0]
      : await createAdjudicationBudgetRepository(db).configure(options);
    return projectAdjudicationBudget(state);
  } finally { await db.pool.end(); }
}
