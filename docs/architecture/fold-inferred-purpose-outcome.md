# Fold-local inferred purpose evaluation: outcome

Date: 2026-10-09. See [design, sources and tradeoffs](fold-inferred-purpose-design.md).

## Implemented

The automatic offline replay now rebuilds recognized inferred-only native purpose
rules from the existing fold-local observation profile. Stored inferred values do
not enter the rebuilt purpose. Declared restrictions remain in force, while mixed,
unknown, invalid, sparse and profile-restricted cases keep the exclusion fallback.
The separately invoked prospective held-out study is unchanged.

Policy report v2 records `inferredPurpose: fold_training_only`; v1 remains readable.
New computation/history fingerprints separate this experiment from old results,
and a legacy policy report is never reused as the new result. Command Center copy
explains the new preparation and the remaining limitations. No schema change,
live policy rewrite, AI budget increase, provider request or routing write was
introduced. Fold caches are per-arm weak maps, not retained global state.

## Verification

- Focused final regressions: 38 tests passed across three suites. The real worker
  prepares movie and TV comparison requests from an ambiguous synthetic fixture,
  but makes no provider calls. A separate deterministic fixture exercises ordinary
  policy decisions. Stored inferred values do not appear in prepared requests.
- Training checks exclude corrected identities and their copied descriptions in
  every fold, preserve each arm's source-only exclusions, and compare regenerated
  purposes with the shared production builder. Input objects remain unchanged.
- Four PostgreSQL integration suites: 45 tests passed, covering source-pair
  execution, history persistence/readback, window progression and cached replay.
- Lint, server/client type checks, both Knip modes, 40 tooling checks, copyright,
  ESM checks, Markdown and ownership drift checks passed. Existing ownership
  analysis debt is unchanged; the audit is not blanket writer authorization.
- [PR 556](node-types-pr-556-outcome.md) was randomly selected from open PRs,
  applied locally and rejected by the existing Node-major check before install.
  Node 24 dependencies remain unchanged; no PR was merged.

- Frontend coverage: 446 files, 6,453 tests passed; 88.80% lines and 80.46%
  branches. The Chromium evaluation-history test passed (keyboard pause/resume
  and access-loss clearing). Its broader dashboard fixture still logs unrelated
  missing retry-readiness/pending-classification responses; those panels are not
  being claimed as verified by this test.

- Backend coverage: 1,757 suites passed, with 54,514 tests passed and one skipped;
  89.75% lines and 85.86% branches. The new fold-purpose module has 100% line,
  branch and function coverage. The current backend/frontend coverage ratchet
  passed without lowering its thresholds. The existing Windows skip covers Linux
  directory fsync; the exact-image Linux probe below passed that behavior.

This is not a release or a claim that deployed Unraid is fixed.

## Local image and schema

Built with `--no-cache --require-provenance` from clean source
`b657390475ac1720193a7b587aba3184903b9cbc`, using the existing local Compose files.
Image: `sha256:7ad41074ce914d3d40bc82578f6e7be757960e44e6cbc414de6fc45c7ca60a31`.
Recreated only local `classifarr`, preserving its mounts, 2 GiB limit and
safeguards. Health is 200, Docker is healthy with zero restarts/OOM kills, and an
unauthenticated evaluation-history GET is still 401. Packaged code emits policy
report v2. Unraid and the unrelated local application container were not changed.

Ran the schema dump using an isolated fresh database from that exact image; the
snapshot is unchanged and the disposable container/appdata were cleaned up.
The Linux directory-fsync probe passed exclusive copy, source preservation and
refusal to overwrite. No local application data was used by the schema check.

The local capture budget remained disabled at zero daily calls/tokens. Immediately
after restart the saved evaluation was still v1; this is historical state, not a
reason to reset quotas, manipulate cooldowns or report the new computation as run.

Read-only follow-up found `inventoryBackgroundReadiness = backfilling` with an
empty pending/processing task queue. Of ten active movie/TV libraries with import
phase `complete`, three have no `backfill_completed_at`; their backfill run IDs
match. This identifies the admission condition, not why the markers are absent.
No completion marker or readiness safeguard was changed. It is local evidence,
not a diagnosis of the separate Unraid database.

An isolated packaged-worker probe, with network disabled, read-only root,
unprivileged user and no application-data mount, passed: 48 synthetic cases,
25 selected comparison pairs and 50 bounded prepared requests. No provider call
or routing write occurred; missing cached responses remained incomplete. This
verifies the image's computation without bypassing local database admission.

## Recommendation and next item

Keep this fold-trained evaluation with explicit provenance: it recovers useful
coverage without allowing the tested item to train its own purpose. The cost is
that it measures a retrained policy, not the exact stored policy, and insufficient
training remains unsupported. Coverage and observational corrections are not
independent accuracy measurements.

Next, investigate the three missing local metadata-backfill completion markers
and their real outstanding work; never mark them complete solely because the task
queue is empty. After readiness and deployment, measure the inferred-only cases
again before considering any administrator-approved capture budget. Obtain
independent reference labels before making quality claims. For the separate
tooling queue, review Knip 6.41.0; do not advance Node declarations to a different
runtime major just to clear an open PR.
