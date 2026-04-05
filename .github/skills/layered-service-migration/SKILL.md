---
name: layered-service-migration
description: 'Service decomposition and layered migration patterns for Classifarr. USE FOR: extracting adapters over legacy tables, building façade service boundaries, adding new DB tables alongside existing ones (dual-write / shadow-read), writing deterministic backfill scripts, normalizing key formats, hardening PolicyEngine contracts, building phase-gated migrations. DO NOT USE FOR: full PolicyEngine rewrites, schema cutovers without a compatibility phase, removing legacy tables before shadow parity is proven.'
---

# Layered Service Migration

## When to Use

Load this skill when:
- Building adapters over `learning_patterns` or `discovered_patterns`
- Introducing a new table alongside existing ones without changing runtime behavior
- Writing or extending `classificationEvidenceService` and its collaborators
- Adding Phase-2-style dual-write or shadow comparison logic
- Building or running backfill scripts
- Hardening PolicyEngine result shapes without changing scoring behavior

## Architecture Overview

This codebase uses a **3-layer approach** for all migrations:

```
Phase 1 — Refactor seams (no new tables, no behavior change)
Phase 2 — New schema + backfill + dual-write (legacy still authoritative)
Phase 3 — Shadow comparison, cleanup tranche, lifecycle reconciliation
Phase 4 — Runtime cutover (legacy retired, new table authoritative)
```

Never mix phases. Each phase should leave the system observable and rollback-safe.

---

## Component Build Order (Foundation → Operator)

### Layer 1 — Foundation
Build these first. Nothing else should depend on inline logic these provide.

| Component | File | Role |
|---|---|---|
| `classificationEvidenceKeyBuilder` | `server/src/services/classificationEvidenceKeyBuilder.js` | Canonical key format. **All** evidence key construction must delegate here. |
| `classificationEvidenceRepository` | `server/src/services/classificationEvidenceRepository.js` | Low-level CRUD for `classification_evidence`. All SQL goes here. |
| `classificationEvidenceService` | `server/src/services/classificationEvidenceService.js` | Top-level façade. Delegates to adapters and repository. No SQL. |
| `classificationEvidenceWriteService` | `server/src/services/classificationEvidenceWriteService.js` | Confirmed human writes. Single write boundary for all callers. |

### Layer 2 — Lifecycle and Compatibility
Build these after Layer 1 is tested and stable.

| Component | File | Role |
|---|---|---|
| `classificationEvidenceLifecycleService` | `server/src/services/classificationEvidenceLifecycleService.js` | Purge / reset / restore. Primary callers: retry, backup, admin. |
| `evidenceCompatibilityMapper` | `server/src/services/evidenceCompatibilityMapper.js` | Map unified evidence back to legacy `method` values for history/stats. |
| `evidenceHistoryReadModel` | `server/src/services/evidenceHistoryReadModel.js` | Stable read model for history/activity/dashboard/stats surfaces. |

### Layer 3 — Policy Integration
Build only after Layer 2 is working and dual-write evidence parity is verified.

| Component | File | Role |
|---|---|---|
| `policyDecisionBuilder` | `server/src/services/policyDecisionBuilder.js` | Normalize PolicyEngine outputs. ✅ Built in Phase 1. |
| `policyScoringContextBuilder` | `server/src/services/policyScoringContextBuilder.js` | Assemble shared scoring inputs (RAG cache, evidence cache). |
| `relatedEvidenceScorer` | `server/src/services/relatedEvidenceScorer.js` | Convert evidence rows into one scored policy family. |

### Layer 4 — Operator/Admin
Build last, on top of stable Layer 2/3 read models.

| Component | File | Role |
|---|---|---|
| `server/src/routes/evidence.js` | Route | Admin surface for unified evidence. |
| `evidenceDiagnosticsService` | `server/src/services/evidenceDiagnosticsService.js` | Operator debug read model. |
| `Evidence.vue` | `client/src/views/Evidence.vue` | Admin screen for unified evidence. |

---

## Evidence Key Rules

All evidence keys MUST be built using `classificationEvidenceKeyBuilder`. Never construct inline.

```
{scope}:{lowercase_value}              single-value scopes
genre:{sorted_value_1}|{sorted_value_2}  multi-genre composite
```

Examples:
```
genre:documentary
genre:documentary|nature    ← sorted, pipe-separated
studio:a24
franchise:mcu
certification:r
```

Helper methods:
```javascript
const keyBuilder = require('./classificationEvidenceKeyBuilder');
keyBuilder.buildSingleGenreKey('Documentary')       // 'genre:documentary'
keyBuilder.buildGenreKey(['Nature', 'Documentary']) // 'genre:documentary|nature'
keyBuilder.buildForScope('studio', 'A24')           // 'studio:a24'
keyBuilder.buildKey('network', 'HBO')               // 'network:hbo'
```

---

## Adapter Pattern

Each legacy table gets exactly one adapter. Adapters:
- Own all SQL for that table
- Emit normalized evidence DTOs that match `classification_evidence` shape
- Never call other adapters directly
- Are injected into the service façade via constructor DI

### Normalized Evidence DTO
```javascript
{
  scope: 'item_exact' | 'genre' | 'studio' | 'franchise' | 'certification',
  libraryId: number | null,
  confidence: number,         // 0–100
  usageCount: number,
  successRate: number | null,
  evidenceKey: string | null, // always from classificationEvidenceKeyBuilder
  evidenceData: object,
  provenance: 'human_confirmed' | 'policy_confirmed' | 'mined',
  source: 'learning_patterns' | 'discovered_patterns' | 'classification_evidence',
  status: 'active' | 'candidate',
  mediaType: string | null
}
```

### Provenance Rules
| Source | Provenance |
|---|---|
| Human correction, Discord confirm, manual review | `human_confirmed` |
| Policy-question resolution | `policy_confirmed` |
| Pattern mining, AI-only | `mined` |

### Trust Rules
- `scope = item_exact` + `provenance = human_confirmed` → **authoritative**. May bypass AI.
- All other scopes → **scored evidence only**. Never authoritative by themselves.
- `mined` provenance → non-authoritative. Can only graduate after later human confirmation.

---

## Phase-Gate Discipline

### Phase 1 Exit Criteria (complete before any new table reads)
- [ ] Service façade exists and routes all evidence reads/writes
- [ ] Both legacy adapters tested and emit normalized DTOs
- [ ] `classificationEvidenceKeyBuilder` is the only key construction source
- [ ] `policyDecisionBuilder` normalizes all PolicyEngine action shapes
- [ ] Lifecycle (purge/reset) is behind the façade — not scattered in callers
- [ ] No change in live classification method distribution

### Phase 2 Exit Criteria (complete before runtime cutover)
- [ ] `classification_evidence` table exists and is backfilled
- [ ] Backfill is idempotent and verifiable
- [ ] Backup/restore understands the new table
- [ ] Purge/reset flows understand exact-vs-related evidence scopes
- [ ] PolicyEngine zero-weight and RAG gating semantics are explicit and tested
- [ ] Runtime still reads legacy sources only

### Phase 3 Exit Criteria (complete before retiring legacy tables)
- [ ] Dual-write is active and mismatch rate is below threshold
- [ ] Shadow reads agree with legacy reads on > 99% of classification events
- [ ] All consumers use `evidenceCompatibilityMapper` for method labels
- [ ] Reporting/history/stats surfaces use `evidenceHistoryReadModel`
- [ ] No direct `learning_patterns` or `discovered_patterns` reads outside adapters

---

## PolicyEngine Contract Rules

When touching `policyEngine.js` or `policyDecisionBuilder.js`:

1. **Result shape is stable across all actions.** `normalizeResult()` must produce
   `ranked`, `topCandidate`, `scores`, `weights`, `breakdown`, `agreement`, and `thresholds`
   regardless of action type.

2. **Explicit zero stays zero.** Use `??` not `||` for weight defaults.
   ```javascript
   // WRONG
   const weight = config.rag_weight || 0.15;
   // CORRECT
   const weight = config.rag_weight ?? 0.15;
   ```

3. **Scorer status distinguishes failure modes.** `0` must not mean both "no evidence"
   and "service error". Return `{ status: 'missing' | 'disabled' | 'error' }`.

4. **Related evidence is scored, never authoritative.** Never let the `pattern` slot
   or the future `related_evidence` slot cause early classification returns.

---

## Backfill Script Template

Backfill scripts live in `scripts/`. They must be:
- Idempotent (safe to rerun)
- Batched to avoid write amplification
- Verifiable by a companion `verify_*.js` script

Backfill mapping reference:
```
learning_patterns.exact_match  → scope=item_exact, provenance=human_confirmed, confidence=100
learning_patterns.genre_pattern → scope=genre,      provenance=policy_confirmed
discovered_patterns.*          → scope=pattern_type, provenance=mined, status=candidate
```

---

## Running Tests in This Repo

All test commands route through `server/scripts/run-jest.mjs`. Use npm scripts where possible:

```bash
npm --prefix server test              # unit + integration
npm --prefix server run test:unit     # unit only
npm --prefix server run test:ci       # CI mode with coverage
```

When running targeted tests directly via `npx jest`, always use the **plural** flag:

```bash
# CORRECT
npx jest --testPathPatterns="classificationEvidence" --no-coverage

# DEPRECATED (triggers a Jest warning)
npx jest --testPathPattern="classificationEvidence"
```

Jest 30+ replaced `--testPathPattern` with `--testPathPatterns`. The project's npm scripts do not use the deprecated form — the warning indicates a manual CLI invocation used the old flag.

---

## Anti-Patterns to Avoid

- `classificationEvidenceManager` that owns storage + scoring + reinforcement + UI payloads
- Inline key construction: `\`genre:${genre.toLowerCase()}\`` — use `keyBuilder` instead
- Dual-write without mismatch logging
- Adding related-evidence scoring before Phase 2 is verified
- Reusing `patterns.js` route as the long-term evidence admin route (it is coupled to discovered-pattern CRUD semantics)
- Treating mined evidence and human-confirmed evidence with the same trust rules
