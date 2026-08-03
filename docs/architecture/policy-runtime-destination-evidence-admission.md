# Policy Runtime Destination Evidence Admission

## Status

Phase 5R.6.3 is complete. A runtime resolution can now automatically add one
compatibility or identity evidence record, but only after a server-derived,
receipt-backed admission succeeds. A normal answer remains outcome-only when
the admission proof is incomplete, stale, ambiguous, or unsupported.

## Problem

The runtime answer identifies where one item was resolved. It must not accept a
client-selected learning tier, label, genre, profile value, AI explanation, or
RAG result as durable destination evidence. Those values can be stale, broad,
or altered in transit, and a library profile describes observation rather than
policy intent.

The product should learn without asking operators to configure evidence boxes,
but that automation must be constrained to facts Classifarr can prove inside
the resolution transaction.

## Official Research Basis

The design uses official guidance reviewed August 3, 2026:

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends server-side validation, canonicalization, and allowlists. The
  candidate is an intersection of persisted native rules and structured item
  metadata; no browser label or generic text is admitted.
- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  recommends an authorization check at the final execution point, based on
  server-generated transaction data and a unique operation reference. The
  existing executor relocks state, revalidates actor authority, and claims a
  durable source-event receipt before it writes evidence.
- [GitHub Dependabot Security Updates](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependabot-security-updates)
  and [npm audit](https://docs.npmjs.com/cli/v11/commands/npm-audit/)
  support updating vulnerable direct and transitive dependencies from the
  lockfile-backed dependency graph. The implementation update also resolves
  the active Undici Dependabot alert and current audit findings.

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| Client-selected evidence controls after each answer | Flexible and visible | Reintroduces manual configuration, trusts stale client state, and makes learning optional instead of automatic. |
| Automatically persist every profile or metadata overlap | Minimal interaction | Treats observed profile values, broad genres, and weak overlaps as destination intent. |
| Server-derived native-rule intersection with bounded provenance and receipt-backed execution | Automatic, deterministic, atomic, replay-safe, and resistant to client or model text substitution | Strict admission produces a no-op when evidence is missing or ambiguous. |

## Decision

Use the third option.

The runtime resolution transaction evaluates eligible native runtime answers
after its final outcome is recorded. It performs no provider lookup, quota
read, RAG lookup, AI-text read, route attempt, or extra browser request.

Only one unambiguous candidate is eligible:

- A current active native intent has exactly one matching affirmative identity
  or compatibility rule.
- Structured item metadata independently contains that same studio, keyword,
  certification, or non-broad genre value.
- Broad genres, missing metadata, multiple matches, unsupported signal types,
  profile-only evidence, RAG-only support, and unsafe AI wording produce a
  no-op.
- The destination profile is current and passes the bounded evidence-quality
  path. It corroborates freshness and quality only; it does not create the
  candidate or establish identity.

When the proof passes, the command builds a canonical
`operator_confirmation` intake from locked server state. Its source-event ID
contains the classification ID, stored runtime-answer fingerprint, and a hash
of the allowed learning tier and candidate key. The client cannot provide or
alter this value.

## Execution Flow

1. `clarificationPolicyResolution.mjs` records the runtime final outcome in
   its existing transaction.
2. `policyRuntimeDestinationEvidenceCommandService.mjs` locks the completed
   classification and destination, then reads the active native intent and
   current destination profile with the caller-owned client.
3. `policyRuntimeDestinationEvidenceCandidate.mjs` derives one candidate from
   allow-listed structured metadata and an affirmative native rule.
4. `policyRuntimeDestinationEvidenceProvenance.mjs` builds bounded evidence
   and a bounded intent with a passing fingerprint and evidence-quality audit.
5. `policyRuntimeDestinationEvidenceAdmission.mjs` creates the canonical
   intake and admits only `identity_evidence` or `compatibility_evidence` with
   a required profile refresh.
6. The authorized executor relocks state using a derived source-event validator,
   revalidates the authenticated actor, verifies the recorded outcome, claims
   the durable receipt, writes the allowed evidence, and queues profile refresh
   in the same transaction.
7. An identical retry returns replayed. An execution failure throws so the
   owning resolution transaction rolls back instead of recording only part of
   the operation.

## Security Properties

- **No client authority:** the runtime answer still contains only a
  fingerprint-bound action and destination ID; it cannot request learning.
- **No model or RAG authority:** free text, AI-originated text, RAG support,
  and provider data never enter candidate derivation or the persistence command.
- **Profile restraint:** profile distributions remain compatibility support and
  freshness evidence, never the origin of an identity candidate.
- **Strict candidate cardinality:** broad or multiple matches do not choose a
  winner; they remain outcome-only.
- **TOCTOU and replay protection:** transaction locks, final execution
  authorization, derived source-event IDs, and the durable receipt prevent
  stale, cross-item, cross-destination, and duplicate writes.
- **Atomic change:** final-outcome verification, evidence persistence, and the
  profile refresh outbox share one transaction.

## Dependency Outcome

- Updated direct `undici` to `8.10.0`; Dependabot alert #96 is fixed by the
  upstream `8.9.0` patch line or later.
- Updated the pinned Discord transitives to `undici` `6.28.0`.
- Updated `express-rate-limit` and transitive security overrides for
  `ip-address`, `socket.io-parser`, `brace-expansion`, and `minimatch`.
- Both `npm audit --omit=dev --audit-level=high` and full `npm audit` report
  zero vulnerabilities after the lockfile update.

## Verification

- `policyRuntimeDestinationEvidenceAdmission.test.mjs`
- `policyRuntimeDestinationEvidenceCommandService.test.mjs`
- `policyRuntimeDestinationEvidenceExecutionState.test.mjs`
- Existing authorized-outcome executor, receipt, evidence-writer, and
  persistence-command tests
- Server security lint and typecheck
- Production and full npm audit

## Final Recommendation Stack

1. Keep runtime answers outcome-only at the API boundary.
2. Admit automatic destination evidence only from an active native rule plus
   matching structured metadata, with exactly one candidate.
3. Keep profile data as freshness and bounded-quality corroboration, not intent.
4. Reuse the authorized executor, derived receipt identity, and refresh outbox
   for every destination-evidence mutation.
5. Continue dependency maintenance from lockfile-backed audit and Dependabot
   findings.

## Next Task

Proceed with **Phase 5R.6, Task 5R.6.4: Direct Writer Inventory And Cutover**.
It must identify every remaining runtime path that writes classification or
reinforcement evidence without the authorized executor and either integrate it,
mark it migration-only, or remove it.
