/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const prefix = 'RESOURCE_STUDY_BUDGET ';
const fields = ['version', 'limitBytes', 'cpuQuotaUsec', 'cpuPeriodUsec', 'pidsLimit', 'pidsLimitHits'];

/** Fixed labels and numeric limits only; never serialize an error or container config. */
export function studyBudgetDiagnostic(metrics, budget) {
  if (!['baseline', 'bounded', 'stress'].includes(budget)) return null;
  return { budget, ...Object.fromEntries(fields.map(key =>
    [key, Number.isSafeInteger(metrics?.[key]) ? metrics[key] : null])) };
}

export function formatStudyBudgetDiagnostic(value) {
  const safe = studyBudgetDiagnostic(value, value?.budget);
  return safe ? `${prefix}${JSON.stringify(safe)}` : null;
}

/** The host reconstructs its own allowlist instead of forwarding subprocess text. */
export function parseStudyBudgetDiagnostic(line) {
  if (typeof line !== 'string' || line.length > 1024 || !line.startsWith(prefix)) return null;
  try {
    const value = JSON.parse(line.slice(prefix.length));
    return formatStudyBudgetDiagnostic(value);
  } catch { return null; }
}
