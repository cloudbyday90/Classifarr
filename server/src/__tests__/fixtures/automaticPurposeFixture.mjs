/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { purposeCohortInput } from './purposeOutcomeFixture.mjs';
import { buildPurposeEvaluationReport } from '../../services/purposeEvaluationProjection.mjs';
export const purposeEvaluationSnapshot = (rows = []) => {
  const inputs = purposeCohortInput(rows); return { observedAt: inputs.observedAt, inputs };
};
export const purposeEvaluationReport = (rows = []) => buildPurposeEvaluationReport(purposeCohortInput(rows));
