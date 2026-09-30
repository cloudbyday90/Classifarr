/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { STUDY_RETRY_TYPES } from './resourceStudyRetryFixture.mjs';

/** Fail closed: old no-retry receipts and partial phase/type coverage are not evidence. */
export function assertStudyRetryReceipt(receipt) {
  const integer = value => Number.isSafeInteger(value) && value >= 0 && value <= 1000;
  if (receipt?.cohortSize !== 60 || receipt.preserved !== true || receipt.rotations !== 1 ||
    !integer(receipt.pressureDeferrals) || receipt.pressureDeferrals < 2 ||
    !STUDY_RETRY_TYPES.every(type => {
      const row = receipt.types?.[type];
      return row && integer(row.beforePasses) && row.beforePasses >= 5 &&
        integer(row.afterPasses) && row.afterPasses >= 5 &&
        integer(row.rolledBackClaims) && row.rolledBackClaims + receipt.pressureDeferrals <= 1000 &&
        row.rolledBackClaims === row.beforePasses + row.afterPasses &&
        row.recoveredClaims === row.afterPasses && Number.isFinite(row.maxPassMs) && row.maxPassMs >= 0;
    })) throw new Error('resource_study_retry_receipt_invalid');
}
