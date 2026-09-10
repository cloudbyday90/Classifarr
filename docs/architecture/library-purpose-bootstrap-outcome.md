# Library Purpose Bootstrap Outcome

Status: implemented and locally verified on 10 September 2026. No release is
created by this change.

## Delivered

- Added a compact **Set library purpose** path for profile-derived,
  identity-purpose rules.
- Made current contents explicit observed suggestions. An administrator keeps
  only terms that define the destination; displayed terms are not promoted to
  declared purpose merely by appearing in the interface.
- Added bounded term entry for the existing genres, keywords, and studios
  groups, with normalized local draft handling.
- Kept exclusions, strict constraints, compatibility semantics, media-type
  rules, and unsupported shapes in the existing advanced editor.
- Reused the existing server-side revision check, idempotency key, validation,
  transaction, receipt, and stale-revision handling. No new write endpoint or
  client authority was introduced.
- Added the current library name to the simple question so the operator sees
  “What belongs in this library?” rather than a generic policy configuration
  form.

## Result

This corrects the local evidence problem without pretending that AI, RAG,
library names, or current contents define policy intent. A collection such as
`Comedy and Standup` can now retain `Comedy` while removing an observed but
non-defining `Documentary` term before saving its first declared-purpose
revision.

The resulting declared purpose becomes a safer, non-circular baseline for
later bounded AI/RAG comparisons. Saving remains a policy revision only; it
does not reclassify or move existing media automatically.

## Verification

Focused frontend tests passed: 2 files and 11 tests.

The complete frontend suite passed: 358 files and 4,967 tests. Root type
checking, client lint, the production client build, documentation lint, and
the static ESM import check also passed. A manual security-diff review covered
the six changed executable files and found no candidate vulnerability: the
surface uses Vue interpolation, introduces no new request or persistence path,
and retains the server-owned authorization and revision boundaries.

`docker compose build --no-cache` completed, then the local stack was
force-recreated. The `classifarr` container reached Docker health status
`healthy`, and its production bundle contained the compact-purpose question.
The unauthenticated `/api/system/health` request returned the expected `401`,
confirming that the health route did not become public during the check.

## Pull request check

GitHub's official pull-request API returned no open pull requests for
`cloudbyday90/Classifarr` on 10 September 2026. No closed, merged, or invented
change was substituted for the requested local PR evaluation.

## Next item

After several libraries have reviewed declared purpose, the next high-value
component is a **purpose-health dashboard**: one concise, auto-refreshing
summary of declared-purpose coverage, competing destinations, and observed
outcome drift. It should surface only exceptions, offer progressive disclosure
for evidence, and feed bounded RAG/AI evaluation without becoming a second
policy editor or automatic routing engine.
