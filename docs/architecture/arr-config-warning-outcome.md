# Arr configuration warning: outcome

Date: 2026-10-12. Starting source:
`4df914e96b7f1b3e12473583f8b499b50c26c486` on `main`.
Node 24.21.0 / npm 12.2.0 on Windows. Version remains 0.49.1-beta.

## Delivered

The warning is now enrolled in the existing strict Vue project. Dashboard owns
the named API loader; the component receives unknown data and a small ESM parser
validates supported quality-profile warnings. The existing GET contract is
unchanged. No raw HTTP calls moved into a view or component.

Unknown providers no longer fall through to Sonarr. Destinations are fixed internal
links, not response-controlled URLs. Provider-scoped IDs avoid duplicate keys,
missing names have deterministic fallbacks, and names remain escaped text.
Dismissal is a named non-submit button. Late responses are ignored after unmount;
failure logging no longer includes the raw transport error. Underlying requests
are not cancelled, and this remains an optional one-fetch warning rather than a
complete configuration-health monitor.

See [design, alternatives and official sources](arr-config-warning-design.md).
No dependencies, server behavior, schema, recovery approvals, memory protection,
or provider configuration were changed.

## Verification

Initial direct enrollment pulled 330 API-graph diagnostics into strict checking.
The typed loader boundary removes that unintended dependency without suppressions
or relaxed compiler options. The initial targeted run passed 93 of 94 checks;
the sole failure expected TS2322 instead of the actual TS2739 for a synchronous
loader returning an object where a Promise is required. The fixture now asserts
the actual single source-mapped diagnostic. Strict component checking passed.

- Full frontend coverage: **461 files, 6,964 tests passed**, no skips, 383.80
  seconds. Statements 87.36%, branches 81.14%, functions 87.08%, lines 89.10%.
  Includes the corrected compiler assertion, 30 real-compiler contracts, parser
  and lifecycle regressions, and the expanded checked-event lint scope.
- Shared-control Chromium checks: eight passed with no retries. The warning case
  uses real RouterLinks and Enter/Space; verifies both destinations, dismissal,
  one load, no form submissions, no API requests and no page errors.
- Production Vite build and eight production-route Chromium checks passed.
- Client lint (zero warnings), both typecheck scopes and 12 runner configuration
  tests passed. The existing six backend Arr endpoint contracts passed using
  mocked database queries, not a live provider/database integration.
- ESM static-import, npm CLI flag, copyright (1,595 files), whitespace and
  Markdown (2,137 files) checks passed.
- All 42 dependency/toolchain contract tests passed; package versions and install
  restrictions were not changed.

The browser runners emitted the existing NO_COLOR/FORCE_COLOR environment
warning. No full backend coverage run or combined coverage ratchet is claimed;
existing backend reports must not be presented as current evidence. Exact image
verification is recorded separately below.

## Open PR inventory

Repeated GitHub MCP requests returned zero open PRs. No random candidate exists;
no PR was invented, reopened, applied or merged. Existing dependencies and lockfiles
remain unchanged. This is not a fresh dependency-upgrade or audit claim.

## Local baseline and rollback

The local desktop-linux container was healthy on image
`sha256:eae9a58a47a4b365097bf5af7a8aa96591cd91a0294b5c1fb528f610c26ac7de`.
A fresh private 75,921,766-byte database backup passed checksum and archive
readability checks; an exact rollback image tag was retained. Private archives
and logs remain ignored, outside Git.

The read-only baseline at 14:33:31 UTC reports ten active/covered libraries,
6,837 classifications, four unresolved identities (two source review and two retry
wait), zero pending text embeddings and 6,815 pending image embeddings. A unique
ten-item consumer batch took 8 ms, with zero writes/provider calls. One
`cached_vectors_incomplete` warning occurred since startup; this UI change does
not resolve optional vector coverage or existing identity reviews.

## Rebuilt image evaluation

The no-cache Compose build completed from clean implementation commit
`f75ea398aa3c08a807c283c79ea2fb8ffea101b2`. Local artifact identities:

- Image/index ID: `sha256:caa1cf08879b548cbd82776665781894dc81b6295d33a2e2104e8fb9fe7f86f7`.
- Exported manifest: `sha256:68a517e4ccf738a9e3dfd580439166db8a3c2828ca7bbc4d6de4a8c749d6d80a`.
- Exported config: `sha256:86b956e259af39a3a95b99dfa98d6cc74ddcb4b4409c0d904a9a2c1efdad750f`.
- OCI revision matched the implementation commit before fixture execution and
  after replacement. These are local artifact identities, not published digests
  or signed registry provenance. The image-evidence follow-up commit is docs only.

`dumpSchema()` ran after the build against the exact image in a fresh disposable
container: ordinary entrypoint, no network or ports, 1 GiB, two CPUs and 256 PIDs.
The generated schema remained unchanged through
`20261010_220000_source_catalog_mappings.sql`, including 22 seed migrations.
Fresh-database consumer checks passed with no invented pending work, images or
unresolved identities. The owned fixture container and data directory were
removed and their absence verified. The private backup and rollback image remain.

Only local Classifarr was replaced, with `--no-build --pull never --no-deps`.
It started at 14:44:53 UTC and passed Docker health and HTTP `/health` (200).
Running image and source revision matched the tested artifact: zero restarts,
OOM false, UID/GID 1000:1000, read-only root, 2 GiB and no-new-privileges retained.

At 14:45:23 UTC the read-only consumer probe returned unchanged baseline counts;
its unique ten-item batch took 5 ms with zero writes/provider calls. No WARN/ERROR
was recorded since startup at that observation point. This short startup check
does not establish sustained memory behavior or completed optional-vector work.
Unraid, shared Plex/Ollama and other local containers were not changed by these
checks. No release, tag or version bump was created.

## Next recommendation

1. Retain the typed loader, runtime parser and fixed native links. Benefit: a
   bounded, independently checked component. Cost: callers must explicitly supply
   the loader; absence of the warning must not be interpreted as verified health.
2. Next review `PgvectorVariantBanner.vue`: its sessionStorage read occurs outside
   the status-load try/catch, its dismissal writes directly to storage, and its
   restart advice should be checked against actual runtime variant selection.
   Add strict contracts and storage/lifecycle regressions before changing advice.
3. Expand strict checks to status producers in bounded batches. Do not pull the
   entire untyped API graph into this change or weaken memory/recovery safeguards.

The dependency-update skill required a fresh open-PR inventory rather than a
duplicate application. The image-evidence skill requires the rebuilt artifact
to match a clean implementation commit and keeps schema checks disposable.
