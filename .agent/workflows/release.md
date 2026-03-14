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
| `client/package.json` | `"version"` (semver-safe) | `"0.23.0-alpha"` |
| `server/package.json` | `"version"` (semver-safe) | `"0.23.0-alpha"` |
| `client/src/constants/appVersion.js` | `APP_DISPLAY_VERSION` (public label, only if needed) | `"v0.23.0a-beta"` |
| `CHANGELOG.md` / `RELEASE_NOTES.md` | release heading (public label) | `"v0.23.0a-beta"` |

## 3. Update RELEASE_NOTES.md

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
# Check for dependency vulnerabilities
npm --prefix server audit
npm --prefix client audit

# Run server tests
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

Then manually add headers to any files the auto-updater missed.

If coverage ratchet fails:
```bash
# Preferred: add/adjust tests until ratchet passes
npm run coverage:ratchet:check

# Only when reduction is intentional and approved:
npm run coverage:ratchet:update
git add coverage-baseline.json
git commit -m "chore(ci): update coverage ratchet baseline for intentional change"
```

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

## 8. Verify GitHub Actions Pass Before Release

Do not create a GitHub release until the pushed commit and tag workflow are green.

```bash
# After push, inspect recent CI/CD runs
gh run list --workflow "CI/CD Pipeline" --limit 10

# Watch the specific run for your tag and fail fast if it fails
gh run watch <run-id> --exit-status
```

If a tag run fails:
```bash
# 1) Fix code on main and push
# 2) Delete broken release/tag
gh release delete vX.X.Xa-beta --yes
git tag -d vX.X.Xa-beta
git push origin :refs/tags/vX.X.Xa-beta

# 3) Recreate tag from the fixed commit and push
git tag -a vX.X.Xa-beta -m "vX.X.Xa-beta: re-release after CI fix"
git push origin vX.X.Xa-beta
```

## 9. Create GitHub Release

Create an actual release on GitHub (tags alone don't appear as releases).

**Using GitHub CLI (preferred):**

// turbo
```bash
gh release create vX.X.Xa-beta --title "vX.X.Xa-beta: Title" --notes-file RELEASE_NOTES.md --latest
```

> **Note:** Prefer curated notes from `RELEASE_NOTES.md`. Do not rely on `--generate-notes` for public releases.

**Or manually via web UI:**

1. Go to: https://github.com/cloudbyday90/Classifarr/releases/new
2. Select the tag you just created
3. Set release title: `vX.X.Xa-beta: Title`
4. Copy the release notes from `RELEASE_NOTES.md` into the description
5. Ensure "Set as the latest release" is checked
6. Click "Publish release"

> **Important:** Do NOT check "pre-release" for alpha versions - the `-alpha` suffix is sufficient. Pre-release prevents "Latest" badge.

## 10. Rebuild Docker (if local testing)

```bash
docker compose down; docker compose up -d --build
```

## 11. Verify

1. Check GitHub releases page shows new release as "Latest"
2. Verify version shows correctly in UI (bottom-left sidebar)
3. Test any breaking changes documented
4. Confirm latest `CI/CD Pipeline` and `OSV Dependency Scan` runs for the tag are `success`

---

## Files Changed in a Release

Minimum files to modify for ANY release:
1. `client/package.json` - version
2. `server/package.json` - version
3. `client/src/constants/appVersion.js` - UI/public display version label
4. `RELEASE_NOTES.md` - release notes entry
5. `CHANGELOG.md` - changelog entry (keep-a-changelog format)

## Important Notes

- **Never skip the display-version update** - This is the version users see in the UI
- **Alpha releases use format**: `v0.XX.0-alpha`
- **Stable releases use format**: `vX.X.X`
- **Keep package.json versions semver-safe** even when the public-facing tag/label uses a custom variant like `v0.44.1a.beta`
- **Always check git status before committing** to ensure all intended files are staged
- **Release notes style**: use emojis, quick visual block(s), and plain-language outcomes
- **Separation of concerns**: `RELEASE_NOTES.md` = public highlights, `CHANGELOG.md` = technical detail
- **Title guidance**: release-note titles should be benefit-focused (avoid issue-centric titles like `Issue #275`)
- **Pre-commit checks are mandatory** - always run tests and copyright check before committing a release
- **Coverage ratchet is a hard gate** - do not tag/release while `npm run coverage:ratchet:check` is failing
- **Release is blocked on green CI for the tag** - never publish release notes before tag workflow success
