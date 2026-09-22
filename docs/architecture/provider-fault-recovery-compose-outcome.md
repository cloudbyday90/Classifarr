# Disposable provider recovery: outcome

## What changed

The existing fixed Compose provider starts with a generation-only HTTP 503 and
can transition once to a completed synthetic response through a POST-only test
endpoint. Its request counter remains capped; it reads no prompts, credentials
or response bodies. The endpoint is published only on loopback by a randomized
Compose project and removed with that project after the run.

The isolated integration test now proves an initial no-route queued result and
an open provider circuit, then persists synthetic movie and TV pending decisions.
An early recovery run remains in cooldown; a due probe while the stub is still
unavailable queues nothing. Once the stub recovers, a real generation-readiness
probe resumes exactly two retry tasks. A second pass queues nothing. A fresh
`QueueService` instance completes both tasks, the trial closes the circuit,
retry counts remain unchanged and no media route is called.

The policy and metadata acquisition layers remain synthetic and no actual
library destination is authorized. Therefore this verifies provider transport,
recovery scheduling, queue and route safety, **not** model answer quality,
successful media placement, or a true OS process restart. A fresh service
instance exercises state carried by PostgreSQL; no real provider or media
server is contacted. The fixture completes queue tasks but deliberately does
not persist a final classified-history row. The 60-second trial expiry edge
remains covered by the separate PostgreSQL provider-deferral integration suite,
not this Compose run.

## Open PR handled locally

A uniform draw from the five open PRs on 22 September 2026 selected
[PR #543](https://github.com/cloudbyday90/Classifarr/pull/543). Its Knip
6.35.1 → 6.37.0 dev-tooling update was applied to the server manifest and lock
file locally, without merging the PR. The pinned lock file includes the matching
parser transitive updates. Both complete and production Knip gates pass with
the new version. [Knip's 6.37.0 release](https://github.com/webpro-nl/knip/releases/tag/knip%406.37.0)
includes binary-reference and config-loader fixes; the update changes tooling,
not runtime classification behavior.

## Validation and follow-up

- The disposable Compose recovery run passed and removed its container/network.
- Provider circuit/retry integration: 12 tests passed.
- Runner and related unit tests: 31 tests passed.
- Full server unit suite: 1,374 suites / 40,287 tests passed.
- Server typecheck, server ESLint, documentation lint, copyright, ESM import
  and mock-shape checks, both Knip gates and the full server dependency audit
  passed; the audit reported zero vulnerabilities at the time of testing.

Keep the layered stack in the [design](provider-fault-recovery-compose-design.md):
fast unit transitions, isolated transport recovery, separate held-out content
quality benchmark and ordinary system smoke tests. The main advantage is
repeatable evidence across the HTTP and queue boundary with no user data;
the costs are Docker dependency and synthetic classification content.

**Next high-value item:** measure the 60-second half-open trial under realistic
queue/metadata delay and ensure that a deferred job is automatically rescheduled
after expiry without losing its identity or retry budget. Use a deterministic
time seam and a disposable database rather than waiting 60 real seconds. That
closes the remaining starvation risk before expanding the media-content
benchmark.
