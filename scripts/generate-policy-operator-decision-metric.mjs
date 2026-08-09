#!/usr/bin/env node
/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  runPolicyOperatorDecisionMetricCli,
} from '../server/src/scripts/generatePolicyOperatorDecisionMetric.mjs';
import {
  pool,
} from '../server/src/config/database.mjs';

try {
  await runPolicyOperatorDecisionMetricCli();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await pool.end();
}
