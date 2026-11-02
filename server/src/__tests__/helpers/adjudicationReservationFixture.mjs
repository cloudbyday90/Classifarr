/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { getPool } from '../integration/setup.mjs';
import { createReadinessDatabase } from './readinessDatabase.mjs';
import { createAdjudicationBudgetRepository } from '../../services/adjudicationBudgetRepository.mjs';
import { createAdjudicationFinalizationClaim } from '../../services/adjudicationFinalizationClaim.mjs';
import { INVENTORY_DISCOVERY_LOCK } from '../../services/inventoryDiscoveryAdmission.mjs';

export const reservationQuery = (...args) => getPool().query(...args);
export const reservationSnapshot = async () => (await reservationQuery('SELECT * FROM adjudication_capture_budget')).rows;
export const reservationOptions = { dailyCalls: 5, dailyTokens: 42240 };
export const reservationDeferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };

export async function claimReservationOwner(db, revision, wrap = scope => scope) {
  let claim;
  const acquired = await db.withSessionAdvisoryLock(INVENTORY_DISCOVERY_LOCK, async scope => {
    claim = await createAdjudicationFinalizationClaim(wrap(scope))(revision);
  });
  if (!acquired || !claim) throw Error('fixture_owner_not_acquired');
  return claim;
}

export async function reservationFixture(options = {}) {
  const db = createReadinessDatabase(options), budget = createAdjudicationBudgetRepository(db);
  try {
    const state = await budget.configure(reservationOptions), owner = await claimReservationOwner(db, state.revision);
    return { db, budget, state, owner };
  } catch (error) { await db.pool.end(); throw error; }
}
