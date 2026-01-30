# Release Checklist (Template)

## Release Metadata
- Version: <fill>
- Date: <fill>
- Owner: <fill>
- Scope/Highlights: <fill>

## Preconditions
- Implementation plan complete and signed off.
- Local tests pass (server + client).
- No failing CI or pending review tasks.
- DB migrations reviewed and safe defaults confirmed.

## Local Testing (Required Before Release)
1) Server tests: `npm --prefix server test`
2) Client tests: `npm --prefix client test`
3) Optional build: `npm --prefix client run build`
4) Manual smoke (update per release):
   - <fill>

## Release Steps
1) Update `RELEASE_NOTES.md` with new version entry.
2) Update `CHANGELOG.md` if required by repo conventions.
3) Verify version references (server/client package.json if needed).
4) Tag the release.

## Post-Release Verification
- Verify key flows for this release (see “Release-Specific Checks” below).
- Monitor logs for regressions (routing errors, webhook failures, AI errors).

## Release-Specific Checks (Fill Per Release)
For each release, copy the release-specific checks from the active implementation plan into this section.
Implementation plan: <fill>
### Highlights / Changes
- <fill>

### Manual Smoke Tests
- <fill>

### Observability
- <fill>

### Links
- <fill>
