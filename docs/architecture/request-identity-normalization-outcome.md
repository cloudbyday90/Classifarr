# Request identity normalization outcome

Date: 13 October 2026. No release or production deployment.

## Delivered behavior

A shared ESM parser gives classification, webhook intake and failed-task checks
the same interpretation of supported flat, camel-case, nested and legacy IDs.
Equivalent values normalize; malformed or contradictory declarations do not
silently select the first value or fall back to a title search. Source webhook
declarations are checked against saved normalized columns before replacement
evidence is considered. The implementation is library-agnostic.

Saved requests are not rewritten. Approved repair remains flat-only. Automatic
same-ID recovery excludes alternate identity containers and recognizes newer
requests using aliases as competing work. Existing recovery history/budgets remain
unchanged; legacy records display their paused status without provider I/O.

Metadata failures now carry their actual typed lookup, safe provider observation
and shared failure reference through classification, queue processing and queue
acknowledgement. Classification logs preserve the safe wrapper's boundary stack,
not the credential-bearing upstream exception or a fabricated logger stack.
Acknowledgement reports its database-confirmed attempts and retry outcome;
earlier failure observations do not claim a retry was admitted.

## Verification

- Focused identity, classification, queue and real HTTP checks passed. The broader
  webhook/Sonarr compatibility run passed 208 tests in 13 suites after preserving
  unnamed episode entries and distinguishing unsupported from conflicting types.
- Isolated PostgreSQL checks passed: 100 tests in five suites, covering source/task
  changes, nested diagnostics, conservative repair/recovery admission, preserved
  rows/budgets, stale claims and sanitized persisted error context.
- Final full frontend run passed: 471 suites, 7,286 tests, including legacy-pause
  presentation. Coverage: statements 87.69%, branches 81.64%, functions 87.37%,
  lines 89.39%.
- Final backend coverage run passed all 1,830 suites: 57,840 tests passed, one
  existing Linux-only directory-fsync test skipped on Windows. Coverage:
  statements/lines 89.72%, branches 86.31%, functions 91.08%. Earlier ownership
  review and webhook/type fixture failures were corrected. Final review also
  reproduced five PostgreSQL failures from inconsistent outer-whitespace
  trimming; the corrected SQL passes the full suite, the 100 database checks
  above and the final packaged-image rehearsal.
- Final type checking, ESLint, dependency/unused-code preflight, copyright,
  migration naming and schema integrity passed. Markdown validation passed for
  2,188 files; ESM static-import and mock-shape checks passed.
- The coverage ratchet passed with fresh backend JSON and frontend HTML reports;
  no coverage baseline was changed. An initial run omitted the required frontend
  HTML artifact, so the complete frontend suite was rerun with that reporter.

The ownership review covers exactly two queue files. No claim predicate, retry
increment or protected-inventory write was relaxed. Existing post-completion
inventory ownership debt is explicitly retained as unresolved, not waived.

## Packaged and local evaluation

The no-cache Compose build used clean source
`ca77320e96dfedfb4a64ed418140b91028d0a877` (no version bump):

- Local image: `sha256:8694a5d16a179fab039a20c1396bcb32a9b364cc3d8730904d5c5c8cf401b190`.
- Platform manifest: `sha256:dea0a01f7282b7ca3f79e42d290a57b6d6bfd00bf5b61d32cf4319b5dcd5dda7`.
- Config: `sha256:0641233ddc3462bff5eef1695a33a84e0f34d724cfe05034801d6ecefcd6dc20`.

An isolated fresh container, with no network or published ports and bounded
CPU/memory/PIDs, ran the packaged services. Nested diagnostics passed without
changing the saved row, nested repair stayed blocked before provider access,
conflicting aliases were rejected and sanitized failure context was verified.
The packaged repair gate also rejected a competing request padded with Unicode
whitespace, including uppercase `MOVIE`.
The existing flat repair rehearsal made eight synthetic provider reads; it did
not retry the task or reset its attempt count. After a same-image restart,
duplicate confirmation required no provider access and its receipt survived
synthetic task retention. Schema matched; disposable resources were removed.
This is a fresh-schema/same-image restart test, **not** a published-image upgrade.

Before local replacement, a new custom-format database backup was created and its
table of contents read successfully: `request-identity-before-20261013-2204.dump`,
76,264,960 bytes, SHA-256
`2227e1e60b6f69a3b8fd1e8d53036d098d914843dca63780f71d08a7204a34a9`.
The previous local image remains tagged for rollback. A backup restore was not
part of this exercise.

The rebuilt local container became healthy with a connected database and HTTP
200 UI response. Read-only checks found 1,977 completed tasks, no failed tasks and
no new error-log entries since the final container's 22:24:24 UTC startup (checked
using the database's America/New_York timezone). Usage sampled at 834.1 MiB during
startup and later 625.8 MiB of 2 GiB. Non-root UID/GID 1000, read-only root and
no-new-privileges
remain enabled; no OOM or restart was observed. These short startup observations
are not a memory-leak or complete classification-workload test. No real failed
local task was available, so failure/repair behavior used synthetic fixtures.

## PR availability and limitations

GitHub MCP returned no open repository PRs on 13 October 2026; none could be
randomly selected. No closed PR was substituted, and no PR was merged.

This does not fix a missing provider record, approve an identity replacement,
expand approved-repair backfill, reconstruct old log context, or deploy to Unraid.
Plex, shared Ollama, memory safeguards and ownership protections are unchanged.

## Recommendation stack

Keep strict shared normalization, unchanged source provenance, sanitized correlated
reports and conservative write gates. These improve consistency without a bulk
rewrite; the tradeoff is that ambiguous legacy requests stay held for review.
The [design and official research](request-identity-normalization-design.md) compare
alternatives and document the bounds.

Next: design alias-preserving approved repair. Require every recognized ID path to
be updated atomically under the existing preview/confirmation fences, prove that
all consumers see the same approved identity, then assess bounded backfill. Do
not widen automatic admission merely because diagnostics can now read a format.

Follow-on implementation: [alias-consistent reviewed repairs](queue-identity-alias-repair-outcome.md)
now covers that manual write boundary; automatic backfill remains deferred.
