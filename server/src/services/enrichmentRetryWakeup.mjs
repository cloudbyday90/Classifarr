/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
/** Coalesce into the existing single timer. Long hints never overflow Node's timer range. */
export function scheduleEnrichmentRetryWakeup(service, delayMs = 5000) {
  const delay = Number.isFinite(delayMs) ? Math.max(1000, Math.min(delayMs, 300_000)) : 5000;
  if (service.processingInProgress) {
    service.pendingWakeDelay = Math.min(service.pendingWakeDelay ?? Infinity, delay);
    return;
  }
  const due = Date.now() + delay;
  if (service.processingScheduled && service.scheduledWakeAt <= due) return;
  service.cancelScheduledProcessing();
  service.processingScheduled = true;
  service.scheduledWakeAt = due;
  service.scheduledTimeout = setTimeout(() => {
    service.processingScheduled = false;
    service.scheduledTimeout = null;
    service.scheduledWakeAt = null;
    void service.triggerProcessing();
  }, delay);
  service.scheduledTimeout.unref?.();
}
