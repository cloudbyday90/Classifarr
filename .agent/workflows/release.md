---
description: How to create a new Classifarr release
---

# Classifarr Release Workflow

Follow these steps IN ORDER when creating a new release.

## 1. Determine Version Number

Check the latest tag:
```bash
git tag --sort=-v:refname | head -5
```

- **Alpha releases**: Increment from current alpha (e.g., `v0.22.0-alpha` → `v0.23.0-alpha`)
- **Stable releases**: Follow semver (e.g., `v1.1.1` → `v1.2.0`)
- **Use the standard release tag pattern**: prefer hyphenated prerelease labels such as `v0.44.1a-beta` and avoid dotted custom variants like `v0.44.1a.beta` unless there is a one-off exception.

## 2. Update Version Numbers (ALL locations)

Important distinction:
- `client/package.json` and `server/package.json` must remain valid semver for npm tooling, CI, and repo health checks.
- Public-facing release labels and Git tags should normally match the standard release tag pattern, such as `v0.44.1a-beta`.
- When a package version needs a semver-safe variant, keep it close to the release tag (for example release tag `v0.44.1a-beta`, package version `0.44.1-a.beta`) and update the UI/release-note display label separately only when necessary.

| File | Field | Example |
|------|-------|---------|
| `package.json` | `"version"` (semver-safe) | `"0.23.0-alpha"` |
| `client/package.json` | `"version"` (semver-safe) | `"0.23.0-alpha"` |
| `server/package.json` | `"version"` (semver-safe) | `"0.23.0-alpha"` |
| `package-lock.json` | top-level `"version"` and `packages[""].version` | `"0.23.0-alpha"` |
| `client/package-lock.json` | top-level `"version"` and `packages[""].version` | `"0.23.0-alpha"` |
| `server/package-lock.json` | top-level `"version"` and `packages[""].version` | `"0.23.0-alpha"` |
| `client/src/constants/appVersion.js` | `APP_DISPLAY_VERSION` (public label, only if needed) | `"v0.23.0a-beta"` |
| `README.md` | version badge, version paragraph (with pull count + date), Docker compose image guidance | see below |
| `CHANGELOG.md` / `RELEASE_NOTES.md` | release heading (public label) | `"v0.23.0a-beta"` |

### README.md Version Updates

Three locations in `README.md` must be updated to the new release label:

1. **Version badge** (near top of file) — update the `version-` segment in the shields.io URL:
   `![Version](https://img.shields.io/badge/version-vNEW--TAG-blue.svg)`

2. **Version paragraph** (first body paragraph) — update the release label, semver-safe form, and the date. Also refresh the Docker Hub pull count:
   ```bash
   # Fetch current pull count from Docker Hub API
   (Invoke-RestMethod -Uri "https://hub.docker.com/v2/repositories/cloudbyday90/classifarr/").pull_count
   ```
   Round the count to the nearest thousand milestone (e.g., 17,317 → **17,000+**). Update the `as of YYYY-MM-DD` date to today.

3. **Docker compose image tag** (in the Quick Start compose block) — keep the `image:` line on `latest`:
   `image: ghcr.io/cloudbyday90/classifarr:latest`

   Do not replace this with a versioned release tag during normal releases. The checked-in
   compose files and README Quick Start should track `latest` so users who pull/recreate
   their container receive the newest published image without editing compose each release.

After changing package versions, refresh lockfile metadata without changing dependencies:
```bash
npm install --package-lock-only
npm --prefix client install --package-lock-only
npm --prefix server install --package-lock-only
```

Then verify every package and lockfile root version agrees:
```bash
npm --prefix client test -- --run src/__tests__/codeHealth.test.js
```

Verify the public tag contract before tagging:
```bash
npm run release:check-candidate-version -- --tag vX.X.Xa-beta
```

On Windows PowerShell with npm 12, invoke the script directly because npm can
interpret `--tag` as its own configuration option instead of forwarding it:
```powershell
node scripts/check-release-candidate-version.mjs --tag vX.X.Xa-beta
```
The CI workflow runs the npm form in Bash, where it forwards the argument as
expected.

## 3. Update Changelog and Release Notes

### CHANGELOG.md

Rename `## [Unreleased]` to `## [VERSION] - YYYY-MM-DD` and add a fresh `## [Unreleased]` heading above it.

Follow the conventions in [`docs/CHANGELOG-CONVENTIONS.md`](../../docs/CHANGELOG-CONVENTIONS.md):
- Bold-topic + em-dash bullets, 1–2 lines max.
- Six standard categories (Added, Changed, Deprecated, Removed, Fixed, Security), omit empty ones.
- Archive to `docs/changelog/` when main file exceeds ~300 lines.

### RELEASE_NOTES.md

Add new section at the TOP of the file.

Audience: general public (not engineers).
Goal: easy-to-read highlights, not a technical dump.

Required style:
- Write for non-technical readers first.
- Use emojis in section headers to improve scanability.
- Include at least one simple visual block (mini graph/progress bar/table).
- Title should describe user value, not issue number.
- Keep internals in `CHANGELOG.md` (migrations, schema, test internals, file-level details).

Use this format:
````markdown
## v0.XX.0-alpha
**Title: User-facing value statement**

> [!IMPORTANT] (only if there is required action)
> Short plain-language action message.

### 🎉 What You’ll Notice
- Short user-facing outcome
- Short user-facing outcome
- Short user-facing outcome

### 📊 Quick Visual
```text
Impact Snapshot
Reliability  [█████████░] 90%
Speed        [████████░░] 80%
Coverage     [███████░░░] 70%
```

### ✨ Highlights
- Major change in plain language
- Major change in plain language

### 🔧 Reliability Improvements
- Stability/reliability improvement
- Stability/reliability improvement

### 👥 Who This Helps
- End users: ...
- Operators/admins: ...

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---
````

Do not copy changelog sections verbatim into release notes.
Keep technical details (migrations, internals, test matrices) in `CHANGELOG.md`.

## 4. Run Pre-Commit Checks (Local + Ratchet Gate)

Before committing, run these checks to ensure CI will pass:

```bash
# Build the verification image, run the full Docker/PostgreSQL smoke suite,
# and let the smoke runner fully clean up its fresh named volumes/containers
# after the run completes.
docker build -t classifarr:test .

# Refresh and verify the committed schema snapshot using the same fresh image
# and PostgreSQL client path CI uses for tag validation. This avoids drift
# between a long-running local compose container and the release verification
# image.
# CRITICAL: always use db:dump-schema:container (not db:dump-schema:live) for
# the release snapshot. The live-container pg_dump can produce cosmetically
# different CHECK constraint formatting from a fresh container, causing the
# CI schema-drift check to fail even when the schema is functionally identical.
# Optional local guard: the host/compose-path snapshot check should also stay
# green when the local environment matches the release image.
npm run db:check-schema

# Check for dependency vulnerabilities
npm --prefix server audit
npm --prefix client audit

# Run server tests — MANDATORY, do not substitute with a subset or the codeHealth test alone.
# migrations.test.mjs contains snapshot assertions that must be verified against current.sql.
npm --prefix server test

# Run client tests
npm --prefix client test

# Enforce coverage ratchet before release
npm run coverage:ratchet:check

# Check copyright headers
npm run check-copyright

# Optional but recommended: run full CI script locally
npm run test:ci
```

### Local AI-evaluation evidence (when relevant)

When a release changes AI classification, evaluation fixtures, policy decision
state, local-model configuration, or queued decision-witness behavior, collect
fresh local evidence before tagging. This is deliberately a local operator
review step, not an automated release gate and not a substitute for the
mandatory checks above.

1. Run the deterministic no-side-effect fault-scenario harness first:

   ```powershell
   node scripts/verify-ai-policy-sweep-fault-scenarios.mjs `
     --output ".tmp/reports/ai-policy-sweep-fault-scenarios.json"
   ```

   Require all scenario contracts to pass and verify its report declares zero
   network requests, application writes, and media submissions. This confirms
   fallback and contamination are still detected as failures; it does not make
   them acceptable quality outcomes. On Windows PowerShell with npm 12, use the
   direct ESM command when arguments are present.
2. When the release changes provider recovery, AI dispatch, queue retry
   persistence, or route admission, run the disposable live provider-fault
   boundary check:

   ```powershell
   npm run test:integration:ai-provider-fault-compose
   ```

   Require the actual queue task to complete with `queued_for_retry`, a null
   destination, and a no-route decision. This command uses only its fixed
   loopback provider stub and an isolated integration database; it always tears
   down its uniquely named Compose project. It is not a substitute for the
   normal Docker smoke suite or full server test suite.
3. Use the intentional local Docker/Ollama setup with the sweep's no-route
   guardrail enabled. Run the reviewed versioned fixture cohort and retain the
   report only in the ignored, access-controlled `.tmp/reports/` directory.
   When a release changes policy-dependent final destinations, use the optional
   local fixture profile only after a policy owner has reviewed it. Its policy
   fingerprint must match the fresh sweep preflight; do not copy the local
   profile into the repository, CI artifacts, or release evidence.
4. Compare the fresh candidate report with a reviewed baseline that used the
   same fixture/model/policy/runtime context:

   ```powershell
   node scripts/compare-ai-policy-sweep-trend.mjs `
     --baseline ".tmp/reports/ai-policy-sweep-reviewed-baseline.json" `
     --candidate ".tmp/reports/ai-policy-sweep-candidate.json"
   ```

   On Windows PowerShell with npm 12, invoke the script directly as shown;
   npm can otherwise interpret `--baseline` and `--candidate` as npm options.

5. Manually review the generated trend artifact. A `pass_rate_regressed`,
   changed outcome distribution, sample-size change, ungraded row,
   `context_changed`, or one-sided cohort requires an explicit operator
   decision. A stable comparison is evidence only: it does not approve a
   release.
6. Never commit, attach to a public GitHub release, or paste raw sweep reports
   or trend artifacts into CI logs. They may contain local request metadata;
   the comparator artifact itself retains only bounded fingerprints and
   aggregates. Use the normal ignored-artifact cleanup process when the review
   is complete.

See [`docs/local-ai-policy-sweep.md`](../../docs/local-ai-policy-sweep.md) and
[`docs/architecture/ai-classification-evaluation-trend-baseline.md`](../../docs/architecture/ai-classification-evaluation-trend-baseline.md)
for the precise contract and security boundary.

Run the image-bound schema and smoke checks with the syntax for your shell:

```powershell
# PowerShell
$env:IMAGE_NAME = "classifarr:test"
npm run db:dump-schema:container
npm run db:check-schema:container
npm run docker:smoke:pgss
Remove-Item Env:IMAGE_NAME
```

```bash
# POSIX shells
IMAGE_NAME=classifarr:test npm run db:dump-schema:container
IMAGE_NAME=classifarr:test npm run db:check-schema:container
IMAGE_NAME=classifarr:test npm run docker:smoke:pgss
```

If `npm audit` finds vulnerabilities:
```bash
# Review vulnerabilities and assess risk
npm audit

# Fix safe updates (patch/minor versions)
npm audit fix

# For major version updates, review breaking changes first
npm outdated
# Then update specific packages after reviewing migration guides
```

If copyright check fails, fix headers:
```bash
npm run update-copyright
```

This handles both cases: inserts the full GPL-3.0 block into files missing a header entirely, and updates the year range in headers that already exist. Re-run `npm run check-copyright` to confirm all files pass.

If coverage ratchet fails:
```bash
# Preferred: add/adjust tests until ratchet passes
npm run coverage:ratchet:check

# Only when reduction is intentional and approved:
npm run coverage:ratchet:update
git add coverage-baseline.json
git commit -m "chore(ci): update coverage ratchet baseline for intentional change"
```

If `db:check-schema:container` fails:
```powershell
# Rebuild the committed snapshot from the same fresh image/path CI uses
docker build -t classifarr:test .
$env:IMAGE_NAME = "classifarr:test"
npm run db:dump-schema:container
git add database/schema/current.sql

# Then rerun the guard to confirm there is no remaining drift
npm run db:check-schema:container
npm run db:check-schema
Remove-Item Env:IMAGE_NAME
```

On POSIX shells, prefix each schema command with `IMAGE_NAME=classifarr:test`.

If the Docker smoke check fails:
```powershell
# Rebuild the verification image after your fix and rerun the full smoke suite.
# The script is expected to create a fresh instance and remove its temporary
# containers/volumes automatically after success or failure.
docker build -t classifarr:test .
$env:IMAGE_NAME = "classifarr:test"
npm run docker:smoke:pgss
Remove-Item Env:IMAGE_NAME
```

On POSIX shells, run `IMAGE_NAME=classifarr:test npm run docker:smoke:pgss`.

The Docker smoke suite is a release gate. It must prove all of these before a tag is created:
- A fresh instance boots cleanly.
- Existing-cluster recovery still works when `pg_stat_statements` runtime files disappear.
- The PG17→18 upgrade path normalizes managed PostgreSQL config carryover and completes successfully.
- Temporary Docker state created for the verification run is fully cleaned up when the smoke script exits.

### Security Checklist (mandatory)

Before committing, work through [`docs/SECURITY_CHECKLIST.md`](../../docs/SECURITY_CHECKLIST.md). All automated gates (Section A) must pass and must already be green from the steps above. Then verify the manual checks (Sections B–N) and complete the sign-off block.

Key manual checks:
- **Section B** — confirm no route auth regressions in `server/src/routes/api.js`
- **Section G** — confirm no debug scripts or log files are tracked in git
- **Section H** — confirm `healthCheck()` and global error handler sanitize in production

The sign-off block from `SECURITY_CHECKLIST.md` should be included in the release commit message or attached to the release ticket.

## 5. Commit Changes

// turbo
```bash
git add -A
git commit -m "vX.X.Xa-beta: Title

Brief description of changes

New Features:
- Feature 1
- Feature 2

Fixes:
- Fix 1"
```

## 6. Create Annotated Tag

// turbo
```bash
git tag -a vX.X.Xa-beta -m "vX.X.Xa-beta: Title - ADDITIONAL NOTES"
```

## 7. Push to Remote

// turbo
```bash
git push origin main --tags
```

## 8. Configure Release Publication Controls

Before relying on the tag workflow for a release, configure these repository
controls in GitHub. They are administrative controls and cannot be established
by the workflow file alone:

1. Enable **immutable releases** for the repository or organization. The
   workflow verifies the resulting release attestation after publication.
2. Configure the `release-publication` environment with a custom **tag** policy
   for `v*`. The final publication job may run only from a release tag.
3. Add required reviewers and self-review prevention only when an independent
   maintainer exists. This single-maintainer repository intentionally has no
   reviewer policy; its publication controls are the tag restriction, CI gates,
   immutable release record, and release-attestation verification.
4. Configure `release-acceptance` with the same custom `v*` tag policy and
   disable administrator bypass for both release environments. The post-deploy
   evidence workflow must be dispatched from the exact deployed release tag.

Do not use a personal access token, a manual GitHub release, or a local Docker
build as a substitute for this tag-based evidence chain.

## 9. Verify Tag Workflow And Release Evidence

Do not communicate a release until the pushed tag workflow has completed.
```bash
# After push, inspect recent CI/CD runs
gh run list --workflow "CI/CD Pipeline" --limit 10

# Watch the specific run for your tag and fail fast if it fails
gh run watch <run-id> --exit-status
```

The tag workflow performs these operations in order:

1. Runs the fixed disposable AI provider-fault integration on a separate fresh
   GitHub-hosted Docker job after release acceptance. It validates and uploads
   only the short-lived `ai-provider-fault-compose-receipt`; a failed or missing
   receipt blocks image publication. Do not substitute local sweep reports for
   this receipt.
2. Builds, publishes, attests, and verifies the GHCR and Docker Hub digest. Each
   validated release tag also publishes the same digest as `:latest` for the
   documented Docker Compose and Unraid update channel; the version tag remains
   the immutable rollback and pinning reference.
3. Starts the exact GHCR digest from a separate hosted consumer job and uploads
   bounded `published-digest-consumer-smoke` evidence. It also verifies that
   `latest` resolves to that digest, every referenced OCI manifest is readable,
   and a clean native-platform `docker pull` succeeds before publication.
4. Validates the tag against all package-lock and package versions plus the
   public UI version, then revalidates the CI readout and consumer evidence
   against the tag, source revision, and digest. It uploads
   `release-candidate-evidence` as a workflow artifact and enters the
   tag-restricted `release-publication` environment.
5. Creates a draft GitHub release with the evidence JSON attached, publishes
   that draft, and verifies the GitHub release attestation. Tags containing a
   prerelease suffix are marked prerelease and explicitly not latest.

Do **not** run `gh release create` manually. The workflow uses `--verify-tag`
and `--fail-on-no-commits`, preventing an unreviewed command from creating a
tag or publishing a duplicate release.

If the tag run fails before the publication job creates a release:
```bash
# 1) Fix code on main and push
# 2) Delete the unpublished broken tag
git tag -d vX.X.Xa-beta
git push origin :refs/tags/vX.X.Xa-beta

# 3) Recreate tag from the fixed commit and push
git tag -a vX.X.Xa-beta -m "vX.X.Xa-beta: re-release after CI fix"
git push origin vX.X.Xa-beta
```

If the multi-architecture Docker build fails during `npm ci` with a transient
registry error such as `ETIMEDOUT`, first confirm that no GitHub release was
created. Keep `npm ci` and lockfile verification intact; use npm's documented
`fetch-retries` configuration in the Docker builder rather than a shell retry
loop, `--force`, or a manual image publication. Rebuild the image locally,
commit the focused fix, pass main-branch CI, and then follow the unpublished-tag
replacement sequence above.

For this public repository, `gh attestation verify` must retain its default
trusted roots. Do not add `--no-public-good`: GitHub publishes public-repository
attestations through Sigstore Public Good, and that flag rejects the required
release verification. Preserve the repository, signer-workflow, source-digest,
and `--deny-self-hosted-runners` constraints.

The published-digest consumer smoke must run as `1000:1000`, matching the
image-owned `/app/data` directory copied into its fresh project-scoped volume.
Keep `read_only: true`, `cap_drop: [ALL]`, and no `cap_add`: capability-stripped
root cannot write that image-owned directory, while the configured runtime user
can initialize it without retaining privilege-escalation capabilities.

If a GitHub release was already published, do not move, delete, or reuse that
tag. Immutable releases prohibit doing so. Correct the release on a newer tag,
rerun the full evidence chain, and avoid availability communication for the
unverified release until the follow-up is published.

### Repairing a Missing `latest` Alias

After tag CI succeeds, verify that the public update alias resolves to the
exact release digest. `latest` is an explicit OCI tag, not an automatic registry
feature, so it must point to the same multi-platform image index as the release
tag:

```bash
docker buildx imagetools inspect ghcr.io/cloudbyday90/classifarr:vX.X.Xa-beta
docker buildx imagetools inspect ghcr.io/cloudbyday90/classifarr:latest
```

If `latest` is missing or resolves to a different digest, first confirm that the
version tag itself pulls cleanly. Do not rebuild the image, republish the
immutable version tag, or delete the GitHub release.
Dispatch **Promote Published Release Image Alias** from `main` and set
`source_tag` to the published immutable `v*` release tag. The workflow rejects
draft or mutable releases and incomplete OCI indexes, copies the exact OCI index
bytes to `:latest`, confirms all referenced manifests plus a native-platform
pull are available, verifies the digests match, and uploads
`published-release-image-alias-promotion` evidence. This is the only supported
recovery path for an otherwise healthy existing release image. If the version
tag itself does not pull, publish a corrective release on a new tag instead.

### Container Image Retention

Do not use generic GHCR package-version deletion for this multi-platform image.
An OCI index references platform-specific manifests that can appear untagged in
package-version inventory; removing those entries can make a still-tagged image
unpullable. Automatic retention is limited to Docker Hub tags. Review GHCR
storage manually with manifest-reference awareness and preserve every child of
each retained release index.

For a GHCR storage review, run the read-only manifest inventory before proposing
any retention action. This is not a release gate and it must not be given a
delete-capable token:

```powershell
$env:GH_TOKEN = '<GitHub token with read:packages>'
$env:GHCR_ACTOR = '<GitHub account that owns the token>'
npm run ghcr:retention:inventory
Remove-Item Env:GH_TOKEN
Remove-Item Env:GHCR_ACTOR
```

The output under `.tmp/ghcr-manifest-retention/` must show a complete graph,
zero unresolved references, an empty `incompleteRetainedTags` list, and every
tagged root and child manifest protected. `manualReviewRequired` is
investigation evidence only. It never authorizes a package deletion; any future
removal needs a separate approved procedure with post-removal multi-platform
pull verification. See
`docs/architecture/ghcr-manifest-retention-inventory.md`.

### Existing Broken Image Release

Do not republish an existing release tag to repair an incomplete retained image
graph. First create fresh read-only retirement evidence for that exact tag. The
command below performs only GitHub Packages, GHCR, and GitHub Releases `GET`
requests; it cannot change registry content, package versions, aliases, tags, or
release metadata:

```powershell
$env:GH_TOKEN = '<GitHub token with read:packages and repository read access>'
npm run release:assess-image-retirement -- --tag vX.Y.Z-beta
Remove-Item Env:GH_TOKEN
```

When the evidence reports
`immutable_release_requires_external_advisory`, retain the generated report,
publish an external incident advisory that names the affected immutable release
and digest, and request explicit approval before any remote retirement action.
Do not use generic package-version deletion. A remote action must begin with a
fresh complete inventory, scope the action to the exact affected tagged root,
and finish with a new inventory plus supported-platform pull checks. See
`docs/architecture/published-image-release-retirement.md`.

## 10. Record Existing-Installation Acceptance

After the immutable release digest is deployed to a supported installation:

1. In GitHub Actions, dispatch `Release Installation Evidence` from the exact
   `v*` tag. Supply the deployed digest and a bounded change or deployment
   reference. It rejects branch dispatches and invalid tag/package versions.
2. Download the workflow's `policy-release-installation-evidence` artifact and
   the matching tag CI `policy-release-acceptance-readout` artifact.
3. Optionally collect the aggregate operator-decision metric for a declared
   time window. Only compare it with an equal-duration, same-scope baseline.
4. Assemble the installation readout with
   `npm run policy:release:acceptance-readout -- --mode installation ...` as
   documented in `docs/architecture/release-acceptance-assembly.md`.

This is a bounded operator attestation of a supplied deployed digest, not a
remote inspection or mutation of Docker Compose. Do not treat it as evidence
for compatibility-code retirement; that requires the separate active-
installation approval chain.

## 11. Rebuild Docker (if local testing)

```bash
docker compose down; docker compose up -d --build
```

## 12. Verify

1. Check the GitHub release has the attached `Release candidate evidence` JSON
   asset and displays as immutable.
2. Verify the release attestation independently:
   ```bash
   gh release verify vX.X.Xa-beta --repo cloudbyday90/Classifarr --format json
   ```
3. Verify version shows correctly in UI (bottom-left sidebar).
4. Test any breaking changes documented.
5. Confirm latest `CI/CD Pipeline` and `OSV Dependency Scan` runs for the tag are `success`.

---

## Files Changed in a Release

Minimum files to modify for ANY release:
1. `package.json` - root version
2. `client/package.json` - client version
3. `server/package.json` - server version
4. `package-lock.json` - root lockfile version metadata
5. `client/package-lock.json` - client lockfile version metadata
6. `server/package-lock.json` - server lockfile version metadata
7. `client/src/constants/appVersion.js` - UI/public display version label
8. `README.md` - version badge, version paragraph (with Docker Hub pull count + date), Docker compose image guidance
9. `RELEASE_NOTES.md` - release notes entry
10. `CHANGELOG.md` - changelog entry (keep-a-changelog format)

Additional file when the release includes database/migration/schema changes:
11. `database/schema/current.sql` - refreshed schema snapshot generated by `npm run db:dump-schema`

## Important Notes

- **Never skip the display-version update** - This is the version users see in the UI
- **Never skip the README version update** - Update the version badge and version paragraph, but keep the Docker compose image on `ghcr.io/cloudbyday90/classifarr:latest`
- **Never skip root/package-lock version updates** - code health checks require root, client, server, and all lockfile root versions to match
- **Alpha releases use format**: `v0.XX.0-alpha`
- **Stable releases use format**: `vX.X.X`
- **Keep package.json versions semver-safe** even when the public-facing tag/label uses a custom variant like `v0.44.1a.beta`
- **Always check git status before committing** to ensure all intended files are staged
- **Release notes style**: use emojis, quick visual block(s), and plain-language outcomes
- **Separation of concerns**: `RELEASE_NOTES.md` = public highlights, `CHANGELOG.md` = technical detail
- **Changelog entry conventions**: follow [`docs/CHANGELOG-CONVENTIONS.md`](../../docs/CHANGELOG-CONVENTIONS.md) — bold-topic + em-dash bullets, 1–2 lines max, six standard Keep a Changelog categories, archive when main file exceeds ~300 lines
- **Title guidance**: release-note titles should be benefit-focused (avoid issue-centric titles like `Issue #275`)
- **Pre-commit checks are mandatory** - always run tests and copyright check before committing a release
- **Schema snapshot freshness is part of release hygiene** - build the release verification image, then run `IMAGE_NAME=classifarr:test npm run db:dump-schema:container` and `IMAGE_NAME=classifarr:test npm run db:check-schema:container` before the release commit
- **Schema-changing work must update `database/schema/current.sql` in the same change** - whenever you add or modify migrations, change schema-affecting SQL, or change the snapshot generator, regenerate `current.sql`, stage it with the schema work, and rerun both the containerized and local schema checks so CI does not fail on snapshot drift
- **Docker smoke verification is part of release hygiene** - build `classifarr:test`, run `IMAGE_NAME=classifarr:test npm run docker:smoke:pgss`, and do not tag until the fresh-instance/upgrade smoke run passes and cleans up
- **Coverage ratchet is a hard gate** - do not tag/release while `npm run coverage:ratchet:check` is failing
- **Release is blocked on the complete evidence chain** - never communicate
  availability before tag CI, digest provenance, consumer smoke, tag-restricted
  publication, and GitHub release-attestation verification succeed
