# Grill-me change-planning workflow

Date: 2026-10-15. Scope: future Classifarr features, behavior changes, refactors,
and enhancements. No runtime or production permissions are added.

## Source and installation

The requested skill is from Matt **Pocock**'s
[skills repository](https://github.com/mattpocock/skills), not a similarly named
third-party adaptation. The inspected source revision is
`49dd158d1076134a641b33efb035946536778336`.

- [grill-me](https://github.com/mattpocock/skills/blob/49dd158d1076134a641b33efb035946536778336/skills/productivity/grill-me/SKILL.md)
  is the explicit entry point and delegates to `grilling`.
- [grilling](https://github.com/mattpocock/skills/blob/49dd158d1076134a641b33efb035946536778336/skills/productivity/grilling/SKILL.md)
  contains the interview process: dependency-ordered decision rounds, recommended
  answers, investigation of facts, and confirmation of shared understanding.

Both directories are installed under `.agents/skills/`, including their upstream
`agents/openai.yaml` files. Skill instructions and metadata are unmodified. Each
directory also includes the upstream MIT license. No executable upstream scripts,
extra skills, global configuration, dependencies, or automatic updater are installed.

## Decision and tradeoffs

| Option | Benefit | Cost |
| --- | --- | --- |
| Explicit invocation only | No change to default planning | Does not meet the request to use this going forward |
| Repository skills plus standing planning rule (selected) | Shared, versioned, reproducible workflow | Adds a design discussion before implementation |
| Global installation or the entire upstream collection | Available across projects | Changes unrelated workflows and installs unnecessary scope |

The final stack is the pinned upstream entry point and dependency, plus a narrow
Classifarr planning rule in the four root agent instruction files. Persistent
repository guidance is a supported use of
[AGENTS.md](https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex).
Existing instruction differences between those files are preserved.

## Behavior and boundaries

The user explicitly requested this as the default for future change planning.
The upstream entry point remains explicit-only; the standing repository rule
selects its `grilling` dependency rather than changing upstream invocation policy.
Agents without a Skill tool read both instruction files directly.

Gather repository facts before asking the user. Ask only unresolved decisions,
reuse previously settled choices, and scale the discussion to the actual change.
When no decisions remain, summarize scope, safeguards, and verification for
confirmation rather than inventing questions. The upstream workflow calls for
fact-finding delegation where available; otherwise gather those facts read-only.

This workflow does not replace recovery, release, dependency, security, or testing
requirements. Agreement on a design does not authorize deployments, data deletion,
shared-provider changes, or a release. A user can explicitly skip this planning
workflow for a particular task. The installation does not retroactively restart
the already-in-progress retention assessment work.

## Updates

Review future upstream changes before replacing these directories. Resolve and
record the exact revision, inspect both skills and their dependencies, preserve
the license, compare the installed files, and recheck the repository integration.
Do not silently follow the upstream main branch or install its whole collection.
