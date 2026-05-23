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
  ].includes(getParseFailureReason(parseResult));
}
