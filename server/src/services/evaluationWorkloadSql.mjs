/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const minute = "(EXTRACT(HOUR FROM statement_timestamp() AT TIME ZONE 'UTC')::int*60+EXTRACT(MINUTE FROM statement_timestamp() AT TIME ZONE 'UTC')::int)";
export const EVALUATION_WINDOW_OPEN_SQL = `(workload_mode='when_idle' OR (workload_mode='scheduled' AND
  CASE WHEN window_start_minute<window_end_minute
    THEN ${minute}>=window_start_minute AND ${minute}<window_end_minute
    ELSE ${minute}>=window_start_minute OR ${minute}<window_end_minute END))`;
