/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { assertUpgradeDrillEnvironment } from './publishedUpgradeFixtures.mjs';
import { shouldRunCli } from '../utils/cliRuntime.mjs';
import { resourceStudyBudget } from './resourceStudyBudget.mjs';
import { readStudyCgroup } from './resourceStudyMetrics.mjs';
import { assertResourceStudyStartupReceipt } from './resourceStudyProfiles.mjs';
import { formatStudyBudgetDiagnostic } from './resourceStudyBudgetDiagnostic.mjs';

export async function runResourceStudy(mode) {
  assertUpgradeDrillEnvironment();
  assert.equal(process.env.CLASSIFARR_RESOURCE_STUDY, 'isolated-synthetic-v1');
  assert.ok(['seed', 'smoke', 'soak', 'capacity', 'image-index', 'image-index-mixed', 'classification-retrieval', 'budget-normal', 'budget-restore'].includes(mode));
  assert.equal(process.env.CLASSIFARR_RUNTIME_MODE, ['seed', 'budget-normal'].includes(mode) ? 'normal' : 'restore');
  const budget = process.env.CLASSIFARR_RESOURCE_STUDY_BUDGET || 'baseline';
  resourceStudyBudget(budget);
  if (mode.startsWith('budget-')) {
    const receipt = { budget, metrics: await readStudyCgroup() };
    assertResourceStudyStartupReceipt(receipt, budget);
    return receipt;
  }
  const db = await import('../config/database.mjs');
  try {
    assert.equal((await db.query('SELECT count(*)::integer AS count FROM libraries')).rows[0].count, 0);
    assert.equal((await db.query('SELECT count(*)::integer AS count FROM media_server')).rows[0].count, 0);
    assert.equal((await db.query("SELECT primary_provider FROM ai_provider_config WHERE id=1")).rows[0].primary_provider, 'none');
    if (mode === 'seed') {
      assert.equal((await db.query('SELECT count(*)::integer AS count FROM users')).rows[0].count, 0);
      const { hashPassword } = await import('../services/auth.mjs');
      await db.query("INSERT INTO users(username,password_hash,role) VALUES ('resource-study-admin',$1,'admin')",
        [await hashPassword(randomBytes(32).toString('hex'))]);
      return { seeded: true };
    }
    if (['image-index-mixed', 'classification-retrieval'].includes(mode)) {
      const { runImageIndexMixedStudy } = await import('./imageIndexMixedWorkload.mjs');
      return await runImageIndexMixedStudy(db, budget,
        value => process.stdout.write(`STUDY_PROGRESS ${JSON.stringify(value)}\n`), mode);
    }
    if (mode === 'image-index') {
      const { runImageIndexStudy } = await import('./imageIndexStudyWorkload.mjs');
      return await runImageIndexStudy(db, budget,
        value => process.stdout.write(`STUDY_PROGRESS ${JSON.stringify(value)}\n`));
    }
    const { runResourceStudyWorkload } = await import('./resourceStudyWorkload.mjs');
    return await runResourceStudyWorkload(db, mode,
      value => process.stdout.write(`STUDY_PROGRESS ${JSON.stringify(value)}\n`), budget);
  } finally { await db.pool.end(); }
}

if (shouldRunCli(import.meta)) {
  try {
    if (process.argv.length !== 3) throw new Error('invalid_study_arguments');
    process.stdout.write(`RESOURCE_STUDY ${JSON.stringify(await runResourceStudy(process.argv[2]))}\n`);
  } catch (error) {
    const diagnostic = formatStudyBudgetDiagnostic(error?.studyBudget);
    if (diagnostic) process.stderr.write(`${diagnostic}\n`);
    // Fixed assertion label and source locations only; never dump database values.
    process.stderr.write(`resource_study_failed ${error?.code === 'ERR_ASSERTION' ? 'assertion' : 'execution'}\n`);
    process.stderr.write(`${String(error.stack).split('\n').filter(line => /^\s+at /.test(line)).slice(0, 8).join('\n')}\n`);
    process.exitCode = 1;
  }
}
