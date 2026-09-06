-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- @seed-reconciliation snapshot-required
-- Fresh schema snapshots omit runtime rows; never reset an existing cursor.
INSERT INTO public.library_observation_sampling_state (singleton) VALUES (true)
ON CONFLICT (singleton) DO NOTHING;
