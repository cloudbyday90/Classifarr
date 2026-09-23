/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

const MAX_EXACT_EVENTS = 5000;

/** Add intake context without interpreting quiet traffic as a failure or granting promotion. */
export function withInventoryProspectiveActivity(report, row) {
  const count = row?.recorded_movie_tv_events;
  if (!Number.isInteger(count) || count < 0 || count > MAX_EXACT_EVENTS + 1 ||
      !Number.isInteger(report?.coverage?.captured) || report.coverage.captured < 0 ||
      (count <= MAX_EXACT_EVENTS && report.coverage.captured > count)) {
    throw new Error('inventory_prospective_activity_invalid');
  }
  return {
    ...report,
    activity: { recordedMovieTvEvents: count, capped: count > MAX_EXACT_EVENTS },
    evidenceState: count === 0 ? {
      phase: 'awaiting_classification_intake', missing: ['recorded_movie_tv_classifications'],
    } : report.evidenceState,
  };
}
