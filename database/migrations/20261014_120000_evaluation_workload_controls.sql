-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Existing positive allowances remain opted in; zero allowances remain off.
ALTER TABLE adjudication_capture_budget
  ADD COLUMN IF NOT EXISTS workload_mode text NOT NULL DEFAULT 'when_idle',
  ADD COLUMN IF NOT EXISTS window_start_minute integer,
  ADD COLUMN IF NOT EXISTS window_end_minute integer;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='adjudication_capture_budget'::regclass
    AND conname='adjudication_workload_window') THEN
    ALTER TABLE adjudication_capture_budget ADD CONSTRAINT adjudication_workload_window CHECK (
      (workload_mode='when_idle' AND window_start_minute IS NULL AND window_end_minute IS NULL)
      OR (workload_mode='scheduled' AND window_start_minute IS NOT NULL AND window_end_minute IS NOT NULL
        AND window_start_minute BETWEEN 0 AND 1439 AND window_end_minute BETWEEN 0 AND 1439
        AND window_start_minute<>window_end_minute));
  END IF;
END $$;
