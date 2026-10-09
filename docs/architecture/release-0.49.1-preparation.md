# v0.49.1-beta preparation

Date: 2026-10-08 (America/New_York). The maintainer explicitly requested this
release using the complete [release runbook](../../.agent/workflows/release.md).
This preparation record is not a claim that publication has passed.

## Scope and changelog review

Reviewed changes from published `v0.49.0-beta` through
`d005676a6cf2233ae8b650b9d40be7c6f545c7cc`: comparison readiness, vector allocation
and lifetime, representative preparation/verification, bounded resource retries,
memory diagnostics/studies, RAG statistics, configuration, runtime networking,
API-documentation parsing, frontend/dependency analysis and CI fixtures/actions.

The original Unreleased block is preserved verbatim in the
[development archive](../changelog/CHANGELOG-2026-10-pre-release-0.49.1.md).
Its entries were compared with the pre-edit record, and existing published
changelog blocks were verified unchanged. The release summary consolidates
Diagnostics into Added/Changed, uses each standard category at most once in
order, and keeps operator actions and security limits. The root has 327 lines,
near the 300-line target; prior archives remain linked. No system was knowingly
omitted. The first matching release-note body was selected with the publication
assembler's `extractReleaseNotes` function and reviewed before freezing.

No migration or schema change exists relative to v0.49.0-beta. Package/lockfile
versions, UI label, README badge/source marker and the first release-note entry
are aligned to v0.49.1-beta; lockfile regeneration changed only version metadata.
Existing documented `latest` channels were retained.

## Verified image-pull milestone

The live [Docker Hub repository endpoint](https://hub.docker.com/v2/repositories/cloudbyday90/classifarr/)
identified `cloudbyday90/classifarr` with integer `pull_count: 20667` at
`2026-10-09T00:13:56.5787512Z`, or
`2026-10-08T20:13:56.5848465-04:00` locally. README and release notes use
**20,667 Docker Hub image pulls**, observed October 8, excluding GHCR and without
equating pulls to users or unique installations.

## Preparation checks

- Fresh root/server/client `npm ci`: passed using Node 24.21.0/npm 12.2.0.
- All three fresh `npm audit` runs: zero vulnerabilities.
- `npm run lint`: passed.
- `npm run lint:docs`: 2,023 files, zero errors before this record was added;
  this record requires the final documentation check too.
- `npm run policy:product-language-audit`: passed, seven surfaces, zero findings.
- `node scripts/check-release-candidate-version.mjs --tag v0.49.1-beta`: passed.
- `git diff --check`: passed.

Full coverage/tests, the no-cache frozen image soak, saved-template upgrade and
routing rehearsals, PostgreSQL smoke, exact-source remote CI, tag publication,
native published-image checks and post-publication attestations remain required.
Their outcome must identify the final source SHA and image IDs, not reuse an
earlier successful image. Local receipts belong under ignored `.tmp/`; verified
tag-workflow receipts become the signed release evidence asset.

## Security and publication-control review

Manual review covered all sections of `docs/SECURITY_CHECKLIST.md`; automated
and publication portions are not signed off until the remaining gates pass.

| Area | Reviewed state |
| --- | --- |
| Route authentication | All 15 Tier 1 and 10 Tier 2 mounts retain their guards; library, log, queue, stats, system and media-server auth paths remain guarded. No route/bootstrap/middleware changes since v0.49.0-beta. |
| Webhooks | Awaited secret validation, encrypted `whsec_` storage and timing-safe equal-length comparison remain; unequal-length input is rejected. This is shared-secret authorization, not a newly claimed payload-HMAC protocol. |
| Headers/session | Helmet CSP disallows inline/eval scripts; configured CORS allowlist remains. Empty CORS configuration is the existing unrestricted design. HttpOnly/Lax cookies, secure-cookie configuration, 15-minute access tokens, refresh rotation and configured CSRF checks remain. |
| Credentials/errors | Encrypted API-key storage, reviewed log/privacy paths, generic unexpected production 5xx and generic API 404 remain. Operational errors retain their deliberately public contracts. |
| Inputs/files | Runtime changes use bounded vector/numeric validation and parameterized queries; dynamic identifiers remain fixed/allowlisted. No new user-selected filesystem path or eval/Function execution was introduced. |
| Containers | Existing non-root runtime/drop-privilege design retained; no privileged production Compose service. Compatibility fencing is not full database-superuser isolation. |
| Passwords/limits | bcrypt cost 12, no password serialization, and login/setup-admin/webhook limiters retained. |
| Git hygiene | No tracked .env, dump or log files; private test artifacts ignored. Final Gitleaks/CodeQL/OSV/Trivy checks still required for the exact candidate. |

GitHub API inspection on October 8 verified immutable releases enabled and both
`release-publication` and `release-acceptance` restricted to `v*` **tags**, with
administrator bypass disabled. There is one administrator collaborator; no
independent-reviewer separation is claimed. Docker Hub credential names exist;
values were not read. Publication/alias writers are tag-gated, verification jobs
have read-only permissions and no registry publication credentials. The existing
explicit manual retention workflow is separate from publication authority.

Remote release/tag inventory showed v0.49.1-beta unused during preparation; it
must be checked again immediately before tagging. No Unraid deployment, paid
provider evaluation or change to the existing local app-data is authorized by
this release preparation. Release installation evidence after deployment remains
a separate operator step.
