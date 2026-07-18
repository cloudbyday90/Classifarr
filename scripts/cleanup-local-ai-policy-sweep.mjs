/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import * as db from '../server/src/config/database.mjs';
import { closeDatabasePool, runCliMain, shouldRunCli } from './lib/cliRuntime.mjs';

const DEFAULT_REPORTS_DIR = path.resolve('.tmp/reports');
const REPORT_FILE_PREFIX = 'ai-policy-sweep-';
const REPORT_FILE_SUFFIX = '.json';

function toPositiveInt(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function toIsoDate(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function normalizeIntList(values) {
  const deduped = new Set();
  for (const value of values) {
    const id = toPositiveInt(value);
    if (id) {
      deduped.add(id);
    }
  }
  return Array.from(deduped).sort((a, b) => a - b);
}

function parseArgs(argv) {
  const args = {
    reports: [],
    reportsDir: DEFAULT_REPORTS_DIR,
    allReports: false,
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === '--report' && next) {
      args.reports.push(path.resolve(next));
      i += 1;
    } else if (arg === '--reports-dir' && next) {
      args.reportsDir = path.resolve(next);
      i += 1;
    } else if (arg === '--all-reports') {
      args.allReports = true;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    }
  }

  return args;
}

function printHelp() {
  console.log([
    'Usage: node scripts/cleanup-local-ai-policy-sweep.mjs [options]',
    '',
    'Removes local-ai-policy-sweep generated DB artifacts so fixtures can be re-tested cleanly.',
    '',
    'Options:',
    '  --report <path>         Use a specific sweep report JSON file (repeatable).',
    '  --all-reports           Use every ai-policy-sweep-*.json report in reports dir.',
    '  --reports-dir <path>    Reports directory (default: .tmp/reports).',
    '  --dry-run               Print what would be removed without deleting.',
    '  --help, -h              Show this help.',
  ].join('\n'));
}

async function listReportFiles(reportsDir) {
  const entries = await readdir(reportsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.startsWith(REPORT_FILE_PREFIX) && name.endsWith(REPORT_FILE_SUFFIX))
    .map((name) => path.resolve(reportsDir, name));
}

async function readReport(filePath) {
  const content = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(content);
  const results = Array.isArray(parsed?.results) ? parsed.results : [];

  return {
    filePath,
    runStartedAt: toIsoDate(parsed?.runStartedAt),
    runFinishedAt: toIsoDate(parsed?.runFinishedAt),
    results,
  };
}

function collectTargetsFromReports(reports) {
  const classificationIds = [];
  const taskIds = [];
  const webhookLogIds = [];
  const identityPairs = new Set();
  const windows = [];

  for (const report of reports) {
    if (report.runStartedAt || report.runFinishedAt) {
      windows.push({
        start: report.runStartedAt,
        end: report.runFinishedAt || report.runStartedAt,
      });
    }

    for (const row of report.results) {
      const historyId = toPositiveInt(row?.historyRow?.id);
      if (historyId) {
        classificationIds.push(historyId);
      }

      const taskId = toPositiveInt(row?.submissionResponse?.taskId);
      if (taskId) {
        taskIds.push(taskId);
      }

      const logId = toPositiveInt(row?.submissionResponse?.logId);
      if (logId) {
        webhookLogIds.push(logId);
      }

      const tmdbId = toPositiveInt(row?.request?.tmdb_id);
      const mediaType = typeof row?.request?.media_type === 'string' ? row.request.media_type.trim().toLowerCase() : '';
      if (tmdbId && mediaType) {
        identityPairs.add(`${tmdbId}:${mediaType}`);
      }
    }
  }

  return {
    classificationIds: normalizeIntList(classificationIds),
    taskIds: normalizeIntList(taskIds),
    webhookLogIds: normalizeIntList(webhookLogIds),
    identityPairs,
    windows,
  };
}

function computeWindowBounds(windows) {
  const starts = windows.map((window) => window.start).filter(Boolean).map((value) => new Date(value).getTime());
  const ends = windows.map((window) => window.end).filter(Boolean).map((value) => new Date(value).getTime());

  if (starts.length === 0 || ends.length === 0) {
    return null;
  }

  const minStart = Math.min(...starts) - (5 * 60 * 1000);
  const maxEnd = Math.max(...ends) + (60 * 60 * 1000);
  return {
    startIso: new Date(minStart).toISOString(),
    endIso: new Date(maxEnd).toISOString(),
  };
}

async function resolveStragglerClassificationIds(client, targets) {
  const tmdbIds = Array.from(targets.identityPairs)
    .map((pair) => toPositiveInt(pair.split(':')[0]))
    .filter(Boolean);

  if (tmdbIds.length === 0) {
    return [];
  }

  const bounds = computeWindowBounds(targets.windows);
  if (!bounds) {
    return [];
  }

  const pairSet = targets.identityPairs;
  const result = await client.query(
    `SELECT id, tmdb_id, media_type
     FROM classification_history
     WHERE tmdb_id = ANY($1::int[])
       AND created_at >= $2::timestamptz
       AND created_at <= $3::timestamptz`,
    [tmdbIds, bounds.startIso, bounds.endIso]
  );

  return normalizeIntList(
    result.rows
      .filter((row) => pairSet.has(`${row.tmdb_id}:${String(row.media_type || '').trim().toLowerCase()}`))
      .map((row) => row.id)
  );
}

async function executeCleanup({ dryRun, reports }) {
  if (!Array.isArray(reports) || reports.length === 0) {
    throw new Error('No reports selected. Use --report <path> or --all-reports.');
  }

  const targets = collectTargetsFromReports(reports);

  return db.withTransaction(async (client) => {
    const stragglerIds = await resolveStragglerClassificationIds(client, targets);
    const classificationIds = normalizeIntList([...targets.classificationIds, ...stragglerIds]);

    if (classificationIds.length === 0 && targets.taskIds.length === 0 && targets.webhookLogIds.length === 0) {
      return {
        dryRun,
        reportsProcessed: reports.length,
        reportPaths: reports.map((report) => report.filePath),
        counts: {},
        targets: {
          classificationIds: [],
          taskIds: targets.taskIds,
          webhookLogIds: targets.webhookLogIds,
          stragglerClassificationIds: stragglerIds,
        },
      };
    }

    const counts = {};

    if (dryRun) {
      return {
        dryRun,
        reportsProcessed: reports.length,
        reportPaths: reports.map((report) => report.filePath),
        counts,
        targets: {
          classificationIds,
          taskIds: targets.taskIds,
          webhookLogIds: targets.webhookLogIds,
          stragglerClassificationIds: stragglerIds,
        },
      };
    }

    if (classificationIds.length > 0) {
      const mediaRequestResult = await client.query(
        'DELETE FROM media_requests WHERE classification_id = ANY($1::int[])',
        [classificationIds]
      );
      counts.mediaRequestsDeleted = mediaRequestResult.rowCount || 0;

      const webhookByClassificationResult = await client.query(
        'DELETE FROM webhook_log WHERE classification_id = ANY($1::int[])',
        [classificationIds]
      );
      counts.webhookLogsByClassificationDeleted = webhookByClassificationResult.rowCount || 0;

      const appNotificationsResult = await client.query(
        `DELETE FROM app_notifications
         WHERE data IS NOT NULL
           AND (
             (data ? 'classificationId' AND (data->>'classificationId') ~ '^[0-9]+$' AND (data->>'classificationId')::int = ANY($1::int[]))
             OR (data ? 'classification_id' AND (data->>'classification_id') ~ '^[0-9]+$' AND (data->>'classification_id')::int = ANY($1::int[]))
           )`,
        [classificationIds]
      );
      counts.appNotificationsDeleted = appNotificationsResult.rowCount || 0;

      const clarificationResponsesResult = await client.query(
        'DELETE FROM clarification_responses WHERE classification_id = ANY($1::int[])',
        [classificationIds]
      );
      counts.clarificationResponsesDeleted = clarificationResponsesResult.rowCount || 0;

      const contentAnalysisResult = await client.query(
        'DELETE FROM content_analysis_log WHERE classification_id = ANY($1::int[])',
        [classificationIds]
      );
      counts.contentAnalysisLogsDeleted = contentAnalysisResult.rowCount || 0;

      const correctionsResult = await client.query(
        'DELETE FROM classification_corrections WHERE classification_id = ANY($1::int[])',
        [classificationIds]
      );
      counts.classificationCorrectionsDeleted = correctionsResult.rowCount || 0;

      const embeddingsResult = await client.query(
        'DELETE FROM classification_embeddings WHERE classification_id = ANY($1::int[])',
        [classificationIds]
      );
      counts.classificationEmbeddingsDeleted = embeddingsResult.rowCount || 0;

      const embeddingErrorsResult = await client.query(
        'DELETE FROM embedding_errors WHERE classification_id = ANY($1::int[])',
        [classificationIds]
      );
      counts.embeddingErrorsDeleted = embeddingErrorsResult.rowCount || 0;

      const patternMatchResult = await client.query(
        'DELETE FROM pattern_match_log WHERE classification_id = ANY($1::int[])',
        [classificationIds]
      );
      counts.patternMatchLogsDeleted = patternMatchResult.rowCount || 0;

      const classificationHistoryResult = await client.query(
        'DELETE FROM classification_history WHERE id = ANY($1::int[])',
        [classificationIds]
      );
      counts.classificationHistoryDeleted = classificationHistoryResult.rowCount || 0;
    }

    if (targets.webhookLogIds.length > 0) {
      const webhookByIdResult = await client.query(
        'DELETE FROM webhook_log WHERE id = ANY($1::int[])',
        [targets.webhookLogIds]
      );
      counts.webhookLogsByIdDeleted = webhookByIdResult.rowCount || 0;
    }

    if (targets.taskIds.length > 0) {
      const taskQueueResult = await client.query(
        'DELETE FROM task_queue WHERE id = ANY($1::int[])',
        [targets.taskIds]
      );
      counts.taskQueueDeleted = taskQueueResult.rowCount || 0;
    }

    return {
      dryRun,
      reportsProcessed: reports.length,
      reportPaths: reports.map((report) => report.filePath),
      counts,
      targets: {
        classificationIds,
        taskIds: targets.taskIds,
        webhookLogIds: targets.webhookLogIds,
        stragglerClassificationIds: stragglerIds,
      },
    };
  });
}

function formatSummary(summary) {
  const lines = [];
  lines.push(`Reports processed: ${summary.reportsProcessed}`);
  lines.push(`Dry run: ${summary.dryRun ? 'yes' : 'no'}`);
  lines.push(`Classification IDs targeted: ${summary.targets.classificationIds.length}`);
  lines.push(`Task IDs targeted: ${summary.targets.taskIds.length}`);
  lines.push(`Webhook log IDs targeted: ${summary.targets.webhookLogIds.length}`);
  lines.push(`Straggler classification IDs detected: ${summary.targets.stragglerClassificationIds.length}`);

  if (!summary.dryRun) {
    lines.push('Deleted rows:');
    const orderedKeys = Object.keys(summary.counts).sort();
    for (const key of orderedKeys) {
      lines.push(`  - ${key}: ${summary.counts[key]}`);
    }
  }

  lines.push('Reports:');
  for (const reportPath of summary.reportPaths) {
    lines.push(`  - ${reportPath}`);
  }

  return lines.join('\n');
}

async function buildReportList(args) {
  const explicitReports = args.reports || [];
  if (args.allReports) {
    const autoReports = await listReportFiles(args.reportsDir);
    return Array.from(new Set([...explicitReports, ...autoReports]));
  }
  return Array.from(new Set(explicitReports));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const reportPaths = await buildReportList(args);
  if (reportPaths.length === 0) {
    throw new Error('No reports found. Provide --report <path> or use --all-reports.');
  }

  const reports = [];
  for (const reportPath of reportPaths) {
    reports.push(await readReport(reportPath));
  }

  await runCliMain({
    execute: () => executeCleanup({ dryRun: args.dryRun, reports }),
    onSuccess: (summary) => {
      console.log(formatSummary(summary));
    },
    shouldFail: () => false,
    failureMessage: 'Local AI policy sweep cleanup failed',
    cleanup: () => closeDatabasePool(db),
  });
}

if (shouldRunCli(import.meta)) {
  await main();
}
