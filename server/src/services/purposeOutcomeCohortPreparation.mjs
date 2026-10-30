/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { preparePurposeOutcomeEvents } from './purposeOutcomeObservations.mjs';

/** Complete source validation and connected first-event holdouts precede every count or display choice. */
export function preparePurposeOutcomeCohort({ rows, observedAt, window }) {
  const now = Date.parse(observedAt);
  if (!Array.isArray(rows) || rows.length > 5000 || !Number.isFinite(now) || window?.until !== observedAt ||
      Date.parse(window.since) !== now - 30 * 86400000) throw new Error('purpose_cohort_input_budget');
  const events = preparePurposeOutcomeEvents(rows, now);
  if (events.some(event => event.at < Date.parse(window.since) || event.at >= now)) throw new Error('purpose_cohort_window');
  const parents = new Map(), root = key => {
    if (!parents.has(key)) parents.set(key, key);
    let value = key;
    while (parents.get(value) !== value) value = parents.get(value);
    while (parents.get(key) !== key) { const next = parents.get(key); parents.set(key, value); key = next; }
    return value;
  };
  for (const event of events) {
    const keys = [...event.aliases];
    for (const key of keys.slice(1)) parents.set(root(key), root(keys[0]));
  }
  const seen = new Set();
  for (const event of events) {
    const component = root([...event.aliases][0]);
    event.disposition = seen.has(component) ? 'duplicate_item' : event.gap ? 'gap' : 'eligible';
    seen.add(component);
  }
  return { events, sourceRows: rows.length, window };
}
