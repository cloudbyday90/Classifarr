/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const refusals = new WeakSet();

/** Only repository-observed non-ownership can mint this private evidence. */
export function createAdjudicationReservationRefusal() {
  const error = new Error('adjudication_reservation_not_owned');
  refusals.add(error);
  return error;
}
export const isAdjudicationReservationRefusal = error => refusals.has(error);
