/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';

/** Committed quota writes only, scoped to the disposable integration database. */
export async function installStudyQuotaAudit(db) {
  const { rows: [database] } = await db.query('SELECT current_database() AS name');
  assert.match(database.name, /^classifarr_suite_[a-f0-9]{12}$/);
  await db.query(`CREATE TABLE study_omdb_quota_audit (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, day date NOT NULL, used integer NOT NULL);
    CREATE FUNCTION study_record_omdb_quota() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      INSERT INTO study_omdb_quota_audit(day,used) VALUES (NEW.last_reset_date,NEW.requests_today);
      RETURN NEW;
    END; $$;
    CREATE TRIGGER study_omdb_quota AFTER UPDATE OF requests_today ON omdb_config
      FOR EACH ROW EXECUTE FUNCTION study_record_omdb_quota()`);
}

export async function assertStudyQuotaAudit(db, total) {
  assert.ok(Number.isSafeInteger(total) && total > 0 && total <= 32);
  const { rows } = await db.query("SELECT to_char(day,'YYYY-MM-DD') AS day,used FROM study_omdb_quota_audit ORDER BY id");
  assert.equal(rows.length, total, 'study_quota_committed_reservations');
  const counts = new Map();
  let previousDay = '';
  for (const row of rows) {
    assert.match(row.day, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(row.day >= previousDay, 'study_quota_day_regressed');
    counts.set(row.day, (counts.get(row.day) ?? 0) + 1);
    assert.equal(row.used, counts.get(row.day), 'study_quota_daily_sequence');
    previousDay = row.day;
  }
  const { rows: configs } = await db.query(`SELECT requests_today,is_active,
    to_char(last_reset_date,'YYYY-MM-DD') AS day FROM omdb_config WHERE is_active`);
  assert.deepEqual(configs, [{ requests_today: counts.get(previousDay), is_active: true, day: previousDay }]);
}
