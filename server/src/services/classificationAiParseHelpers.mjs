export function getParseFailureReason(parseResult) {
  if (!parseResult || typeof parseResult !== 'object') {
    return null;
  }

  if (typeof parseResult.parse_failure_reason === 'string' && parseResult.parse_failure_reason.trim()) {
    return parseResult.parse_failure_reason.trim();
  }

  const meta = parseResult.policy_question?.meta || parseResult.clarification?.meta || null;
  if (meta && typeof meta.violation_reason === 'string' && meta.violation_reason.trim()) {
    return meta.violation_reason.trim();
  }

  return null;
}

export function isRepairEligibleParseResult(parseResult, mode) {
  if (!parseResult || typeof parseResult !== 'object') {
    return false;
  }

  if (parseResult.format === 'fallback') {
    return true;
  }

  if (mode !== 'classify' || parseResult.format !== 'contract_violation') {
    return false;
  }

  return [
    'narrative_no_format_match',
    'no_format_matched',
    'single_valid_option',
    'no_valid_options',
    'validation_failed',
  ].includes(getParseFailureReason(parseResult));
}

export function getValidationError(parseResult) {
  if (!parseResult || typeof parseResult !== 'object') {
    return null;
  }

  if (typeof parseResult.validation_errors === 'string' && parseResult.validation_errors.trim()) {
    return parseResult.validation_errors.trim();
  }

  const meta = parseResult.policy_question?.meta || parseResult.clarification?.meta || null;
  if (meta && typeof meta.validation_errors === 'string' && meta.validation_errors.trim()) {
    return meta.validation_errors.trim();
  }

  return null;
}
