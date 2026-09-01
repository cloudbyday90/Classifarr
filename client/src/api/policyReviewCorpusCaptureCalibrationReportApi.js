/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { getDataRequest } from './core'

const REVIEW_CORPUS_CAPTURE_CALIBRATION_REPORT_PATH =
  '/policies/candidate-correction/review-corpus/captured-outcomes/calibration-report'

/** Reads one fixed aggregate-only calibration report with no request filters. */
export function getPolicyCandidateCorrectionReviewCorpusCaptureCalibrationReport() {
  return getDataRequest(REVIEW_CORPUS_CAPTURE_CALIBRATION_REPORT_PATH)
}

const policyReviewCorpusCaptureCalibrationReportApi = {
  getPolicyCandidateCorrectionReviewCorpusCaptureCalibrationReport,
}

export default policyReviewCorpusCaptureCalibrationReportApi
