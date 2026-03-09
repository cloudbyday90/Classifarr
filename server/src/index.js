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

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const cookieParser = require('cookie-parser');

const db = require('./config/database');
const apiRouter = require('./routes/api');
const setupRouter = require('./routes/setup');
const authRouter = require('./routes/auth');
const systemRouter = require('./routes/system');
const discordBot = require('./services/discordBot');
const queueService = require('./services/queueService');
const errorHandler = require('./middleware/errorHandler');
const { ensureCsrfCookie, csrfProtection } = require('./middleware/csrf');
const { setLoggerDb } = require('./utils/logger');
const providerLock = require('./services/providerLock');
const avxGuard = require('./services/avxGuard');
const runtimeSettings = require('./config/runtimeSettings');

const app = express();
let server = null; // module-scope ref used by graceful shutdown handler
const PORT = process.env.PORT || 21324;
const SECURITY_HEADERS_STRICT = (process.env.SECURITY_HEADERS_STRICT || 'true').toLowerCase() !== 'false';
const ENFORCE_HTTPS_HEADERS = (process.env.ENFORCE_HTTPS_HEADERS || 'false').toLowerCase() === 'true';

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = runtimeSettings.getCorsOriginsList();
    if (allowedOrigins.length === 0) {
      if (!origin) return callback(null, true);
      return callback(null, origin);
    }
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, origin);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Webhook-Key', 'X-CSRF-Token'],
};

const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'"],
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
  fontSrc: ["'self'", 'data:'],
  connectSrc: ["'self'"],
  frameSrc: ["'none'"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
  // Disabled by default to avoid forcing HTTPS asset upgrades on local HTTP deployments.
  upgradeInsecureRequests: ENFORCE_HTTPS_HEADERS ? [] : null,
};

if (process.env.NODE_ENV !== 'production') {
  cspDirectives.connectSrc.push('http://localhost:*', 'ws://localhost:*');
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: cspDirectives,
  },
  // Disabled by default for local HTTP compatibility (Unraid/LAN).
  hsts: ENFORCE_HTTPS_HEADERS ? undefined : false,
  crossOriginOpenerPolicy: SECURITY_HEADERS_STRICT ? undefined : false,
  originAgentCluster: SECURITY_HEADERS_STRICT,
}));
app.use(cors(corsOptions));
app.use(morgan('combined'));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(ensureCsrfCookie);
app.use('/api', csrfProtection);

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Classifarr API',
      version: '1.0.0',
      description: 'AI-powered media classification for the *arr ecosystem',
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
      },
    ],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// API Routes
const userRouter = require('./routes/user');
app.use('/api/setup', setupRouter);  // Setup routes (no auth required)
app.use('/api/auth', authRouter);    // Auth routes
app.use('/api/user', userRouter);    // User profile routes (auth required)
app.use('/api/system', systemRouter); // System routes (auth required)
app.use('/api', apiRouter);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../public')));

// Classification progress API route (must be before catch-all)
const classificationProgressRouter = require('./routes/classificationProgress');
app.use('/api/classification/progress', classificationProgressRouter);

// Fallback to index.html for client-side routing (MUST BE LAST)
// Express 5 requires named wildcards: {*splat} matches all paths including /
app.get('{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Initialize Discord bot
async function initializeServices() {
  let runtimeWiringStatus = { ok: true, checked: 0, issues: [] };
  try {
    const startupService = require('./services/startupService');
    runtimeWiringStatus = startupService.validateRuntimeWiring();
  } catch (error) {
    runtimeWiringStatus = {
      ok: false,
      checked: 0,
      issues: [{ module: './services/startupService', expected: 'runtime wiring validation', actual: error.message }]
    };
    console.error('Runtime wiring validation bootstrap failed:', error.message);
  }

  try {
    console.log('Initializing Discord bot...');
    await discordBot.initialize();
    console.log('Discord bot initialized successfully');
  } catch (error) {
    console.warn('Discord bot initialization failed:', error.message);
    console.warn('Continuing without Discord notifications...');
  }

  if (!runtimeWiringStatus.ok) {
    console.error('Runtime wiring validation failed; queue and scheduler startup skipped', runtimeWiringStatus);
  } else {
    // Start queue worker
    try {
      queueService.startWorker();
      console.log('Queue worker started successfully');
    } catch (error) {
      console.warn('Queue worker start failed:', error.message);
    }

    // Start scheduler service
    try {
      const schedulerService = require('./services/scheduler');
      schedulerService.init(); // It was called init() in the class, but index.js called start(). Checked scheduler.js, it has init().
      console.log('Scheduler service started successfully');
    } catch (error) {
      console.warn('Scheduler service start failed:', error.message);
    }
  }

  // Initialize ProviderLock configuration (non-blocking defaults if unavailable)
  try {
    await providerLock.init();
    console.log('ProviderLock configuration loaded');
  } catch (error) {
    console.warn('ProviderLock configuration load failed:', error.message);
  }



  // Start health check heartbeat (every 15 minutes)
  try {
    const healthCheckService = require('./services/healthCheckService');
    healthCheckService.startHeartbeat(15 * 60 * 1000);
    console.log('Health check heartbeat started (15 min interval)');
  } catch (error) {
    console.warn('Health check heartbeat failed to start:', error.message);
  }

  // Start Ollama scheduled preflight check (daily)
  try {
    const ollamaService = require('./services/ollama');
    ollamaService.startScheduledPreflight(24 * 60 * 60 * 1000);
    console.log('Ollama scheduled preflight check started (24 hour interval)');
  } catch (error) {
    console.warn('Ollama scheduled preflight check failed to start:', error.message);
  }

  // Check and start embedding migration if needed
  try {
    const embeddingMigrationService = require('./services/embeddingMigrationService');
    await embeddingMigrationService.checkAndStartMigration();
    console.log('Embedding migration check completed');
  } catch (error) {
    console.warn('Embedding migration check failed:', error.message);
  }

  // Initialize backfill orchestrator
  try {
    const backfillOrchestrator = require('./services/backfillOrchestrator');
    await backfillOrchestrator.init();
    console.log('Backfill orchestrator initialized');
  } catch (error) {
    console.warn('Backfill orchestrator initialization failed:', error.message);
  }

  // Generate library profiles for all libraries with items (async, don't wait)
  try {
    const libraryProfileService = require('./services/libraryProfileService');
    // Run in background - don't block startup
    libraryProfileService.generateAllProfiles().then(results => {
      const success = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      console.log(`Startup library profile generation complete: ${success} success, ${failed} failed`);
    }).catch(error => {
      console.warn('Startup library profile generation failed:', error.message);
    });
  } catch (error) {
    console.warn('Library profile service not available:', error.message);
  }

  // Auto-create policies for libraries without one (handles Docker restart scenario)
  try {
    const result = await db.query(`
      INSERT INTO library_policies (library_id, name, description, enabled, priority, auto_classify_threshold, prompt_threshold)
      SELECT 
        l.id,
        l.name || ' Policy',
        'Auto-generated policy for ' || l.name,
        true,
        5,
        85,
        60
      FROM libraries l
      WHERE NOT EXISTS (
        SELECT 1 FROM library_policies lp WHERE lp.library_id = l.id
      )
      RETURNING library_id
    `);
    if (result.rows.length > 0) {
      console.log(`Startup policy generation: Created ${result.rows.length} policies for libraries without one`);
    }
  } catch (error) {
    console.warn('Startup policy generation failed:', error.message);
  }

  // Auto-queue items needing rating normalization (first 1000 items)
  try {
    const ratingNormalizer = require('./utils/ratingNormalizer');
    const needsSQL = ratingNormalizer.getNeedsNormalizationSQL();

    const result = await db.query(`
      SELECT COUNT(*) as count FROM media_server_items
      WHERE original_rating IS NULL
        AND content_rating IS NOT NULL
        AND ${needsSQL}
    `);

    const count = parseInt(result.rows[0].count);

    if (count > 0) {
      console.log(`Auto-queuing first 1000 items for rating normalization (${count} total need normalization)`);

      await db.query(`
        INSERT INTO task_queue (task_type, priority, payload, status)
        SELECT 'rating_normalization', 5, jsonb_build_object('media_item_id', id), 'pending'
        FROM media_server_items
        WHERE original_rating IS NULL
          AND content_rating IS NOT NULL
          AND ${needsSQL}
        LIMIT 1000
        ON CONFLICT DO NOTHING
      `);
    }
  } catch (error) {
    console.warn('Startup rating normalization check failed:', error.message);
  }

  // Auto-generate default API key if none exist
  try {
    const apiKeyService = require('./services/apiKeyService');
    await apiKeyService.ensureDefaultApiKey();
  } catch (error) {
    console.warn('Default API key generation failed:', error.message);
  }

  // Ensure webhook secret key exists
  try {
    const webhookService = require('./services/webhook');
    await webhookService.ensureSecretKey();
  } catch (error) {
    console.warn('Webhook secret key generation failed:', error.message);
  }
}

// Start server
async function startServer() {
  try {
    // Test database connection
    await db.query('SELECT 1');
    console.log('Database connected successfully');
    setLoggerDb(db);

    // Run database migrations
    try {
      const migrationRunner = require('./config/migrations');
      const result = await migrationRunner.run();
      console.log(`Migrations complete (${result.total} total, ${result.applied} newly applied)`);
    } catch (migrationError) {
      console.error('Migration error:', migrationError.message);
      // Continue anyway - some migrations might fail if already applied
    }

    // Prewarm HNSW vector indexes into shared_buffers after restart.
    // Front-loads disk I/O so the first RAG search isn't cold from disk.
    // Runs after migrations so the pg_prewarm extension is guaranteed to exist.
    // Non-blocking: a failure here (e.g. extension not yet installed) is only logged.
    try {
      const prewarmResult = await db.prewarmHnswIndexes();
      if (prewarmResult.loaded) {
        console.log(`HNSW indexes prewarmed: ${prewarmResult.blocks.text} text blocks, ${prewarmResult.blocks.image} image blocks`);
      }
    } catch (prewarmError) {
      console.warn('HNSW prewarm skipped:', prewarmError.message);
    }

    // Check whether pg_stat_statements is loaded and collecting.
    // This is informational only — a missing/inactive extension does not block startup.
    // The extension requires shared_preload_libraries to be set in postgresql.conf,
    // which only takes effect after a container restart (docker-entrypoint.sh sets it
    // on first boot / upgrade, but existing containers need a recreate to pick it up).
    try {
      const pgssResult = await db.checkPgStatStatements();
      if (pgssResult.active) {
        console.log('pg_stat_statements: active — query profiling is available');
      } else {
        console.warn(`pg_stat_statements: inactive — ${pgssResult.reason}`);
      }
    } catch (pgssError) {
      console.warn('pg_stat_statements check failed:', pgssError.message);
    }

    // Run post-upgrade tasks
    try {
      const postUpgradeService = require('./services/postUpgradeService');
      const taskResult = await postUpgradeService.runPendingTasks();
      console.log(`Post-upgrade tasks: ${taskResult.executed} executed, ${taskResult.skipped} already completed`);
    } catch (upgradeError) {
      console.error('Post-upgrade task error:', upgradeError.message);
      // Continue anyway - post-upgrade tasks are non-critical
    }

    // Ensure runtime settings file exists/syncs defaults for container deployments.
    runtimeSettings.ensureRuntimeSettingsFile();

    // Load DB-backed runtime settings overrides after migrations have run.
    await runtimeSettings.refreshFromDatabase();
    const effectiveOmdbRuntime = runtimeSettings.getOmdbRuntimeConfig();
    console.log('OMDb runtime configuration loaded', effectiveOmdbRuntime);

    if (process.env.NODE_ENV === 'production' && runtimeSettings.getCorsOriginsList().length === 0) {
      console.warn('WARNING: CORS origin restriction is not configured in production.');
      console.warn('Set one of:');
      console.warn('  - settings.cors_origin in DB/UI');
      console.warn(`  - ${runtimeSettings.getRuntimeSettingsFilePath()} (runtime.json)`);
      console.warn('  - CORS_ORIGIN environment variable');
    }

    // Record pgvector CPU compatibility info for UI/diagnostics
    try {
      const guardResult = await avxGuard.run();
      if (guardResult?.selected) {
        console.log(`pgvector variant selected: ${guardResult.selected}`);
      }
    } catch (guardError) {
      console.warn('AVX guard failed:', guardError.message);
    }

    // Initialize services
    await initializeServices();

    // Start listening
    server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`Classifarr server running on port ${PORT}`);
      console.log(`API Documentation: http://localhost:${PORT}/api/docs`);
      console.log(`Health Check: http://localhost:${PORT}/health`);

      // Warn if no explicit heap cap is set so operators can spot the risk early.
      const hasExplicitCap = (process.env.NODE_OPTIONS || '').includes('max-old-space-size');
      if (!hasExplicitCap) {
        const os = require('os');
        const v8 = require('v8');
        const heapLimitMb = Math.round(v8.getHeapStatistics().heap_size_limit / 1024 / 1024);
        const freeMemMb   = Math.round(os.freemem()  / 1024 / 1024);
        const totalMemMb  = Math.round(os.totalmem() / 1024 / 1024);
        console.warn(
          `[WARN] --max-old-space-size not set. Node.js heap auto-capped at ~${heapLimitMb} MB. ` +
          `Free RAM: ${freeMemMb} MB / ${totalMemMb} MB. ` +
          `On low-memory hosts this can cause OOM crashes. ` +
          `Set memory limits in docker-compose or pass NODE_OPTIONS=--max-old-space-size=<MB>.`
        );
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

/**
 * Graceful shutdown handler — invoked on SIGTERM (Docker stop) and SIGINT (Ctrl-C).
 * Resets any in-flight queue tasks back to 'pending' so they aren't treated as
 * zombie tasks on the next boot, eliminating the spurious stale-task WARN.
 */
async function gracefulShutdown(signal) {
  console.log(`Received ${signal}, starting graceful shutdown`);

  // Force-exit after 10 s if something hangs (DB unreachable, etc.)
  const forceExit = setTimeout(() => {
    console.error('Graceful shutdown timed out after 10 s, forcing exit');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  try {
    await queueService.gracefulShutdown();
  } catch (err) {
    console.error('Queue graceful shutdown error:', err.message);
  }

  if (server) {
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
