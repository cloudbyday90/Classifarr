/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { cleanupBudget, cleanupId } from '../inventoryCleanup/contract.mjs';
import { cleanupTransaction } from '../inventoryCleanup/transaction.mjs';
import { finishCleanup, lockCleanupJob } from '../inventoryCleanup/step.mjs';
import { stepItemDependents } from './items.mjs';
import { stepParentDependents } from './parents.mjs';
import { assertDependentContract } from './contract.mjs';
import { stepRetainedReferences } from '../inventoryRetainedReferences/batch.mjs';

export async function stepDependentCleanup(db, id, { budget = 128 } = {}) {
    cleanupId(id); cleanupBudget(budget);
    return cleanupTransaction(db, async () => {
        await assertDependentContract(db);
        const job = await lockCleanupJob(db, id);
        if (job.state === 'completed') return job;
        const item = await stepItemDependents(db, job, budget);
        if (item) return item;
        const parent = await stepParentDependents(db, job, budget);
        const retained = await stepRetainedReferences(db, parent.job, budget - parent.used);
        return parent.used + retained.used === budget ? retained.job : finishCleanup(db, retained.job);
    });
}
