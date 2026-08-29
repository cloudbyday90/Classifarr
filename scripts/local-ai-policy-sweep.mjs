/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  AI_CLASSIFICATION_EVALUATION_STATUS,
  buildSweepEvaluationArtifact,
  normalizeSweepFixtures,
} from './lib/aiClassificationEvaluationSweepAdapter.mjs';
import {
  validateAiPolicySweepFixtureDocument,
} from './lib/aiPolicySweepFixtureDocument.mjs';
import {
  appendAiPolicySweepFixtureProfile,
  verifyAiPolicySweepFixtureProfileBinding,
} from './lib/aiPolicySweepFixtureProfile.mjs';
import {
  createAuthenticatedLocalAiPolicySweepApi,
} from './lib/localAiPolicySweepAuthentication.mjs';

const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_FIXTURES = path.resolve('scripts/fixtures/ai-policy-sweep.fixtures.json');
const DEFAULT_HISTORY_LIMIT = 100;
const VALID_INGEST_MODES = new Set(['requests', 'webhook-overseerr', 'direct']);

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.CLASSIFARR_BASE_URL || DEFAULT_BASE_URL,
    token: process.env.CLASSIFARR_ACCESS_TOKEN || null,
    apiKey: process.env.CLASSIFARR_API_KEY || null,
    username: process.env.CLASSIFARR_USERNAME || null,
    password: process.env.CLASSIFARR_PASSWORD || null,
    ingestMode: process.env.CLASSIFARR_INGEST_MODE || 'requests',
    webhookKey: process.env.CLASSIFARR_WEBHOOK_KEY || null,
    models: (process.env.CLASSIFARR_MODELS || 'qwen3.5:4b').split(',').map((v) => v.trim()).filter(Boolean),
    fixturesPath: process.env.CLASSIFARR_FIXTURES || DEFAULT_FIXTURES,
    fixtureProfilePath: process.env.CLASSIFARR_FIXTURE_PROFILE || null,
    runsPerFixture: Number.parseInt(process.env.CLASSIFARR_RUNS_PER_FIXTURE || '1', 10),
    historyTimeoutMs: Number.parseInt(process.env.CLASSIFARR_HISTORY_TIMEOUT_MS || '60000', 10),
    historyPollIntervalMs: Number.parseInt(process.env.CLASSIFARR_HISTORY_POLL_INTERVAL_MS || '750', 10),
    outputPath: process.env.CLASSIFARR_REPORT_PATH || null,
    failOnFallback: process.env.CLASSIFARR_FAIL_ON_FALLBACK !== 'false',
    skipExistingFixtures: process.env.CLASSIFARR_SKIP_EXISTING_FIXTURES !== 'false',
    blockArrRouting: process.env.CLASSIFARR_BLOCK_ARR_ROUTING !== 'false',
    verifyQueueLifecycle: process.env.CLASSIFARR_VERIFY_QUEUE_LIFECYCLE !== 'false',
    allowCiRun: process.env.CLASSIFARR_ALLOW_CI_LOCAL_SWEEP === 'true',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === '--base-url' && next) {
      args.baseUrl = next;
      i += 1;
    } else if (arg === '--token' && next) {
      args.token = next;
      i += 1;
    } else if (arg === '--api-key' && next) {
      args.apiKey = next;
      i += 1;
    } else if (arg === '--username' && next) {
      args.username = next;
      i += 1;
    } else if (arg === '--password' && next) {
      args.password = next;
      i += 1;
    } else if (arg === '--ingest-mode' && next) {
      args.ingestMode = next.trim();
      i += 1;
    } else if (arg === '--webhook-key' && next) {
      args.webhookKey = next;
      i += 1;
    } else if (arg === '--models' && next) {
      args.models = next.split(',').map((v) => v.trim()).filter(Boolean);
      i += 1;
    } else if (arg === '--fixtures' && next) {
      args.fixturesPath = path.resolve(next);
      i += 1;
    } else if (arg === '--fixture-profile' && next) {
      args.fixtureProfilePath = path.resolve(next);
      i += 1;
    } else if (arg === '--runs-per-fixture' && next) {
      args.runsPerFixture = Number.parseInt(next, 10);
      i += 1;
    } else if (arg === '--history-timeout-ms' && next) {
      args.historyTimeoutMs = Number.parseInt(next, 10);
      i += 1;
    } else if (arg === '--history-poll-interval-ms' && next) {
      args.historyPollIntervalMs = Number.parseInt(next, 10);
      i += 1;
    } else if (arg === '--output' && next) {
      args.outputPath = path.resolve(next);
      i += 1;
    } else if (arg === '--allow-fallback') {
      args.failOnFallback = false;
    } else if (arg === '--include-existing-fixtures') {
      args.skipExistingFixtures = false;
    } else if (arg === '--allow-arr-routing') {
      args.blockArrRouting = false;
    } else if (arg === '--no-queue-lifecycle-verify') {
      args.verifyQueueLifecycle = false;
    } else if (arg === '--allow-ci-run') {
      args.allowCiRun = true;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    }
  }

  return args;
}

function printHelp() {
  console.log([
    'Usage: node scripts/local-ai-policy-sweep.mjs [options]',
    '',
    'Core options:',
    '  --base-url <url>                Classifarr base URL (default: http://localhost:3000)',
    '  --token <jwt>                   Access token (used when no API key is supplied)',
    '  --api-key <clf_...>             Admin API key; exchanged for short-lived scoped JWT',
    '  --username <username>           Admin username for /api/auth/login fallback',
    '  --password <password>           Admin password for /api/auth/login fallback',
    '  --ingest-mode <mode>            requests | webhook-overseerr | direct (default: requests)',
    '  --webhook-key <secret>          Required when --ingest-mode webhook-overseerr',
    '  --models <a,b,c>                Comma-separated ollama models (default: qwen3.5:4b)',
    '  --fixtures <path>               Fixture JSON path',
    '  --fixture-profile <path>        Local reviewed fixture profile pinned to policy context',
    '  --runs-per-fixture <n>          Repetitions per fixture per model (default: 1)',
    '  --history-timeout-ms <ms>       Wait time for persisted history entry (default: 60000)',
    '  --history-poll-interval-ms <ms> Poll interval when waiting for history row (default: 750)',
    '  --output <path>                 Output report path (default: .tmp/reports/...)',
    '  --allow-fallback                Do not fail run when method is fallback',
    '  --include-existing-fixtures     Do not filter out fixtures already present in synced library',
    '  --allow-arr-routing             Do not force require_all_confirmations=true during sweep',
    '  --no-queue-lifecycle-verify     Disable strict queue lifecycle verification (queued modes)',
    '  --allow-ci-run                 Allow execution when CI env var is detected (unsafe default off)',
    '',
    'Environment variable equivalents are supported with CLASSIFARR_* names.',
  ].join('\n'));
}

function isLikelyCiEnvironment() {
  const keys = ['CI', 'GITHUB_ACTIONS', 'TF_BUILD', 'BUILD_BUILDID', 'JENKINS_URL', 'GITLAB_CI'];
  return keys.some((key) => {
    const value = process.env[key];
    return value !== undefined && String(value).trim().length > 0 && String(value).toLowerCase() !== 'false';
  });
}

function assertNotCiUnlessAllowed(args) {
  if (args.allowCiRun) {
    return;
  }
  if (isLikelyCiEnvironment()) {
    throw new Error(
      'Refusing to run local-ai-policy-sweep in CI/CD. This harness requires local Ollama/Plex context. ' +
      'Override only when intentional with --allow-ci-run or CLASSIFARR_ALLOW_CI_LOCAL_SWEEP=true.'
    );
  }
}

function assertValidArgs(args) {
  if (!Array.isArray(args.models) || args.models.length === 0) {
    throw new Error('At least one model is required (set --models).');
  }
  if (!Number.isInteger(args.runsPerFixture) || args.runsPerFixture < 1) {
    throw new Error('--runs-per-fixture must be an integer >= 1.');
  }
  if (!Number.isInteger(args.historyTimeoutMs) || args.historyTimeoutMs < 1000) {
    throw new Error('--history-timeout-ms must be an integer >= 1000.');
  }
  if (!Number.isInteger(args.historyPollIntervalMs) || args.historyPollIntervalMs < 100) {
    throw new Error('--history-poll-interval-ms must be an integer >= 100.');
  }
  if (!VALID_INGEST_MODES.has(args.ingestMode)) {
    throw new Error(`--ingest-mode must be one of: ${Array.from(VALID_INGEST_MODES).join(', ')}`);
  }
  if (args.ingestMode === 'webhook-overseerr' && (!args.webhookKey || args.webhookKey.trim().length === 0)) {
    throw new Error('--webhook-key is required when --ingest-mode is webhook-overseerr.');
  }
}

function safeNowIso() {
  return new Date().toISOString();
}

function toBooleanSetting(value) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }
  return Boolean(value);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function readJsonFile(filePath) {
  const content = await readFile(filePath, 'utf8');
  return JSON.parse(content);
}

async function ensureDirForFile(filePath) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

function formatTimestampForPath(value = new Date()) {
  return value.toISOString().replace(/[:.]/g, '-');
}

function buildDefaultOutputPath() {
  const fileName = `ai-policy-sweep-${formatTimestampForPath()}.json`;
  return path.resolve('.tmp/reports', fileName);
}

function getAiSettingsWritePrecondition(response) {
  const writePrecondition = response?.headers?.get('etag');
  if (!writePrecondition) {
    throw new Error('AI settings response did not return its required write precondition.');
  }
  return writePrecondition;
}

function validateClassifyResponse(response, { failOnFallback }) {
  const issues = [];

  if (!response || typeof response !== 'object') {
    issues.push('Response is not an object.');
    return issues;
  }

  if (typeof response.method !== 'string' || response.method.length === 0) {
    issues.push('Response is missing method.');
  }

  if (response.method === 'fallback' && failOnFallback) {
    issues.push('Method returned fallback.');
  }

  if (response.needs_clarification === true) {
    if (!response.policy_question && !response.clarification) {
      issues.push('needs_clarification=true but no policy question payload found.');
    }
  } else if (response.needs_retry === true) {
    if (typeof response.reason !== 'string' || response.reason.length === 0) {
      issues.push('needs_retry=true but no reason found.');
    }
  } else {
    if (!response.library || typeof response.library !== 'object') {
      issues.push('Final response is missing library object.');
    }
    if (typeof response.confidence !== 'number' || Number.isNaN(response.confidence)) {
      issues.push('Final response is missing numeric confidence.');
    }
  }

  return issues;
}

function validateQueuedSubmissionResponse(response, mode) {
  const issues = [];
  if (!response || typeof response !== 'object') {
    issues.push('Submission response is not an object.');
    return issues;
  }

  if (response.success !== true) {
    issues.push('Submission response is missing success=true.');
  }

  if (response.queued !== true) {
    issues.push('Submission response is missing queued=true.');
  }

  if (!Number.isInteger(response.taskId)) {
    issues.push('Submission response is missing numeric taskId.');
  }

  if (!Number.isInteger(response.logId)) {
    issues.push('Submission response is missing numeric logId.');
  }

  if (mode === 'webhook-overseerr' && typeof response.message !== 'string') {
    issues.push('Webhook submission did not return expected message field.');
  }

  return issues;
}

function summarizeSubmissionResponse(response, mode) {
  return {
    mode,
    success: response?.success === true,
    queued: response?.queued === true,
    taskId: Number.isInteger(response?.taskId) ? response.taskId : null,
    logId: Number.isInteger(response?.logId) ? response.logId : null,
  };
}

function buildOverseerrLikeWebhookPayload(fixture, runIndex) {
  const requestId = Number(fixture.tmdb_id) * 10 + (runIndex + 1);
  return {
    notification_type: 'MEDIA_PENDING',
    event: 'media.pending',
    subject: fixture.title,
    media: {
      media_type: fixture.media_type,
      tmdbId: fixture.tmdb_id,
      title: fixture.title,
    },
    request: {
      id: requestId,
      is4k: false,
      requestedBy: {
        username: 'local-sweep',
        email: 'local-sweep@classifarr.local',
      },
      createdAt: safeNowIso(),
    },
  };
}

async function submitFixtureForIngestMode({ api, args, fixture, runIndex }) {
  if (args.ingestMode === 'direct') {
    const classifyResponse = await api.requestJson('/api/classification/classify', {
      method: 'POST',
      body: {
        tmdb_id: fixture.tmdb_id,
        media_type: fixture.media_type,
        title: fixture.title,
      },
    });

    return {
      mode: 'direct',
      submissionResponse: classifyResponse,
      validationIssues: validateClassifyResponse(classifyResponse, {
        failOnFallback: args.failOnFallback,
      }),
      classifyResponse,
    };
  }

  if (args.ingestMode === 'requests') {
    const submitResponse = await api.requestJson('/api/requests/submit', {
      method: 'POST',
      body: {
        tmdbId: fixture.tmdb_id,
        mediaType: fixture.media_type,
        title: fixture.title,
      },
    });

    return {
      mode: 'requests',
      submissionResponse: submitResponse,
      validationIssues: validateQueuedSubmissionResponse(submitResponse, 'requests'),
      classifyResponse: null,
    };
  }

  const webhookPayload = buildOverseerrLikeWebhookPayload(fixture, runIndex);
  const submitResponse = await api.requestJson(`/api/webhook/overseerr?key=${encodeURIComponent(args.webhookKey)}`, {
    method: 'POST',
    body: webhookPayload,
    includeAuth: false,
  });

  return {
    mode: 'webhook-overseerr',
    submissionResponse: submitResponse,
    validationIssues: validateQueuedSubmissionResponse(submitResponse, 'webhook-overseerr'),
    classifyResponse: null,
  };
}

async function fetchHistoryPage(api) {
  const page = await api.requestJson(`/api/classification/history?page=1&limit=${DEFAULT_HISTORY_LIMIT}`);
  return Array.isArray(page?.data) ? page.data : [];
}

async function checkFixtureAlreadyInLibrary(api, fixture) {
  const lookup = await api.requestJson(
    `/api/media-sync/lookup/${encodeURIComponent(String(fixture.tmdb_id))}?mediaType=${encodeURIComponent(fixture.media_type)}`,
  );

  return {
    exists: lookup?.exists === true,
    item: lookup?.item || null,
  };
}

async function waitForNewHistoryRow(api, existingIds, timeoutMs, pollMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const rows = await fetchHistoryPage(api);
    const found = rows.find((row) => !existingIds.has(row.id));
    if (found) {
      return found;
    }
    await sleep(pollMs);
  }

  return null;
}

async function waitForQueueDecisionWitness(api, taskId, timeoutMs, pollMs) {
  if (!Number.isSafeInteger(taskId) || taskId < 1) {
    return null;
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await api.requestJson(`/api/queue/tasks/${taskId}/decision-witness`);
    if (result?.available === true) {
      return result;
    }
    await sleep(pollMs);
  }

  return null;
}

function summarizeQueueDecisionWitness(result) {
  if (!result || result.available !== true || !result.decisionWitness) {
    return null;
  }

  return {
    queueTaskId: Number.isSafeInteger(result.queueTaskId) ? result.queueTaskId : null,
    classificationId: Number.isSafeInteger(result.classificationId) ? result.classificationId : null,
    version: result.decisionWitness.version || null,
    algorithm: result.decisionWitness.algorithm || null,
    fingerprint: result.decisionWitness.fingerprint || null,
  };
}

function recordHistoryObservation({ row, historyRow, report, args, existingHistoryIds = null }) {
  if (!historyRow) {
    return false;
  }

  if (existingHistoryIds) {
    existingHistoryIds.add(historyRow.id);
  }
  row.historyRow = {
    id: historyRow.id,
    status: historyRow.status,
    method: historyRow.method,
    confidence: historyRow.confidence,
    library_id: historyRow.library_id,
    library_name: historyRow.library_name,
  };
  report.summary.byHistoryStatus[historyRow.status] =
    (report.summary.byHistoryStatus[historyRow.status] || 0) + 1;

  if (historyRow.status === 'pending_retry') {
    report.summary.pendingRetryCount += 1;
  }
  if (historyRow.status === 'awaiting_decision') {
    report.summary.clarificationCount += 1;
  }
  if (historyRow.status === 'routed') {
    report.summary.routedCount += 1;
    if (args.blockArrRouting) {
      row.validationIssues.push('Persisted history status is routed while no-route guardrail is enabled.');
    }
  }
  if (historyRow.method === 'existing_media') {
    report.summary.existingMediaMethodCount += 1;
    row.validationIssues.push('Persisted history method returned existing_media; fixture likely contaminated by known media.');
  }
  if (historyRow.method === 'source_library') {
    report.summary.sourceLibraryMethodCount += 1;
    row.validationIssues.push('Persisted history method returned source_library; fixture likely contaminated by source-library signal.');
  }
  if (historyRow.method === 'fallback') {
    report.summary.fallbackCount += 1;
    if (args.failOnFallback) {
      row.validationIssues.push('Persisted history method returned fallback.');
    }
  }

  return true;
}

async function fetchQueueTaskSnapshot(api, taskId) {
  if (!Number.isInteger(taskId)) {
    return { status: null, source: null, error: null };
  }

  try {
    const [pendingTasks, failedTasks] = await Promise.all([
      api.requestJson('/api/queue/pending?limit=100'),
      api.requestJson('/api/queue/failed?limit=100'),
    ]);

    const pendingMatch = Array.isArray(pendingTasks)
      ? pendingTasks.find((task) => task?.id === taskId)
      : null;
    if (pendingMatch) {
      return {
        status: pendingMatch.status || 'pending',
        source: 'task_queue',
        error: null,
      };
    }

    const failedMatch = Array.isArray(failedTasks)
      ? failedTasks.find((task) => task?.id === taskId)
      : null;
    if (failedMatch) {
      return {
        status: failedMatch.status || 'failed',
        source: 'task_queue',
        error: failedMatch.error_message || null,
      };
    }

    return { status: null, source: null, error: null };
  } catch (error) {
    return { status: null, source: 'task_queue', error: error.message };
  }
}

async function fetchWebhookLogById(api, logId, maxPages = 4, limit = 50) {
  if (!Number.isInteger(logId)) {
    return null;
  }

  for (let page = 1; page <= maxPages; page += 1) {
    try {
      const payload = await api.requestJson(`/api/settings/webhook/logs?page=${page}&limit=${limit}`);
      const logs = Array.isArray(payload?.logs) ? payload.logs : [];
      const match = logs.find((entry) => entry?.id === logId);
      if (match) {
        return match;
      }

      const totalPages = Number.parseInt(payload?.totalPages, 10);
      if (Number.isInteger(totalPages) && page >= totalPages) {
        break;
      }
    } catch (_error) {
      return null;
    }
  }

  return null;
}

function classifyLifecycleTerminalStatus({ queueStatus, webhookStatus }) {
  const webhook = typeof webhookStatus === 'string' ? webhookStatus : null;
  const queue = typeof queueStatus === 'string' ? queueStatus : null;

  if (webhook === 'failed' || queue === 'failed') {
    return 'failed';
  }

  if (webhook === 'completed') {
    return 'completed';
  }

  return null;
}

async function verifyQueueLifecycle({ api, taskId, logId, timeoutMs, pollMs }) {
  const deadline = Date.now() + timeoutMs;
  const observedQueueStatuses = new Set();
  const observedWebhookStatuses = new Set();
  const observedSources = new Set();
  const errors = [];
  let terminalStatus = null;

  while (Date.now() < deadline) {
    const [queueSnapshot, webhookLog] = await Promise.all([
      fetchQueueTaskSnapshot(api, taskId),
      fetchWebhookLogById(api, logId),
    ]);

    if (queueSnapshot?.status) {
      observedQueueStatuses.add(queueSnapshot.status);
      if (queueSnapshot?.source) {
        observedSources.add(queueSnapshot.source);
      }
    }
    if (queueSnapshot?.error) {
      errors.push(`queue snapshot error: ${queueSnapshot.error}`);
    }

    const webhookStatus = typeof webhookLog?.processing_status === 'string'
      ? webhookLog.processing_status
      : null;
    if (webhookStatus) {
      observedWebhookStatuses.add(webhookStatus);
      observedSources.add('webhook_log');
    }

    terminalStatus = classifyLifecycleTerminalStatus({
      queueStatus: queueSnapshot?.status,
      webhookStatus,
    });

    if (terminalStatus) {
      break;
    }

    await sleep(pollMs);
  }

  return {
    taskId,
    logId,
    terminalStatus,
    queueStatuses: Array.from(observedQueueStatuses),
    webhookStatuses: Array.from(observedWebhookStatuses),
    observedSources: Array.from(observedSources),
    errors,
  };
}

async function runSweep() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  assertValidArgs(args);
  assertNotCiUnlessAllowed(args);

  const defaultFixtureDocument = await readJsonFile(args.fixturesPath);
  let fixtureDocument = defaultFixtureDocument;
  let fixtureProfileMetadata = null;
  if (args.fixtureProfilePath) {
    const profile = await readJsonFile(args.fixtureProfilePath);
    const profileAppend = appendAiPolicySweepFixtureProfile({
      fixtureDocument: defaultFixtureDocument,
      profile,
    });
    if (!profileAppend.validation.ok) {
      const detail = profileAppend.validation.issues
        .map(issue => `${issue.path}: ${issue.message}`)
        .join('\n');
      throw new Error(`Fixture profile is invalid:\n${detail}`);
    }
    fixtureDocument = profileAppend.fixtureDocument;
    fixtureProfileMetadata = profileAppend.profileMetadata;
  }
  const fixtureDocumentValidation = validateAiPolicySweepFixtureDocument(fixtureDocument);
  if (!fixtureDocumentValidation.ok) {
    const detail = fixtureDocumentValidation.issues
      .map(issue => `${issue.path}: ${issue.message}`)
      .join('\n');
    throw new Error(`Fixture document is invalid:\n${detail}`);
  }
  const fixtures = normalizeSweepFixtures(fixtureDocument);

  let token = args.token;
  if (!args.apiKey && typeof token === 'string' && token.startsWith('clf_')) {
    args.apiKey = token;
    token = null;
  }

  const authentication = await createAuthenticatedLocalAiPolicySweepApi({
    baseUrl: args.baseUrl,
    token,
    apiKey: args.apiKey,
    username: args.username,
    password: args.password,
  });

  if (authentication.authenticationMethod === 'api_key_exchange') {
    console.log('Authenticated via admin API key exchange and received scoped access token.');
    console.log('Scoped token read-only preflight succeeded.');
  } else if (authentication.authenticationMethod === 'password_login') {
    console.log('Authenticated via /api/auth/login and received access token.');
  }

  const { api } = authentication;

  const baselineAiConfigResponse = authentication.initialAiSettingsResponse ||
    await api.requestJsonWithResponse('/api/settings/ai');
  const [libraries, baselineHistory, baselineSettings, policyContext] = await Promise.all([
    api.requestJson('/api/libraries'),
    fetchHistoryPage(api),
    api.requestJson('/api/settings'),
    api.requestJson('/api/policies/evaluation-context'),
  ]);
  const baselineAiConfig = baselineAiConfigResponse.payload;
  let aiSettingsWritePrecondition = getAiSettingsWritePrecondition(baselineAiConfigResponse);

  const fixtureProfileBinding = verifyAiPolicySweepFixtureProfileBinding({
    profileMetadata: fixtureProfileMetadata,
    policyContext,
  });
  if (!fixtureProfileBinding.ok) {
    throw new Error(
      'Fixture profile does not match the active policy context; refusing before settings changes or media submission.'
    );
  }

  if (!Array.isArray(libraries) || libraries.length === 0) {
    throw new Error('No libraries configured. Configure at least one library before running policy+AI sweep tests.');
  }

  const existingHistoryIds = new Set(baselineHistory.map((row) => row.id));
  const baselineRequireAllConfirmations = toBooleanSetting(baselineSettings?.require_all_confirmations);

  const skippedExistingFixtures = [];
  const runnableFixtures = [];

  if (args.skipExistingFixtures) {
    for (const fixture of fixtures) {
      const existing = await checkFixtureAlreadyInLibrary(api, fixture);
      if (existing.exists) {
        skippedExistingFixtures.push({
          name: fixture.name || fixture.title || String(fixture.tmdb_id),
          tmdb_id: fixture.tmdb_id,
          media_type: fixture.media_type,
          title: fixture.title,
          existingItem: {
            library_id: existing.item?.library_id ?? null,
            library_name: existing.item?.library_name ?? null,
            title: existing.item?.title ?? null,
            media_type: existing.item?.media_type ?? null,
            tmdb_id: existing.item?.tmdb_id ?? null,
          },
        });
      } else {
        runnableFixtures.push(fixture);
      }
    }
  } else {
    runnableFixtures.push(...fixtures);
  }

  if (runnableFixtures.length === 0) {
    throw new Error('All fixtures are already present in synced libraries. Add new fixtures or pass --include-existing-fixtures.');
  }

  const runStartedAt = safeNowIso();
  const report = {
    runStartedAt,
    runFinishedAt: null,
    config: {
      baseUrl: args.baseUrl,
      ingestMode: args.ingestMode,
      fixturesPath: args.fixturesPath,
      fixtureProfileConfigured: fixtureProfileMetadata !== null,
      runsPerFixture: args.runsPerFixture,
      models: args.models,
      failOnFallback: args.failOnFallback,
      skipExistingFixtures: args.skipExistingFixtures,
      blockArrRouting: args.blockArrRouting,
      verifyQueueLifecycle: args.verifyQueueLifecycle,
      historyTimeoutMs: args.historyTimeoutMs,
      historyPollIntervalMs: args.historyPollIntervalMs,
    },
    preflight: {
      libraryCount: libraries.length,
      baselineAiModel: baselineAiConfig?.ollama_model || null,
      baselinePrimaryProvider: baselineAiConfig?.primary_provider || null,
      baselineRequireAllConfirmations,
      policyContext,
      fixtureProfile: fixtureProfileMetadata,
      fixturesRequested: fixtures.length,
      fixturesRunnable: runnableFixtures.length,
      fixturesSkippedAsExisting: skippedExistingFixtures.length,
    },
    skippedExistingFixtures,
    results: [],
    summary: {
      totalRuns: 0,
      passCount: 0,
      failCount: 0,
      byModel: {},
      byHistoryStatus: {},
      fallbackCount: 0,
      pendingRetryCount: 0,
      clarificationCount: 0,
      routedCount: 0,
      skippedExistingFixtures: skippedExistingFixtures.length,
      lifecycleFailures: 0,
      existingMediaMethodCount: 0,
      sourceLibraryMethodCount: 0,
      evaluationFixtureDefinitionCount: runnableFixtures.filter(fixture => fixture.evaluationFixture).length,
      evaluationFixtureDocumentCount: fixtureDocumentValidation.evaluationFixtureCount,
      evaluatedCount: 0,
      evaluationPassCount: 0,
      evaluationFailCount: 0,
      evaluationInvalidCount: 0,
      evaluationNotEvaluatedCount: 0,
    },
  };

  console.log(`Starting local policy->AI model sweep at ${runStartedAt}`);
  console.log(`Ingest mode: ${args.ingestMode}`);
  console.log(`Models: ${args.models.join(', ')}`);
  console.log(`Fixtures: requested=${fixtures.length}, runnable=${runnableFixtures.length}, skipped-existing=${skippedExistingFixtures.length}`);

  if (args.blockArrRouting && !baselineRequireAllConfirmations) {
    await api.requestJson('/api/settings', {
      method: 'PUT',
      body: {
        require_all_confirmations: 'true',
      },
    });
    console.log('Enabled no-route test guardrail (require_all_confirmations=true).');
  }

  try {
    for (const model of args.models) {
      console.log(`\n=== Model: ${model} ===`);

      const updatedAiConfigResponse = await api.requestJsonWithResponse('/api/settings/ai', {
        method: 'PUT',
        headers: { 'If-Match': aiSettingsWritePrecondition },
        body: {
          primary_provider: 'ollama',
          ollama_model: model,
          ollama_fallback_enabled: false,
        },
      });
      aiSettingsWritePrecondition = getAiSettingsWritePrecondition(updatedAiConfigResponse);

      report.summary.byModel[model] = report.summary.byModel[model] || {
        total: 0,
        passed: 0,
        failed: 0,
      };

      for (const fixture of runnableFixtures) {
        for (let runIndex = 0; runIndex < args.runsPerFixture; runIndex += 1) {
          const requestStarted = Date.now();
          const fixtureLabel = `${fixture.name || fixture.title || fixture.tmdb_id}#${runIndex + 1}`;

          const row = {
            model,
            fixture: fixtureLabel,
            request: {
              tmdb_id: fixture.tmdb_id,
              media_type: fixture.media_type,
              title: fixture.title,
            },
            requestStartedAt: safeNowIso(),
            responseLatencyMs: null,
            ingestMode: args.ingestMode,
            submissionResponse: null,
            validationIssues: [],
            historyRow: null,
            queueDecisionWitness: null,
            lifecycle: null,
            evaluation: null,
            status: 'pass',
          };

          try {
            const submission = await submitFixtureForIngestMode({ api, args, fixture, runIndex });
            row.responseLatencyMs = Date.now() - requestStarted;
            row.submissionResponse = summarizeSubmissionResponse(
              submission.submissionResponse,
              submission.mode,
            );
            row.validationIssues = [...submission.validationIssues];

            let lifecycleResult = null;
            const submittedTaskId = Number.isInteger(submission?.submissionResponse?.taskId)
              ? submission.submissionResponse.taskId
              : null;
            const submittedLogId = Number.isInteger(submission?.submissionResponse?.logId)
              ? submission.submissionResponse.logId
              : null;
            const persistedPromise = args.ingestMode === 'direct'
              ? waitForNewHistoryRow(
                api,
                existingHistoryIds,
                args.historyTimeoutMs,
                args.historyPollIntervalMs,
              )
              : waitForQueueDecisionWitness(
                api,
                submittedTaskId,
                args.historyTimeoutMs,
                args.historyPollIntervalMs,
              );

            if (args.verifyQueueLifecycle && args.ingestMode !== 'direct' && submittedTaskId && submittedLogId) {
              lifecycleResult = await verifyQueueLifecycle({
                api,
                taskId: submittedTaskId,
                logId: submittedLogId,
                timeoutMs: args.historyTimeoutMs,
                pollMs: args.historyPollIntervalMs,
              });
              row.lifecycle = lifecycleResult;
            }

            const persisted = await persistedPromise;

            if (args.ingestMode === 'direct' && !persisted) {
              row.validationIssues.push('No new classification_history row found within timeout window.');
            } else if (args.ingestMode !== 'direct' && !persisted) {
              row.validationIssues.push('No queue decision witness was available within timeout window.');
            } else if (args.ingestMode === 'direct') {
              recordHistoryObservation({
                row,
                historyRow: persisted,
                report,
                args,
                existingHistoryIds,
              });
            } else {
              row.queueDecisionWitness = summarizeQueueDecisionWitness(persisted);
              recordHistoryObservation({
                row,
                historyRow: persisted.history
                  ? {
                    id: persisted.history.id,
                    status: persisted.history.status,
                    method: persisted.history.method,
                    confidence: persisted.history.confidence,
                    library_id: persisted.history.libraryId,
                    library_name: persisted.history.libraryName,
                  }
                  : null,
                report,
                args,
              });
            }

            row.evaluation = buildSweepEvaluationArtifact({
              fixture,
              classificationResponse: submission.classifyResponse,
              queueDecisionWitness: persisted?.decisionWitness || null,
              historyRow: row.historyRow,
              policyContext,
              runtime: {
                model,
                ingestMode: args.ingestMode,
                requireAllConfirmations: args.blockArrRouting || baselineRequireAllConfirmations,
                aiConfig: {
                  primary_provider: 'ollama',
                  ollama_fallback_enabled: false,
                },
              },
            });

            if (row.evaluation.status === AI_CLASSIFICATION_EVALUATION_STATUS.EVALUATED) {
              report.summary.evaluatedCount += 1;
              if (row.evaluation.result.passed) {
                report.summary.evaluationPassCount += 1;
              } else {
                report.summary.evaluationFailCount += 1;
                row.validationIssues.push('Evaluation fixture did not meet its expected outcome.');
              }
            } else if (row.evaluation.status === AI_CLASSIFICATION_EVALUATION_STATUS.INVALID) {
              report.summary.evaluationInvalidCount += 1;
              row.validationIssues.push('Evaluation fixture does not satisfy the versioned contract.');
            } else if (row.evaluation.status === AI_CLASSIFICATION_EVALUATION_STATUS.NOT_EVALUATED) {
              report.summary.evaluationNotEvaluatedCount += 1;
              if (fixture.evaluationFixture && args.ingestMode !== 'direct') {
                row.validationIssues.push('Versioned queued fixture could not be evaluated from a valid decision witness.');
              }
            }

            if (args.verifyQueueLifecycle && args.ingestMode !== 'direct') {
              if (!row.lifecycle) {
                report.summary.lifecycleFailures += 1;
                row.validationIssues.push('Queue lifecycle verification did not run for queued submission.');
              } else {
                let lifecycleIssueDetected = false;
                const hasQueueDispatchEvidence = row.lifecycle.queueStatuses.includes('pending')
                  || row.lifecycle.queueStatuses.includes('processing')
                  || row.lifecycle.webhookStatuses.includes('queued')
                  || row.lifecycle.webhookStatuses.includes('received')
                  || row.lifecycle.webhookStatuses.includes('processing');

                if (!hasQueueDispatchEvidence) {
                  lifecycleIssueDetected = true;
                  row.validationIssues.push('Queue lifecycle did not observe dispatch evidence (pending/processing/queued/received).');
                }

                if (row.lifecycle.terminalStatus === 'failed') {
                  lifecycleIssueDetected = true;
                  row.validationIssues.push('Queue lifecycle reached failed terminal status.');
                } else if (!row.lifecycle.terminalStatus) {
                  lifecycleIssueDetected = true;
                  row.validationIssues.push('Queue lifecycle did not reach terminal status before timeout.');
                }

                if (row.lifecycle.errors.length > 0) {
                  lifecycleIssueDetected = true;
                  row.validationIssues.push(`Queue lifecycle observation errors: ${row.lifecycle.errors.join(' | ')}`);
                }

                if (lifecycleIssueDetected) {
                  report.summary.lifecycleFailures += 1;
                }
              }
            }
          } catch (error) {
            row.status = 'fail';
            row.validationIssues.push(error.message);
          }

          if (row.validationIssues.length > 0) {
            row.status = 'fail';
          }

          report.results.push(row);
          report.summary.totalRuns += 1;
          report.summary.byModel[model].total += 1;

          if (row.status === 'pass') {
            report.summary.passCount += 1;
            report.summary.byModel[model].passed += 1;
            console.log(`PASS ${fixtureLabel} (${row.responseLatencyMs}ms)`);
          } else {
            report.summary.failCount += 1;
            report.summary.byModel[model].failed += 1;
            console.log(`FAIL ${fixtureLabel}: ${row.validationIssues.join(' | ')}`);
          }
        }
      }
    }
  } finally {
    try {
      const restoredAiConfigResponse = await api.requestJsonWithResponse('/api/settings/ai', {
        method: 'PUT',
        headers: { 'If-Match': aiSettingsWritePrecondition },
        body: {
          primary_provider: baselineAiConfig?.primary_provider ?? 'none',
          ollama_model: baselineAiConfig?.ollama_model ?? 'llama3.2',
          model: baselineAiConfig?.model ?? '',
          ollama_fallback_enabled: baselineAiConfig?.ollama_fallback_enabled ?? false,
        },
      });
      getAiSettingsWritePrecondition(restoredAiConfigResponse);
      console.log('\nRestored baseline AI provider/model settings.');
    } catch (restoreError) {
      console.warn(`\nWARN: failed to restore baseline AI settings: ${restoreError.message}`);
    }

    try {
      if (args.blockArrRouting) {
        await api.requestJson('/api/settings', {
          method: 'PUT',
          body: {
            require_all_confirmations: baselineRequireAllConfirmations ? 'true' : 'false',
          },
        });
        console.log('Restored require_all_confirmations baseline setting.');
      }
    } catch (restoreError) {
      console.warn(`WARN: failed to restore require_all_confirmations setting: ${restoreError.message}`);
    }
  }

  report.runFinishedAt = safeNowIso();

  const outputPath = args.outputPath || buildDefaultOutputPath();
  await ensureDirForFile(outputPath);
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log('\n=== Summary ===');
  console.log(`Total runs: ${report.summary.totalRuns}`);
  console.log(`Pass: ${report.summary.passCount}`);
  console.log(`Fail: ${report.summary.failCount}`);
  console.log(`Fallback count: ${report.summary.fallbackCount}`);
  console.log(`Pending retry count: ${report.summary.pendingRetryCount}`);
  console.log(`Awaiting decision count: ${report.summary.clarificationCount}`);
  console.log(`Routed count: ${report.summary.routedCount}`);
  console.log(`Existing media method count: ${report.summary.existingMediaMethodCount}`);
  console.log(`Source library method count: ${report.summary.sourceLibraryMethodCount}`);
  console.log(`Lifecycle failure count: ${report.summary.lifecycleFailures}`);
  console.log(`Skipped existing fixtures: ${report.summary.skippedExistingFixtures}`);
  console.log(`Report: ${outputPath}`);

  if (report.summary.failCount > 0) {
    process.exitCode = 1;
  }
}

runSweep().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
});
