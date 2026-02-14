# Issue 262 Interface Design

Title: Command Center UI Design Spec (2026)
Status: Draft (locked baseline for implementation)
Date: 2026-02-11
Related: `docs/issue-262-implementation-plan.md`
Research log: `docs/issue-262-best-practices.md`

## Purpose
Define what the Command Center interface looks like, how sections are ordered, and how key interactions behave.

This is the visual/UX design source of truth for Issue 262.

## Research-Informed Design Constraints (Locked)
This design is not style-only; it is evidence-backed and must remain aligned to Phase 0 best-practice findings.

Required evidence categories:
- action-first operational IA and scan hierarchy
- notification center behavior and interaction semantics
- SWR/realtime refresh ergonomics and freshness signaling
- mobile operational interactions (bottom-sheet detail and action-density behavior)
- legacy deprecation/migration UX patterns

Execution requirements:
- design decisions must map to entries in `docs/issue-262-best-practices.md`
- intentional deviations from research-backed defaults must be documented with rationale
- if a later implementation change conflicts with locked design behavior, update both this doc and the research mapping

## Existing UI System Alignment (Locked)

The Command Center must reuse the current Classifarr visual system and shared UI primitives.

### Core Theme Tokens
Source: `client/src/style.css`

| Token | Hex | Usage |
|---|---|---|
| `--color-primary` | `#3b82f6` | Primary buttons, active states, focus accents |
| `--color-primary-dark` | `#2563eb` | Primary hover/pressed |
| `--color-primary-light` | `#60a5fa` | Highlight/hover text accents |
| `--color-background` | `#1a1d24` | Page background and form field surfaces |
| `--color-background-light` | `#242731` | Card/module surfaces |
| `--color-sidebar` | `#12141a` | Header/sidebar/nav surfaces |
| `--color-success` | `#22c55e` | Success badges/statuses |
| `--color-warning` | `#f59e0b` | Warning badges/statuses |
| `--color-error` | `#ef4444` | Error badges/statuses |

Palette rules:
- Do not introduce a new palette for Command Center.
- Reuse semantic colors for status meaning (`success`, `warning`, `error`).
- Keep neutral borders on `gray-700/gray-800` to match existing modules.

### Shared Components To Reuse
Use existing common components before creating new variants:
- `Card.vue` for each Command Center module shell.
- `Button.vue` variants: `primary`, `secondary`, `success`, `warning`, `error`, `ghost`.
- `Badge.vue` variants: `default`, `success`, `warning`, `error`, `info`.
- `Input.vue` and `Select.vue` for Quick Add and change-selection controls.
- `Toggle.vue` for binary setting controls where applicable.
- `Modal.vue` for confirm/change flows requiring dialogs.
- `Toast.vue` for action feedback.
- `Tabs.vue` only where a compact/mobile segmented section is explicitly needed.

### Surface, Spacing, and Radius Conventions
- Module containers: `bg-background-light`, `border border-gray-800`, `rounded-lg`.
- Form surfaces: `bg-background` with `border-gray-700`.
- Standard module padding baseline: `p-6` (or responsive equivalent).
- Keep card/header/footer structures consistent with current `Card.vue` behavior.

### Iconography and Status Language
- Continue using the current mixed style:
  - Emoji/status symbols for high-signal operational markers.
  - Heroicons for nav/system controls where already used.
- Keep status text paired with icon/color (do not rely on color alone).

### Accessibility and Interaction Baseline
Source: `client/src/accessibility.css`

- Respect existing focus-visible treatment (`2px` primary outline + offset).
- Maintain minimum mobile touch targets (`44x44`) on actionable controls.
- Keep keyboard navigation parity for all primary actions.

### Motion and Feedback Baseline
- Reuse existing subtle transitions (`~0.3s`) for reveal/panel/toast motion.
- Avoid heavy or decorative animation in operational modules.
- Prioritize stable layout while live data refreshes.

## Global Header

```
┌─────────────────────────────────────────────────────────────────┐
│  [≡]  Classifarr                         [🔔 N]  [👤 admin ▾] │
└─────────────────────────────────────────────────────────────────┘
```

Header rules:
- Left: menu toggle (`[≡]`).
- Middle: product label (`Classifarr`).
- Right: notifications bell with unread count (`[🔔 N]`).
- Far-right: account menu (`[👤 admin ▾]`).

## Notifications Panel

Clicking `[🔔 N]` opens a right-aligned panel:

```
┌─────────────────────────────────────┐
│  NOTIFICATIONS        [Mark All Read]│
│  ───────────────────────────────────│
│  ● ... unread items ...             │
│  ───────────────────────────────────│
│  ○ ... read items ...               │
│  ───────────────────────────────────│
│             [View All Notifications]│
└─────────────────────────────────────┘
```

Rules:
- Unread first (`●`), read second (`○`).
- Each item has summary line, detail line, and relative timestamp.
- `Mark All Read` updates both UI and persisted state.
- Clicking a notification navigates/scrolls to the target section when available.
- Default row click behavior:
  - clicking a notification row opens its target and marks it read.
- Action-priority behavior:
  - inline row actions (`Mark Read/Unread`, `Dismiss`) do not trigger row navigation.
  - `Open` action mirrors default row-click behavior.
- Panel row actions support:
  - open target
  - mark read/unread
  - dismiss (for dismissible notification types only)
- Interaction semantics are locked to research-backed notification behavior (grouping, action priority, and row-open expectations).

### Notifications Panel (Detailed Example)

```
                                          ┌─────────────────────────────────────┐
                                          │  NOTIFICATIONS        [Mark All Read]│
                                          │  ───────────────────────────────────│
                                          │                                      │
                                          │  ● 🚨 2 items awaiting decision      │
                                          │    The Bear S03, Oppenheimer         │
                                          │                            5 min ago │
                                          │                                      │
                                          │  ● ⚠️ Radarr connection lost         │
                                          │    Unable to route classifications   │
                                          │                           12 min ago │
                                          │                                      │
                                          │  ● 💰 AI budget: 90%                 │
                                          │    $4.50 / $5.00 limit               │
                                          │                            1 hr ago │
                                          │                                      │
                                          │  ───────────────────────────────────│
                                          │  ○ ✓ Library sync completed          │
                                          │    4K Movies: +12 items              │
                                          │                            2 hrs ago │
                                          │                                      │
                                          │  ○ ✓ Enrichment batch done           │
                                          │    247 items enriched                │
                                          │                            3 hrs ago │
                                          │                                      │
                                          │  ───────────────────────────────────│
                                          │             [View All Notifications] │
                                          └─────────────────────────────────────┘
```

### Notifications View (All Notifications)

`[View All Notifications]` opens a dedicated notifications view.

Route and layout baseline:
- Route: `/notifications`
- Full-page list with filter bar, unread/read grouping, and pagination.
- Uses the same icon/type taxonomy as the bell panel.

View-level actions:
- Bulk: `[Mark All Read]`, `[Clear Read]`
- Row: `[Open]`, `[Mark Read/Unread]`, `[Dismiss]` (when supported)

Filter/sort baseline:
- Filters: `All`, `Unread`, `Alerts`, `Info`
- Sort: newest first by default
- Pagination baseline: 25 rows per page (or infinite scroll equivalent)

Empty states:
- Unread filter empty: `No unread notifications ✓`
- Global empty: `No notifications yet`

Design sample:

```
┌─────────────────────────────────────────────────────────────────┐
│  NOTIFICATIONS                                                  │
│  [All] [Unread] [Alerts] [Info]               [Mark All Read]  │
│  ───────────────────────────────────────────────────────────────│
│  ● 🚨 2 items awaiting decision                    5 min ago    │
│    The Bear S03, Oppenheimer                                    │
│    [Open] [Mark Read]                                           │
│  ───────────────────────────────────────────────────────────────│
│  ○ ✓ Library sync completed                      2 hrs ago      │
│    4K Movies: +12 items                                         │
│    [Open] [Mark Unread] [Dismiss]                               │
│  ───────────────────────────────────────────────────────────────│
│                              [Previous] [1] [2] [Next]         │
└─────────────────────────────────────────────────────────────────┘
```

## Command Center Layout (Full Stack)

```
1. 🔔 ALERTS
2. 🔄 PROCESSING
3. 🎬 ENRICHMENT
4. 🚨 NEEDS ATTENTION (N)
5. ⚠️ ERRORS (N)
6. ✓ RECENTLY COMPLETED
7. ➕ QUICK ADD
8. 📁 LIBRARIES
9. 📊 TODAY
```

Core priority order (for compact/mobile emphasis):
1. Alerts
2. Processing
3. Needs Attention
4. Errors
5. Recently Completed
6. Today

### Canonical Full-Page Mockup

```
┌─────────────────────────────────────────────────────────────────┐
│  COMMAND CENTER                                    [● Live]    │
├─────────────────────────────────────────────────────────────────┤
│  🔔 ALERTS                                                      │
│  🔄 PROCESSING                                                  │
│  🎬 ENRICHMENT                                                  │
│  🚨 NEEDS ATTENTION                                             │
│  ⚠️ ERRORS                                                      │
│  ✓ RECENTLY COMPLETED                                           │
│  ➕ QUICK ADD                                                    │
│  📁 LIBRARIES                                                   │
│  📊 TODAY                                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Actual Command Center (Detailed Composition)

```
┌─────────────────────────────────────────────────────────────────┐
│  COMMAND CENTER                                    [● Live]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐
│  │  🔔 ALERTS                                                  │
│  │  ───────────────────────────────────────────────────────────│
│  │  ⚠️ Radarr connection lost 5 min ago            [Reconnect] │
│  │  ⚠️ AI budget at 90% ($4.50 / $5.00)            [View Usage]│
│  └─────────────────────────────────────────────────────────────┘
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐
│  │  🔄 PROCESSING                                              │
│  │  ───────────────────────────────────────────────────────────│
│  │  Inception (2010)                                   Movie   │
│  │  ═══════════════════════════════════░░░░░░░░░░░░░░░░  67%  │
│  │  Phase: AI Analysis • Step 6/8 • 3.2s                      │
│  │  Completed: 5 phases • Next: Decision                       │
│  │  [View Details]                                              │
│  │  llama3.3:8b • 847 tokens • 3.2s                            │
│  │  Queue: 3 pending • Overall: 2,847 / 6,324 (45%)            │
│  └─────────────────────────────────────────────────────────────┘
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐
│  │  🎬 ENRICHMENT                                              │
│  │  ───────────────────────────────────────────────────────────│
│  │  ═══════════════════════════════════════░░░░░░░░░░░░  89%  │
│  │  5,621 / 6,324 enriched • OMDb: 5,418 • Tavily: 203         │
│  └─────────────────────────────────────────────────────────────┘
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐
│  │  🚨 NEEDS ATTENTION (2)                                     │
│  │  ───────────────────────────────────────────────────────────│
│  │  The Bear S03                                          TV   │
│  │  62% → TV Drama • "Multiple genres detected"                │
│  │  [✓ Confirm]  [✎ Change ▾]                                  │
│  │  ----------------------------------------------------------- │
│  │  Oppenheimer                                        Movie   │
│  │  71% → 4K Movies • "Biopic vs Drama"                        │
│  │  [✓ Confirm]  [✎ Change ▾]                                  │
│  │  ----------------------------------------------------------- │
│  │  [✓ Confirm All]                                            │
│  └─────────────────────────────────────────────────────────────┘
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐
│  │  ⚠️ ERRORS (2)                                              │
│  │  ───────────────────────────────────────────────────────────│
│  │  The Matrix 5 • AI timeout • 2 min ago                      │
│  │  [↻ Retry]  [🗑 Dismiss]                                     │
│  │  Avatar 5 • TMDB lookup failed • 5 min ago                  │
│  │  [↻ Retry]  [🗑 Dismiss]                                     │
│  │  ----------------------------------------------------------- │
│  │  [↻ Retry All]  [🗑 Dismiss All]                             │
│  └─────────────────────────────────────────────────────────────┘
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐
│  │  ✓ RECENTLY COMPLETED                                       │
│  │  ───────────────────────────────────────────────────────────│
│  │  Toy Story 4 → Kids Movies (98%)                    2s ago  │
│  │  Breaking Bad S01 → TV Drama (100%)                15s ago  │
│  │  John Wick 4 → 4K Movies (94%)                     32s ago  │
│  │                                     [View Full History →]   │
│  └─────────────────────────────────────────────────────────────┘
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐
│  │  ➕ QUICK ADD                                                │
│  │  ───────────────────────────────────────────────────────────│
│  │  [Search TMDB...                                  ] [Add]   │
│  └─────────────────────────────────────────────────────────────┘
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐
│  │  📁 LIBRARIES                                               │
│  │  ───────────────────────────────────────────────────────────│
│  │  Kids Movies      1,234 items    +12 today    98% auto      │
│  │  4K Movies          892 items     +5 today    94% auto      │
│  │  TV Drama         2,104 items     +8 today    91% auto      │
│  │  Anime              456 items     +3 today    96% auto      │
│  │                                    [Manage Libraries →]     │
│  └─────────────────────────────────────────────────────────────┘
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐
│  │  📊 TODAY                                                   │
│  │  ───────────────────────────────────────────────────────────│
│  │  127 classified • 89% confidence • 12 manual                │
│  │  🟢 AI Online   🟢 Worker Active                            │
│  └─────────────────────────────────────────────────────────────┘
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Actual Command Center (Idle-State Composition)

Notes:
- `ALERTS` is not shown when no critical alerts are present.
- `ENRICHMENT` may be hidden when fully complete and disabled by policy.

```
┌─────────────────────────────────────────────────────────────────┐
│  COMMAND CENTER                                    [● Live]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐
│  │  🔄 PROCESSING                                              │
│  │  ───────────────────────────────────────────────────────────│
│  │  Idle — nothing processing                                  │
│  │  Library: 6,324 / 6,324 (100%)                              │
│  └─────────────────────────────────────────────────────────────┘
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐
│  │  🚨 NEEDS ATTENTION                                         │
│  │  ───────────────────────────────────────────────────────────│
│  │  No items awaiting decision ✓                               │
│  └─────────────────────────────────────────────────────────────┘
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐
│  │  ⚠️ ERRORS                                                  │
│  │  ───────────────────────────────────────────────────────────│
│  │  No errors ✓                                                │
│  └─────────────────────────────────────────────────────────────┘
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐
│  │  ✓ RECENTLY COMPLETED                                       │
│  │  ───────────────────────────────────────────────────────────│
│  │  Toy Story 4 → Kids Movies (98%)                    2s ago  │
│  │  Breaking Bad S01 → TV Drama (100%)                15s ago  │
│  │  John Wick 4 → 4K Movies (94%)                     32s ago  │
│  │                                     [View Full History →]   │
│  └─────────────────────────────────────────────────────────────┘
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐
│  │  ➕ QUICK ADD                                                │
│  │  ───────────────────────────────────────────────────────────│
│  │  [Search TMDB...                                  ] [Add]   │
│  └─────────────────────────────────────────────────────────────┘
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐
│  │  📁 LIBRARIES                                               │
│  │  ───────────────────────────────────────────────────────────│
│  │  Kids Movies      1,234 items    +12 today    98% auto      │
│  │  4K Movies          892 items     +5 today    94% auto      │
│  │  TV Drama         2,104 items     +8 today    91% auto      │
│  │  Anime              456 items     +3 today    96% auto      │
│  │                                    [Manage Libraries →]     │
│  └─────────────────────────────────────────────────────────────┘
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐
│  │  📊 TODAY                                                   │
│  │  ───────────────────────────────────────────────────────────│
│  │  127 classified • 89% confidence • 12 manual                │
│  │  🟢 AI Online   🟢 Worker Active                            │
│  └─────────────────────────────────────────────────────────────┘
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Priority Design Block

```
1. Alerts — Critical issues first (only when present)
2. Processing — What's happening now
3. Needs Attention — Your action required
4. Errors — Problems to fix
5. Recently Completed — Feedback loop
6. Today — Summary stats
```

## Mobile View Spec (Locked)

Breakpoints:
- Desktop: `>= 1024px`
- Tablet: `768px - 1023px`
- Mobile: `<= 767px`

Layout rules:
- Mobile and tablet use a single-column vertical stack.
- Mobile default reading/action order follows the locked priority set:
  - Alerts -> Processing -> Needs Attention -> Errors -> Recently Completed -> Today
- Enrichment, Quick Add, and Libraries remain visible and follow the priority set.
- No horizontal page scroll is allowed in any module state.

Header and navigation:
- Global header remains visible with `[≡]`, brand, bell, and account actions.
- Section anchor jumps account for sticky-header offset on mobile.
- Notification bell opens a mobile-friendly overlay (drawer/sheet), not a tiny dropdown.

Action layout and touch targets:
- All primary action controls meet `44x44` minimum touch targets.
- Two-action rows (for example `Confirm/Change`, `Retry/Dismiss`) may render in two columns when space allows.
- If width is constrained, action rows stack to full-width buttons.
- Primary actions remain directly visible; no hidden-menu-only primary action paths.

Module-specific mobile behavior:
- Processing:
  - default card stays compact
  - tapping `[View Details]` opens phased detail in a bottom sheet (`~85-90vh`)
  - bottom sheet supports explicit close affordance and preserves scroll position
- Needs Attention:
  - policy question text and options remain visible in-card
  - binary prompts use explicit `[Yes] [No]`
  - non-binary options render as stacked buttons when needed
- Errors:
  - row actions remain one-tap accessible
  - bulk actions remain visible at module footer
- Quick Add:
  - compact layout allowed; input and `[Add]` may stack on narrow widths
- Libraries:
  - rows collapse to concise two-line metadata format on mobile

Mobile acceptance baseline:
- Core actions (`Confirm`, `Change`, `Retry`, `Dismiss`, `Add`, `Reconnect`) are executable in <=2 taps from module context.
- Processing detail is reachable without route change and closable without state loss.
- Bottom-sheet detail usage on mobile is a locked research-backed interaction pattern and should not be replaced with route navigation in v1.
- Notification open/read flows remain usable on mobile without obscuring primary navigation.

### Mobile ASCII Mockups (Locked)

#### Processing (mobile card)

```
┌───────────────────────────────────────┐
│ 🔄 PROCESSING                         │
│ ───────────────────────────────────── │
│ Inception (2010)              Movie   │
│ ═░░░░░░░░░░░░░░░░░░░░░░░░░░░░   03%   │
│ Phase: Queued • Step 1/8 • 0.1s       │
│ [View Details]                        │
│ llama3.3:8b • 0 tokens • 0.1s         │
│ Queue: 3 pending • Overall: 45%       │
└───────────────────────────────────────┘
```

#### Processing details (mobile bottom sheet)

```
┌───────────────────────────────────────┐
│ Classifying: "Inception" (2010)  03%  │
│ Phase: Queued • Step 1/8 • 0.1s       │
│                                       │
│ ⏳ 📥 📋 🧠 ⚖️ 🤖 ✅ 📤                │
│ •  ○  ○  ○  ○  ○  ○  ○                │
│                                       │
│ • Queued             running...       │
│ ○ Metadata Fetch                        │
│ ○ Policy Evaluation                     │
│ ○ RAG Analysis                          │
│ ○ Signal Combination                    │
│ ○ AI Analysis                           │
│ ○ Decision                              │
│ ○ Notification                          │
│                                       │
│ [Close]                               │
└───────────────────────────────────────┘
```

#### Needs Attention (mobile card, binary prompt)

```
┌───────────────────────────────────────┐
│ 🚨 NEEDS ATTENTION (1)                │
│ ───────────────────────────────────── │
│ Motorvalley (2026)             TV     │
│ Low confidence • Conflicting signals  │
│ Is this primarily English content?    │
│ [Yes] [No]                            │
│ [✎ Change ▾]                          │
└───────────────────────────────────────┘
```

#### Needs Attention (mobile card, non-binary prompt)

```
┌───────────────────────────────────────┐
│ 🚨 NEEDS ATTENTION (1)                │
│ ───────────────────────────────────── │
│ Oppenheimer                    Movie   │
│ 71% • Biopic vs Drama                │
│ Which library should this go to?      │
│ [4K Movies]                           │
│ [Movies]                              │
│ [Drama Collection]                    │
│ [✎ Change ▾]                          │
└───────────────────────────────────────┘
```

#### Errors (mobile rows)

```
┌───────────────────────────────────────┐
│ ⚠️ ERRORS (2)                         │
│ ───────────────────────────────────── │
│ The Matrix 5 • AI timeout • 2 min ago │
│ [↻ Retry] [🗑 Dismiss]                │
│ ───────────────────────────────────── │
│ Avatar 5 • TMDB failed • 5 min ago    │
│ [↻ Retry] [🗑 Dismiss]                │
│ ───────────────────────────────────── │
│ [↻ Retry All]                          │
│ [🗑 Dismiss All]                       │
└───────────────────────────────────────┘
```

#### Quick Add (mobile)

```
┌───────────────────────────────────────┐
│ ➕ QUICK ADD                          │
│ ───────────────────────────────────── │
│ [Search TMDB...]                      │
│ [Add]                                 │
└───────────────────────────────────────┘
```

## Final UI Baseline (Build Handoff)
- Use `Card.vue` shell for each section with consistent header divider and `rounded-lg` boundary.
- Keep a single vertical column on desktop/tablet; do not split core action modules into separate columns.
- Preserve this visual hierarchy: `Alerts` -> `Processing` -> `Needs Attention` -> `Errors` before informational modules.
- Keep section actions visible without hover-only discovery for primary workflows.
- Keep relative-time metadata right-aligned in list rows where timestamps exist.
- Ensure all section cards preserve layout in loading, empty, and error states.

## Section Designs

### Alerts
- Purpose: Critical system issues needing immediate action.
- Row structure: severity/icon + message + age + single action button.
- Example actions: `Reconnect`, `View Usage`.

### Processing
- Shows active item, progress bar, model/tokens/elapsed, queue + overall totals.
- Default card includes active-phase summary only:
  - `Phase: {label} • Step {index}/{total} • {duration}`
  - `Completed: {completedCount} phases • Next: {nextLabel}`
- Selecting the active Processing card opens the detailed phase breakdown view.
- Interaction pattern (locked):
  - desktop/tablet: inline expand directly beneath the selected Processing card.
  - mobile: bottom-sheet detail panel from the selected card.
  - modal is not used for Processing detail.
- Supports contextual secondary actions when pending work exists:
  - `Cancel Pending`
  - `Cancel All Pending`
  - `Manual Classify` (pending-item overflow path)
  - `Refresh`
- Supports optional `Up Next` preview rows for pending items (top 3 recommended).
- Empty state:
  - `Idle — nothing processing`
  - `Library: {processedCount} / {totalCount} ({percent}%)`

#### Classifying Behavior (Locked)
- The UI must represent classification as an 8-phase pipeline, not a single spinner.
- Required phase order:
  - `queued` -> `metadata_fetch` -> `policy_eval` -> `rag_analysis` -> `signal_combine` -> `ai_analysis` -> `decision` -> `notification`
- Required state markers:
  - complete: `✓`
  - in progress: `•`
  - pending: `○`
- Required contextual line:
  - `Phase: {label} • Step {index}/{total} • {duration}`
- Required progression summary:
  - overall percent plus phase-aware progress.
- Required collapsed behavior on Command Center:
  - show only active phase summary (`Phase`, `Step`, `Completed`, `Next`) in the default Processing card.
- Required detail behavior:
  - full phase list appears when the user selects the Processing card.
  - detail is available from phase `queued` (`Step 1/8`) and must not wait for `ai_analysis`.
  - each phase row can show timing (`running...` or duration).
  - optional metadata line (TMDB id, matched policy, embedding count, library id) when available.
- Secondary active items may use compact rows, but phase status visibility must remain.
- During migration, this phased behavior remains visible on Activity page until Command Center processing parity is verified.

Active-state sample:

```
┌─────────────────────────────────────────────────────────────────┐
│  🔄 PROCESSING                                                  │
│  ───────────────────────────────────────────────────────────────│
│  Inception (2010)                                      Movie    │
│  ═══════════════════════════════════░░░░░░░░░░░░░░░░   67%     │
│  Phase: AI Analysis • Step 6/8 • 3.2s                          │
│  Completed: 5 phases • Next: Decision                          │
│  [View Details]                                                 │
│  llama3.3:8b • 847 tokens • 3.2s                               │
│  Queue: 3 pending • Overall: 2,847 / 6,324 (45%)               │
└─────────────────────────────────────────────────────────────────┘
```

Compact operational variant (locked, matches current mockup intent):

```
┌─────────────────────────────────────────────────────────────────┐
│  🔄 PROCESSING                                                  │
│  ───────────────────────────────────────────────────────────────│
│  Inception (2010)                                      Movie    │
│  ═══════════════════════════════════░░░░░░░░░░░░░░░░   67%     │
│  Phase: AI Analysis • Step 6/8 • 3.2s                          │
│  [View Details]                                                 │
│  llama3.3:8b • 847 tokens • 3.2s                               │
│  Queue: 3 pending • Overall: 2,847 / 6,324 (45%)               │
└─────────────────────────────────────────────────────────────────┘
```

Processing compact-view rule:
- This compact card is valid for default on-page scan.
- Full phase-stepper/details are required behavior and must appear when the user selects a Processing card.
- Use a visible trigger label (`View Details`) on the Processing card.
- Expanded selected-card example is canonical in `Classifying Progress Component (Phased)` below.

### Enrichment
- Running view includes progress bar and percent.
- Metric line:
  - `{enrichedCount} / {totalCount} enriched • OMDb: {omdbCount} • Tavily: {tavilyCount}`
- Visible while active; supports complete/empty state behavior per policy.
- Conditional action:
  - show `[Process Retry Queue]` when Tavily retry backlog is non-zero.

Running-state design:

```
┌─────────────────────────────────────────────────────────────────┐
│  🎬 ENRICHMENT                                                  │
│  ───────────────────────────────────────────────────────────────│
│  ═══════════════════════════════════════░░░░░░░░░░░░░░░  89%   │
│  5,621 / 6,324 enriched • OMDb: 5,418 • Tavily: 203             │
└─────────────────────────────────────────────────────────────────┘
```

Compact operational variant (locked, matches current mockup intent):

```
┌─────────────────────────────────────────────────────────────────┐
│  🎬 ENRICHMENT                                                  │
│  ───────────────────────────────────────────────────────────────│
│  ═══════════════════════════════════════░░░░░░░░░░░░░░░  89%   │
│  5,621 / 6,324 enriched • OMDb: 5,418 • Tavily: 203             │
└─────────────────────────────────────────────────────────────────┘
```

### Needs Attention
- Card-per-item decision layout.
- Discord parity (locked for Command Center):
  - Render the same policy question prompt text from `policy_question.question`.
  - Render uncertainty context from `policy_question.why_uncertain` when present.
  - Render answer choices from `policy_question.options` as primary decision controls.
  - Render targeted recheck diagnostic context when present (for example comparator/recheck reason line) to preserve Queue-depth resolution context.
- Binary prompt behavior (locked):
  - If options collapse to a Yes/No semantic pair, render explicit `[Yes]` and `[No]` buttons.
  - If options are non-binary, render labeled option buttons exactly as returned.
- Fallback behavior (locked):
  - If an `awaiting_decision` item has missing/invalid `policy_question`, keep card actionable via `[✎ Change ▾]` manual path.
  - Surface a diagnostics signal/log marker for missing policy payloads (no silent failure).
- Actions:
  - `[✓ Confirm]`
  - `[✎ Change ▾]`
  - `[✓ Confirm All]` (bulk)
- Empty state:
  - `No items awaiting decision ✓`

### Needs Attention Definition of Done (Policy Prompt Parity)
- Same policy prompt text appears in Command Center as the source pending payload:
  - `policy_question.question`
  - `policy_question.why_uncertain` (when present)
  - option labels from `policy_question.options`
- Binary prompts render explicit Yes/No controls:
  - if two options map to Yes/No semantics, show `[Yes]` and `[No]`
  - otherwise show the returned option labels
- Resolve requests preserve payload parity:
  - `library_id`
  - `selected_option`
  - `resolved_by`
  - `generate_rule: true`
- Missing/invalid `policy_question` does not block action:
  - user can still resolve via `[✎ Change ▾]`
  - diagnostics signal/log marker is emitted
- Targeted recheck diagnostic parity is preserved:
  - if recheck diagnostics are available in payload, they are shown inline on the card before action buttons

### Errors
- Failed-item rows with reason and age.
- Actions:
  - `[↻ Retry]`
  - `[🗑 Dismiss]`
  - `[↻ Retry All]`
  - `[🗑 Dismiss All]`
- Empty state:
  - `No errors ✓`

### Recently Completed
- Shows latest 5 completion rows.
- Row format:
  - `{Title} → {Library} ({Confidence}%) {relativeTime}`
- Footer action:
  - `[View Full History →]`

Design sample:

```
┌─────────────────────────────────────────────────────────────────┐
│  ✓ RECENTLY COMPLETED                                          │
│  ───────────────────────────────────────────────────────────────│
│  Toy Story 4 → Kids Movies (98%)                        2s ago  │
│  Breaking Bad S01 → TV Drama (100%)                    15s ago  │
│  John Wick 4 → 4K Movies (94%)                         32s ago  │
│                                        [View Full History →]    │
└─────────────────────────────────────────────────────────────────┘
```

### History (Retained Route)
- `/history` remains the canonical historical workspace (not removed in Command Center consolidation).
- Required history controls:
  - filter bar (media type, library, method, date range, optional title/text search).
  - persistent sort order (newest first default).
- Smart reclassification behavior (locked):
  - exactly one selected row enables single-item `Reclassify`.
  - more than one selected row enables `Batch Reclassify`.
  - batch action is disabled when selection count is `0`.
- Discoverability:
  - primary entry from Command Center `Recently Completed` footer: `[View Full History →]`.

### Quick Add
- Inline manual request entry.
- Layout:
  - `[Search TMDB... ] [Add]`
- `Add` submits to existing manual request classification flow.

Design sample:

```
┌─────────────────────────────────────────────────────────────────┐
│  ➕ QUICK ADD                                                   │
│  ───────────────────────────────────────────────────────────────│
│  [Search TMDB...                                    ] [Add]     │
└─────────────────────────────────────────────────────────────────┘
```

### Libraries
- Per-library rows:
  - name, item count, today delta, auto percentage.
- Actions:
  - per-row quick action `[⚙]`
  - footer `[Manage Libraries →]`
- Conditional setup CTA:
  - `Configure Media Server` appears only if Media Server is not configured or Radarr/Sonarr mappings are missing.

Libraries row quick-action menu baseline (`[⚙]`):
- `Open Library`
- `Sync Library`
- `View History`
- `Settings`

## Sidebar Navigation (Locked)

Purpose:
- Align sidebar IA to Command Center-first workflows while preserving temporary legacy access during migration.

Primary sidebar navigation (Command Center era):
- `Command Center` -> `/`
- `Libraries` -> `/libraries`
- `History` -> `/history`
- `Policies` -> `/policies`
- `Presets` -> `/presets`
- `Tuning` -> `/tuning-suggestions`
- `Statistics` -> `/statistics`
- `Policy Stats` -> `/policy-stats`
- `Settings` -> `/settings`
- `System` -> `/system`

Sidebar v1 group/order map (locked):

| Group | Order | Label | Route |
|---|---|---|---|
| Core | 1 | Command Center | `/` |
| Core | 2 | Libraries | `/libraries` |
| Core | 3 | History | `/history` |
| Classification | 4 | Policies | `/policies` |
| Classification | 5 | Presets | `/presets` |
| Classification | 6 | Tuning | `/tuning-suggestions` |
| Insights | 7 | Statistics | `/statistics` |
| Insights | 8 | Policy Stats | `/policy-stats` |
| Admin | 9 | Settings | `/settings` |
| Admin | 10 | System | `/system` |

Route-visibility rules:
- `/request` remains available for compatibility but is not a primary sidebar item in Command Center-era IA.
- `/activity` and `/queue` are legacy-only during migration and are excluded from primary groups.
- `/migration` is excluded from primary sidebar navigation.
- Smart Rule Builder v2 is excluded from active Command Center-era navigation and workflow entry points.

Legacy transition behavior (locked):
- `Activity` and `Queue` are removed from primary sidebar groups once Command Center parity gates pass.
- During transition, if still exposed, `Activity` and `Queue` must appear in a clearly labeled `Legacy`/`Deprecated` group.
- `Migration` is not shown as a primary sidebar destination in Command Center-era UX.
- Legacy rule/migration wording is removed from primary operational UX copy and replaced with Policy/Presets/Tuning terminology.

Sidebar behavior rules:
- Active state highlights exactly one route target.
- Mobile sidebar opens from `[≡]` and closes on selection.
- Sidebar labels must match locked terminology in this design and plan docs.

### Today
- Compact summary line:
  - classified count, average confidence, manual count.
- Health badges:
  - AI status, worker status.

## Summary Matrix

| Section | Content | Actions |
|---|---|---|
| Alerts | Critical system issues | Reconnect, View Usage |
| Processing | Current item + progress + queue + active phase context | `[View Details]`, Cancel Pending, Cancel All Pending, Manual Classify, Refresh |
| Enrichment | OMDb/Tavily progress bar | Conditional: Process Retry Queue |
| Needs Attention | Awaiting decision cards + policy question parity | Confirm, Change, Confirm All, Yes/No (when binary) |
| Errors | Failed items | Retry, Dismiss, Retry All, Dismiss All |
| Recently Completed | Last 5 items | View Full History |
| Quick Add | TMDB search box | Search, Add |
| Libraries | Per-library stats | Per-library `[⚙]`, Manage, conditional Configure Media Server |
| Today | Summary stats + health | None |

## Empty-State Principles
- Keep module shells visible.
- Use concise single-line status copy.
- Do not hide core sections when empty unless explicitly defined (for example conditional alerts).

### Empty-State Mockups (Clean)

```
┌─────────────────────────────────────────────────────────────────┐
│  🔄 PROCESSING                                                  │
│  ───────────────────────────────────────────────────────────────│
│  Idle — nothing processing                                      │
│  Library: 6,324 / 6,324 (100%)                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  🚨 NEEDS ATTENTION                                             │
│  ───────────────────────────────────────────────────────────────│
│  No items awaiting decision ✓                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  ⚠️ ERRORS                                                      │
│  ───────────────────────────────────────────────────────────────│
│  No errors ✓                                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Loading and Error View Pattern (All Modules)

Loading baseline:
- Keep module shell and title visible.
- Render skeleton rows/bars sized to final content.
- Keep action buttons disabled but visible while loading.

Error baseline:
- Keep module shell and title visible.
- Show concise error line + retry action.
- Preserve previous stale data when available (SWR behavior).

Pattern sample:

```
┌─────────────────────────────────────────────────────────────────┐
│  🔄 PROCESSING                                                  │
│  ───────────────────────────────────────────────────────────────│
│  Loading...                                                     │
│  [██████████████████████████████████████████████]              │
│  [Refresh disabled]                                             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  ⚠️ ERRORS                                                      │
│  ───────────────────────────────────────────────────────────────│
│  Unable to load error queue                                    │
│  [Retry]                                                        │
└─────────────────────────────────────────────────────────────────┘
```

## Navigation Targets (Anchors)
- `#alerts`
- `#processing`
- `#enrichment`
- `#needs-attention`
- `#errors`
- `#recently-completed`
- `#quick-add`
- `#libraries`
- `#today`

Legacy queue-tab replacement mapping (locked):
- `Pending` -> `#processing`
- `Failed` -> `#errors`
- `Awaiting Decision` -> `#needs-attention`

Queue advanced-ops discoverability:
- Advanced queue operations (`reprocess completed`, `clear and resync`) remain under `Settings > Queue`.
- Command Center provides tertiary/secondary discoverability links to Queue settings, but does not expose destructive advanced actions inline.

## Live Data Behavior
- Interface should appear live-updating while preserving layout stability.
- Module data updates should use SWR-style stale-while-revalidate behavior.
- Relative timestamps should refresh without full page reload.
- Staleness/freshness contract (locked):
  - actionable modules expose `Last updated` (or equivalent freshness indicator) in module header/meta line.
  - manual refresh actions trigger SWR `mutate` and immediately update freshness timestamp on success.
  - stale data may remain visible during revalidation, but stale status must be visually indicated.
- Refresh/freshness behavior is aligned to research-backed SWR operational UX patterns and is part of the locked contract.

## Activity Page Continuity (Transition)
- During migration, keep the existing Activity page `Classifying...` experience available.
- Preserve the active classification presentation (`Processing Now`, primary progress bar, active task detail rows) until Command Center Processing reaches parity.
- Current component continuity target:
  - `GlobalProgressBar` for primary active item progress.
  - `ActivityItemProgress` for additional active tasks.
- Remove/deprecate the Activity page classifying block only after parity validation is complete.

### Classifying Progress Component (Phased)
This is the phased classification progress UI you referenced.
It appears as the detailed view after a user selects the active Processing card.

Required phase order (locked):
1. `queued`
2. `metadata_fetch`
3. `policy_eval`
4. `rag_analysis`
5. `signal_combine`
6. `ai_analysis`
7. `decision`
8. `notification`

Required labels/icons (locked):
- `queued` -> `⏳ Queued`
- `metadata_fetch` -> `📥 Metadata Fetch`
- `policy_eval` -> `📋 Policy Evaluation`
- `rag_analysis` -> `🧠 RAG Analysis`
- `signal_combine` -> `⚖️ Signal Combination`
- `ai_analysis` -> `🤖 AI Analysis`
- `decision` -> `✅ Decision`
- `notification` -> `📤 Notification`

Component layout behavior:
- Header line: `Classifying: "{title}" ({year})`.
- Subline: `Phase: {label} • Step {index}/{total} • {duration}`.
- Right summary: overall percent.
- Horizontal phase stepper showing complete/current/pending states.
- Expandable detail list for per-phase timing + optional metadata context.

State visuals:
- Complete phase marker: `✓` + success accent.
- Current phase marker: `•` + active pulse + phase icon + highlight.
- Pending phase marker: muted icon/marker.

Example (expanded detail, preferred):

```
┌─────────────────────────────────────────────────────────────────┐
│  Classifying: "Inception" (2010)                      67%      │
│  Phase: AI Analysis • Step 6/8 • 3.2s                          │
│                                                                 │
│  ⏳  📥  📋  🧠  ⚖️  🤖  ✅  📤                                 │
│  ✓   ✓   ✓   ✓   ✓   •   ○   ○                                 │
│                                                                 │
│  (expanded)                                                     │
│   ✓ Queued               0.2s                                   │
│   ✓ Metadata Fetch       0.8s                                   │
│   ✓ Policy Evaluation    0.3s                                   │
│   ✓ RAG Analysis         0.6s                                   │
│   ✓ Signal Combination   0.2s                                   │
│   • AI Analysis          running...                             │
│   ○ Decision                                                    │
│   ○ Notification                                                │
│                                                                 │
│  [Collapse Details]                                             │
└─────────────────────────────────────────────────────────────────┘
```

## Notification vs Alert Boundary
- Alerts: critical/action-now, visible in page.
- Notifications: informational/review-oriented, surfaced in bell panel.
- Some events can appear in both when severity warrants (for example connection loss, budget warnings).

### Notification Type Matrix

| Type | Icon | When Generated |
|---|---|---|
| Awaiting Decision | 🚨 | Items need your input |
| Error | ❌ | Classification failed after retries |
| Connection Lost | ⚠️ | Radarr/Sonarr/Plex disconnected |
| Connection Restored | ✅ | Service reconnected |
| Budget Warning | 💰 | AI spend at 80%, 90%, 100% |
| Sync Completed | ✓ | Library sync finished |
| Enrichment Completed | ✓ | Batch enrichment done |
| Policy Suggestion | 💡 | New tuning suggestion available |
| Update Available | 🆕 | New Classifarr version |

### Notification vs Alert Matrix

| Alerts (on page) | Notifications (bell) |
|---|---|
| Critical, needs action NOW | Informational, can review later |
| Always visible when present | Hidden until you click bell |
| Blocks/warns you | Informs you |
| Connection lost, budget exceeded | Sync completed, enrichment done |

## Do/Don't Checklist

### Do
- Use existing theme tokens and semantic colors from `client/src/style.css`.
- Reuse shared components (`Card`, `Button`, `Badge`, `Input`, `Select`, `Modal`, `Toast`) before adding new primitives.
- Keep modules vertically stacked, stable, and always understandable in loading/empty/error states.
- Keep primary actions visible and explicit in each actionable module.
- Use SWR-style stale-while-revalidate updates with visibility-aware polling.
- Preserve keyboard/focus accessibility and minimum touch target sizing.

### Don't
- Do not introduce a new color palette or alternate surface system for Command Center.
- Do not replace primary actions with hidden menus as the only path.
- Do not remove `Classifying...` Activity-page continuity before Command Center parity is validated.
- Do not rely on color alone to communicate status.
- Do not create conflicting polling loops that fight SWR updates.
