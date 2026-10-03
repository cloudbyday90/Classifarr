# Release-evidence skill design

Date: 2026-10-03.

## Purpose

Provide a focused project skill for deciding whether CI and container evidence
actually supports a release-readiness claim. Runtime recovery design remains in
`classifarr-recovery-change`; this skill covers source/image identity, receipt
transfer, validation, failure propagation and the limits of the resulting claim.

## Decisions and tradeoffs

- Reuse repository ESM validators rather than embed executable checks in prompts.
  This avoids two implementations, but the skill must follow maintained script paths.
- Add a distinct skill instead of extending the recovery skill to every CI task.
  Discovery stays precise at the cost of one more small skill to maintain.
- Keep instructions short and permission-neutral. Assessment does not authorize
  rebuilding live containers, publishing, or rewriting historical receipts.

Expected triggers: "verify this release receipt", "wire routing evidence into CI",
and "does this image have sufficient release evidence?" Ordinary UI work and
diagnosing a provider outage should not trigger it.

[Official OpenAI skill guidance](https://learn.chatgpt.com/docs/build-skills), opened
2026-10-03, supports focused workflows, explicit inputs/outputs and behavioral
trigger checks. The skill-creator guidance shaped the small instruction-only design.

## Acceptance

Validate metadata and linked paths. Exercise the referenced gate with correct,
missing, stale and mismatched evidence; check that the CLI fails safely. Document
this as contract testing, not a measured agent-behavior benchmark.
