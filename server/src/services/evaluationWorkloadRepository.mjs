/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validateEvaluationWorkload, projectEvaluationWorkload } from './evaluationWorkloadContract.mjs';
import { READ_ADJUDICATION_BUDGET_SQL } from './adjudicationBudgetSql.mjs';
import { ADJUDICATION_RESERVED_TOKENS } from './adjudicationBudgetContract.mjs';

/** Admin controls share the existing ledger; edits cannot replenish work or erase cooldowns. */
export function createEvaluationWorkloadRepository(database) {
  return {
    read: () => database.withTransaction(async client => {
      await client.query("SET TRANSACTION READ ONLY; SET LOCAL statement_timeout='3s'");
      return projectEvaluationWorkload((await client.query(READ_ADJUDICATION_BUDGET_SQL)).rows[0]);
    }),
    configure: input => {
      const value = validateEvaluationWorkload(input);
      return database.withTransaction(async client => {
        await client.query("SET LOCAL statement_timeout='3s'; SET LOCAL lock_timeout='1s'");
        await client.query('INSERT INTO adjudication_capture_budget(singleton) VALUES(true) ON CONFLICT DO NOTHING');
        const result = await client.query(`UPDATE adjudication_capture_budget SET revision=revision+1,
          workload_mode=$2,window_start_minute=$3,window_end_minute=$4,daily_calls=$5,daily_tokens=$6,
          status=CASE WHEN $5=0 THEN 'disabled' ELSE 'ready' END
          WHERE singleton=true AND revision=$1`, [value.revision,value.mode === 'off' ? 'when_idle' : value.mode,
          value.startMinute,value.endMinute,value.dailyRequests,value.dailyRequests*ADJUDICATION_RESERVED_TOKENS]);
        if (result.rowCount !== 1) throw new Error('evaluation_workload_conflict');
        return projectEvaluationWorkload((await client.query(READ_ADJUDICATION_BUDGET_SQL)).rows[0]);
      });
    },
  };
}
