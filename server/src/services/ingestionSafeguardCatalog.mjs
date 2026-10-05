/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { INGESTION_COMPATIBILITY_DIAGNOSTICS_SQL } from './ingestionCompatibilityDiagnostics.mjs';

export const SAFEGUARD_TABLES = Object.freeze(['media_server_items', 'media_server_sync_status',
  'media_source_capture_state', 'library_ingestion_state', 'media_source_observations', 'media_server_collections']);
export const SAFEGUARD_TRIGGERS = Object.freeze(['ingestion_compatibility_rows', 'ingestion_compatibility_truncate']);
const expectedBody = `BEGIN
  IF current_setting('classifarr.ingestion_protocol', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'ingestion_writer_upgrade_required',
      HINT = 'This database requires a protocol-aware Classifarr writer. Upgrade the writer; do not bypass the fence.';
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') AND TG_TABLE_NAME IN ('media_server_sync_status','media_source_capture_state') THEN
    NEW.ingestion_protocol := 1;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END`;

/** Strict repair eligibility; deliberately narrower than ordinary status observation. */
export async function readIngestionSafeguardPlan(db) {
  const { rows: [state] } = await db.query( // sql-interpolation: only the fixed imported catalog SQL is interpolated; values are bound.
    `SELECT ${INGESTION_COMPATIBILITY_DIAGNOSTICS_SQL} AS diagnostic,
    current_database() AS database,
    EXISTS(SELECT 1 FROM public.policy_native_intent_reconciliation_restore_gates WHERE gate_id=1 AND gate_state='ready') AS restore_ready,
    (SELECT p.prosrc=$1 AND NOT p.prosecdef AND p.provolatile='v' AND p.prorettype='trigger'::regtype
      AND p.proconfig=ARRAY['search_path=pg_catalog'] AND l.lanname='plpgsql'
      FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang
      WHERE p.oid=to_regprocedure('public.enforce_ingestion_compatibility()')) AS function_matches,
    NOT EXISTS(SELECT 1 FROM pg_trigger t WHERE t.tgrelid=ANY($2::regclass[]) AND t.tgname=ANY($3::text[])
      AND (t.tgqual IS NOT NULL OR t.tgnargs<>0 OR t.tgattr<>''::int2vector OR t.tgconstraint<>0)) AS trigger_details_match,
    (SELECT count(*)=2 FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE a.attrelid=ANY(ARRAY['public.media_server_sync_status'::regclass,'public.media_source_capture_state'::regclass])
        AND a.attname='ingestion_protocol' AND NOT a.attisdropped AND a.attnotnull
        AND a.atttypid='smallint'::regtype AND pg_get_expr(d.adbin,d.adrelid)='0') AS columns_match,
    (SELECT bool_and(pg_has_role(current_user,c.relowner,'USAGE')) FROM pg_class c WHERE c.oid=ANY($2::regclass[])) AS can_alter`,
  [`\n${expectedBody}\n`, SAFEGUARD_TABLES.map(table => `public.${table}`), SAFEGUARD_TRIGGERS]);
  const d = state.diagnostic;
  const changes = d.checks.filter(check => check.status === 'not_always_enabled');
  const reason = !d.migrationRecorded ? 'migration_required' : !d.protocolReady ? 'protocol_required'
    : !state.restore_ready ? 'restore_required'
      : !state.function_matches || !state.trigger_details_match || !state.columns_match || d.checks.length !== changes.length ? 'definition_changed'
        : !changes.length ? 'not_needed' : !state.can_alter ? 'maintenance_identity_required' : 'confirmation_required';
  const fingerprint = createHash('sha256').update(JSON.stringify(state)).digest('hex');
  return { reason, changes, fingerprint };
}

export function safeguardEnableSql(change) {
  if (!SAFEGUARD_TABLES.includes(change?.table) || !SAFEGUARD_TRIGGERS.includes(change?.trigger)
    || change.status !== 'not_always_enabled') throw new Error('repair_target_invalid');
  return `ALTER TABLE public.${change.table} ENABLE ALWAYS TRIGGER ${change.trigger}`;
}
