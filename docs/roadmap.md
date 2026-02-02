# Classifarr Development Roadmap

This document outlines planned features and improvements, organized by engineering complexity and upcoming releases.

**Current Version:** v0.41.0-alpha  
**Last Updated:** 2026-02-01

---

## Recently Completed (v0.41.0-alpha)

### System Health & Monitoring
- ✅ System Health Dashboard with trend tracking (#184)
- ✅ Service lockdown system (#206)
- ✅ Sync error hygiene with 404 handling (#226)

### Automation & Learning
- ✅ Discord verification learning (#240)
- ✅ Unified confidence settings page (#241)

### User Experience
- ✅ Classification signal breakdown (#185)
- ✅ Dashboard accessibility (WCAG 2.1 AA) (#204)
- ✅ User profile settings (#187)
- ✅ Backup & restore system (#186)

### Documentation & Quality
- ✅ Comprehensive API documentation (#188)
- ✅ Testing coverage enforcement (80% lines, 75% functions) (#227)
- ✅ Copyright compliance automation (#198)

### System Retirement
- ✅ Event detection system removed (Epic #168)
  - Database schema cleanup (#228)
  - Backend code removal (#229)
  - Frontend UI removal (#225)

---

## Low Complexity, High Impact
**Target:** Next Minor Release (v0.42.0-alpha)

### User Experience Improvements
- **Policy Name/Description Editing** (#241 follow-up)
  - Issue: Users can't edit policy names/descriptions after auto-generation
  - Solution: Add inline editing or "Edit Name" button
  - Effort: Low (UI-only change)
  - Impact: High (improves UX, addresses user feedback)

- **Preset Usage Count Display** (#241 follow-up)
  - Issue: Users don't see preset popularity
  - Solution: Display "Used in X policies" in preset grid
  - API: Already exists (\`/policies/presets/:id/usage\`)
  - Effort: Low (frontend + API integration)
  - Impact: Medium (helps users choose presets)

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

### Data Management
- **Export/Import Policy Configurations**
  - Share policies between instances
  - Effort: Low (JSON export/import)
  - Impact: Medium (multi-instance management)

---

## Medium Complexity, Important
**Target:** Next 1-2 Releases (v0.42.0 - v0.43.0)

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

### Search & Filtering
- **Advanced Search and Filtering**
  - Search history by title, genre, confidence, date
  - Effort: Medium (UI + query optimization)
  - Impact: High (usability)

---

## High Complexity or Research
**Target:** Future/Major Releases (v0.44.0+)

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

## Release Cadence

- **Alpha releases:** Every 2-4 weeks with new features
- **Beta releases:** Quarterly with stability focus
- **Stable releases:** Bi-annually with long-term support

---

## Feedback

Have ideas for features or improvements? Please open an issue on GitHub or join our Discord community.

---

**Roadmap Notes:**
- Items move between complexity tiers as design solidifies
- Open issues are linked where available
- Community feedback prioritizes future work
