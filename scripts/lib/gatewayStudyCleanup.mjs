/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
/** Each internal action retains its exact-name/ownership fence; try all, never hide a leak. */
export function finishGatewayStudyCleanup(actions) {
  const failedResources = [];
  for (const action of actions) {
    try { action.run(); } catch { failedResources.push(action.name); }
  }
  if (failedResources.length) throw Object.assign(new Error('gateway_study_cleanup_incomplete'), { failedResources });
}
