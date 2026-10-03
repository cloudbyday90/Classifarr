# Recovery-change skill outcome

## Delivered — 3 October 2026

The versioned [Classifarr recovery-change skill](../../.agents/skills/classifarr-recovery-change/SKILL.md)
is stored in the official repository discovery location, with `agents/openai.yaml`
UI metadata. Invoke `$classifarr-recovery-change` for retry, recovery, backfill or
scheduler work. Discovery depends on the host loading repository skills; a new
session may be needed. No global configuration or personal skill was overwritten.

The skill-creator metadata validator passed. Markdown lint passed for the skill.
The current provider-guard work exercises its design-before-change, isolated
database, real HTTP, failure-point testing, and separate outcome-document workflow.
It adds no executable script, network access, runtime process, or permissions.

## Scenario review

These are manual instruction reviews, not measured independent agent evaluations.

| Scenario | Expected behavior supported by the instructions |
| --- | --- |
| Repeated provider outage | Trace admission and side effects; design shared bounded recovery; test failure points |
| Unknown legacy ingestion owner | Do not infer stopped ownership from age or one container |
| Disabled optional AI jobs | Do not make them prerequisites for import-and-metadata recovery |
| Diagnosis only | Inspect and explain without implementing or deploying |
| Unrelated visual or dependency-only change | Do not select this skill implicitly |
| Requested commit on main, no release | Preserve branch, inspect diff, commit/push only as requested; no release |

## Tradeoff and follow-up

This is narrower and easier to maintain than adding a large checklist to every
prompt. Its limitation is that instructions are not enforcement: deterministic
tests, database fences and authorization remain responsible for safety.

Use it on the next independent recovery task, record any missed invariant, and
make a specific correction. Do not expand it into a general autonomous repair
agent or claim measured reliability from metadata validation alone.

See the [design and official sources](recovery-change-skill-design.md).

## Image rehearsal extension — 3 October 2026

The next recovery task added a conditional
[image rehearsal reference](../../.agents/skills/classifarr-recovery-change/references/image-rehearsal.md).
It distinguishes container replacement from restart, fixture deadlines from
elapsed cooldowns, and attempted writes from duplicate stored rows. It directs
agents to existing isolated runners without granting deployment permission.
Metadata and Markdown validation passed; the linked routing runner passed a
real-image upgrade and crash/restart exercise. See its
[outcome and limitations](manual-routing-rehearsal-outcome.md). No independent
agent evaluation or autonomous recovery guarantee is claimed.
