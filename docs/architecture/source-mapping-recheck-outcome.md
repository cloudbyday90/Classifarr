# Saved mapping recheck outcome

## Implemented — 2026-10-11

The [design](source-mapping-recheck-design.md) is implemented as a small ESM
status module and additive v1 API fields. Saved mappings now show last successful
application and distinguish waiting for current verification from an active
owned library scan that has captured the item. First verification, current
completion, recorded failure and revocation remain separate. Existing clients
can ignore the new fields; new clients accept older responses.

No identity approval, source/provider write, recovery attempt, schema migration,
ownership change or retry reset was added. Counts still depend on actual owned
completion. The read-only local probe at 10:32:02 UTC found seven applied mappings
and four unresolved items across ten covered active libraries, with zero writes
or provider calls. That is local evidence, not a fresh Unraid diagnosis.

The [reconciliation proposal](source-identity-reconciliation-design.md) explains
the existing automatic recovery gate and why these approvals were required.
Extending automatic recovery to provable aliases is the next item; it is not
silently enabled here. Incomplete episode/group evidence still requires repair.

## Verification

- Focused status unit tests: 11 passed; client parser/component tests: 21 passed.
- Isolated PostgreSQL mapping tests: 30 passed. The new test reproduces successful
  apply followed by recapture, missing ledger linkage, active ownership, stale
  generation, wrong capture source/digest, disabled library/server, interrupted
  checks, owner release and successful reapplication. Status reads do not call
  providers or clear the unresolved observation. Initial fixture callback and
  cleanup errors were corrected before the successful run.
  A subsequent negative test reproduced a maintenance lock falsely looking like
  a sync against stale markers. The final predicate also requires an ingestion
  slot on the same session. A slot held by a different session cannot satisfy it.
- Chromium mapping flow: passed, including keyboard refresh, announced status,
  last-success timestamp, unchanged unresolved count, revocation and 320/390 px
  reflow. The mobile capture was visually inspected. Unrelated evaluation/retry
  endpoints use incomplete synthetic responses and log fixture-only unavailable
  messages; this is not live provider testing.
- Both workspace typechecks, lint, both Knip modes, 40 tooling tests, ESM checks,
  copyright and four policy gates passed. Markdown checked 2,097 files with no
  errors before this outcome document was added.
- The ownership gate detected the changed list/revoke file. Review confirmed
  identical DML analysis and unchanged revocation fencing; only that file's
  source digest and review explanation were updated. The gate and its 39 focused
  tests then passed. No unrelated review classification was refreshed.
- Full coverage, final image evaluation and post-build schema evidence are
  pending at this source commit and must be recorded before final handoff.

## Random open PR trial

Fresh enumeration returned two open PRs (#555 and #556). The random draw selected
#556 at `a62b4d210fda8579fa961a5da3d6a7b6e3d7b888`. Its exact Node-types 26.6.4 /
undici-types 8.9.0 change was applied locally. Script-disabled and normal-policy
clean installs succeeded; the full dependency tree was valid and npm audit
reported zero vulnerabilities, including development dependencies.

The server typecheck failed at `discordDeliveryWriter.mjs:20`: Discord's Undici
FormData/File declarations do not match the Node-26 declarations. Tooling passed
39/40, rejecting the Node-major mismatch. The trial was restored exactly and a
normal clean install, typechecks and all 40 tooling tests passed on Node 24.
The PR was not merged; no dependency diff remains. Audit results describe this
2026-10-11 trial, not a permanent security guarantee.

## Local replacement safeguards

Before replacing the local container, retained a checksum-verified, readable
57,668,043-byte database archive and an exact rollback image tag. The baseline
local image is `sha256:e2fddaf0190a92eb3e956abd69b0c738837c797cc19c996ac5bbc5a88084e1d5`.
Archive paths stay in ignored diagnostics. Do not modify Unraid, shared Plex or
Ollama, unrelated containers, or data volumes. No release/version bump.
