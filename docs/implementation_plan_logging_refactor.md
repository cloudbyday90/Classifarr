# implementation_plan_logging_refactor.md

## Scope

This document proposes three targeted refactors to `server/src/utils/logger.mjs`. Each item was identified by auditing the logger against current Node.js best practices. Research sources cited inline.

**Prior art consulted:**
- nearForm / Matteo Collina — *"The Cost of Logging in 2022"*; *"Welcome to pino@7.0.0"*
- USENIX SREcon23 — *"Do Not Thrash the Node.js Event Loop"* (Collina)
- PkgPulse 2026 benchmark — pino vs. winston vs. bunyan at scale
- Dash0 — *"Contextual Logging Done Right in Node.js with AsyncLocalStorage"*
- Platformatic blog — *"The Hidden Cost of Async Context in Node.js"*
- Node.js v25 docs — `node:async_hooks`, `AsyncLocalStorage`
- pino GitHub `docs/api.md`; pino-http; pino-correlation-id

---

## Section L.1 — Replace `fs.appendFileSync` with a Non-Blocking `WriteStream`

### Problem Statement

`FileLogger.writeLog()` calls `fs.appendFileSync()` on every single log line:

```js
// logger.mjs line ~215
fs.appendFileSync(logPath, message + '\n', 'utf8');
```

`appendFileSync` executes three POSIX syscalls in sequence on the event loop thread: `open(O_WRONLY|O_CREAT|O_APPEND)`, `write()`, `close()`. No file descriptor is reused between calls. This blocks the Node.js event loop for the duration of each syscall.

Additionally, `shouldRotate()` calls `fs.statSync()` on every invocation:

```js
// logger.mjs line ~120
const stats = fs.statSync(logPath);
return stats.size >= LOG_CONFIG.maxFileSize;
```

`shouldRotate()` is called from `writeLog()`, which is called by every `error()`, `warn()`, `info()`, and `debug()` call across all 272 modules and 1,634 call sites. The result: **two blocking syscalls per log line in the hot path** (one `statSync` + one `appendFileSync`).

Log rotation further uses `fs.renameSync`, `fs.readdirSync`, and `fs.unlinkSync` — all synchronous.

### Why This Matters

From nearForm's *"The Cost of Logging in 2022"* benchmarks:
- Winston (which uses `appendFileSync`-style sync writes): **−50% throughput** vs. no logging
- Bunyan (similar sync write path): **−70% throughput** vs. no logging
- Pino (pre-opened fd, no `open/close` per call): **≈ equivalent to no logging** at typical traffic levels

The classification pipeline processes webhook payloads that fan out across up to 12 service calls per item, each emitting multiple log lines. During a backfill or library sync, hundreds of items may be in flight. Every `appendFileSync` call steals CPU time and delays other callbacks waiting on the event loop.

**From POSIX semantics:** `statSync` typically costs 1–10 µs on a warm cache. Under dirty-page flush conditions (kernel deciding to write pages to disk), `appendFileSync` can spike to **1–10 ms**. At 1,000 log calls/second (conservative for an active classification run), tail-latency log writes consume up to 10 seconds per second of CPU — impossible to sustain without event loop lag.

### Root Cause

The `FileLogger` was built with correctness as the primary concern. A persistent `WriteStream` requires lifecycle management (open, drain, close on shutdown), which `appendFileSync` sidesteps at the cost of event loop blocking. The `shouldRotate` `statSync` avoids needing to track file size in memory, again at the cost of a syscall per write.

### Proposed Change

Replace the `FileLogger` write mechanism with a persistent append-mode `WriteStream` per log file, backed by an in-memory byte counter for rotation decisions.

#### Design

**File descriptor lifecycle:**

```
fileLogger.initialize()
  → fs.mkdirSync(logDir) (unchanged)
  → this.mainStream = fs.createWriteStream(mainLogPath, { flags: 'a', encoding: 'utf8' })
  → this.errorStream = fs.createWriteStream(errorLogPath, { flags: 'a', encoding: 'utf8' })
  → this.mainBytesWritten = 0  (seed from fs.statSync on init — one time only)
  → this.errorBytesWritten = 0 (same)
```

**Per-write path (replaces `writeLog`):**

```
writeLog(stream, message, sizeRef)
  → if (!LOG_CONFIG.enabled || !this.initialized) return
  → const bytes = Buffer.byteLength(message + '\n', 'utf8')
  → stream.write(message + '\n')   ← async; enqueued into kernel write buffer
  → sizeRef.count += bytes
  → if (sizeRef.count >= LOG_CONFIG.maxFileSize) → this.rotateLog(...)
```

`WriteStream.write()` enqueues data into the stream's internal buffer and returns immediately — no syscall on the calling thread. The kernel drains the buffer asynchronously on its own schedule. This is the same pattern used by pino's `sonic-boom` in async mode.

**Rotation:**

Current rotation calls `fs.renameSync` then starts an async gzip pipeline. This is a mixed sync/async pattern — the rename blocks, and then the unlink (via `unlinkSync` in the stream `finish` callback) blocks again later. Proposed:

```
rotateLog(stream, logPath, sizeRef)
  → if (this.rotating) return
  → this.rotating = true
  → sizeRef.count = 0
  → end the current stream (stream.end())
  → await fs.promises.rename(logPath, rotatedPath)   ← async
  → reopen the stream: fs.createWriteStream(logPath, { flags: 'a', encoding: 'utf8' })
  → start gzip pipeline (unchanged — already async)
  → cleanup: fs.promises.unlink() instead of unlinkSync
  → cleanupRotatedFiles() → use fs.promises.readdir + fs.promises.stat (async)
  → this.rotating = false
```

The stream is closed during rotation. Any log calls during rotation are dropped (same behavior as today — `writeLog` guards on `this.rotating`). The rotation window is short (a rename + stream reopen): typically < 5 ms on local disk.

**Shutdown drain:**

Register `process.on('exit', ...)` and `process.on('SIGTERM', ...)` in `initialize()` to call `stream.end()` on both streams before exit. Without this, buffered writes that haven't been flushed to the kernel may be lost on `SIGTERM`. The pino docs document this requirement as `pino.final()` / `flushSync()`.

```js
// In initialize()
const gracefulClose = () => {
  this.mainStream?.end();
  this.errorStream?.end();
};
process.on('exit', gracefulClose);
process.on('SIGTERM', gracefulClose);
process.on('SIGINT', gracefulClose);
```

#### What Changes

| Before | After |
|---|---|
| `fs.appendFileSync(path, msg)` per write | `stream.write(msg)` per write — no syscall on event loop |
| `fs.statSync(path)` per write for rotation check | In-memory byte counter `+=` per write |
| `fs.renameSync` during rotation | `await fs.promises.rename(...)` |
| `fs.unlinkSync` in stream `finish` callback | `await fs.promises.unlink(...)` |
| `fs.readdirSync` + `fs.statSync` × N during cleanup | `await fs.promises.readdir(...)` + `await fs.promises.stat(...)` × N |
| No shutdown drain | `stream.end()` on `exit` / `SIGTERM` / `SIGINT` |

#### What Does Not Change

- Log file paths, naming, rotation naming convention (timestamp-based)
- `LOG_CONFIG` environment variables (unchanged semantics)
- GZIP compression pipeline (already async `stream.pipe()`)
- `LOG_CONFIG.maxFiles` retention enforcement
- `cleanupOldLogs()` scheduled function (can be converted to async separately)
- The `Logger` class API (`createLogger`, `error`, `warn`, `info`, `debug`) — callers are unaffected

### Edge Cases

**Initial size seed on restart:** On `initialize()`, call `fs.statSync` once per log file to seed the in-memory byte counter. This is the only sync stat call and occurs once at startup before any requests are served.

**Concurrent rotate guard:** The `this.rotating = true` guard is set synchronously at the start of `rotateLog()`. Because Node.js is single-threaded, no other `writeLog()` call can execute between the guard check and setting the flag — the guard is sufficient without a mutex.

**Log loss during rotation window:** During rotation (between `stream.end()` and stream reopen), `writeLog()` returns early. For a classification workload, the rotation window is < 5 ms. Losing a handful of INFO/DEBUG messages during file rotation is acceptable. ERROR messages are also written to the database via `persistToDb()`, so they are not permanently lost.

**Process crash before stream flush:** If the process receives `SIGKILL`, buffered stream data may be lost. `SIGKILL` cannot be intercepted. This is an inherent trade-off of async I/O and affects only the file output path; DB persistence is unaffected (each DB insert is committed immediately). Document this in a `// NOTE: SIGKILL may lose buffered file writes` comment in `initialize()`.

**`NODE_ENV=test` guard (existing):** The existing `if (process.env.NODE_ENV !== 'test') { fileLogger.initialize(); }` guard prevents stream creation during tests. Tests continue to use console-only logging unchanged.

**Write stream `error` event:** Attach `stream.on('error', err => console.error('Log stream error:', err.message))` to each stream. Without this, an unhandled `error` event on the stream would terminate the process.

### Verification Plan

1. **Unit test `FileLogger`**: Mount a temp directory. Call `writeLog` 10,000 times. Assert all 10,000 lines appear in the output file. Assert no `statSync` is called after initialization (spy on `fs.statSync`).
2. **Rotation test**: Seed `bytesWritten` to just below `maxFileSize`. Write one more line. Assert the stream was ended, a rotated file exists, and a new stream was opened on the original path.
3. **Shutdown drain test**: Write a log line. Emit `process.emit('exit')`. Assert the file contains the line (i.e., the `end()` drained the buffer).
4. **Benchmark (manual)**: `autocannon -c 10 -d 10` against the classification webhook endpoint with `LOG_LEVEL=DEBUG`. Compare event loop lag (via `process.hrtime()` before/after a known sync operation) before and after the change.

---

## Section L.2 — Convert `error()` and `warn()` to Synchronous Interfaces with a Detached Persistence Queue

### Problem Statement

`Logger.error()` and `Logger.warn()` are declared `async` and return `Promise<errorId | null>`:

```js
// logger.mjs
async error(message, data, options = {}) {
  // ... write to console and file (sync) ...
  const errorId = await this.persistToDb('ERROR', message, data, options);
  return errorId;
}
```

A grep across the server codebase finds:
- **1,634** total `logger.error|warn|info|debug` call sites
- **15** use `await logger.error(...)` or `await logger.warn(...)`
- **~1,619** call sites call `logger.error()` or `logger.warn()` **without `await`**

The `async` function signature means every un-awaited call creates a detached `Promise`. The consequences are:

1. **DB write failures are silently discarded.** `persistToDb` has a `try/catch` that swallows errors and returns `null`, but if something in the chain throws before that catch (e.g., a pool exhaustion during startup), the rejection is silently swallowed.

2. **The `errorId` feature is functionally broken for 99% of callers.** Every call site that calls `logger.error('Something failed', { ... })` without `await` discards the returned `Promise` immediately. The `error_id` UUID is never read. The feature only works in `errorHandler.mjs`, which is the single correct usage.

3. **False contract leaks into module consumers.** Every module importing `createLogger` implicitly works with a logger that returns Promises from two of its four methods, but none of those modules handle the Promises. This is a latent bug waiting to surface if a caller ever does `const result = logger.error(...)` and tries to use `result` synchronously — it would be a `Promise`, not an `error_id`.

4. **Async context leak.** In Node.js, detached Promises hold a reference to the async execution context of their creation site. In a long-running server, 1,619 fire-and-forget Promises per-call chain accumulate async resources that delay GC. (This is especially relevant if `AsyncLocalStorage` is added in L.3 — each log call's detached Promise would hold the entire ALS store alive until the DB insert resolves.)

5. **Shutdown ordering.** On `SIGTERM`, the DB pool is closed before all detached `persistToDb` Promises resolve. Inflight DB inserts at shutdown race against pool close and may generate noise errors.

### Root Cause

The design mixed two concerns into a single function signature:
- The fast synchronous path: format → console → file
- The slow asynchronous path: DB insert for error tracking

Making both paths part of the same `async` function forced callers to choose between the correct contract (`await`) and the fast path (fire-and-forget, discarding the Promise). In practice, callers universally chose fire-and-forget because waiting for a DB insert before continuing is never appropriate in a request handler.

### Proposed Change

**Principle** (from Matteo Collina / nearForm): *"Your log call must be synchronous and fast — exactly serialize and write. Transport is decoupled."*

Decouple the fast synchronous path from the DB persistence path:

1. `error()` and `warn()` become **synchronous void methods** from the caller's perspective. They format, write to console, and write to the file stream (after L.1 lands, this is fully non-blocking). They return `void`.

2. DB persistence is detached: `persistToDb(...)` is called but its Promise is not `await`-ed inside `error()`/`warn()`. Instead, it is managed by a small internal drain queue that:
   - Catches its own errors
   - Does not block the caller
   - Drains gracefully on shutdown

3. `errorHandler.mjs`, the one legitimate caller that needs the `errorId`, uses a new explicit method `persistErrorAndGetId(...)` that is properly `async` and must be `await`-ed.

#### Design

**`error()` and `warn()` (new signatures):**

```js
error(message, data, options = {}) {          // ← no longer async
  if (this.level < LOG_LEVELS.ERROR) return;
  const formattedMsg = this.formatMessage('ERROR', message, data);
  console.error(formattedMsg);
  fileLogger.writeMainLog(formattedMsg);
  fileLogger.writeErrorLog(formattedMsg);
  if (options?.skipDbPersist !== true) {
    Logger._enqueueDbPersist('ERROR', this.module, message, data, options);
  }
}

warn(message, data, options = {}) {           // ← no longer async
  if (this.level < LOG_LEVELS.WARN) return;
  if (this.shouldThrottleLog('WARN', message, options)) return;
  const formattedMsg = this.formatMessage('WARN', message, data);
  console.warn(formattedMsg);
  fileLogger.writeMainLog(formattedMsg);
  fileLogger.writeErrorLog(formattedMsg);
  if (options?.skipDbPersist !== true) {
    Logger._enqueueDbPersist('WARN', this.module, message, data, options);
  }
}
```

**Internal drain queue:**

```js
// Static class members
Logger._persistQueue = [];
Logger._persistDraining = false;

static _enqueueDbPersist(level, module, message, data, options) {
  Logger._persistQueue.push({ level, module, message, data, options });
  if (!Logger._persistDraining) {
    Logger._drainPersistQueue();
  }
}

static _drainPersistQueue() {
  Logger._persistDraining = true;
  setImmediate(async () => {
    while (Logger._persistQueue.length > 0) {
      const entry = Logger._persistQueue.shift();
      try {
        await Logger._persistEntry(entry);
      } catch (_err) {
        // silently swallow — persistence is best-effort
      }
    }
    Logger._persistDraining = false;
  });
}

static async _persistEntry({ level, module, message, data, options }) {
  const db = Logger.db;
  if (!db || typeof db.query !== 'function') return;
  // ... (same INSERT logic as current persistToDb, but returns void) ...
}
```

The drain runs on `setImmediate` so it never executes during the current tick (preserving the synchronous return of `error()`/`warn()`). Because `_drainPersistQueue` is not re-entered while `_persistDraining = true`, inserts are serialised — no concurrent pool saturation from burst logging.

**Queue size bound:** If the DB is unavailable for an extended period, `_persistQueue` grows unboundedly. Add a cap:

```js
static _enqueueDbPersist(level, module, message, data, options) {
  if (Logger._persistQueue.length >= 500) return;  // drop on overflow
  // ...
}
```

500 entries at ~1 KB each = ~500 KB peak memory. Acceptable for a single-node server. Dropped entries are still visible in the file log.

**`persistErrorAndGetId()` — for `errorHandler.mjs`:**

```js
async persistErrorAndGetId(message, data, options = {}) {
  return this.persistToDb(this.level >= LOG_LEVELS.ERROR ? 'ERROR' : 'WARN', message, data, options);
}
```

Update `errorHandler.mjs`:

```js
// Before:
const errorId = await logger.error(err.message, data, { req, error: err });

// After:
logger.error(err.message, data, { req, error: err });          // fast sync log
const errorId = await logger.persistErrorAndGetId(err.message, data, { req, error: err });
```

This is the only call site change required. All 1,619 other call sites require **no change** — they already call `logger.error(...)` without `await`, and they continue to work exactly the same way (fire and forget). The only difference is that the fired work is now managed inside the logger rather than as a detached external Promise.

#### What Changes

| Before | After |
|---|---|
| `async error()` returns `Promise<errorId \| null>` | `error()` is `void` (synchronous) |
| `async warn()` returns `Promise<errorId \| null>` | `warn()` is `void` (synchronous) |
| DB persist happens inline with `await persistToDb(...)` | DB persist is enqueued via `_enqueueDbPersist`, drained on `setImmediate` |
| 1,619 detached Promises from un-awaited calls | Zero detached Promises — fire-and-forget is now explicit and managed |
| `errorId` always discarded at 1,619 call sites | `errorId` only returned by `persistErrorAndGetId()`, the explicit async helper |
| `persistToDb` is a public instance method | `persistToDb` unchanged; `_persistEntry` is the queue-drained variant |

#### What Does Not Change

- `logger.info()` and `logger.debug()` — already synchronous, no change needed
- The `persistToDb()` method — retained for direct use by `persistErrorAndGetId()`
- All 1,619 unawaited call sites — no source change required
- `skipDbPersist` option — checked before enqueue (no DB call at all)
- `shouldThrottleLog` / `shouldDedupe` — unchanged, still in the `warn()` fast path

### Edge Cases

**`setLoggerDb` called after logs are already enqueued:** If `_persistQueue` has entries queued before `Logger.db` is set (i.e., during startup), `_persistEntry` checks `Logger.db` at drain time — not at enqueue time. As long as the drain loop runs after `setLoggerDb(db)`, startup-era entries will persist successfully. The typical startup sequence is:

```
1. Bootstrap modules load → various logger.warn/error calls → entries queued
2. runStartupPreflight() → setLoggerDb(db) → Logger.db set
3. setImmediate drain fires → Logger.db is now set → entries persist
```

The drain fires on `setImmediate`, which runs after the current execution stack (including the synchronous `setLoggerDb` call) completes. Startup-era entries are therefore captured.

**Shutdown before drain completes:** During `SIGTERM` handling (before the DB pool is closed), call `Logger._flushPersistQueue()` — a sync drain of the queue that fires off all pending `_persistEntry` calls and awaits them before the pool closes. The shutdown orchestration in `runtimeLifecycle.mjs` should await this before calling `pool.end()`.

```js
// New export
export async function flushLoggerPersistQueue() {
  while (Logger._persistQueue.length > 0) {
    const entry = Logger._persistQueue.shift();
    try { await Logger._persistEntry(entry); } catch (_) {}
  }
}
```

**Burst logging (e.g., batch backfill with 500 errors):** The 500-entry queue cap prevents unbounded memory growth. Entries beyond 500 are dropped to file-only (which is the correct degraded behavior — the file log is always written synchronously in the new scheme and is not subject to the queue). Add a `console.warn('Logger persist queue full — dropping DB entry')` once when the cap is first hit, then suppress via the existing dedup mechanism.

**`ragLogger.mjs` separate DB write path:** `ragLogger.mjs` has its own DB write path that does not go through `Logger.error/warn`. It is unaffected by this change. The `createLogger('RAGLogger')` instance used by `ragLogger.mjs` will gain the synchronous interface like all other modules.

**Test suite:** All tests that `await logger.error(...)` or assert on its return value (if any) need updating. Most test mocks replace `logger.error` with `jest.fn()`, which already returns `undefined`. Tests asserting `expect(logger.error).toHaveBeenCalledWith(...)` continue to work unchanged.

### Verification Plan

1. **Unit test `error()`**: Call `logger.error('msg', data)` without `await`. Assert the function returns `undefined` (not a Promise). Assert `console.error` was called synchronously. Assert `Logger._persistQueue.length === 1` after the call.
2. **Unit test drain queue**: After calling `error()`, advance to `setImmediate` (via `jest.runAllImmediates()` or `await new Promise(setImmediate)`). Assert `db.query` was called with the expected INSERT.
3. **Unit test DB unavailable**: Set `Logger.db = null`. Call `error()` repeatedly up to queue cap. Assert no unhandled Promise rejections. Assert `Logger._persistQueue.length` does not exceed 500.
4. **Integration test `errorHandler.mjs`**: Submit a request that triggers an error. Assert the JSON response contains a valid `errorId` UUID (returned by `persistErrorAndGetId`).
5. **Regression**: Grep the codebase for `await logger.error` and `await logger.warn`. The only remaining uses should be inside `persistErrorAndGetId` and `errorHandler.mjs`. Fail the check if any other `await logger.error/warn` pattern is found (they are no longer meaningful — the return value is `void`).

---

## Section L.3 — Thread Correlation IDs Through the Classification Pipeline via `AsyncLocalStorage`

### Problem Statement

When a classification job for a single item (e.g., "Dune Part Two") fails, it may log errors or warnings across up to 12 services:

```
ClassificationService
  → ClassificationPhaseService
    → ClassificationAiService
      → ClassificationRagLoopService
        → EmbeddingService
    → ClassificationMetadataService
      → TMDBService
  → ClassificationRetryService
  → ClassificationPersistenceService
```

Each service calls `createLogger('<serviceName>')` independently. Each `logger.error(...)` call writes a separate row to `error_log` with its own `module`, `message`, and `metadata`. There is no shared field that links all these rows to the single classification attempt that failed.

The result: when investigating a classification failure from the `error_log` table or log files, there is no query that can reconstruct the complete picture. An operator can filter by `module = 'classificationAi'` and `created_at` timestamp, but if two items fail near-simultaneously, their log entries are interleaved and indistinguishable.

### Why This Matters

The classification pipeline is the product's core value proposition. When it fails, being able to reconstruct the failure narrative is operationally critical. The current state is:
- Operators search by `module` and timestamp (imprecise; breaks under concurrent load)
- `request_context` is populated only for HTTP-origin errors (captures `req.userId`, `req.path`); background jobs have `request_context = null`
- No field in `error_log` links a classification failure to the originating webhook payload or item ID

This gap makes incident diagnosis in production time-consuming and error-prone.

### Node.js Mechanism: `AsyncLocalStorage`

`node:async_hooks` `AsyncLocalStorage` (stable since Node.js 16.4.0) provides an execution-context store that automatically propagates through all `await`, `Promise`, `setTimeout`, `setImmediate`, and `EventEmitter` callbacks descended from a root `run()` call — without passing the context as a parameter.

Benchmarks from the Platformatic blog (2025/2026):
- Node.js v22: **~9.8% throughput overhead** vs. no ALS
- Node.js v24: **~6.7% throughput overhead** vs. no ALS
- Full OpenTelemetry auto-instrumentation (also uses ALS, plus many more hooks): **~80% throughput overhead**

For Classifarr's classification workload, which is CPU- and I/O-bound on AI inference, a 7–10% overhead on the log path is acceptable — especially compared to the operational benefit of attributable error logs.

### Proposed Change

Introduce a single `AsyncLocalStorage` instance exported from `logger.mjs` that carries a `classificationContext` store. The store is established at classification job inception and is automatically available to all services in the call chain without any parameter changes.

#### Design

**New export from `logger.mjs`:**

```js
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export const classificationALS = new AsyncLocalStorage();

export function runWithClassificationContext(context, fn) {
  return classificationALS.run(context, fn);
}

export function getClassificationContext() {
  return classificationALS.getStore() ?? null;
}

export function createCorrelationId() {
  return randomUUID();
}
```

**Context shape:**

```js
{
  correlationId: string,   // UUID, unique per classification attempt
  itemId: string,          // e.g., Overseerr request ID or TMDB ID
  itemTitle: string,       // human-readable for log readability
  jobStartedAt: number,    // Date.now() at job inception
}
```

**`ClassificationService.classify()` — establish context at job entry:**

```js
// classificationServiceCore.mjs
async classify(overseerrPayload) {
  const correlationId = createCorrelationId();
  const context = {
    correlationId,
    itemId: overseerrPayload.media?.tmdbId ?? overseerrPayload.requestId,
    itemTitle: overseerrPayload.media?.title ?? 'unknown',
    jobStartedAt: Date.now(),
  };

  return runWithClassificationContext(context, async () => {
    // All existing classify() logic runs inside this callback.
    // No parameter changes to any called service.
    return this._classifyInternal(overseerrPayload);
  });
}
```

The entire existing `classify()` body becomes `_classifyInternal()`. The ALS `run()` wrapper is the only new code in `ClassificationService`.

**`Logger._persistEntry()` — use `capturedCtx` from the queue entry struct (see L.2 correction above):**

```js
// capturedCtx is a snapshot taken at enqueue time by _enqueueDbPersist.
// Do NOT call getClassificationContext() here — it may run in the wrong ALS scope.
static async _persistEntry({ level, module, message, data, options, capturedCtx }) {
  const db = Logger.db;
  if (!db || typeof db.query !== 'function') return;

  const sanitizedData = sanitizeData(data);
  const enrichedMetadata = capturedCtx
    ? { ...sanitizedData, correlationId: capturedCtx.correlationId, itemId: capturedCtx.itemId, itemTitle: capturedCtx.itemTitle }
    : sanitizedData;

  // ... INSERT with enrichedMetadata ...
}
```

The `correlationId` is automatically injected into every DB-persisted error and warning that occurs within a classification job — including those emitted by deeply-nested services — **without those services needing any code change**. The snapshot approach guarantees that concurrent jobs never cross-contaminate each other's `correlationId` through the shared drain queue.

**`formatMessage()` — include correlationId in file log lines:**

```js
formatMessage(level, message, data) {
  const timestamp = new Date().toISOString();
  const ctx = getClassificationContext();
  const correlationSuffix = ctx ? ` [cid:${ctx.correlationId.slice(0, 8)}]` : '';
  let log = `[${timestamp}] [${level}] [${this.module}]${correlationSuffix} ${message}`;
  if (data) log += ` ${JSON.stringify(data)}`;
  return log;
}
```

File log lines for a classification job then look like:
```
[2025-01-15T10:23:45.123Z] [ERROR] [classificationAi] [cid:3f7a1b2c] OpenAI rate limit exceeded {"model":"gpt-4o","retryAfter":30}
[2025-01-15T10:23:45.130Z] [WARN]  [classificationRetry] [cid:3f7a1b2c] Retrying classification {"attempt":2,"maxAttempts":3}
```

The short prefix `cid:3f7a1b2c` (first 8 hex chars) is grep-friendly without cluttering the line.

**HTTP request correlation:**

For errors originating from HTTP request handlers (not classification background jobs), `request_context` already captures `req.userId` and `req.path`. The ALS `classificationALS.getStore()` returns `null` for HTTP-only requests (outside a classification `run()` context), so the enrichment is silently skipped — no behavior change for non-classification paths.

If full HTTP correlation is desired later, a second `AsyncLocalStorage` instance can be added in `middleware/requestContext.mjs` without modifying the classification ALS.

#### What Changes

| File | Change |
|---|---|
| `logger.mjs` | Add `classificationALS`, `runWithClassificationContext`, `getClassificationContext`, `createCorrelationId` exports; inject context into `_persistEntry` and `formatMessage` |
| `classificationServiceCore.mjs` | Wrap `classify()` body in `runWithClassificationContext(context, async () => { ... })` |
| No other service files | Zero changes required — ALS propagates automatically through all `await` chains |

#### What Does Not Change

- `Logger` class API — `error()`, `warn()`, `info()`, `debug()`, `createLogger()` all unchanged from L.2
- All 272 service files that call `createLogger(...)` — no changes to any of them
- `ragLogger.mjs` — `ragLogger` calls `createLogger('RAGLogger')` inside a classification call chain, so its DB-persisted log entries automatically receive the `correlationId` via `_persistEntry`. No changes to `ragLogger.mjs`.
- `errorHandler.mjs` — HTTP error handler is outside ALS context; `correlationId` injection is silently skipped
- Database schema — `metadata JSONB` column already exists on `error_log` and already accepts arbitrary keys; `correlationId` is stored as `metadata->>'correlationId'`

### Edge Cases

**Multiple concurrent classifications:** ALS is fully isolated per `run()` invocation. If 10 classification jobs are in flight simultaneously, each has its own store. `classificationALS.getStore()` inside service A's call chain for job 1 returns job 1's context, not job 2's. This is the core guarantee of `AsyncLocalStorage`.

**Retry and second-pass paths:** `ClassificationRetryService` and `classificationRagLoopService` are called within the same `classify()` async chain — they inherit the same ALS context automatically. No special handling needed.

**`setImmediate`-based drain queue (from L.2) — context must be captured at enqueue time, not drain time:** The drain queue is shared across all concurrent classification jobs. `_drainPersistQueue` only schedules **one** `setImmediate` at a time (guarded by `_persistDraining = true`). If job A's `logger.error()` call triggers the `setImmediate` scheduling, and job B subsequently calls `logger.error()` before the `setImmediate` fires, job B's entry is pushed to `_persistQueue` but no new `setImmediate` is scheduled. When the single `setImmediate` fires — in job A's ALS context — it drains ALL queued entries, including job B's. `getClassificationContext()` at that moment returns job A's context, so job B's `error_log` row would be stamped with job A's `correlationId`. **This is a cross-contamination bug.**

   **Fix:** Capture the ALS context snapshot at enqueue time and store it in the queue entry struct. Do not call `getClassificationContext()` inside `_persistEntry`:

   ```js
   // In _enqueueDbPersist (L.2) — capture context NOW, while in the correct ALS scope:
   static _enqueueDbPersist(level, module, message, data, options) {
     if (Logger._persistQueue.length >= 500) return;
     const capturedCtx = getClassificationContext();  // snapshot
     Logger._persistQueue.push({ level, module, message, data, options, capturedCtx });
     if (!Logger._persistDraining) {
       Logger._drainPersistQueue();
     }
   }

   // In _persistEntry (L.2) — use capturedCtx from the struct, not getClassificationContext():
   static async _persistEntry({ level, module, message, data, options, capturedCtx }) {
     const db = Logger.db;
     if (!db || typeof db.query !== 'function') return;
     const sanitizedData = sanitizeData(data);
     const enrichedMetadata = capturedCtx
       ? { ...sanitizedData, correlationId: capturedCtx.correlationId, itemId: capturedCtx.itemId, itemTitle: capturedCtx.itemTitle }
       : sanitizedData;
     // ... INSERT with enrichedMetadata ...
   }
   ```

   This is the correct pattern: ALS context is read while the call is still live in the correct async scope (inside `error()`/`warn()`), then stored as a plain object in the queue entry. The drain loop reads from the struct directly and never touches ALS. This eliminates cross-job context bleed regardless of drain timing.

   > **Why this matters:** Node.js ALS propagates context through `setImmediate` from the scheduling site, but the scheduling site here is `_drainPersistQueue` (called from the first job's `error()`). All entries drained in that single `setImmediate` execution inherit the first-scheduling-job's context — not the context of each entry's originating `error()` call. The fix is to not rely on ALS propagation across the drain loop at all.

   This correction also applies to `Logger._persistEntry` in L.3's design section — update it to use `capturedCtx` from the struct instead of `getClassificationContext()`.

**`worker_threads` do NOT inherit ALS:** If a worker thread is spawned for any reason within a classification job, the worker starts with a clean ALS context. Any log calls from a worker will not have `correlationId`. In Classifarr's current architecture there are no `worker_threads` in the classification path — but if `pino.transport()` is ever adopted for file transport, the transport worker runs in a separate thread and does not receive the ALS store. The correlation context would need to be serialized into the log message payload explicitly. Document this constraint.

**Queue-based classification (schedulerService.mjs):** `schedulerService.runLibraryScan` → `mediaSyncService.syncLibrary` are not currently wrapped by `runWithClassificationContext`. These are sync/batch operations, not single-item classification. They do not need `correlationId` tracking today. If added later, the same `runWithClassificationContext` wrapper pattern applies at the scheduler's task dispatch site.

**ALS performance overhead:** As noted, ~7–10% throughput overhead. For classification workloads that make multiple AI API calls (each taking 500 ms–5 s), the logging overhead is negligible by comparison. For high-frequency sync paths (`logger.info` inside a tight loop), note that `getClassificationContext()` is a single `Map` lookup — O(1), ~100 ns.

**Backward compatibility of `correlationId` in `metadata`:** The `metadata JSONB` column is open-schema. Existing queries that reference `metadata` by specific keys (e.g., `metadata->>'error'`, `metadata->>'model'`) are unaffected. New operator query pattern enabled:

```sql
SELECT module, message, metadata, created_at
FROM error_log
WHERE metadata->>'correlationId' = '3f7a1b2c-...'
ORDER BY created_at;
```

This requires a new index for production performance:

```sql
CREATE INDEX IF NOT EXISTS idx_error_log_correlation_id
  ON error_log ((metadata->>'correlationId'));
```

Add this as a database migration.

### Verification Plan

1. **Unit test `runWithClassificationContext`**: Call `runWithClassificationContext({ correlationId: 'test-id', itemId: '42' }, async () => { return getClassificationContext(); })`. Assert the resolved value is the context object.
2. **Unit test ALS propagation through `await`**: Inside a `runWithClassificationContext` callback, do `await Promise.resolve()`. Then call `getClassificationContext()`. Assert it returns the context (confirms ALS propagates through await).
3. **Unit test `_persistEntry` enrichment**: Mock `Logger.db.query`. Set up ALS context with a known `correlationId`. Call `Logger._persistEntry(...)`. Assert the `$7` parameter (metadata) to `db.query` includes `correlationId`.
4. **Unit test `formatMessage` with context**: Inside ALS context, call `logger.error('test')`. Assert the formatted message contains `[cid:` prefix.
5. **Integration test**: Submit a webhook payload that triggers classification. After the job completes, query `error_log WHERE metadata->>'correlationId' IS NOT NULL`. Assert all rows for the job share the same `correlationId`.
6. **Concurrency test**: Submit two simultaneous classification requests with different TMDB IDs. Assert `error_log` rows are attributed to the correct `correlationId` per item (no cross-contamination).

---

## Implementation Order

These items have dependencies and supersession relationships:

| Step | Item | Dependency | Notes |
|---|---|---|---|
| 1 | **L.4** — Pino adoption | None | Supersedes L.1 entirely |
| 2 | **L.5** — Structured NDJSON format | L.4 (pino provides NDJSON natively) | If L.4 is not taken, L.5 can be done independently after L.1 |
| 3 | **L.2 (corrected)** — Sync interface + drain queue | L.4 or L.1 must be landed first | L.2 updated: `capturedCtx` snapshot at enqueue time |
| 4 | **L.3** — ALS correlation IDs | L.2 corrected version must be landed first | L.3 design updated: `_persistEntry` uses `capturedCtx` |
| 5 | **L.6** — Runtime log level hot-reload | L.4 (requires pino's `logger.level` setter) | Standalone; no effect on other items |

**If L.4 (pino) is taken:** L.1 is fully superseded and should not be implemented. The sequence is L.4 → L.5 → L.2 → L.3 → L.6.

**If L.4 is deferred:** L.1 is still valid. The sequence is L.1 → L.2 → L.3 → L.5 → L.6 (L.6 requires manual implementation of the level setter rather than pino's native support).

Each item has no effect on external API contracts or call sites outside `logger.mjs` (except `classificationServiceCore.mjs` for L.3 and the new admin endpoint for L.6).

---

## Section L.4 — Replace `FileLogger` with Pino as the Logging Engine

### Problem Statement

L.1 proposes replacing `fs.appendFileSync` with a `WriteStream`. That is a viable incremental improvement, but it produces a custom implementation that still needs to replicate: buffered I/O draining, backpressure handling, rotation lifecycle, shutdown drain, fast-redact for `SENSITIVE_FIELDS`, per-module child loggers with bound fields, and worker-thread transport isolation. All of these are solved problems in **pino** — the Node.js logging library co-authored by the nearForm team and embedded as the default logger in Fastify.

Adopting pino directly delivers better file I/O performance than any hand-rolled `WriteStream` approach (pino uses `sonic-boom`, which pre-opens a file descriptor and uses atomic `write(2)` with internal buffering — faster than Node.js `Writable` stream pipeline overhead), plus a battle-tested worker-thread transport system, native NDJSON output (enabling L.5 for free), and a `logger.level` property setter for L.6.

### Why This Supersedes L.1

| Capability | L.1 custom `WriteStream` | Pino `sonic-boom` |
|---|---|---|
| Per-write syscall | None (stream buffer) | None (fd + `write(2)`, shared buffer) |
| Buffering strategy | Node.js stream internal buffer | `sonic-boom` 4 KB configurable buffer |
| Worker-thread isolation | Not implemented | `pino.transport()` out of the box |
| Log rotation | Custom (manual `stream.end()` + reopen) | `pino-roll` transport (maintained) |
| Shutdown drain | Manual `stream.end()` on `exit`/`SIGTERM` | `pino.final()` + `flushSync()` |
| Fast-redact | Custom `sanitizeData()` (recursive, not path-aware) | `fast-redact` (compile-time path optimization, wildcard support) |
| Throughput (PkgPulse 2026) | ~100K–200K logs/sec (estimated WriteStream) | ~680K logs/sec |

From PkgPulse 2026 benchmarks: pino at 1M entries = **~680K logs/sec**; Winston = **~85–120K logs/sec**; hand-rolled `WriteStream` estimated between these. The nearForm *"Cost of Logging 2022"* measured pino as having **≈ zero throughput penalty** vs. no logging at typical Fastify workloads.

### Proposed Change

**Install pino:**

```sh
npm install pino pino-roll
```

`pino-roll` provides file rotation transport as a worker-thread transport module (replaces `FileLogger` rotation logic).

**New `logger.mjs` structure:**

```js
import pino from 'pino';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

// Root pino instance — file transport via worker thread
const rootLogger = pino(
  {
    level: process.env.LOG_LEVEL?.toLowerCase() || 'info',
    redact: {
      paths: ['password', 'token', 'api_key', 'apikey', 'secret', 'authorization',
              'auth', 'jwt', 'session', 'cookie', 'access_token', 'refresh_token', 'private_key'],
      censor: '[REDACTED]',
    },
    formatters: {
      level: (label) => ({ level: label }),   // string level instead of numeric
    },
    base: { pid: process.pid },               // omit hostname if not needed; add app: 'classifarr'
    timestamp: pino.stdTimeFunctions.isoTime, // ISO-8601 timestamp
  },
  process.env.NODE_ENV !== 'test'
    ? pino.transport({
        targets: [
          {
            target: 'pino/file',           // stdout in container
            options: { destination: 1 },   // fd 1 = stdout
            level: process.env.LOG_LEVEL?.toLowerCase() || 'info',
          },
          {
            target: 'pino-roll',           // rotating file (worker thread)
            options: {
              file: `${process.env.LOG_DIR || '/app/data/logs'}/classifarr.log`,
              size: process.env.LOG_MAX_FILE_SIZE || '10m',
              limit: { count: parseInt(process.env.LOG_MAX_FILES, 10) || 5 },
              dateFormat: 'yyyy-MM-dd-HH-mm-ss',
              compress: process.env.LOG_COMPRESS !== 'false' ? 'gzip' : false,
            },
            level: process.env.LOG_LEVEL?.toLowerCase() || 'info',
          },
        ],
      })
    : pino.destination({ dest: 1, sync: true }) // test: sync stdout only
);
```

**`createLogger(module)` — now returns a pino child:**

```js
export function createLogger(module) {
  return rootLogger.child({ module });
}
```

`logger.child({ module })` binds `module` to every log line emitted by that instance. It shares the root's file descriptor — no new fd, no new transport. All 272 `createLogger('...')` call sites continue to work without any change.

**`setLoggerDb(db)` — unchanged:** The DB drain queue (L.2) is independent of pino. `Logger.db` is still set via `setLoggerDb` during startup. `persistToDb` calls continue to go through `_enqueueDbPersist`.

### Key Migration Footgun: Argument Order Inversion

Pino's signature is `logger.info(mergingObject, message)`. The current custom logger's signature is `logger.info(message, data)`. **These are inverted.** If call sites are migrated naively by swapping to pino child loggers with the original argument order, `message` becomes the merging object and `data` becomes the message string — a silent data-loss bug.

Three options:
1. **Wrapper shim (recommended for migration):** Provide a thin shim that re-orders arguments to match pino's signature before delegating to pino. The shim is a drop-in replacement for the current `Logger` class methods:
   ```js
   class LoggerShim {
     constructor(pinoChild) { this._pino = pinoChild; }
     error(message, data, options) {
       if (options?.skipDbPersist !== true) Logger._enqueueDbPersist('ERROR', ...);
       this._pino.error({ ...data }, message);
     }
     warn(message, data, options) { /* same pattern */ }
     info(message, data)  { this._pino.info({ ...data }, message); }
     debug(message, data) { this._pino.debug({ ...data }, message); }
   }
   export function createLogger(module) {
     return new LoggerShim(rootLogger.child({ module }));
   }
   ```
   All 272 call sites keep the exact same `logger.error(message, data)` signature. Zero call-site changes.

2. **Full migration:** Update all 272 call sites to pino's native `logger.error(data, message)` order. Enables direct use of pino child loggers without a wrapper. High change volume but yields maximal pino compatibility (including pino-http, pino-opentelemetry, etc.)

3. **pino-proxy pattern:** Use a `Proxy` wrapping the pino child to intercept method calls and reorder arguments. Similar to option 1 but avoids an explicit class.

**Recommendation:** Option 1 (shim) for initial migration. This preserves the full existing call-site API, delivers all pino performance benefits, and defers the argument-order migration to a follow-up refactor.

### Error-Log-Only File (current `error.log`)

The current logger writes to both `classifarr.log` (all levels) and `error.log` (ERROR + WARN). The pino `targets` array can be extended with a third target using `pino-roll` pointing to `error.log` with `level: 'warn'`. This preserves the two-file behavior.

### What Changes

| Before | After |
|---|---|
| `FileLogger` class (custom sync I/O) | Removed entirely |
| `fs.appendFileSync` per write | `sonic-boom` buffered write (worker thread via `pino.transport()`) |
| Custom `sanitizeData()` with recursive object walk | `pino` `redact` option using `fast-redact` compile-time paths |
| Log rotation via `renameSync` | `pino-roll` worker-thread transport |
| `Logger` class with `error/warn/info/debug` | `LoggerShim` wrapping `pino.child({ module })` |
| `createLogger(module)` → `Logger` instance | `createLogger(module)` → `LoggerShim` instance (same API) |

### What Does Not Change

- `createLogger(module)` export — same function name and signature
- `setLoggerDb(db)` — still needed for the DB drain queue (L.2)
- All 272 call sites — no changes (shim preserves the existing API)
- L.2 drain queue — unaffected; sits above pino
- L.3 ALS integration — unaffected; `capturedCtx` snapshot at enqueue time is pino-agnostic
- `ragLogger.mjs` — calls `createLogger('RAGLogger')` which returns a shim; no change needed

### Edge Cases

**`pino.transport()` and ESM `.mjs` files:** Pino's transport worker uses dynamic `import()` and fully supports ESM transport modules. `pino-roll` is ESM-compatible. `"type": "module"` in `package.json` requires no special config. Source: pino `transports.md`.

**Worker thread transport crashes:** If `pino-roll`'s worker thread throws (e.g., disk full), the error is isolated to the worker. The main process continues and emits to stdout. The main process does NOT crash. This is superior to a main-thread `WriteStream` which, if it emits an `error` event without a listener, would crash the process.

**`NODE_ENV=test` guard:** The test path uses `pino.destination({ dest: 1, sync: true })` — synchronous stdout only, no file, no worker thread. This matches the existing `if (process.env.NODE_ENV !== 'test')` guard behavior.

**`pino` `redact` and the existing `sanitizeData()` in `persistToDb`:** The pino `redact` option applies to log lines written to file/stdout. `persistToDb` inserts into PostgreSQL and should still use `sanitizeData()` on the data before the DB insert — the pino redaction does not affect the `data` object passed to `_enqueueDbPersist`. Keep `sanitizeData()` in `_persistEntry`. The two mechanisms operate on different outputs.

**Child level inheritance:** If `rootLogger.level = 'debug'` is set at runtime (L.6), pino child loggers created BEFORE that mutation do NOT automatically inherit the new level. Each `LoggerShim`'s internal `_pino` child has its own level. To propagate a global level change, either: (a) re-set level on a registry of all active children (L.6 design), or (b) use `rootLogger.level` and configure children to delegate to root by not setting their own level. Option (b) is pino's recommended pattern: only set level on the root instance, never on children, unless per-module override is intentional.

### Verification Plan

1. **Unit test shim**: Instantiate `createLogger('test')`. Call `.info('msg', { foo: 'bar' })`. Capture pino output. Assert output contains `"msg":"msg"` and `"foo":"bar"`.
2. **Redaction test**: Call `.error('login failed', { password: 'secret123' })`. Assert the captured pino output contains `[REDACTED]`, not `secret123`.
3. **Worker thread isolation test**: Mount `pino-roll` to a temp dir. Call `.error(...)` 100 times. Verify file is written. Assert no `unhandledRejection` in the main process.
4. **Argument order regression test**: Grep for any `logger.error(message, data)` call that would produce incorrect output under pino's native ordering. Assert all output has `msg` as a string field (not an object).

---

## Section L.5 — Structured NDJSON Log Format

### Problem Statement

The current `formatMessage()` produces flat, unstructured strings:
```
[2025-01-15T10:23:45.123Z] [ERROR] [classificationAi] OpenAI rate limit exceeded {"model":"gpt-4o","retryAfter":30}
```

This format is not machine-parseable without regex. Fields are not queryable. The `data` object is embedded as a trailing JSON blob that shares no delimiter with the message text. Log aggregators (Loki, Datadog, Elasticsearch) require regex pipelines to extract fields from this format — a brittle, maintenance-heavy integration point.

**If L.4 (pino) is adopted:** This item is delivered for free. Pino's output is NDJSON by default. L.5 becomes a configuration task only (schema alignment, Loki label config).

**If L.4 is not adopted:** `formatMessage()` must be replaced with a JSON serializer.

### NDJSON Schema (Canonical)

Each log line is one JSON object on a single line, terminated by `\n`:

```json
{"ts":"2025-01-15T10:23:45.123Z","level":"error","module":"classificationAi","msg":"OpenAI rate limit exceeded","model":"gpt-4o","retryAfter":30,"correlationId":"3f7a1b2c-...","pid":1234}
```

| Field | Type | Source | Notes |
|---|---|---|---|
| `ts` | ISO-8601 string | `new Date().toISOString()` | Loki can parse this directly |
| `level` | string (`"error"`, `"warn"`, `"info"`, `"debug"`) | Method name | pino numeric levels remapped via `formatters.level` |
| `module` | string | `createLogger(module)` binding | Child logger binding |
| `msg` | string | First argument to `error/warn/info/debug` | The human-readable message |
| `correlationId` | string (UUID) | ALS context snapshot (L.3) | Only present inside classification jobs |
| `pid` | number | `process.pid` | Set in pino `base` config |
| *(data fields)* | any | Second argument to `error/warn/info/debug` | Merged at top level, not nested |

**Data fields at top level (not nested):** Rather than `{ data: { model: "gpt-4o", retryAfter: 30 } }`, data fields are merged to the top level. This is the pino merge-object pattern and is required for Loki's `json_parser` and Elasticsearch ECS compatibility.

### Loki / Grafana Alloy Configuration

From Grafana Labs community testing with Loki 3.4.2 + Alloy:

```yaml
# Alloy pipeline for NDJSON from Classifarr
stage.json {
  expressions = {
    level        = "level",
    module       = "module",
    correlationId = "correlationId",
    message      = "msg",
  }
}
stage.timestamp {
  source = "ts"
  format = "RFC3339Nano"
}
stage.labels {
  values = {
    level  = ""     # LOW cardinality only — 4 values
    module = ""     # LOW cardinality — ~30 module names
    # Do NOT label correlationId, userId, itemId — high cardinality → stream explosion
  }
}
stage.structured_metadata {
  values = {
    correlationId = ""   # high-cardinality; Loki structured_metadata (Loki 3.x)
  }
}
stage.output {
  source = "message"
}
```

`correlationId` goes into Loki `structured_metadata` (Loki 3.x feature) rather than as a label — high-cardinality labels cause stream explosion. Structured metadata is queryable via `{app="classifarr"} | json | correlationId = "3f7a1b2c-..."` without creating a new stream per job.

### Without L.4 (Pino) — Manual NDJSON Implementation

Replace `formatMessage()`:

```js
formatMessage(level, message, data, capturedCtx) {
  const record = {
    ts: new Date().toISOString(),
    level: level.toLowerCase(),
    module: this.module,
    msg: message,
    ...(data && typeof data === 'object' ? sanitizeData(data) : { raw: data }),
    ...(capturedCtx ? { correlationId: capturedCtx.correlationId, itemId: capturedCtx.itemId } : {}),
    pid: process.pid,
  };
  return JSON.stringify(record);
}
```

Call sites for `console.error(formattedMsg)`, `console.log(formattedMsg)`, and `fileLogger.writeMainLog(formattedMsg)` are unchanged — they now receive a JSON string instead of a bracketed string.

**Interaction with L.3 `capturedCtx`:** Since `formatMessage` is called inside `error()`/`warn()` (before enqueue), and `error()`/`warn()` are called within the ALS context, `getClassificationContext()` can be called at `formatMessage()` time without the cross-contamination risk. The flat-file line and the DB entry are written from the same call, in the correct ALS scope.

### What Changes

| Before | After |
|---|---|
| `formatMessage()` → `[timestamp] [LEVEL] [module] message {JSON}` | `formatMessage()` → `{"ts":...,"level":...,"module":...,"msg":...,...}` |
| `console.error(formattedMsg)` outputs bracketed string | `console.error(formattedMsg)` outputs parseable JSON |
| File log lines unparseable without regex | File log lines directly parseable by `jq`, Loki, Datadog, Elasticsearch |

### Edge Cases

**`JSON.stringify` on circular data objects:** If a caller passes a data object with circular references, `JSON.stringify` throws. The existing `sanitizeData()` does not guard against this. Add a `try/catch` around `JSON.stringify` in `formatMessage()` and fall back to `String(data)` if serialization fails. Alternatively, use `fast-safe-stringify` (zero-dep drop-in). Pino handles this internally via its serialization layer.

**console output readability in development:** NDJSON is machine-readable but not human-friendly in a terminal. For development (`NODE_ENV !== 'production'`), pipe stdout through `pino-pretty` (if pino is adopted) or a similar pretty-printer. This is a developer tooling concern, not a production concern.

---

## Section L.6 — Runtime Log Level Hot-Reload

### Problem Statement

`Logger` sets `this.level = LOG_LEVELS[process.env.LOG_LEVEL || 'INFO']` in the constructor. Log level is fixed at process startup. To change log verbosity (e.g., temporarily enabling DEBUG to diagnose a production issue), the process must be restarted — which in a Docker container environment means losing any in-flight classification state.

This is a known operational friction point. The Fastify team and nearForm explicitly document runtime level mutation as a supported pattern for production Node.js services. Source: Better Stack pino guide; Fastify docs.

### How Node.js Level Mutation Works Safely

Node.js is single-threaded. There are no true threads in the event loop. Setting `logger.level = 'debug'` is a synchronous property assignment that is visible to all subsequent log calls on the next event loop tick. There are no race conditions, no torn reads, and no need for locking. Source: pino API docs; Node.js docs.

**With worker-thread transports (pino):** Level mutation on the main-thread logger does NOT propagate to `pino.transport()` worker threads. Workers have their own level filter. For most use cases this is fine — if you lower the main logger to `debug`, debug records are emitted and the worker simply passes them through (workers default to the lowest level `trace` or whatever `level` was set at transport construction). Source: Better Stack guide.

### Proposed Change

**Static level registry on `Logger`:**

```js
// In Logger class:
static _activeLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase() || 'INFO'];
static _moduleOverrides = new Map();   // module name → LOG_LEVELS value

// In constructor (replaces this.level = LOG_LEVELS[...]):
get level() {
  return Logger._moduleOverrides.get(this.module) ?? Logger._activeLevel;
}

// In setLogLevel(level, module = null):
static setLogLevel(levelName, module = null) {
  const numericLevel = LOG_LEVELS[levelName.toUpperCase()];
  if (numericLevel === undefined) throw new Error(`Invalid log level: ${levelName}`);
  if (module) {
    Logger._moduleOverrides.set(module, numericLevel);
  } else {
    Logger._activeLevel = numericLevel;
    Logger._moduleOverrides.clear();   // global change clears per-module overrides
  }
}
```

The `level` getter reads from static state shared across all `Logger` instances. A single `Logger.setLogLevel('debug')` call immediately affects all 272 module loggers on the next log call — no restart required, no instance iteration.

**With pino (L.4):** `LoggerShim` delegates to pino. For global level change, update `rootLogger.level = newLevel`. For per-module overrides, update the specific child logger's `.level` property. Expose via the same `setLogLevel` export for API consistency.

**Admin endpoint (new route, guarded by admin auth):**

```js
// New route: PUT /api/system/log-level
// Auth: requires admin role (same guard as /api/system/health)
router.put('/log-level', requireAdmin, (req, res) => {
  const { level, module } = req.body;
  const validLevels = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
  if (!validLevels.includes(level?.toUpperCase())) {
    return res.status(400).json({ error: `Invalid level. Must be one of: ${validLevels.join(', ')}` });
  }
  const previous = module
    ? Logger._moduleOverrides.get(module) ?? Logger._activeLevel
    : Logger._activeLevel;
  Logger.setLogLevel(level, module ?? null);
  res.json({
    previous: Object.keys(LOG_LEVELS).find(k => LOG_LEVELS[k] === previous),
    current: level.toUpperCase(),
    module: module ?? 'global',
    note: 'Change is in-process only; reverts on restart unless LOG_LEVEL env is updated.',
  });
});
```

**Export `setLogLevel` from `logger.mjs`** so it can also be called programmatically from integration tests or maintenance scripts without an HTTP round-trip.

### What Changes

| Before | After |
|---|---|
| `this.level` set once at `new Logger(module)` construction | `get level()` reads from `Logger._activeLevel` at call time |
| No way to change log level without restart | `Logger.setLogLevel('debug')` → all loggers affected immediately |
| No per-module verbosity control | `Logger.setLogLevel('debug', 'classificationAi')` → one module verbose, others unchanged |
| No admin endpoint for log level | `PUT /api/system/log-level` with admin guard |

### What Does Not Change

- `LOG_LEVEL` environment variable — still used as the startup default; `setLogLevel` overrides it in-memory only
- `LOG_LEVELS` numeric map — unchanged
- Level check logic inside `error()`, `warn()`, etc. — `this.level >= LOG_LEVELS.X` still works; `this.level` now reads from the getter
- All call sites — no changes

### Edge Cases

**`Map` reads in the getter hot path:** `Logger._moduleOverrides.get(this.module)` is an O(1) `Map` lookup. At ~30 module names and 1,634 call sites, this is negligible. No caching needed.

**Per-module override and global reset:** `Logger.setLogLevel('info')` (no module argument) calls `Logger._moduleOverrides.clear()` — all per-module overrides are cleared. This is intentional: a global reset is authoritative. Document this in the endpoint's `note` field.

**Persistence across restart:** Log level changes via the admin endpoint are in-memory only. They do not persist to the database or to `runtime.json`. If persistence is desired, a follow-up could store the level in `runtimeSettings` (the existing `settings` table) and reload it on startup — but that is out of scope for this item.

**`setLogLevel` called before `Logger` instances exist:** Safe — the static `_activeLevel` is set at module load time. Instances created after the call see the new level.

---

## Implementation Order (Updated)

| Step | Item | Dependency | Supersedes |
|---|---|---|---|
| 1 | **L.4** — Pino adoption | None | **L.1** (superseded) |
| 2 | **L.5** — Structured NDJSON | L.4 (free via pino config) or standalone | — |
| 3 | **L.2 (corrected)** — Sync interface + drain queue with `capturedCtx` snapshot | L.4 or L.1 landed | Previous L.2 design |
| 4 | **L.3 (corrected)** — ALS correlation IDs with `capturedCtx` in struct | L.2 corrected version | Previous L.3 edge case text |
| 5 | **L.6** — Runtime log level hot-reload | L.4 (pino) or standalone with getter pattern | — |

**If L.4 is adopted:** L.1 is not implemented. L.5 is a pino config task (set `formatters.level`, `timestamp`, confirm Loki pipeline). Items L.2–L.6 all layer on top of pino without conflict.

**If L.4 is deferred:** L.1 is implemented first, then L.2 → L.3 → L.5 (manual NDJSON) → L.6 (getter pattern). L.4 can be slotted in later as a replacement for L.1 without breaking L.2, L.3, or L.6.

No item affects external API contracts, database schema (except the one index in L.3 and the new route in L.6), or existing call sites outside `logger.mjs` and `classificationServiceCore.mjs`.

---

## Migration

L.3 requires one new database migration:

```sql
-- Add GIN/btree expression index for correlationId lookups on error_log
CREATE INDEX IF NOT EXISTS idx_error_log_correlation_id
  ON error_log ((metadata->>'correlationId'));
```

This index is safe to create `IF NOT EXISTS` in a migration; it does not affect existing rows (NULL metadata or rows without the `correlationId` key are simply not indexed).
