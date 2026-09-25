# Durable cached-evaluation history: design

Status: Unreleased. Research checked September 25, 2026.

## Problem and decision

The preceding recurring-capture commit safely rotates movie/TV windows but replaces
the previous report. Summing those reports would count retries and repeated cached
responses as new evidence. Add a bounded, transactional history of selected cases,
then show distinct coverage for the latest retained comparable revision.

Use the existing PostgreSQL database, ESM services, fixed evaluation worker and
Vue stale-while-revalidate composable. Do not add a queue, inference provider,
analytics platform, routing permission or new model dependency.

## Evidence and recommendations

- [NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/playbook/measure/)
  recommends documenting evaluation methods, test sets and limitations. Report
  paired outcomes separately from reference-label coverage; unknown labels never
  become successes. The published framework is being revised; this design does
  not claim draft requirements are final.
- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) addresses
  provenance, quality and versioning. Apply those principles to private evaluation
  records: distinguish cohort, evidence/configuration and cached-model revisions.
  This does not require publishing private media or adopting RDF.
- [W3C WCAG 2.2 pause/stop/hide guidance](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide)
  supports a persistent pause control for auto-updating summaries. Keep native
  disclosure/buttons, visible focus and text status; pause is presentation-only.
- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  supports restricting diagnostic access, excluding sensitive data and bounding
  retention. The history stores categories, and browser errors deliberately omit
  transport bodies and credentials. It is not a security audit log.

These are design applications of the sources, not claims that any standard
prescribes this exact database layout or establishes Classifarr's accuracy.

## Storage and counting contract

Each accepted automatic replay may atomically append a versioned record alongside
the singleton report. At most 25 cases per window; movie/TV only. Store hashed,
revision-scoped item references and categorical outcomes, not titles, source IDs,
prompts, responses, destinations, model names or credentials. Hashes are private
pseudonymous references, not guaranteed anonymous data.

Evidence revision includes the retained cohort, library/policy/source/embedding
inputs, configuration and correction evidence, excluding window offset and cached
response contents. Cached model identity is a separate revision component. Changes
split comparison groups; no cross-revision accuracy or improvement claim is made.
Future changes to prompt preparation, grading or selection semantics must bump the
computation/history revision rather than silently combine old and new evaluators.

Identical result windows are content-deduplicated without extending their lifetime.
Keep a separate last-observed timestamp so an A→B→A outcome recurrence is ordered
correctly without resetting first-observed retention or adding duplicate coverage.
Keep at most 500 windows, no older than 30 days. Prune on worker state reads and
accepted saves; read APIs filter expired/future records even while workers are
disabled. Cleanup resumes when the application/database is available. Backups have
independent retention. Existing singleton reports cannot reconstruct per-case
history; history begins with the next recomputation, not an invented backfill.

For each revision, selected coverage is a union of item references. Paired coverage
uses the latest completed pair for each item; a later cache miss does not erase a
historical completion. Only valid proposed/abstained responses on both arms count
as paired. Labeled pairs require the existing provenance-screened correction label.
Gains/regressions and changed deferrals remain paired observations, not end-to-end
accuracy. Retention/caps can reduce coverage; it is not lifetime coverage.

## Read surface and security

Administrator-only, rate-limited, parameter-free GET returns aggregate counts and
up to six revision summaries. It performs no inference, backfill, cleanup or
routing writes. No private hashes leave the service. Use no-store responses and
instance-local SWR (`persist: false`), clear data on failed/forbidden refresh, pause
the displayed snapshot while allowing authorization/failure clearing. Put a compact
summary on Command Center with details collapsed and no repeated warning panels.

## Options and final recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Sum existing reports | Small change | Inflates coverage and mixes revisions | Reject |
| Retain raw prompts/responses indefinitely | Rich debugging | Privacy, size and retention risk | Reject |
| Bounded categorical history in PostgreSQL | Atomic, restart-safe, no new infrastructure | Finite history; conservative revision splitting | Implement |
| External evaluation platform | Rich dashboards | Integration, credentials and data export | Defer |

Recommended stack: existing production replay → bounded ESM history contract →
transactional PostgreSQL retention/deduplication → protected aggregate GET →
nonpersistent SWR → compact accessible Vue summary. No automatic promotion.

## Verification plan

Test repeated windows, overlapping movie/TV selections, cache misses, corrections,
model/evidence/cohort changes, malformed records, worker output validation,
superseded saves, rollback, restart, retention and bounds in PostgreSQL. Test route
authorization/no-store/query rejection, API wiring, SWR failure/pause behavior and
UI disclosure. Run coverage/quality gates and isolated synthetic container checks.

Next after this component: identify the largest **measured** missing-evidence reason
and address that bottleneck with a bounded recovery experiment, rather than raising
budgets or enabling routing based on unlabelled agreement.
