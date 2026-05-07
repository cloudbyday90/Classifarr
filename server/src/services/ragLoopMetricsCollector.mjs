/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function toNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function parseTimestampMs(value) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSemverTriplet(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const match = value.trim().toLowerCase().replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function isVersionNewer(currentVersion, previousVersion) {
  if (
    typeof currentVersion !== 'string' ||
    typeof previousVersion !== 'string' ||
    !currentVersion ||
    !previousVersion ||
    currentVersion === previousVersion
  ) {
    return false;
  }

  const current = parseSemverTriplet(currentVersion);
  const previous = parseSemverTriplet(previousVersion);
  if (!current || !previous) {
    return false;
  }

  if (current.major !== previous.major) {
    return current.major > previous.major;
  }
  if (current.minor !== previous.minor) {
    return current.minor > previous.minor;
  }
  return current.patch > previous.patch;
}

class RagLoopMetricsCollector {
  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      shadowSamples: 0,
      shadowWouldUpgrade: 0,
      applySamples: 0,
      applyUpgrades: 0,
      stageErrors: 0,
      shadowStageErrors: 0,
      applyStageErrors: 0,
      latencyDeltas: [],
      shadowLatencyDeltas: [],
      applyLatencyDeltas: [],
      updatedAt: null,
    };
  }

  recordEvaluation({
    rolloutMode = 'shadow',
    wouldUpgrade = false,
    adopted = false,
    hadError = false,
    latencyDeltaMs = 0,
  } = {}) {
    if (rolloutMode === 'shadow') {
      this.state.shadowSamples += 1;
      if (wouldUpgrade) {
        this.state.shadowWouldUpgrade += 1;
      }
      if (hadError) {
        this.state.shadowStageErrors += 1;
      }
    } else {
      this.state.applySamples += 1;
      if (adopted) {
        this.state.applyUpgrades += 1;
      }
      if (hadError) {
        this.state.applyStageErrors += 1;
      }
    }

    if (hadError) {
      this.state.stageErrors += 1;
    }

    const delta = Number(latencyDeltaMs);
    if (Number.isFinite(delta)) {
      this.state.latencyDeltas.push(delta);
      if (rolloutMode === 'shadow') {
        this.state.shadowLatencyDeltas.push(delta);
      } else {
        this.state.applyLatencyDeltas.push(delta);
      }
      if (this.state.latencyDeltas.length > 2000) {
        this.state.latencyDeltas = this.state.latencyDeltas.slice(this.state.latencyDeltas.length - 2000);
      }
      if (this.state.shadowLatencyDeltas.length > 2000) {
        this.state.shadowLatencyDeltas = this.state.shadowLatencyDeltas.slice(this.state.shadowLatencyDeltas.length - 2000);
      }
      if (this.state.applyLatencyDeltas.length > 2000) {
        this.state.applyLatencyDeltas = this.state.applyLatencyDeltas.slice(this.state.applyLatencyDeltas.length - 2000);
      }
    }

    this.state.updatedAt = new Date().toISOString();
  }

  getSnapshot() {
    const totalSamples = this.state.shadowSamples + this.state.applySamples;
    const shadowCorrectionDelta = this.state.shadowSamples > 0
      ? this.state.shadowWouldUpgrade / this.state.shadowSamples
      : 0;
    const applyErrorRateDelta = this.state.applySamples > 0
      ? this.state.applyStageErrors / this.state.applySamples
      : 0;
    const shadowErrorRateDelta = this.state.shadowSamples > 0
      ? this.state.shadowStageErrors / this.state.shadowSamples
      : 0;
    const errorRateDelta = totalSamples > 0
      ? this.state.stageErrors / totalSamples
      : 0;

    return {
      shadow_sample_count: this.state.shadowSamples,
      correction_delta: shadowCorrectionDelta,
      error_rate_delta: errorRateDelta,
      p95_latency_delta_ms: percentile(this.state.latencyDeltas, 95),
      shadow_error_rate_delta: shadowErrorRateDelta,
      shadow_p95_latency_delta_ms: percentile(this.state.shadowLatencyDeltas, 95),
      apply_sample_count: this.state.applySamples,
      apply_upgrade_count: this.state.applyUpgrades,
      apply_error_rate_delta: applyErrorRateDelta,
      apply_p95_latency_delta_ms: percentile(this.state.applyLatencyDeltas, 95),
      updated_at: this.state.updatedAt,
    };
  }

  resolveAutoFallbackThresholds(config = {}) {
    return {
      minApplySamples: Math.max(1, toNumber(config.rag_loop_auto_fallback_min_apply_samples, 25)),
      consecutiveBreaches: Math.max(1, toNumber(config.rag_loop_auto_fallback_consecutive_breaches, 3)),
      cooldownMs: Math.max(0, toNumber(config.rag_loop_auto_fallback_cooldown_ms, 900000)),
      maxErrorRateDelta: Math.max(0, Math.min(1, toNumber(config.rag_loop_shadow_max_error_rate_delta, 0.01))),
      maxP95LatencyDeltaMs: Math.max(0, toNumber(config.rag_loop_shadow_max_p95_latency_delta_ms, 250)),
    };
  }

  evaluateAutoFallback({
    config = {},
    state = {},
    nowMs = Date.now(),
    metrics = null,
  } = {}) {
    const snapshot = metrics || this.getSnapshot();
    const thresholds = this.resolveAutoFallbackThresholds(config);
    const autoFallbackEnabled = config.rag_loop_auto_fallback_enabled !== false;
    const breachCount = Math.max(0, Math.trunc(toNumber(state.breachCount, 0)));
    const cooldownUntilMs = parseTimestampMs(state.cooldownUntil);
    const inCooldown = cooldownUntilMs !== null && nowMs < cooldownUntilMs;
    const minSamplesReached = snapshot.apply_sample_count >= thresholds.minApplySamples;

    const breachReasonCodes = [];
    if (snapshot.apply_error_rate_delta > thresholds.maxErrorRateDelta) {
      breachReasonCodes.push('error_rate_delta_exceeded');
    }
    if (snapshot.apply_p95_latency_delta_ms > thresholds.maxP95LatencyDeltaMs) {
      breachReasonCodes.push('p95_latency_delta_exceeded');
    }

    const breachDetected = breachReasonCodes.length > 0 && minSamplesReached;
    let nextBreachCount = breachCount;
    if (!autoFallbackEnabled) {
      nextBreachCount = 0;
    } else if (breachDetected && !inCooldown) {
      nextBreachCount = breachCount + 1;
    } else if (!breachDetected) {
      nextBreachCount = 0;
    }

    const shouldFallback = autoFallbackEnabled &&
      breachDetected &&
      !inCooldown &&
      nextBreachCount >= thresholds.consecutiveBreaches;

    return {
      autoFallbackEnabled,
      inCooldown,
      minSamplesReached,
      breachDetected,
      breachReasonCodes,
      nextBreachCount,
      shouldFallback,
      shouldPersistBreachCount: nextBreachCount !== breachCount,
      thresholds: {
        min_apply_samples: thresholds.minApplySamples,
        consecutive_breaches: thresholds.consecutiveBreaches,
        cooldown_ms: thresholds.cooldownMs,
        max_error_rate_delta: thresholds.maxErrorRateDelta,
        max_p95_latency_delta_ms: thresholds.maxP95LatencyDeltaMs,
      },
      observedMetrics: {
        apply_sample_count: snapshot.apply_sample_count,
        apply_error_rate_delta: snapshot.apply_error_rate_delta,
        apply_p95_latency_delta_ms: snapshot.apply_p95_latency_delta_ms,
        breach_count_before: breachCount,
        breach_count_after: nextBreachCount,
      },
    };
  }

  shouldAttemptAutoRecover({
    config = {},
    state = {},
    currentVersion = null,
    rolloutMode = 'shadow',
  } = {}) {
    if (rolloutMode !== 'shadow' || config.rag_loop_auto_recover_enabled !== true) {
      return { shouldRecover: false, reason: 'disabled_or_not_shadow' };
    }

    const fallbackVersion = typeof state.lastFallbackVersion === 'string'
      ? state.lastFallbackVersion
      : null;
    if (!fallbackVersion) {
      return { shouldRecover: false, reason: 'no_fallback_version' };
    }

    if (!isVersionNewer(currentVersion, fallbackVersion)) {
      return { shouldRecover: false, reason: 'version_not_newer' };
    }

    if (
      typeof state.lastRecoverAttemptVersion === 'string' &&
      state.lastRecoverAttemptVersion === currentVersion
    ) {
      return { shouldRecover: false, reason: 'already_attempted_this_version' };
    }

    return { shouldRecover: true, reason: 'version_bump_detected' };
  }

  canPromote(config = {}) {
    const snapshot = this.getSnapshot();
    const minSamples = Number.isFinite(Number(config.rag_loop_shadow_min_samples))
      ? Number(config.rag_loop_shadow_min_samples)
      : 200;
    const maxErrorRateDelta = Number.isFinite(Number(config.rag_loop_shadow_max_error_rate_delta))
      ? Number(config.rag_loop_shadow_max_error_rate_delta)
      : 0.01;
    const maxP95LatencyDeltaMs = Number.isFinite(Number(config.rag_loop_shadow_max_p95_latency_delta_ms))
      ? Number(config.rag_loop_shadow_max_p95_latency_delta_ms)
      : 250;

    return {
      ready: (
        snapshot.shadow_sample_count >= minSamples &&
        snapshot.error_rate_delta <= maxErrorRateDelta &&
        snapshot.p95_latency_delta_ms <= maxP95LatencyDeltaMs
      ),
      metrics: snapshot,
    };
  }
}

export const ragLoopMetricsCollector = new RagLoopMetricsCollector();
