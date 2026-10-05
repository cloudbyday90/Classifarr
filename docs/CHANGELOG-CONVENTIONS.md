# Changelog Conventions

This document defines how `CHANGELOG.md` entries are written, formatted, and archived. Follow these rules when adding entries during development or cutting a release.

Reference: [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/)

---

## Entry Format

Write one compact bullet per system and distinct outcome, usually one or two
sentences. Wrap long lines for readability; do not turn an entry into a list of
implementation steps.

```markdown
- **Short topic** — concise description of what changed and why.
```

**Rules:**

- Bold the system or component name, followed by an em-dash (`—`) and a plain-language description of the outcome.
- No multi-paragraph explanations. If more detail is needed, link to a relevant doc or commit.
- No issue numbers in the topic line. Use the description if a reference is needed (e.g., `...resolves rare race condition in advisory lock acquisition`).
- Update the existing system entry when related work lands. Do not add one bullet per commit, PR, extracted file, test or retry of the same fix.
- Describe the current combined behavior, not every intermediate design. Keep superseded development steps in the detailed archive or design documents.
- Retain meaningful component coverage: name affected providers, deployment targets or workflows when their differences matter. Do not compress unrelated systems into a vague “reliability improvements” entry.
- Keep operator actions, compatibility changes, data preservation, security boundaries and unfinished rollout gates explicit. Shorter wording must not imply that a prototype is enabled or a release is approved.
- Put exact dependency/PR chronology, test counts and design tradeoffs in linked engineering records; retain important runtime requirements and security advisories in the summary.

### System-Level Summary

Start a substantial Unreleased section with a short **TL;DR** paragraph, followed
by system-level entries under the standard categories. The paragraph is an
overview, not a replacement for coverage of all changed systems.

Keep a system in one entry where practical. Separate entries are appropriate
for distinct outcomes, such as a new recovery workflow and its security boundary;
do not repeat the same behavior under Added, Changed and Fixed. Omit repeated
“no PR merge or release” statements from individual entries.

### Categories

Use the six standard Keep a Changelog categories in this order:

| Category      | When to use                                              |
|---------------|----------------------------------------------------------|
| `### Added`   | New features, endpoints, modules, config options         |
| `### Changed` | Behavioral changes, refactors, dependency bumps, updates |
| `### Deprecated` | Features marked for removal in a future release       |
| `### Removed` | Features, endpoints, or modules deleted                  |
| `### Fixed`   | Bug fixes and regression fixes                          |
| `### Security`| Vulnerability patches, auth hardening                    |

Omit categories with no entries (do not leave empty headings). Each category
appears at most once per version. Put performance work under its system in
Changed or Fixed, and release-workflow changes under Changed or Security rather
than adding parallel category headings. Preserve historical archives as recorded.

### Examples

**Good:**

```markdown
### Added

- **Operational health** — Command Center shows library recovery progress and specific next steps, with read-only background refreshes.

### Changed

- **Media-server imports** — Plex, Jellyfin and Emby share bounded outage recovery; incomplete scans preserve inventory rather than pruning it.

### Fixed

- **Settings and preset mutations** — Lost responses recover through saved receipts instead of repeating writes, preserving drafts and rejecting stale results.

### Security

- **Recovery security boundary** — Compatibility safeguards reject unmodified legacy writers; stronger database privilege isolation remains separate work.
```

**Bad (do not do this):**

```markdown
### Added

- Added a new feature that allows users to configure the backfill schedule through the settings page. This has been a long-requested feature and implements a cron-like scheduling system with configurable intervals. The backend stores the schedule in a new `backfill_schedules` table with columns for interval, enabled status, and last run timestamp. The frontend exposes this through a new settings tab with time picker and day-of-week selector.

### Fixed

- fixed stuff
- Issue #46625
- Extracted another helper and added three tests.
- Updated the same dependency again; no PR merge or release.
```

Problems: implementation detail overwhelms the first entry; the others are vague,
use a bare issue number, or describe development steps rather than system outcomes.

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
| Unreleased     | `CHANGELOG.md` top                | Operators and engineers |
| Current release| `CHANGELOG.md` below Unreleased   | Everyone        |
| Older versions | `docs/changelog/CHANGELOG-YYYY-MM.md` or `CHANGELOG-YYYY-MM-label.md` | Everyone |

### Unreleased vs Release Commit

- **During development**: update the relevant system entry under `## [Unreleased]` as work is completed; add a new entry only for a distinct system or outcome.
- **At release**: rename `## [Unreleased]` to `## [VERSION] - YYYY-MM-DD` and add a fresh `## [Unreleased]` heading above it.

---

## Archival Strategy

### When to Archive

Keep the main `CHANGELOG.md` near **300 lines or fewer**. When released history
causes the excess, archive older versions to monthly files. When Unreleased is
the cause, consolidate it by system using the pre-release procedure below;
moving short released sections alone will not solve development-log growth.

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
6. Check that every changed system/component has a summary entry and that
   compatibility, operator actions, security limits and unfinished work survive
   consolidation. Do not promote an intermediate experiment to a shipped feature.
7. Compare the archived Unreleased block with the pre-edit record and confirm
   existing published-version blocks are unchanged. Validate links and Markdown.
8. Do not overwrite an existing archive; use a descriptive suffix for a later
   consolidation in the same month. Keep any earlier detailed archive reachable.

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
| **Scope**          | Every changed system and notable outcome; detailed chronology linked | Highlights only |
| **Written by**     | Engineer during development             | Engineer at release time           |

Never copy `CHANGELOG.md` entries verbatim into `RELEASE_NOTES.md`. Rewrite for the target audience.

---

## Checklist for Adding an Entry

1. Does it update an existing system entry where possible, under one correct category?
2. Is it a compact outcome summary rather than a per-commit development log?
3. Does it use the bold-topic + em-dash + description pattern?
4. Is it technically accurate, including operator actions, compatibility and safety limits?
5. Would a new team member understand what changed and why?
6. Are category headings unique within Unreleased, with detailed history linked rather than lost?
