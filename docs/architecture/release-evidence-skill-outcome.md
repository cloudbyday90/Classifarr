# Release-evidence skill outcome

Date: 2026-10-03.

Implemented `.agents/skills/classifarr-release-evidence/SKILL.md` with discoverable
UI metadata. It separates evidence assessment from release/deployment authority,
routes to existing repository validators, and distinguishes local image identity
from published registry provenance. No model API, package dependency or daemon was added.

## Verification

- Skill metadata validator passed; linked repository scripts and reference exist.
- Markdown validation passed.
- The referenced gate tests reject missing, old-schema, wrong-source/image/run/attempt,
  stale, duplicate/incomplete, provider-write and failed-cleanup evidence.
- The actual verifier CLI exits 1 for missing evidence and unexpected arguments,
  with a fixed message rather than raw input or secrets.
- Trigger review: receipt verification and CI acceptance changes fit; UI changes
  and runtime outage diagnosis remain outside this skill's description.

This verifies metadata and deterministic contracts, not autonomous-agent success
rates. No independent agent benchmark was run. The skill-creator guidance kept
the skill focused; the recovery skill preserved isolation and cleanup requirements.

Next: use this skill when adding published-digest routing evidence, retaining the
distinction between local test results and the exact artifact users download.
