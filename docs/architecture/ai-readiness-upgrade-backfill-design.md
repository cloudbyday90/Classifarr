# AI readiness upgrade backfill — design

Date: 2026-09-30. Scope: a saved primary Ollama configuration that has never
recorded a verification-capability check, including installations upgraded from
before that check existed. This is not library ownership or media backfill.

## Decision

Use a small scheduler-owned ESM worker on a five-minute schedule, with an
additional startup check after two minutes. Reuse the existing fixed, media-free structured
output probe and capability store. Never infer readiness from the version,
provider availability, existing inventory, or successful classification.

The worker first checks for a missing `checked_at`. Existing successful,
unsuccessful, expired and model-changed results are preserved; explicit testing
remains available. It waits for active movie/TV inventory, completed ingestion
and metadata handoff, an idle task queue, and background resource admission.
RAG need not be enabled: strict Ollama verification is a separate capability.
Music-only and unconfigured installations do not generate model traffic.

A session advisory lock serializes automatic attempts across application
instances. The configuration and readiness are reread after admission. The
transport is bound to that saved endpoint/model, not a cached global client or
request-supplied URL. Connectivity is limited to five seconds and generation to
sixty seconds. No model pull, media prompt, cloud fallback or repair loop occurs.
Shutdown/lost ownership prevents subsequent probe stages and persistence. While
the process remains alive, an already-started run stays joined through its
transport timeout, not a detached Promise race. Existing process shutdown may
exit earlier; an uncommitted check remains discoverable after restart. Admission
is local to the app, not a remote Ollama GPU reservation.

The probe runs outside a database transaction. A short bounded transaction locks
the settings row, checks revision/fingerprint and saves **only if still never
checked**. A concurrent manual result wins. The existing checked timestamp is
durable completion evidence even for an unavailable/unsupported result, so
restarts do not repeatedly load a failed model. Database failure before commit
leaves work discoverable; a crash can repeat this idempotent probe, not guarantee
exactly-once inference. Aggregate outcome history is best effort and not authority.

## Alternatives and trade-offs

| Option | Benefit | Cost / risk |
| --- | --- | --- |
| SQL migration marks readiness | No inference cost | False evidence; rejected |
| Blocking post-upgrade probe | Immediate attempt | Delays startup and competes with recovery; rejected |
| Scheduler-owned missing-result backfill | Restart-safe, bounded and reuses authority | May wait on a busy installation; selected |
| Repeated automatic repair of failed checks | Could recover transient outages | Needs durable retry policy and operator controls; separate follow-up |

## Official sources reviewed

- [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs):
  JSON Schema, schema in the prompt, low temperature and response validation.
  A well-formed output is a capability check, not classification-quality evidence.
- [Ollama generate API](https://docs.ollama.com/api/generate): explicit non-streaming
  schema output and thinking control. Existing transport/probe behavior is reused.
- [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html):
  session locks and row locks have distinct lifetimes. No row transaction spans
  model I/O; session ownership uses the application's existing lock-lease helper.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html):
  future UI work should communicate waiting/completion without moving focus.
  This change reuses the existing readiness presentation; no new UI or WCAG
  conformance claim is introduced.

## Recommendation stack

1. Ship missing-result backfill with concurrency, shutdown and real-DB tests.
2. Surface a concise waiting reason/next step in the existing AI readiness card.
3. Separately design opt-in, bounded retry for previously failed checks; never
   weaken the strict verification gate or silently retest every stale result.
