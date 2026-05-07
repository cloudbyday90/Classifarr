/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import fs from 'node:fs';
import { relative } from 'node:path';
import {
  METRICS,
  baselinePath,
  rootDir,
  readJson,
  getCurrentCoverage,
} from './coverage-ratchet-utils.mjs';

// Coverage tools can vary by a few hundredths between local/CI runs.
// Treat deltas within 0.05 percentage points as equivalent to avoid flaky gates.
const EPSILON = 0.05;
const SCOPE_NAMES = ['server', 'client'];
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';
const stepSummaryPath = process.env.GITHUB_STEP_SUMMARY;

function formatPct(value) {
  return `${value.toFixed(2)}%`;
}

function printSummary(rows) {
  console.log('Coverage ratchet summary:');
  for (const scope of SCOPE_NAMES) {
    console.log(`- ${scope}`);
    for (const row of rows.filter((candidate) => candidate.scope === scope)) {
      const previous = row.baseline;
      const now = row.current;
      const delta = row.delta;
      const deltaPrefix = delta >= 0 ? '+' : '';
      console.log(
        `  ${row.metric.padEnd(10)} baseline=${formatPct(previous)} current=${formatPct(now)} delta=${deltaPrefix}${delta.toFixed(2)}`
      );
    }
  }
}

function escapeGithubCommandValue(value) {
  return String(value)
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A');
}

function emitGithubError(message, baselineRelativePath) {
  if (!isGitHubActions) {
    return;
  }
  const title = escapeGithubCommandValue('Coverage Ratchet');
  const file = escapeGithubCommandValue(baselineRelativePath);
  const escapedMessage = escapeGithubCommandValue(message);
  console.error(`::error file=${file},title=${title}::${escapedMessage}`);
}

function writeStepSummary(rows, regressions) {
  if (!stepSummaryPath) {
    return;
  }

  const lines = [
    '### Coverage Ratchet',
    '',
    '| Scope | Metric | Baseline | Current | Delta | Status |',
    '|---|---|---:|---:|---:|---|',
  ];

  for (const row of rows) {
    const status = row.delta < -EPSILON ? 'regressed' : 'ok';
    const deltaPrefix = row.delta >= 0 ? '+' : '';
    lines.push(
      `| ${row.scope} | ${row.metric} | ${formatPct(row.baseline)} | ${formatPct(row.current)} | ${deltaPrefix}${row.delta.toFixed(2)} | ${status} |`
    );
  }

  lines.push('');
  if (regressions.length > 0) {
    lines.push('Result: failed');
    lines.push('');
    for (const issue of regressions) {
      lines.push(`- ${issue}`);
    }
  } else {
    lines.push('Result: passed');
  }
  lines.push('');

  fs.appendFileSync(stepSummaryPath, `${lines.join('\n')}\n`, 'utf8');
}

function main() {
  const baseline = readJson(baselinePath);
  const current = getCurrentCoverage();
  const regressions = [];
  const baselineRelativePath = relative(rootDir, baselinePath);
  const rows = [];

  for (const scope of SCOPE_NAMES) {
    for (const metric of METRICS) {
      const previous = Number(baseline?.[scope]?.[metric]);
      const now = Number(current?.[scope]?.[metric]);
      if (!Number.isFinite(previous)) {
        regressions.push(
          `Missing baseline value for ${scope}.${metric} in ${baselineRelativePath}`
        );
        continue;
      }
      if (!Number.isFinite(now)) {
        regressions.push(`Missing current value for ${scope}.${metric}`);
        continue;
      }
      const delta = now - previous;
      rows.push({ scope, metric, baseline: previous, current: now, delta });
      if (delta < -EPSILON) {
        regressions.push(
          `${scope}.${metric} regressed: baseline=${formatPct(previous)} current=${formatPct(now)}`
        );
      }
    }
  }

  printSummary(rows);
  writeStepSummary(rows, regressions);

  if (regressions.length > 0) {
    console.error('\nCoverage ratchet failed:');
    for (const issue of regressions) {
      console.error(`- ${issue}`);
      emitGithubError(issue, baselineRelativePath);
    }
    console.error(
      '\nIf this reduction is intentional, run `npm run coverage:ratchet:update` and commit the updated baseline.'
    );
    process.exit(1);
  }

  console.log('\nCoverage ratchet passed (no regressions detected).');
}

try {
  main();
} catch (error) {
  console.error(`Coverage ratchet check failed: ${error.message}`);
  process.exit(1);
}
