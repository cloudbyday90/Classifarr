# Release Checklist

## Release Metadata

- Public release label: `vX.Y.Z-beta`
- Package version: `X.Y.Z-suffix` (example: `0.44.2-c.beta`)
- Date: `YYYY-MM-DD`
- Owner: `<name>`
- Scope/Highlights: `<one-line summary>`

## Preconditions

- Implementation plan complete and signed off.
- Local tests pass (server + client).
- No failing CI or pending review tasks.
- DB migrations reviewed and safe defaults confirmed.

## Local Testing (Required Before Release)

1. Server tests: `npm --prefix server test`
2. Client tests: `npm --prefix client test`
3. Integration tests: `npm --prefix server run test:integration`
4. Optional build: `npm --prefix client run build`
5. Document test run warnings/errors in `docs/interesting_findings.md`.
   - Only add NEW non-breaking findings discovered during this release cycle.

## Prerequisites

- [GitHub CLI (gh)](https://cli.github.com/) installed and authenticated (`gh auth login`).
- Docker build pipeline configured to trigger on Release creation.

## Release Steps

1. **Update Notes**: Update `RELEASE_NOTES.md` with new version entry.
2. **Update Changelog**: Update `CHANGELOG.md` if required.
3. **Bump Versions**: Update version references:
   - `package.json`
   - `client/package.json`
   - `server/package.json`
   - `client/src/constants/appVersion.js`
   - any release/version badges or image tags in `README.md`
4. **Keep Conventions Straight**:
   - `RELEASE_NOTES.md`, Git tags, and the UI use the public label format such as `v0.44.2c-beta`
   - package files use the semver-safe variant such as `0.44.2-c.beta`
5. **Commit**: Commit these changes with message `release: vX.Y.Z-beta`.
6. **Create GitHub Release & Tag**: Use GitHub CLI to create the GitHub Release object and tag simultaneously. This creates the release entry in the GitHub UI and automatically triggers the Docker build pipeline.

   ```bash
   # Syntax: gh release create <tag> --title "<title>" --notes-file <file> --target <branch>

   # Example:
   gh release create v0.44.2c-beta --title "v0.44.2c-beta" --notes-file RELEASE_NOTES.md --target main
   ```

   > **Note**: Ensure `RELEASE_NOTES.md` contains only the notes for the current release if you use it directly as the source file, or copy the current section into a temp file. Alternatively, use `--generate-notes`.

## Post-Release Verification

- Confirm deployment is live (version display and health endpoints).
- Run a short production smoke (auth/login, classification, routing, webhook ingest).
- Monitor logs and alerts for regressions (routing errors, webhook failures, AI errors).
- Check metrics for error rate spikes, queue backlogs, and slowdowns.
- Validate rollback path is ready if issues appear.
