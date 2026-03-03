# Classifarr Development Roadmap

This document outlines planned features and improvements, organized by engineering complexity.

Status labels:

- `Active` = in normal roadmap consideration
- `Deferred (v1.1+)` = intentionally deferred follow-up scope after current V1 stabilization

---

## Recently Completed

### System Health & Monitoring

- ✅ System Health Dashboard with trend tracking (#184)
- ✅ Service lockdown system (#206)
- ✅ Sync error hygiene with 404 handling (#226)

### Automation & Learning

- ✅ Discord verification learning (#240)
- ✅ Unified confidence settings page (#241)
- ✅ Low-confidence AI loop immediate-apply rollout with automatic safety fallback, incident diagnostics, and optional version-aware auto-recover (#275)
- ✅ Second Pass reliability fixes — relaxed policy recheck gate, OR-based adoption, extended timeouts, RAG candidate building, low-score candidate filtering
- ✅ Signal agreement scoring — consensus multiplier boosts confidence when multiple signals agree on a library

### User Experience

- ✅ Classification signal breakdown (#185)
- ✅ Dashboard accessibility (WCAG 2.1 AA) (#204)
- ✅ User profile settings (#187)
- ✅ Backup & restore system (#186)
- ✅ Preset usage count display in preset picker (#241 follow-up)

### Documentation & Quality

- ✅ Comprehensive API documentation (#188)
- ✅ Testing coverage enforcement (80% lines, 75% functions) (#227)
- ✅ Copyright compliance automation (#198)

### System Retirement

- ✅ Event detection system removed (Epic #168)
  - Database schema cleanup (#228)
  - Backend code removal (#229)
  - Frontend UI removal (#225)

### Issue 275 Snapshot (Shipped vs Deferred)

| Scope                                           | Status             | Notes                                                  |
| ----------------------------------------------- | ------------------ | ------------------------------------------------------ |
| Immediate-apply low-confidence flow             | ✅ Shipped         | `apply` is active default behavior                     |
| Automatic safety fallback (`apply` -> `shadow`) | ✅ Shipped         | Enabled by default with sustained-breach guards        |
| Fallback incident diagnostics/report payload    | ✅ Shipped         | Copyable incident details for issue reporting          |
| Version-aware auto-recover toggle               | ✅ Shipped         | Optional, off by default, one attempt per version bump |
| Per-policy RAG loop overrides                   | `Deferred (v1.1+)` | Follow-up tuning scope                                 |
| Advanced diagnostics dashboards                 | `Deferred (v1.1+)` | Follow-up observability depth                          |

---

## Low Complexity, High Impact

### User Experience Improvements

- **Policy Name/Description Editing** (#241 follow-up)
  - Issue: Users can't edit policy names/descriptions after auto-generation
  - Solution: Add inline editing or "Edit Name" button
  - Effort: Low (UI-only change)
  - Impact: High (improves UX, addresses user feedback)

- **Arr Settings Dropdown Cleanup** (UX polish)
  - Issue: Duplicate default options (e.g., "All Episodes (Default)" vs "All Episodes")
  - Solution: Consolidate labels and dedupe values
  - Effort: Low (data cleanup)
  - Impact: Medium (cleaner UI)

### Customization

- **Dark/Light Theme Toggle**
  - Add user-selectable themes
  - Effort: Low-Medium (CSS + state management)
  - Impact: High (accessibility, user preference)

- **Customizable Dashboard Widgets**
  - Allow users to rearrange/hide dashboard cards
  - Effort: Medium (drag-drop + localStorage)
  - Impact: Medium (personalization)

### Classification Quality

- ~~**Policy Question Reasoning** (Second Pass)~~
  - Completed: Low-score candidates now filtered from policy questions

- ~~**Signal Agreement Scoring** (Second Pass)~~
  - Completed: Agreement multiplier applied in `policyEngine.evaluatePolicy` — 2-5 agreeing signals boost score by 5-30%

### Data Management

- **Export/Import Policy Configurations**
  - Share policies between instances
  - Effort: Low (JSON export/import)
  - Impact: Medium (multi-instance management)

### Developer Experience

- **Fix Jest Unicode Output in PowerShell (Windows)**
  - Issue: PowerShell defaults to OEM CP437 encoding, so Jest's `✓`/`✗`/`●` symbols render as garbled sequences (e.g., `ΓêÜ`, `Γ£ô`, `ΓùÅ`) in terminal output
  - Solution: Add `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8` to `$PROFILE`, or set `terminal.integrated.env.windows` → `PYTHONIOENCODING: utf-8` in VS Code settings
  - Effort: Very Low (one-line config change)
  - Impact: Medium (cleaner CI/local output, easier to read test results at a glance)

---

## Medium Complexity, Important

### Advanced Policy Analytics

- **Heatmap of Confidence Over Time**
  - Visualize classification confidence trends
  - Effort: Medium (charting library + data aggregation)
  - Impact: High (insights into policy effectiveness)

- **Policy Effectiveness Scoring**
  - Track success rate, user corrections, confidence trends
  - Effort: Medium (new metrics + UI)
  - Impact: High (data-driven policy tuning)

- **A/B Testing for Policy Configurations**
  - Test policy changes before full rollout
  - Effort: High (requires policy versioning)
  - Impact: High (reduces risk of bad changes)

### Performance Optimizations

- **Batch Classification API**
  - Classify multiple items in one request
  - Effort: Medium (API changes + queue handling)
  - Impact: High (faster bulk operations)

- **Caching Layer for Repeated Classifications**
  - Cache results for identical media
  - Effort: Medium (Redis integration)
  - Impact: Medium (performance improvement)

- **Background Job Queue Improvements**
  - Better priority handling, retry logic
  - Effort: Medium (queue refactor)
  - Impact: Medium (reliability)

### Maintenance & Technical Debt

- **Resolve Suppressed Vulnerabilities**
  - **Issue**: `ajv` vulnerability (GHSA-2g4f-4pwh-qvx6) in `server/` is suppressed because `eslint` requires the older version.
  - **Goal**: Upgrade `eslint` and `ajv` once a compatible release chain exists.
  - **Effort**: Low (dependency updates)
  - **Impact**: High (security compliance)

- **Expand Integration Test Coverage — Untested Route Layer** *(partially complete — top 3 priorities done March 2026)*
  - **Issue**: Gap analysis (March 2026) found 22 of 38 route files have zero integration test coverage. The largest gaps are against the most-used endpoints.
  - **Priority order by risk × size:**
    1. ~~`auth.js` (324 lines) — login → token → refresh → logout → change-password → session list~~ ✅ `auth-routes.test.js` — 33 tests
    2. ~~`libraries.js` (1865 lines) — labels, arr-settings, CRUD; largest uncovered route in the codebase~~ ✅ `libraries-api.test.js` — 22 tests
    3. ~~`queue.js` (581 lines) — HTTP endpoint coverage for retry, dismiss, clear-failed, cancel-all~~ ✅ `queue-api.test.js` — 28 tests
    4. `webhook.js` — inbound event → queue insertion → response; external trigger path is completely untested
    5. `backup.js` — export → import round-trip integrity (data in must match data out)
    6. `patterns.js` (739 lines) — DB-level assertion that learned patterns persist, conflict-check, and influence future classification
  - **Effort**: Medium (testcontainer infrastructure already exists; mostly writing request/assertion chains)
  - **Impact**: High (prevents silent regressions in the core classification and auth paths; closes the gap between 80% unit coverage and actual end-to-end confidence)

### Search & Filtering

- **Advanced Search and Filtering**
  - Search history by title, genre, confidence, date
  - Effort: Medium (UI + query optimization)
  - Impact: High (usability)

### Second Pass / Classification Intelligence

- **Feedback Loop from Manual Resolutions** (Second Pass)
  - Issue: User decisions on `prompt_select` are lost — the system never learns from corrections
  - Solution: Index user-resolved classifications back into the RAG database as high-confidence embeddings; weight user-validated matches higher in future retrievals
  - Effort: Medium (RAG index update on resolution + retrieval weight adjustment)
  - Impact: Very High (system gets smarter with every user interaction; same bad suggestions stop recurring)

- **Conflict-Aware Pass2 Retrieval** (Second Pass)
  - Issue: Pass2 does the same search as pass1 but with enriched metadata — finds more but not better
  - Solution: When pass1 identifies conflicting candidates (e.g., Movies vs TV Shows), pass2 specifically queries for items in each conflicting library to find precedent
  - Effort: Medium (query diversification + conflict-specific RAG queries)
  - Impact: High (makes pass2 retrieval fundamentally different from pass1)

- **Graduated Confidence Blending** (Second Pass)
  - Issue: Pass2 is binary adopt/reject — either the full result is used or nothing
  - Solution: Blend pass1 and pass2 signals into a weighted confidence score; pass2 can boost confidence without changing the library suggestion
  - Effort: Medium (confidence fusion logic + trace updates)
  - Impact: Medium-High (reduces unnecessary `prompt_select` by raising confidence above threshold)

- **Historical Bias Correction** (Second Pass)
  - Issue: Policy doesn't account for user's actual library distribution (e.g., 100 items in Movies vs 2 in Christmas and Hallmark)
  - Solution: Use library distribution as a Bayesian prior — uncertain items are statistically weighted toward more populated libraries
  - Effort: Medium (distribution query + prior weighting in policy scoring)
  - Impact: Medium (reduces obvious mismatches where a library is rarely used)

### Deferred (v1.1+) - Issue 275 Follow-Up

- **Per-Policy RAG Loop Overrides** (`Deferred (v1.1+)`)
  - Scope: limited override keys for second-pass behavior (`enable`, `strategy`, `timeout`) with safe precedence
  - Effort: Medium (settings contract + resolver + UI wiring)
  - Impact: High (finer control for mixed-library environments)

- **Operator Diagnostics in Settings/History** (`Deferred (v1.1+)`)
  - Scope: richer trace filtering and stage-level operator diagnostics in existing views
  - Effort: Medium
  - Impact: Medium-High (faster operational triage)

---

## High Complexity or Research

### RAG Similarity Visualization

**Status:** Design phase (open questions remain)
**Issue:** #185 (related)
**Scope:**

- Display AI similarity matches in classification details
- Show top 5-10 similar titles with percentages
- Visual progress bars, library attribution
- Consensus indicator (e.g., "✅ All top matches → Sci-Fi Movies")

**Open Design Questions:**

1. Consensus display for mixed results (count-based vs weighted)
2. Data storage approach (metadata JSONB vs new column)
3. Progress bar color coding (single color, gradient, or library color)
4. Empty/N/A states (when to show vs hide)
5. Number of matches to display (default 5, max 10, configurable?)
6. Hover metadata (full title, plot excerpt, genre overlap, signal matches)

**Implementation Tasks:**

- [ ] Backend: Store RAG matches in classification metadata
- [ ] Backend: API endpoint to retrieve RAG matches
- [ ] Frontend: Create \`RagMatchesPanel.vue\` component
- [ ] Frontend: Integrate into history detail view
- [ ] Frontend: Add toggle to show/hide section
- [ ] Frontend: Responsive design for mobile
- [ ] Testing: Verify RAG data collection
- [ ] Testing: Manual UI/UX verification

**Effort:** High (backend changes + new UI component + design decisions)
**Impact:** High (transparency, trust in AI recommendations)

### Deferred (v1.1+) - Issue 275 Follow-Up

- **Advanced Diagnostics Dashboards** (`Deferred (v1.1+)`)
  - Scope: breaker timeline, strategy distribution, promotion trends, trace reason-code filtering
  - Effort: High
  - Impact: High (rollout governance and observability depth)

- **Trace Projection for Analytics** (`Deferred (v1.1+)`)
  - Scope: project trace fields to dedicated analytics tables/materialized views
  - Effort: High
  - Impact: Medium-High (faster reporting without scanning raw metadata blobs)

- **Schema Optimizations for Learning/Alias Paths** (`Deferred (v1.1+)`)
  - Scope: optional fields like explicit `learning_eligible` and alias cache columns
  - Effort: High
  - Impact: Medium (operational clarity + query performance)

### Second Pass / Classification Intelligence

- **Async Second Pass** (Second Pass)
  - Issue: Second pass is constrained by inline request timeout; AI rerun gets starved
  - Solution: Classify immediately with first-pass confidence; queue async second pass for uncertain items; auto-reclassify or notify user when confidence improves
  - Effort: High (background job queue + notification system + state management)
  - Impact: Very High (removes timeout pressure entirely; AI rerun gets unlimited time)

- **Franchise / Series Detection** (Second Pass)
  - Issue: Sequels, spinoffs, and reboots are classified independently even when the original is already in the database
  - Solution: Detect franchise relationships via TMDB collections/series data; inherit classification from existing franchise members with high confidence
  - Effort: High (TMDB collection API + franchise graph + inheritance logic)
  - Impact: High (eliminates misclassification for related media)

### Machine Learning Improvements

- **User Feedback Loop**
  - "Was this classification correct?" prompts
  - Effort: High (requires model retraining pipeline)
  - Impact: High (continuous improvement)

- **Active Learning**
  - Prioritize uncertain classifications for manual review
  - Effort: High (ML pipeline)
  - Impact: Medium (efficiency)

- **Model Retraining Based on User Corrections**
  - Automatically improve from feedback
  - Effort: Very High (ML infrastructure)
  - Impact: High (accuracy improvement)

### Integration Enhancements

- **Support for Additional Media Servers**
  - Kodi, enhanced Emby support
  - Effort: High (new integrations)
  - Impact: Medium (broader compatibility)

- **Webhook Support for More Request Sources**
  - Beyond Overseerr/Jellyseerr
  - Effort: Medium-High (depends on source)
  - Impact: Medium (flexibility)

- **API Integrations with Movie Databases**
  - Letterboxd, IMDb lists
  - Effort: Medium-High (API integrations)
  - Impact: Medium (data enrichment)

### Multi-Tenancy

- **Multiple User Accounts with Permissions**
  - Role-based access control
  - Effort: Very High (auth system overhaul)
  - Impact: High (enterprise use cases)

- **Team Collaboration Features**
  - Shared policies, comments, approvals
  - Effort: Very High (new features)
  - Impact: Medium (team workflows)

- **Audit Logging for Policy Changes**
  - Already partially implemented (#241)
  - Effort: Medium (expand existing system)
  - Impact: High (compliance, debugging)

---

## Feedback

Have ideas for features or improvements? Please open an issue on GitHub or join our Discord community.

---

**Roadmap Notes:**

- Items move between complexity tiers as design solidifies
- Open issues are linked where available
- Deferred `v1.1+` items are intentionally parked until V1 stabilization gates are satisfied
- Issue 275 deferred items remain frozen while V1 apply-rollout Operational Visibility is monitored for longer-term tuning
- Community feedback prioritizes future work
