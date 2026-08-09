# Changelog Conventions

This document defines how `CHANGELOG.md` entries are written, formatted, and archived. Follow these rules when adding entries during development or cutting a release.

Reference: [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/)

---

## Entry Format

Each entry under a category heading is a single bullet, 1–2 lines max.

```markdown
- **Short topic** — concise description of what changed and why.
```

**Rules:**

- Bold the topic prefix, followed by an em-dash (`—`) and a plain-language description.
- No multi-paragraph explanations. If more detail is needed, link to a relevant doc or commit.
- No issue numbers in the topic line. Use the description if a reference is needed (e.g., `...resolves rare race condition in advisory lock acquisition`).
- Group related sub-items into a single bullet with a parenthetical summary when there are many (e.g., `ESM modular extractions (35+ sub-modules): ...`).

### Categories

Use the six standard Keep a Changelog categories in this order:

| Category      | When to use                                              |
|---------------|----------------------------------------------------------|
| `### Added`   | New features, endpoints, modules, config options         |
| `### Changed` | Behavioral changes, refactors, dependency bumps, updates |
| `### Deprecated` | Features marked for removal in a future release       |
| `### Removed` | Features, endpoints, or modules deleted                  |
| `### Fixed`   | Bug fixes, regression fixes, CVE remediations            |
| `### Security`| Vulnerability patches, auth hardening                    |

Omit categories with no entries (do not leave empty headings).

### Examples

**Good:**

```markdown
### Added

- **V8 module compile cache** — `module.enableCompileCache()` in `server/src/index.mjs` speeds up server startups.
- **Weak-overlap policy race escalation** — candidates surviving only on compatibility evidence now degrade to manual review.
- **ESM modular extractions** (14 sub-modules): `discordNotificationBuilder`, `healthCheckImageEmbeddings`, `policyEngineUtils`, ...

### Fixed

- **Fixed spurious `same_mode_without_primary_provider` integrity warning** — early-return guard when `primary_provider='none'`.
- **Fixed CVE-2026-46625** — override `js-cookie` to >=3.0.7.
```

**Bad (do not do this):**

```markdown
### Added

- Added a new feature that allows users to configure the backfill schedule through the settings page. This has been a long-requested feature and implements a cron-like scheduling system with configurable intervals. The backend stores the schedule in a new `backfill_schedules` table with columns for interval, enabled status, and last run timestamp. The frontend exposes this through a new settings tab with time picker and day-of-week selector.

### Fixed

- fixed stuff
- Issue #46625
```

Problems: first entry is a multi-paragraph deep dive, second is too vague, third uses a bare issue number.

---

## Version Headings

```markdown
## [Unreleased]

## [0.46.5a-beta] - 2026-05-24
```

- `## [Unreleased]` is always present at the top.
- Released versions use `## [VERSION] - YYYY-MM-DD` (ISO date).
- Versions are listed in reverse chronological order.

---

## Where Entries Live

| Scope          | Location                          | Audience        |
|----------------|-----------------------------------|-----------------|
| Unreleased     | `CHANGELOG.md` top                | Engineers       |
| Current release| `CHANGELOG.md` below Unreleased   | Everyone        |
| Older versions | `docs/changelog/CHANGELOG-YYYY-MM.md` or `CHANGELOG-YYYY-MM-label.md` | Everyone |

### Unreleased vs Release Commit

- **During development**: add entries under `## [Unreleased]` as work is completed.
- **At release**: rename `## [Unreleased]` to `## [VERSION] - YYYY-MM-DD` and add a fresh `## [Unreleased]` heading above it.

---

## Archival Strategy

### When to Archive

When the main `CHANGELOG.md` exceeds **~300 lines**, archive older versions to monthly files.

### How to Archive

1. Identify the oldest released version block in `CHANGELOG.md`.
2. Move it and all older blocks to a new file: `docs/changelog/CHANGELOG-YYYY-MM.md` (use the month of the oldest entry).
3. If a month already has an archive, append to it or create a descriptive suffix (e.g., `CHANGELOG-2026-05-early.md`).
4. Add a cross-link line at the top of `CHANGELOG.md`:

```markdown
Archived changelogs: [May 2026 Early](docs/changelog/CHANGELOG-2026-05-early.md) | [April 2026](docs/changelog/CHANGELOG-2026-04.md) | ...
```

5. Order archive links newest-first (left to right).

### Large Pre-Release Consolidation

When an unusually long development cycle makes the Unreleased section too
large for release review, keep a concise release-facing summary in
`CHANGELOG.md` and move the detailed pre-release record to
`docs/changelog/CHANGELOG-YYYY-MM-pre-release.md`.

1. Preserve the detailed Unreleased record verbatim in the pre-release archive.
2. Add a short archive header that states the consolidation date and purpose.
3. Link the archive from the root archive list and directly below
   `## [Unreleased]`.
4. Keep the root summary self-contained, non-duplicative, and within the
   standard category order.
5. Do not use a pre-release archive to replace released-version archives.

### Archive File Format

Each archive file is self-contained:

```markdown
# Changelog Archive: YYYY Month

> These entries were moved from `CHANGELOG.md` on DATE.

## [VERSION] - YYYY-MM-DD

### Added
- ...

### Fixed
- ...
```

---

## Separation from RELEASE_NOTES.md

|                    | `CHANGELOG.md`                          | `RELEASE_NOTES.md`                |
|--------------------|-----------------------------------------|------------------------------------|
| **Audience**       | Engineers, operators                    | General public, end users          |
| **Tone**           | Technical, precise                      | Plain language, benefit-focused    |
| **Format**         | Keep a Changelog bullets                | Emoji headers, visual blocks       |
| **Scope**          | Every notable change                    | Highlights only                    |
| **Written by**     | Engineer during development             | Engineer at release time           |

Never copy `CHANGELOG.md` entries verbatim into `RELEASE_NOTES.md`. Rewrite for the target audience.

---

## Checklist for Adding an Entry

1. Is the entry under the correct category?
2. Is it 1–2 lines max (no multi-paragraph deep dives)?
3. Does it use the bold-topic + em-dash + description pattern?
4. Is it technically accurate and specific?
5. Would a new team member understand what changed and why?
