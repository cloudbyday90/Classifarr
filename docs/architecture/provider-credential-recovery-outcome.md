# Credential-aware enrichment recovery outcome

## Delivered

Rejected OMDb credentials and routed web-search credentials now pause work
without consuming independent enrichment retries. The pause persists across
restarts. Correcting the saved key or explicitly disabling/re-enabling after an
account repair creates a new generation; the existing scheduler resumes eligible
work subject to due times, cooldowns and quotas.

Migration 302 adds generation/rejection fields to existing configuration rows
and a secret-free status view. Atomic queue claims, background dispatch and
deferred statistics share the same credential gate. They do not claim work when
all configured credentials for that dependency are rejected. Missing setup
remains unconfigured rather than manufacturing a credential error.

The HTTP request carries only the internally captured generation back to the
rejection writer. Conditional updates cannot reject a replacement credential,
including an A-to-B-to-A rotation. Key edits and enabled-state changes rotate
the generation; ordinary saves, usage accounting and telemetry do not. Only a
first rejection updates the timestamp. No key hash or provider payload is added
to recovery state, logs or public diagnostics.

OMDb checks rejection before reserving quota. Its failed HTTP request still
counts as a local provider attempt. Web search retains healthy alternate-provider
fallback and supports the legacy Tavily bridge. Review caught and fixed an
important distinction: migration provenance on a real web-provider row must not
redirect its rejection write to the legacy configuration table.

Existing settings explain the pause and corrective action. OMDb exposes a
programmatic status message; web-search route diagnostics use a fixed reason
label. Neither page assumes that an unchanged settings save or a connection test
clears the stored pause. No new endpoint, raw client HTTP call or runtime package
was added.

## Safety and limits

- Existing claim tokens, deadlines, source identity and active movie/TV library
  checks still govern item writes. Music remains excluded. No unknown worker is
  adopted, and no previously exhausted record is reopened automatically.
- Provider rejection describes credentials, not ownership of an item. Persisting
  that observation does not grant media-write authority. Already admitted network
  calls can finish; this is not exactly-once HTTP dispatch.
- This covers OMDb lookup admission, the web-search router/legacy bridge, and
  independent enrichment retries. Ad-hoc connection tests and direct legacy
  provider consumers are not certified as globally coordinated by this change.
- If rejection persistence fails, the typed error is retained and retry work
  still waits without charging its item budget. A durable pause cannot be
  guaranteed during a database outage; ordinary bounded retry scheduling applies.
- A remote account repair with an unchanged key needs explicit disable/re-enable
  in this increment. Cached success and existing connection tests are not
  authority to clear rejection. Controlled automatic verification is the next
  component, not an undocumented bypass.
- No release, tag, version bump, live data change or live container rebuild was
  performed. The schema-test image is retained locally for repeatability.

## Verification

Focused backend verification passed 338 tests. Focused PostgreSQL verification
passed 38 tests for credential recovery, retry scheduling and quota reservation.
Settings tests cover corrective copy and avoiding optimistic pause removal.

| Gate | Result |
| --- | --- |
| Backend | 1,533 suites; 46,382 tests passed |
| Frontend | 406 files; 5,719 tests passed |
| PostgreSQL integration | 197 suites; 2,316 tests passed; one opt-in suite/test skipped |
| Coverage ratchet | Passed; no baseline lowered |
| Markdown | 1,648 documents checked; zero issues |

Backend coverage: statements/lines 90.24%, branches 84.93%, functions 92.12%.
Frontend coverage: statements 86.02%, branches 78.58%, functions 85.47%, lines
87.96%. The final full runs passed 54,417 tests in total, excluding focused reruns
and the 12 installation checks below.

Lint, type checks, CI preflight, ESM checks, four policy gates, production UI build,
migration integrity and isolated authoritative schema comparison passed. The
ownership review gate remains enabled; changed fixed-query sources were reviewed
and pinned without claiming that unrelated static-analysis gaps are resolved.

The full database run exposed a historical test-fixture assumption: the September
7 consolidation migration compares entire configuration rows, but later random
generation fields intentionally make those rows different. The test now removes
only the later credential fields, triggers and dependent view inside its rolled-
back disposable transaction before replaying the immutable old migration. Normal
installation already executes that repair before adding generations, as confirmed
by the clean-source upgrade drill. Production migration history is unchanged.

### Installation evidence

The clean-source drill passed all 12 checks at `2026-09-29T11:36:23.893Z` for
commit `46309ee1af07b8edadd91d957a6bb0eccf7ccafa`.

- Published baseline: `v0.48.4-beta`, source
  `a0e417fd714919bb4ca30e20f9cd2380136ca74e`, verified image
  `sha256:dc95fcdd80123b6bbf5b252fec286d9e81fbbc21a1030087c0a44abacd6a187f`.
- Candidate image:
  `sha256:74b78778cfde982082455e7e07353751de9f04cae516ff4b0c3858ba65311ff6`.
- PostgreSQL 18.6: fresh and upgraded installations reached 302 migrations;
  the published baseline had 222.
- Passed provenance, fresh operational seeds, startup progress, backfill crash
  recovery, baseline export, persisted-volume migration, interrupted restore,
  unsafe-startup rejection, verified rollback/retry, movie/TV recovery handoff,
  normal restart/profiles and upgraded scheduling.
- Disposable project
  `classifarr-upgrade-drill-4ac2547918f8cc51138a2fd5ca843e6b` and its volumes,
  network and candidate image were cleaned up.
- Live Classifarr remained on image
  `sha256:8993f6dfa53f74b4fe05bf8d3e81df568f00612b9b8742f1be40c5cfb170c63d`,
  started `2026-09-29T01:16:51.534281224Z`, healthy with zero restarts and no OOM.

The local ignored receipt is `.tmp/ci/runtime-installation-acceptance.json`.
Documentation and historical test-fixture follow-up changes do not alter the
tested runtime. Provider tests use mocked HTTP and fixture credentials, not
paid/live provider requests.

## Recommendation and next component

Keep the selected stack: modular Node ESM services, PostgreSQL generation gates,
the existing scheduler/router and Vue settings. The benefit is restart-safe,
rotation-safe recovery without another operational service. The tradeoff is
configuration-driven recovery rather than automatic detection of account repair.
The [design](provider-credential-recovery-design.md) records alternatives and
official September 2026 research, including HTTP semantics and W3C guidance.

Next: a provider recovery probe coordinator. Use one database-leased probe per
rejected generation, bounded backoff and provider quota accounting. A successful
live response must invalidate older failure observations before reopening work.
Prove concurrent workers, restart, stale success/failure and account-only repair
without item retry consumption. Reuse existing scheduling and settings rather
than adding another dashboard or per-item health requests.

Two GitHub MCP searches found no open Classifarr PRs to select during this round.
No PR could be selected or implemented, and none was merged.
