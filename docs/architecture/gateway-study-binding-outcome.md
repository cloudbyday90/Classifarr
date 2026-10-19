# Gateway study input binding outcome

## Result and exact subject

Passed the approved five-mode rollout, including native refusal/input-protection
checks, both restore/comparison lanes, unchanged-duration inference soaks and
verified owned cleanup. See the separate [design](gateway-study-binding-design.md)
for the official research, options, safeguards and recommendation stack.

- Tested clean source: `aa22146fd034218c08adb923cb0dea42d445286e`.
- No-cache local Docker image ID:
  `sha256:cfea5f92865fd2132a710c68deb2dca83aef16285f64c6d70801fd116c9e6ba0`.
- Inspected OCI source label matches that source. This is a locally built image
  and local integrity evidence, not a published manifest digest or attestation.
- Platform: Docker Desktop Linux/amd64; Node.js 24.21.0 and PostgreSQL 18.6.
- Verification date: 2026-10-18 Eastern (some logs are dated October 19 UTC).
  This later documentation update does not change tested executable inputs.

The common runner now stages exact committed blobs, not later worktree reads.
Small ESM modules separate input policy, source binding, staging, execution and
output checks. The expected manifest digest is supplied by the host command and
verified before manifest interpretation or copied executable imports. Launch
arguments are checked before restoring the fixtures' original argument shape.
Every workload mounts code and its manifest read-only; observations use a separate
`/results` volume. Row-mode application parity and native safety assertions remain.

## Native results

All commands used the exact image and revision above with
`scripts/run-gateway-online-archive-rehearsal.mjs`. Each mode independently passed
wrong-digest refusal before fixture SQL setup, existing/new input-write denial,
writable-output probing and final committed-checkout/owned-cleanup checks. Linux
staging additionally proved that its no-follow reader refuses a symlink; the
writable staging container was removed before the workload started.

| Mode flag | Study-input manifest SHA-256 | Result |
| --- | --- | --- |
| `--history-profile` | `f8ed1cd05891f2c0582750b2c0f7d8455d9acd0d79527aa4a8394902a0cb51a4` | Passed, cleanup verified |
| `--row-mode-profile` | `5e1c37c55a14a98f3b8913964dcf3555a636a65bb15a7aad62bd12505c6ec1b3` | Passed, cleanup verified |
| `--restore-memory` | `ccbff749615588b1018d42a0c6c3c707a9c406b6f53684e360a46e028859af47` | Passed, cleanup verified |
| `--inference-soak` | `a8301fa637298d312703a1ae8b09cce4ba0d51df78ed205bfc31b3cdac4c38f4` | Passed, cleanup verified |
| `--extended-soak` | `1eec2aa1a8efd189f8129114840acdd19a18ae86525a21025b64471d89420964` | Passed, cleanup verified |

The manifest is version 2 test metadata, not a new database or archive format.
All modes bound 19 shared fixture files; row mode bound six additional comparison
files and its two parity-sensitive packaged application modules. No production
application code, schema, schedule, retry budget or provider setting changed.

### History and row-mode studies

History profiling retained exact equivalence over 3,001 records and passed the
existing production query budget. Row mode passed both eight-run lanes, all ten
refusal/cancellation probes, byte/hash equivalence and read-only database denial.
The final source fingerprint was unchanged. Its predeclared performance screen
remained negative: allocation ratios were 0.946, 1.010, 1.083 and 1.009, with a
natural elapsed ratio of 0.992. This is not evidence to change the production
reader. The earlier [row-mode findings](gateway-row-mode-outcome.md) still apply.

### Repeated restore study

Both lanes completed five real large restores with exact receipts, empty scratch
space and no surviving children. The natural lane retained its real baseline,
four one-minute gaps and five-minute tail: 678 samples over 677,289.7 ms.
The separate allocation lane had 83 samples over 75,084.9 ms. Both reported zero
forced GC and zero memory/PID-limit events. Source fingerprints matched afterward.
Neither lane shortened cooldowns, refunded attempts or removed verification.

### Concurrent inference studies

| Profile | Offered | Completed synthetic calls | Expected busy responses | Observed duration |
| --- | ---: | ---: | ---: | ---: |
| Eight-minute arrival plan | 528 | 480 | 48 | 479,299 ms |
| Thirty-minute load plus idle tail | 1,980 | 1,800 | 180 | 1,860,105 ms |

Both preserved peak provider concurrency one, unique work fingerprints and UUIDv7
request identities. Final admission/binding counts were 481 and 1,801 respectively,
including the prerequisite request. Each retained two verified catalog jobs at
attempt one, with no active request or cleanup operation. Real dump and restore
windows overlapped admitted inference requests; container uptime alone was not
used as progress evidence. No drops or unexpected request failures passed.

The extended study had 1,860 observations, zero failed samples and a maximum sample
gap of 1,099.9 ms. Its 3,000 historical rows and 233,849,288-byte fingerprint were
unchanged; two roots remained retained. Memory/PID-limit checks passed. All provider
calls were to the synthetic loopback fixture, with external networking disabled.

## Quality checks and local Compose evaluation

- Tooling/preflight: 61 cases, 60 passed and one Windows symlink-creation skip.
  Native Linux staging separately proved symlink-read refusal in every mode.
- Seven affected backend contract suites: 36,483 tests passed, including ownership,
  preflight, code-health, installation/routing and frozen-release contracts.
- Full configured lint and type checks, both dependency inventories, copyright,
  ownership checks, four policy gates, static ESM and mock-shape checks passed.
  No ownership/security baseline was regenerated.
- Markdown checks: 2,292 files, zero errors. Final documentation, whitespace and
  secret checks passed before handoff.
- No full application coverage rerun or new published/arm64 upgrade claim: this
  changes tooling, not application/API/schema behavior. Existing mixed-image
  upgrade contracts passed; those native upgrade exercises were not rerun here.

The normal local Compose service was refreshed from the exact no-cache image,
with the previous image protected and no image pull or optional gateway enablement.
Container `7a51fe7a8957bca34ae5fb7206553fc1851a095fd7c39476f17281a2f967ceac`
was healthy; `/health`, `/api/system/health/ready` and `/` each returned HTTP 200.
Optional gateway schemas remained absent. Capture budget remained
`revision=2`, all call/token allowance and reservation fields zero, with unchanged
`next_check_at=2026-10-09 16:50:11.617278-04`.

Fresh private pre-refresh backup:
`data/backups/gateway-study-binding-refresh-ready-20261018.dump`,
76,251,697 bytes, reported mode `0600`, SHA-256
`1440a21e2ad84b4c5d41beb8f02c4646d446c0754b0fa391026ec5c0ada2a710`.
Its `pg_restore --list` check passed; this is not a full application-DB restore
proof. The earlier 76,252,366-byte task-start backup remains retained too.
Protected rollback tag:
`classifarr-local-rollback:2a20020ea89e9f17132499b666d52adab2055b76b6e6d147d2ae27654dbb1a11`
points to prior local image
`sha256:ec579c2b2d9999f6418eb4015bed7672a1c3e33a9ea2a96bc897581bc6ae51a9`.
No backup/image pruning or live history deletion was performed. All owned study
containers, volumes and temporary input directories were gone after completion.

## Limitations and next recommendation

These are trusted-host local integrity checks, not signatures or protection from
a compromised host, Docker daemon, checkout or trusted image. Fixed input lists
must be maintained; relative-import closure tests make omissions fail review.
Generated observations remain separately writable and are validated, not treated
as executable inputs. Abrupt host loss can leave disposable labeled resources;
unverified cleanup cannot produce a passed result.

The common CLI still defaults to equal image/fixture source. The neutral helper
supports explicitly separate revisions and tests that contract; existing upgrade
callers/receipt schemas were not forced through a universal equality restriction.

At completion of this batch, default archive/catalog/retention,
qualification/cleanup and scheduling/rotation families were deferred and unbound.
The subsequent [default-family outcome](gateway-default-binding-outcome.md) records
its separately tested rollout on October 19. Qualification/cleanup and
scheduling/rotation remain follow-ons, without new recovery authority, admin
functions or purge permissions.

GitHub MCP enumeration found no open PRs, including the repeat check during this
work. No closed PR was presented as open. All changes stay on main, with high-level
Unreleased notes and separate design/outcome documents. No release, Unraid change
or shared Ollama reconfiguration was performed.
