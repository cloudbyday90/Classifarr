# v0.49.4-beta changelog consolidation review

Date: 2026-11-02. Review base: 46ba1290dfb644293b657f77021c7716b3a89dc1.
Previous published release: v0.49.3-beta at
2fcf07bdc35e93bbe2f480b3268b15466f16e012, verified from live release state.
This documentation review does not close release gates or publish a version.

## Historical fidelity and navigation

Preserve the entire original Unreleased section verbatim in the new
[November development archive](../changelog/CHANGELOG-2026-11-pre-release-0.49.4.md).
Preserve complete v0.49.1-beta/v0.49.2-beta blocks verbatim in the new
[published-history archive](../changelog/CHANGELOG-2026-10-releases-0.49.1-through-0.49.2.md).
Keep the complete published v0.49.3-beta block unchanged in the root changelog.
Neither archive existed before this review; no earlier archive was overwritten.

The canonical pre-edit record was read from Git, not reconstructed from notes.
Exact entry-text comparisons pass for both archives and the retained published
block. Only trailing blank section separators are normalized to one final newline
where a section becomes a file ending; no entry text changes. The original
extracted development-record SHA-256 is:
26efddfb957475ec5a3519268e3cb42341b2265379c5db2d07396864ad430103.
Older published-block SHA-256:
36405ea474f0df3f1a8cd240cb25f7791f891da2412978ca06a932dad0b87909.
Private before/after receipts remain under .tmp.

Following the existing archive convention, historical relative links retain their
original repository-root interpretation. New archive headers provide working
relative navigation for those references. Root links, new header links and
historical root-interpreted destinations are checked separately. All previous
archives remain reachable. The root now has 216 lines before version alignment.

## System coverage against the release range

The range changes 469 files. Review used the complete Unreleased record and the
actual changed-component inventory; implementation chronology was consolidated
into current outcomes rather than used as release-note structure.

| Changed system | Coverage retained in root summary |
| --- | --- |
| Policy purpose authority and cards | Shared declaration proof; inferred/mixed/unknown provenance; legacy statistics isolated |
| Explicit History assessment | Original automated reference, administrator scope, atomic receipt and replay recovery |
| Prospective choices/rankings/policy context | Typed binding, immutable complete captures, separate cohorts and historical gaps |
| Automatic evaluation/audit | Provider-free background work, saved bounded aggregates and existing compact UI |
| Private diagnostics | Optional developer CLI only, closed output and validation/display limits |
| Migration/restore/retention | Eight migrations, backups/keys, older-writer exclusion, expiry/tombstones and export exclusions |
| Refresh and readiness failures | Proven database origin, one-hour process-local holds, three-second reads and truthful cancellation |
| Capture lifecycle and durability | Claims, reservations/checkpoints/rotation/finalization, cooldowns, uncertain commits and maintenance serialization |
| Publication investigation | Healthy admission regressions; no speculative runtime progression-lock change |
| Logging | Bounded safe projection plus fixed/rate-limited persistence fallback; separate native-stack policy |
| Runtime dependencies | Axios and dotenv final combined versions; auth/CSRF/cancellation/no-replay boundaries |
| Tooling and compiler | Final Vite/PostCSS/ESLint graph, retained vue-tsc baseline and ownership-review invariants |
| CI publication | Full-SHA Docker Login/CodeQL pins and preserved permissions/promotion gates |
| Security patches | Runtime parsers, redirect credential filtering, request counting and RE2JS |
| Open security/release gates | Separate npm bundle blocker and development-tool findings; no advisory-free claim |
| Local maintenance | Agent-operated cleanup with recovery/current evidence and other projects protected |

Added, Changed, Fixed and Security each appear once, in standard order. The
TL;DR is an overview and does not replace component coverage. Superseded PR
versions and implementation details remain in the exact development archive.
No historical placement becomes ground truth, no broad accuracy improvement is
claimed, and no experiment is promoted into a deployed routing guarantee.

## Operator actions and unresolved boundaries

Retain database/appdata/encryption-key backup requirements. Normal startup applies
the eight new migrations; an old image is not a schema downgrade plan. Stop
older writers before sharing upgraded state. Preserve evidence leases, deletion
and restore semantics; no historical backfill or automatic production cleanup
is introduced. No ordinary Compose/Unraid template change is required.

The npm 12.2.1 bundled parser remains unresolved. The prior exception was for
v0.49.3-beta only; this review does not extend it. A proposed deferral needs a new
explicit maintainer decision after fresh risk and image evidence, not a silent
wording change. Other release, audit, provenance and publication gates remain.

Manual category/system/history review is complete. Markdown, local navigation,
product-language and whitespace checks must pass before the documentation commit.
Fresh source/image/frozen/publication checks belong to the separate release
outcome; earlier development receipts do not qualify this candidate.
