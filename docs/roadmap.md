# Classifarr Development Roadmap

This document outlines the planned features and improvements for upcoming releases.

---

## v0.38.1-alpha (In Progress)

**Theme: Unified Policy Configuration**

### Completed Features

#### Unified Policy Configuration Modal ✅
- **Problem**: Fragmented policy editing experience with nested modals; users couldn't see Combined Signals while selecting presets
- **Solution**: Consolidated `PolicyBuilderModal` and `PresetSelectionModal` into single unified modal
  - Integrated preset selection UI inline (suggestions, categories, search, grid)
  - Removed nested modal experience
  - Modal title shows "[Library Name] Policy" instead of generic "Edit Policy"
  - Save button adapts: "Create Policy" or "Save Policy" based on state
  - Advanced Settings (Scoring Weights, Combination Mode) collapsed by default
  - Auto-generated policy name/description from library and selected presets
  - Single "Configure" button replaces "Add Presets" and "Edit" buttons

### Future Enhancements

#### Policy Name/Description Editing
- **Issue**: With removal of Basic Information section, users can no longer edit policy names or descriptions through UI
- **Proposed Solution**: Add optional "Edit Name" button or inline editing capability
  - Allow users to override auto-generated names
  - Preserve custom names/descriptions when editing existing policies
  - Consider pencil icon next to policy name for inline editing

#### Preset Usage Count Display
- **Issue**: Users don't see how popular presets are when selecting them
- **Proposed Solution**: Display "Used in X policies" count in preset grid
  - API endpoint already exists: `/policies/presets/:id/usage`
  - Consider implementing as hover tooltip to avoid performance impact
  - Could batch-fetch usage counts for visible presets

---

## v0.38.0-alpha (Current Release)

**Theme: Enhanced Policy Setup Experience**

### Completed Features

#### Phase 9.6: Preset Viewer UX Improvements ✅
- **Problem**: System preset "View Details" modal displayed disabled form inputs that appeared editable but weren't, creating UX confusion
- **Solution**: New read-only `PresetSummaryModal.vue` component
  - Clean summary view with badges and chips (no form inputs)
  - Content ratings shown as badge pills
  - Genres displayed as preferred/excluded chips
  - Keywords shown as tags
  - "Used in X policies" usage indicator
  - "Customize" button to clone system presets as custom presets
  - Auto-switch to Custom Presets tab after customization
  - Success toast notification

#### Previous Phases (Completed)
- Phase 9.5: Pre-Release Testing & Docker verification
- Phase 9: Custom Presets Manager UI
- Phase 8: Backend Integration & Verification
- Phase 7: Policy UX Changes
- Phase 6: Policy Card & Preset Selection Modal
- Phase 5: Custom Presets API
- Phase 4: Preset Suggestions API
- Phase 3a: Startup Policy Generation
- Phase 3: Auto-Create Policy
- Phase 2: Database Migration
- Phase 1: Current Implementation Analysis

### Remaining Tasks
- Phase 11: Final Documentation & Release
  - Create roadmap.md (this document)
  - Update implementation_plan.md with Phase 9.6 details
  - Docker build and testing
  - Git tag and release

---

## v0.39.0-alpha (Planned)

**Theme: RAG Similarity Visualization**

### Phase 10: RAG Similarity Matches Visualization

#### Overview
Display AI similarity matches that contributed to classification decisions, helping users understand why content was classified into specific libraries.

#### Proposed UI Design

```
🔮 RAG Similarity Matches for "Inception (2010)"
┌─────────────────────────────────────────────────────┐
│ 92% │████████████████████░│ Interstellar (2014)    │ → Sci-Fi Movies
│ 87% │█████████████████░░░░│ The Prestige (2006)    │ → Sci-Fi Movies  
│ 82% │████████████████░░░░░│ Tenet (2020)           │ → Sci-Fi Movies
│ 71% │██████████████░░░░░░░│ The Matrix (1999)      │ → Sci-Fi Movies
│ 65% │█████████████░░░░░░░░│ Arrival (2016)         │ → Sci-Fi Movies
└─────────────────────────────────────────────────────┘
✅ All top matches → Sci-Fi Movies (RAG score: 87%)
```

#### Features
- **Match List Display**: Show top 5-10 similar titles with similarity percentages
- **Visual Progress Bars**: Color-coded similarity strength indicators
- **Library Attribution**: Show which library each match belongs to
- **Consensus Indicator**: Display overall consensus (e.g., "✅ All top matches → Sci-Fi Movies")
- **RAG Score**: Aggregate similarity score that contributed to classification

#### Open Design Questions

1. **Consensus Display for Mixed Results**
   - **Option A (Count-based)**: "3 matches → Sci-Fi, 2 matches → Drama"
   - **Option B (Weighted)**: Use weighted average based on similarity percentages
   - **Question**: Which approach better represents AI confidence?

2. **Data Storage Approach**
   - **Option A**: Store in existing `metadata` JSONB field
   - **Option B**: Add new `rag_matches` column to `classification_history`
   - **Trade-offs**: Flexibility vs. query performance

3. **Progress Bar Color Coding**
   - **Option A**: Single color (primary blue) with opacity
   - **Option B**: Gradient from green (high similarity) to yellow (medium) to red (low)
   - **Option C**: Match library color from policy
   - **Question**: What provides best visual clarity?

4. **Empty/N/A States**
   - When should we show "No RAG matches" vs hiding the section entirely?
   - Should we show matches with very low similarity (<50%)?

5. **Number of Matches to Display**
   - Default: 5 matches
   - Maximum: 10 matches
   - Should this be configurable per-user?

6. **Additional Match Metadata on Hover**
   - Show full title + year
   - Show plot similarity excerpt
   - Show genre overlap
   - Show which signals matched

#### Implementation Tasks
- [ ] Backend: Store RAG matches in classification metadata
- [ ] Backend: API endpoint to retrieve RAG matches for a classification
- [ ] Frontend: Create `RagMatchesPanel.vue` component
- [ ] Frontend: Integrate panel into history detail view
- [ ] Frontend: Add toggle to show/hide RAG matches section
- [ ] Frontend: Responsive design for mobile
- [ ] Testing: Verify RAG data collection during classification
- [ ] Testing: Manual UI/UX verification

#### Success Criteria
- Users can see which existing library content influenced AI classification decisions
- Visual representation helps users understand and trust AI recommendations
- Provides actionable insights for tuning library policies

---

## v0.40.0+ (Future Ideas)

### Potential Features Under Consideration

#### Advanced Policy Analytics
- Heatmap of classification confidence over time
- Policy effectiveness scoring (how often does this policy correctly classify?)
- A/B testing for policy configurations

#### Machine Learning Improvements
- User feedback loop: "Was this classification correct?"
- Active learning: Prioritize uncertain classifications for manual review
- Model retraining based on user corrections

#### Integration Enhancements
- Support for additional media servers (Kodi, Emby enhancements)
- Webhook support for more request sources
- API integrations with movie databases (Letterboxd, IMDb lists)

#### Performance Optimizations
- Batch classification API
- Caching layer for repeated classifications
- Background job queue improvements

#### User Experience
- Dark/light theme toggle
- Customizable dashboard widgets
- Advanced search and filtering
- Export/import policy configurations

#### Multi-Tenancy
- Multiple user accounts with different permissions
- Team collaboration features
- Audit logging for policy changes

---

## Release Cadence

- **Alpha releases**: Every 2-4 weeks with new features
- **Beta releases**: Quarterly with stability focus
- **Stable releases**: Bi-annually with long-term support

## Feedback

Have ideas for features or improvements? Please open an issue on GitHub or join our Discord community.

---

**Last Updated**: 2026-01-13  
**Current Version**: v0.38.0-alpha
