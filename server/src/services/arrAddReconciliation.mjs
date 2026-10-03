/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isValidArrExpectation, verifyArrResource } from './arrResourceVerification.mjs';

const failed = error => ({ routed: false, reason: 'arr_add_failed', error });
const verified = reason => ({ routed: true, reason, error: null });
const mismatch = 'The provider item could not be verified in the selected destination. Review it before retrying.';

/** One add at most. Callbacks use bounded provider HTTP methods, never retries. */
export async function reconcileArrAdd({ read, add, expected }) {
  if (!isValidArrExpectation(expected)) return failed('A valid media ID and absolute destination are required. Review the library settings.');
  let existing;
  try { existing = await read(); }
  catch { return failed('Could not check the provider. Check its connection before retrying.'); }
  if (existing !== null) return verifyArrResource(existing, expected) ? verified('already_in_arr') : failed(mismatch);

  let reason = 'routed';
  try {
    const result = await add();
    if (result?.alreadyExists) reason = 'already_in_arr';
  } catch (error) {
    if (error?.code === 'ARR_ADD_REJECTED') return failed('The provider rejected the add request. Review its settings before retrying.');
    // An uncertain response is not absence. Read, but never repeat the POST here.
    reason = 'already_in_arr';
  }
  try {
    const observed = await read();
    return verifyArrResource(observed, expected) ? verified(reason) : failed(mismatch);
  } catch {
    return failed('The add outcome is unconfirmed. Check the item in the provider before retrying.');
  }
}
