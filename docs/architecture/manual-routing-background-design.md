# Background routing checks: design

Date: 2026-10-03. Scope: saved manual-classification routing intents, not add retries.

## Decision

An administrator can enable up to three background provider reads for a specific
History record. Nothing is enrolled automatically, including upgraded records.
The existing checker still verifies the frozen identity and destination against
current configuration and saves a separate observation, never routing success.
No Docker template, environment variable, sidecar, or additional dependency is needed.

## Options and recommendation stack

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Manual checks only | Smallest operating cost | Requires someone to return after an outage | Keep available |
| Per-record opt-in, durable budget, shared lock | Bounded unattended checks; survives restart | Small state table and one database session during a read | Implement first |
| Enroll every historical failure | Less operator work | Old records lack trustworthy intent; surprising traffic | Do not implement |
| Repeat provider adds | Could complete routing | Presence is not replay authority; duplicate side effects | Separate future design |

Recommended stack: explicit admin opt-in, server-created intent, persistent
admission budget, shared database coordination, bounded GET, guarded observation,
then human review for unresolved items.

## Boundaries and lifecycle

- One shared session advisory lock covers manual and background checks across
  cooperating processes using the same database. No transaction spans HTTP.
- Both paths persist a per-record cooldown **before** provider I/O. Manual checks
  wait at least 60 seconds; background attempts wait 5, then 15 minutes, with
  up to 30 seconds of jitter. At most three automatic admissions per record.
- A crash consumes an admission. Toggling off/on or restarting cannot reset
  attempts or the due time. History deletion cascades only its check state.
- The scheduler wakes once per minute, selects at most one indexed, explicitly
  enabled due record, and waits for its single bounded read. Empty/fresh setups
  make no provider calls. This check does not depend on ingestion or AI work.
  Quiet scheduler polling omits routine start/finish log pairs; check outcomes,
  configuration changes and failures still generate logs.
- Found items, mismatches, changed decisions/configuration, and invalid intents
  end automatic checking. Absence/unavailability may use the remaining budget.
- Administrator enablement is persistent application configuration, not a token
  handed to the worker. Any current administrator can disable it. Disabling
  prevents future admissions; an already admitted read may finish.
- Shutdown or loss of the lock session aborts the HTTP request; work is awaited,
  not detached by a timeout race. A network partition can release a database lock
  before an old provider read has stopped: this is coordination for read-only work,
  not an absolute distributed fencing guarantee. No provider writes are authorized.
- Responses and logs contain fixed reason codes and IDs, not credentials, URLs,
  provider bodies, or media paths. Query values are parameterized.
- UI controls use native buttons, explicit on/off text, and polite status feedback.
  Opening controls reads local state only; it does not probe or enroll an item.

## Official research

Sources discovered and reviewed with web tools on 2026-10-03:

- [PostgreSQL 18 advisory-lock functions](https://www.postgresql.org/docs/18/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS):
  session locks last until unlock/session end; try-locks do not wait. This supports
  the existing checked-out-session helper, not a transaction held across HTTP.
- [AWS retry/backoff guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/retry-backoff.html):
  bound retries, avoid retry storms, and fail fast for non-transient failures.
  Our delays and three-attempt budget are application choices, not AWS defaults.
- [AWS jitter guidance](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/):
  spread repeated work instead of synchronizing retries after an outage.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages):
  expose asynchronous feedback without moving focus; avoid chatty announcements.

## Validation plan

Real PostgreSQL: concurrent instances, manual/background contention, restart,
cooldown and budget persistence, enable/disable races, legacy/configuration drift,
crash-before-I/O admission, and history preservation. Unit tests cover cancellation,
schedule shutdown and fixed safe responses. Client tests cover explicit controls,
admin failures and API retry suppression. Run normal lint, ESM, type, coverage,
migration and ownership-review checks. Record results separately in the outcome.

See the [implementation and validation outcome](manual-routing-background-outcome.md).
