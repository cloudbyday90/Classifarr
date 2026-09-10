# Documentation-Lint Dependency Remediation — Outcome

Status: implemented, unreleased. Validated on 10 September 2026.

## Delivered change

- Replaced the root `smol-toml` override at `1.6.1` with `1.8.0`.
- Regenerated the root npm lockfile so the resolved dependency matches the
  manifest.
- Left server and client manifests and lockfiles unchanged.
- Added an Unreleased changelog entry. No release was created.

## Verification evidence

- Root `npm audit --json`: 0 vulnerabilities; `markdownlint-cli2@0.23.2`
  resolves the overridden `smol-toml@1.8.0`.
- Direct server and client `npm audit --json` runs: 0 vulnerabilities each.
- `npm run lint:docs`: 1,208 Markdown files checked with 0 issues.
- `npm run esm:check-static-imports`: passed.

## Security outcome

The root lint path no longer resolves the advisory's affected `smol-toml`
range. This reduces denial-of-service risk when repository documentation or
configuration is linted, without changing HTTP exposure, data retention,
AI/RAG retrieval, policy scoring, routing authority, or user permissions.

## Follow-up

The highest-value product follow-up remains operational rather than another
speculative model change: collect two genuinely independent completed reviewer
worksheets from a current private packet, finalize them, then run consensus and
the offline semantic summary. That supplies the first trustworthy measurement
for deciding whether candidate-bounded AI/RAG evidence should change an
advisory priority threshold. It must not be simulated by code.
