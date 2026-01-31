# Release Checklist (Template)

## Release Metadata
- Version: v0.40.5c-alpha
- Date: 2026-01-31
- Owner: Moreland
- Scope/Highlights: Discord verification constraint fix via post-migration update.

## Preconditions
- Implementation plan complete and signed off.
- Local tests pass (server + client).
- No failing CI or pending review tasks.
- DB migrations reviewed and safe defaults confirmed.

## Local Testing (Required Before Release)
1) Server tests: `npm --prefix server test`
2) Client tests: `npm --prefix client test`
3) Integration tests: `npm --prefix server run test:integration`
4) Optional build: `npm --prefix client run build`
5) Document test run warnings/errors in `docs/interesting_findings.md`.
   - Only add NEW non-breaking findings discovered during this release cycle.

## Release Steps
1) Update `RELEASE_NOTES.md` with new version entry.
2) Update `CHANGELOG.md` if required by repo conventions.
3) Update version references across server, client, UI display, and any docs that should mention the new version.
4) Verify version references are consistent (search for the previous version string).
5) Tag the release.

## Post-Release Verification
- Confirm deployment is live (version display and health endpoints).
- Run a short production smoke (auth/login, classification, routing, webhook ingest).
- Monitor logs and alerts for regressions (routing errors, webhook failures, AI errors).
- Check metrics for error rate spikes, queue backlogs, and slowdowns.
- Validate rollback path is ready if issues appear.

