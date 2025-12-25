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

## 2. Update Version Numbers (ALL locations)

| File | Field | Example |
|------|-------|---------|
| `client/package.json` | `"version"` | `"0.23.0"` |
| `server/package.json` | `"version"` | `"0.23.0"` |
| `client/src/components/layout/Sidebar.vue` | Line ~49, hardcoded version | `<div>v0.23.0-alpha</div>` |

## 3. Update RELEASE_NOTES.md

Add new section at the TOP of the file with format:
```markdown
## v0.XX.0-alpha
**Title: Brief Description**

> [!IMPORTANT]  (if breaking changes or required actions)
> Required action message here

### Breaking Changes (if any)
- Description

### New Features
- Feature 1
- Feature 2

### Improvements
- Improvement 1

### Fixes
- Fix 1

---
```

## 4. Commit Changes

// turbo
```bash
git add -A
git commit -m "vX.X.X-alpha: Title

Brief description of changes

New Features:
- Feature 1
- Feature 2

Fixes:
- Fix 1"
```

## 5. Create Annotated Tag

// turbo
```bash
git tag -a vX.X.X-alpha -m "vX.X.X-alpha: Title - ADDITIONAL NOTES"
```

## 6. Push to Remote

// turbo
```bash
git push origin main --tags
```

## 7. Create GitHub Release

Create an actual release on GitHub (tags alone don't appear as releases):

1. Go to: https://github.com/cloudbyday90/Classifarr/releases/new
2. Select the tag you just created (e.g., `v0.30.0-alpha`)
3. Set release title: `vX.X.X-alpha: Title`
4. Copy the release notes from `RELEASE_NOTES.md` into the description
5. Check "Set as pre-release" for alpha versions
6. Click "Publish release"

**Or use GitHub CLI:**
```bash
gh release create vX.X.X-alpha --title "vX.X.X-alpha: Title" --notes-file RELEASE_NOTES.md --prerelease
```

## 8. Rebuild Docker (if local testing)

```bash
docker compose down; docker compose up -d --build
```

## 9. Verify

1. Check GitHub releases page shows new release as "Latest"
2. Verify version shows correctly in UI (bottom-left sidebar)
3. Test any breaking changes documented

---

## Files Changed in a Release

Minimum files to modify for ANY release:
1. `client/package.json` - version
2. `server/package.json` - version
3. `client/src/components/layout/Sidebar.vue` - UI version display
4. `RELEASE_NOTES.md` - changelog entry

## Important Notes

- **Never skip the Sidebar.vue update** - This is the version users see in the UI
- **Alpha releases use format**: `v0.XX.0-alpha`
- **Stable releases use format**: `vX.X.X`
- **Always check git status before committing** to ensure all intended files are staged
