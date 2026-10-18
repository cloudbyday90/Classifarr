/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { soakProfile } from './soakProfile.mjs';

export const SOAK_PHASES = soakProfile().phases;

export function soakArrivals(profileName = 'regression') {
  const profile = soakProfile(profileName);
  const plan = [];
  for (let pair = 0; pair < profile.durationMs / 2000; pair++) {
    const at = pair * 2000, phase = profile.phases.find(item => at >= item.start && at < item.end).name;
    for (const [offset, installation] of [[0, 'first'], [50, 'second'], ...(pair % 5 === 0 ? [[100, 'background']] : [])]) {
      plan.push({ id: plan.length + 1, at: at + offset, phase, installation });
    }
  }
  return plan;
}

export function distribution(values, profileName = 'regression') {
  if (!Array.isArray(values) || values.length > soakProfile(profileName).sampleLimit || values.some(value => !Number.isFinite(value) || value < 0)) {
    throw new Error('soak_samples_invalid');
  }
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = p => sorted.length ? Number(sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)].toFixed(3)) : null;
  return { count: sorted.length, p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99), max: percentile(1) };
}

/** Open arrivals: completion never shifts later arrival times. No catch-up burst. */
export async function runSoakArrivals({ request, profileName = 'regression', plan = soakArrivals(profileName), now = () => performance.now(), sleep = delay }) {
  const profile = soakProfile(profileName);
  if (!Array.isArray(plan) || !plan.length || plan.length > profile.sampleLimit || plan.some((item, index) =>
    !Number.isFinite(item.at) || item.at < 0 || item.at > profile.durationMs || index > 0 && item.at < plan[index - 1].at)) {
    throw new Error('soak_plan_invalid');
  }
  const started = now(), active = new Set(), results = [];
  for (const arrival of plan) {
    const remaining = started + arrival.at - now();
    if (remaining > 0) await sleep(remaining);
    const latenessMs = Math.max(0, now() - started - arrival.at);
    if (latenessMs > 500 || active.size >= 4) {
      results.push({ ...arrival, outcome: 'dropped', latenessMs }); continue;
    }
    const sentAt = now();
    const pending = Promise.resolve().then(() => request(arrival)).then(
      status => ({ ...arrival, outcome: 'response', status, latenessMs, latencyMs: now() - sentAt }),
      () => ({ ...arrival, outcome: 'failed', latenessMs, latencyMs: now() - sentAt }),
    ).then(result => { results.push(result); active.delete(pending); });
    active.add(pending);
  }
  await Promise.all(active);
  return results.sort((a, b) => a.id - b.id);
}

export function summarizeSoak(results, observations, profileName = 'regression') {
  const profile = soakProfile(profileName), stats = values => distribution(values, profileName);
  if (results.length !== profile.offered || results.some((row, index) => row.id !== index + 1 || row.outcome !== 'response' ||
    row.status !== (row.installation === 'background' ? 429 : 200)) || observations.length !== profile.foreground ||
    new Set(observations.map(row => row.id)).size !== profile.foreground || observations.some(row =>
      !results.some(result => result.id === row.id && result.status === 200))) throw new Error('soak_accounting_failed');
  return profile.phases.map(phase => {
    const rows = results.filter(row => row.phase === phase.name), success = rows.filter(row => row.status === 200);
    const admitted = observations.filter(row => success.some(item => item.id === row.id));
    return { phase: phase.name, offered: rows.length, completed: success.length, busy: rows.length - success.length,
      latencyMs: stats(success.map(row => row.latencyMs)), busyLatencyMs: stats(rows.filter(row => row.status === 429).map(row => row.latencyMs)),
      latenessMs: stats(rows.map(row => row.latenessMs)), preClaimMs: stats(admitted.map(row => row.preClaimMs)),
      claimMs: stats(admitted.map(row => row.claimMs)) };
  });
}
