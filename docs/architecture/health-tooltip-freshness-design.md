# Health tooltip freshness: design

Date: 2026-10-12. The operator reported Healthy/Not Configured badges whose hover
text still said Unknown.

The System page already derives badge and tooltip labels from the same status.
The shared directive's mouseenter closure instead retains its original mounted
binding. Later Vue updates change the badge but a new hover reads the old text.
Additionally, any element's update/unmount can hide another element's tooltip.

Store current text per element in a WeakMap and track the active tooltip owner.
Update stored text on every directive update; refresh only the active owner's
tooltip. Unmount removes that element's listeners/state and only its own visible
tooltip. Preserve plain `textContent` rendering, positioning, click dismissal and
the single-visible-tooltip limit. No status normalization or network call changes.

Recommendation: fix the shared lifecycle, covering all callers. A System-only
workaround would leave other stale tooltips behind. No new tooltip package is
needed. This does not add keyboard interaction to existing nonfocusable cards;
the visible status remains available without hovering.

Test mounted Unknown to updated Healthy and Not Configured, updates while shown,
repeat hover, unrelated updates/unmounts, empty text, listener cleanup and literal
untrusted text. Include the real System view/directive regression and a browser
hover test. Record outcomes separately.

Official source discovered by MCP and opened on 2026-10-12:
[Vue custom directives](https://vuejs.org/guide/reusability/custom-directives.html)
documents distinct mounted/updated hooks and the current binding value. Keeping
element-local state for event handlers is the implementation decision here.
