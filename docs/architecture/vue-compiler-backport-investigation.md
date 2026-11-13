# Vue compiler backport investigation

November 13, 2026. Research completed against main
`2a626e5b0bf6d9311a52b7425955b33097ab4271`; candidate implementation remains
pending. This extends the earlier
[graph investigation](vue-compiler-graph-investigation.md) with an actionable
path requested by the user.

## Newly established upstream facts

GitHub and web MCP retrieval at 21:29 UTC found that latest stable remains
3.3.14. Language-core also publishes a separate 4.0.0 alpha; this investigation
does not propose a major migration.
[Latest stable release](https://github.com/vuejs/language-tools/releases/tag/v3.3.14),
[language-core registry](https://registry.npmjs.org/%40vue%2Flanguage-core/3.3.14).

The slot fix was merged on November 12 in
[PR 6329](https://github.com/vuejs/language-tools/pull/6329), exact commit
[`31e5f342f9b505056e807b97c478c366df9d2eee`](https://github.com/vuejs/language-tools/commit/31e5f342f9b505056e807b97c478c366df9d2eee).
It removes the temporary arrow wrapper's closing parenthesis and body separately,
avoiding the source-range operation that spans split generated segments. Path
history exposed this fixing commit even though the retrieved issue timeline did
not link it.

The URL fix exists in still-open
[PR 6241](https://github.com/vuejs/language-tools/pull/6241), exact head
`4d3309d61b1c8b62f9a44d2261862f82e4383cbc`. Its replacement matches quoted
strings and block comments before line comments. Upstream
[PR 6230](https://github.com/vuejs/language-tools/pull/6230) explains the original
flattening requirement: the inference-only props must stay under one line's
diagnostic suppression. Removing flattening changes that behavior.

## Feasibility evidence and limits

An in-memory probe using installed TypeScript 6.0.3 found that the proposed PR
6241 regex preserves ordinary URL strings, simple templates and real comments,
but corrupts a valid nested template and the regex literal `/[//]/`, producing
TS1161. These are flattened-props parser probes, not full compiler executions or
proof of a shipped application failure.

A separate in-memory prototype parsed the props in an expression wrapper,
visited token children, collected actual leading/trailing line-comment ranges,
deduplicated offsets and replaced them backwards before existing newline
flattening. It preserved syntax for nested templates, regex literals, comments
inside interpolations, block comments and multiple real line comments. This is
feasibility evidence only. Real-CLI inference, exact negative diagnostics,
source mappings, performance and all normal gates remain unverified.

## Delivery finding

Our pinned npm 12.2.2 already implements native `npm patch`. Its official docs
describe project-root `patchedDependencies`, checked-in unified diffs, lockfile
patch hashes, automatic install application even with scripts disabled, and
fatal missing/hash/apply/unused failures. Local `npm patch --help` and the exact
installed npm source confirm the command exists. Its shrinkwrap implementation
upgrades patched public locks to format 4 so older clients refuse installation;
the hidden installed lock stays an internal format-3 cache.
[Official command](https://docs.npmjs.com/cli/v12/commands/npm-patch/),
[exact command source](https://github.com/npm/cli/blob/v12.2.2/lib/commands/patch.js).

This removes the need for the initially suggested custom install patcher. The
client is an independent npm project, so its own manifest/lock and the frontend
Docker copy boundary need the patch files. Dependency-script permissions remain
unchanged. A clean install must prove the actual automatic patch behavior;
reading the command documentation is insufficient verification.

## Outcome and next decision

There is a concrete bounded route: retain the coherent 3.3.14 graph, backport the
merged slot fix, assess correct comment conversion and deliver through native
npm patches. It carries temporary compiler maintenance and responsibility for
unmerged/local changes. The proposed
[adoption design](vue-compiler-backport-adoption-design.md) defines conditional
acceptance and retirement. At the end of this research, no current-task
dependency install, source patch, candidate real-CLI execution, package adoption,
PR merge or deployment had occurred. Subsequent implementation and verification
are recorded separately in the [outcome](vue-compiler-backport-adoption-outcome.md).
