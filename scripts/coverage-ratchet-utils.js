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

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const baselinePath = path.join(rootDir, 'docs', 'testing', 'coverage-baseline.json');
const serverSummaryPath = path.join(rootDir, 'server', 'coverage', 'coverage-summary.json');
const clientCoverageIndexPath = path.join(rootDir, 'client', 'coverage', 'index.html');

const METRICS = ['statements', 'branches', 'functions', 'lines'];

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${path.relative(rootDir, filePath)}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function toPercent(value) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid coverage percentage value: ${value}`);
  }
  return parsed;
}

function extractClientMetric(html, label) {
  const pattern = new RegExp(
    `<span class="strong">\\s*([0-9.]+)%\\s*</span>\\s*<span class="quiet">${label}</span>`,
    'i'
  );
  const match = html.match(pattern);
  if (!match) {
    throw new Error(`Unable to find client coverage metric: ${label}`);
  }
  return toPercent(match[1]);
}

function getCurrentCoverage() {
  const serverSummary = readJson(serverSummaryPath);
  const clientCoverageHtml = fs.readFileSync(clientCoverageIndexPath, 'utf8');

  return {
    server: {
      statements: toPercent(serverSummary.total.statements.pct),
      branches: toPercent(serverSummary.total.branches.pct),
      functions: toPercent(serverSummary.total.functions.pct),
      lines: toPercent(serverSummary.total.lines.pct),
    },
    client: {
      statements: extractClientMetric(clientCoverageHtml, 'Statements'),
      branches: extractClientMetric(clientCoverageHtml, 'Branches'),
      functions: extractClientMetric(clientCoverageHtml, 'Functions'),
      lines: extractClientMetric(clientCoverageHtml, 'Lines'),
    },
  };
}

module.exports = {
  METRICS,
  baselinePath,
  rootDir,
  readJson,
  getCurrentCoverage,
};

