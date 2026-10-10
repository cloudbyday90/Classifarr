# Source mapping review guidance — outcome

## Diagnosis and implemented scope

Implemented on `main` on 2026-10-10, without a release or version bump. See the
[design, official research and tradeoffs](source-mapping-guidance-design.md).

At 22:10:25 UTC the local read-only database probe found eleven unresolved items:
nine source-review and two retry-wait, with ten current library captures. A bounded
read of their Plex metadata confirmed all eleven have descriptions and artwork.
Nine declare two TVDB IDs; two grouped shows declare multiple TMDb series IDs.
Metadata presence does not establish agreement between those identifiers.

The evidence review now displays the exact typed TMDb titles and dates already
read for the proposal. It does not introduce searches, rank candidates or select a
match. Missing, conflicting, reused and differently numbered episode IDs have
specific next-step guidance. Every season still needs verification before approval.

Approved recovery retains fixed diagnostic codes for changed source/configuration,
missing seasons, incomplete membership, provider-read failure and timeout. Status
reads make no provider calls. Legacy generic failures remain unknown, with GitHub
report guidance; interrupted checks are unconfirmed rather than completed.
Unknown provider messages and credentials are neither persisted nor displayed.

A discovered cached-source retry gap is fixed: a failed fresh-layout read now
retains its reason and one-day cooldown. Repeated admission within the same scan
also checks the database's current cooldown. Restarting or re-reading a status
does not reset attempts. No ownership, memory, timeout or completeness guard was
relaxed. No schema migration or automatic approval/backfill is added.

## PR trial

Fresh enumeration returned two open PRs, #555 and #556. Random selection chose
[PR #555](https://github.com/cloudbyday90/Classifarr/pull/555) again at immutable
head `4cbffcb7dd726af152382a1f92edb9dc326fe349`. Its exact manifest/lockfile changes
were applied locally: `@types/node` 24.19.2 → 26.6.4 and `undici-types` 7.24.6 → 8.9.0.
Registry metadata disclosed no lifecycle scripts for either candidate.

Script-disabled installation, normal policy-controlled installation, dependency
tree validation, client typecheck and audit completed. Audit reported zero findings.
Tooling tests passed 39/40: the deployed Node-major alignment test rejected Node 26
declarations on Node 24. The original manifests/lockfile were restored, installed
and checked again: 40/40 tooling tests and zero audit findings. No PR dependency
change is retained and neither PR was merged.

## Verification in progress

Focused backend checks passed four suites / 65 tests. Focused client checks passed
four files / 76 tests after correcting an empty-array parameterized test fixture.
Isolated PostgreSQL mapping tests passed 29 tests, including specific reasons,
legacy/interrupted state, repeated same-scan admission and restart-safe cooldown.
The Chromium mapping flow passed with intercepted fixture APIs, typed catalog
display, lost-response protection and narrow 390/320-pixel bounds.

The two changed ownership-manifest entries were individually reviewed: recovery
state remains inside `withCurrentCapture`; management changes only its read
projection, leaving revocation locking unchanged. Their analysis digests remain
unchanged. No blanket baseline refresh was performed.

Broader tests, final image identity and local evaluation will be recorded after
completion; these focused results are not a claim of remote CI or Unraid success.

## Recommendation stack

1. Keep complete typed mappings and explicit operator approval. This preserves
   grouping and auditability; individual review is still required.
2. Use the new per-item evidence and failure guidance before changing IDs. It adds
   no provider traffic to status views, but cannot make an ambiguous mapping valid.
3. Next: bounded catalog candidate discovery with visible provider provenance,
   followed by individual review of the eleven remaining items. Do not choose the
   first search hit, discard an extra ID or split a correctly grouped source show.

Unraid and shared Plex/Ollama were not modified. The local count is not a fresh
Unraid measurement. No real mapping was approved and the eleven conflicts have
not been claimed as resolved.
