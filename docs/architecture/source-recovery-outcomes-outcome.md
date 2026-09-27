# Source recovery outcomes: implementation outcome

Date: 2026-09-26. Unreleased; no release or deployment.

## Delivered

The existing recovery session records a fixed reason when it cannot safely
recover a conflicting identity. It distinguishes unavailable providers, invalid
responses, inconclusive or disagreeing IDs, title/year mismatches, changed or
unavailable source evidence, local failures, and unsuccessful persistence.
Structurally unprovable evidence and unsupported source adapters are recorded as
preflight decisions, without pretending a provider attempt occurred.

Each unresolved observation has at most one latest outcome and four new nullable
columns: attempt UUID, attempt timestamp, completion timestamp, and reason code.
The migration does not backfill invented historical diagnoses. The existing
successful-repair receipt gains a database-stamped `persisted_at`, written in the
same transaction as inventory repair and observation removal. `verified_at`
still describes independent verification, not persistence.

Command Center metadata details show the recorded reason and time. Known
identity disagreements offer a source check even if a retry cooldown exists.
Local storage failures direct users to Classifarr service health, not to change
their Plex match. Provider request failures retain the eligible-sync guidance.
The same read-only API, Vue/SWR memory-only cache, and accessible text/legend
remain in use; no new endpoint or dependency was added.

## Preserved boundaries

- No changed identity acceptance criteria, increased budgets, new queue, or AI
  requests. Movie/TV scope and exclusion of unresolved identities remain intact.
- Cooldown or session-budget skips do not erase a useful earlier diagnosis.
- Guarded writes require current capture, matching digest, matching attempt
  token, active library, and no completed outcome for that token. Late results
  cannot overwrite a newer attempt. Successful claimed repair persistence also
  checks the attempt token.
- A changed source digest clears diagnostic state and cooldown together.
- Outcome records share existing observation retention and deletion. They are
  not an unbounded audit table or a replacement for existing repair receipts.
- Only fixed labels/timestamps are exposed. Attempt UUIDs, exception text,
  credentials, provider responses, and source IDs are not returned as outcomes.
- Diagnostic persistence errors emit a deduplicated, redacted warning and do not
  authorize repair or stop the library sync.

## Validation

- Targeted recovery/sync/API unit suites: 159 tests passed across ten suites,
  including wrong-detail-ID responses, numeric-string ID compatibility, and
  persistence-failure diagnostics.
- PostgreSQL integration: 38 tests passed across four suites, including retry
  preservation/reset, supersession, replay rejection, outcome projection, and
  atomic repaired-item receipts.
- Chromium browser test passed with intercepted synthetic data: cause labels,
  source-check guidance, pagination, keyboard focus, access loss, no writes, and
  390px/320px layouts.
- Isolated PostgreSQL 18 rehearsal passed: restore the previous snapshot, apply
  the migration twice, regenerate through the existing dump tool, restore a
  fresh database, and confirm a stable schema round-trip. Disposable container
  removed; no persistent application volume was attached.
- Type checks, production frontend build, documentation lint, copyright,
  migration naming/snapshot integrity, static ESM checks, and production
  dependency checks passed.
- Security lint reports only the existing unrelated filesystem warning in
  `captureOperatorCorrectionFrozenPolicy.mjs:32`.
- Full frontend coverage: 5,409 tests passed across 386 files. Coverage is 85.83%
  statements, 78.07% branches, 85.33% functions, and 87.85% lines.
- Final recovery-module coverage after the numeric-string compatibility check:
  46 tests passed across two suites; 100% statements/lines, 96.87% branches,
  83.33% functions. PostgreSQL integration was rerun successfully afterward.

- Full backend coverage: 43,373 tests passed across 1,456 suites. Coverage is
  90.37% statements/lines, 84.42% branches, and 92.20% functions.
- Both applications passed the coverage ratchet without changing baselines.

## PR check

GitHub MCP returned no open PRs for `cloudbyday90/Classifarr`. There was no PR to
randomly select or implement; no closed or unrelated PR was substituted or merged.

## Limits and follow-up

An unfinished claim is displayed as completion not confirmed, never as a running
worker. A provider exception means its request failed, not proof that the entire
provider is offline. Missing or invalid source evidence that cannot be bound to
a validated digest remains undiagnosed. Successful receipts remain on inventory
items; this unresolved-item panel is not a resolved-history dashboard.

The new read-model field is additive, but recovery categories now consider known
identity disagreements. Deploy the matching UI with the server; older open UI
sessions may withhold details until refreshed. Existing rows remain unknown until
the normal eligible sync records evidence. This commit does not run those syncs.

Next: evaluate recovery scheduling fairness under the existing eight-attempt
budget. Stable source ordering plus persistent failures can favor early items
when sync intervals exceed the daily cooldown. Build a deterministic movie/TV
outage/restart benchmark, then use the existing recorded attempt times or a
durable cursor to prevent starvation without increasing provider load. Extend
the current worker rather than creating another recovery system.

See the [design and research](source-recovery-outcomes-design.md) for the
recommendation stack and tradeoffs.
