/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export function libraryUtcCoverageFixture(trend, groups) {
  const totals = { retained_events: trend.totals.events + Object.values(trend.excluded).reduce((a, b) => a + b, 0),
    ...trend.totals, ...trend.excluded }
  return { timestamp_basis: trend.timestamp_basis, time_zone: trend.time_zone, day_count: trend.day_count,
    start_date: trend.start_date, end_date: trend.end_date, totals,
    group_count: groups.length, group_limit: 200, truncated: false, groups }
}
