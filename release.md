# Release Checklist (Template)

## Release Metadata

- Version: v0.40.5d-alpha
- Date: 2026-01-30
- Owner: Moreland
- Scope/Highlights: Respect \*arr quality profile selection during routing.

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

## Prequisites

- [GitHub CLI (gh)](https://cli.github.com/) installed and authenticated (`gh auth login`).
- Docker build pipeline configured to trigger on Release creation.

## Release Steps

1. **Update Notes**: Update `RELEASE_NOTES.md` with new version entry.
2. **Update Changelog**: Update `CHANGELOG.md` if required.
3. **Bump Versions**: Update version references:
   - `server/package.json`
   - `client/package.json`
   - `client/src/components/layout/Sidebar.vue` (if hardcoded)
4. **Commit**: Commit these changes with message `release: vX.Y.Z-alpha`.
5. **Create GitHub Release & Tag**: Use GitHub CLI to create the **GitHub Release object** (package) and tag simultaneously. This creates the release entry in the GitHub UI and **automatically triggers** the Docker build pipeline.

   ```bash
   # Syntax: gh release create <tag> --title "<title>" --notes-file <file> --target <branch>

   # Example:
   gh release create v0.41.0-alpha --title "v0.41.0-alpha" --notes-file RELEASE_NOTES.md --target main
   ```

   > **Note**: Ensure `RELEASE_NOTES.md` contains ONLY the notes for the current release if using it as the source file, or copy the specific section to a temp file. Alternatively, use `--generate-notes` for auto-generated notes.

## Post-Release Verification

- Confirm deployment is live (version display and health endpoints).
- Run a short production smoke (auth/login, classification, routing, webhook ingest).
- Monitor logs and alerts for regressions (routing errors, webhook failures, AI errors).
- Check metrics for error rate spikes, queue backlogs, and slowdowns.
- Validate rollback path is ready if issues appear.
