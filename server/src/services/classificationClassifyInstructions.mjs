/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/** Static guidance only; supplied evidence and external authorization stay separate. */
export function buildClassificationClassifyInstructions() {
  return `\n\nIMPORTANT FOR CLARIFICATION:
- The problem_summary should be SHORT (max 50 chars)
- The why_uncertain should explain WHAT DATA conflicts and WHY you can't decide
- The question should be SPECIFIC and help the user understand what choosing each option means
- Always provide 2-3 clear options (not just yes/no when possible)

CRITICAL - DO NOT HALLUCINATE CONFLICTS:
- Only mention libraries that have ACTUAL signal support (genres, keywords, patterns matching that library)
- A content rating describes the item; it does not by itself establish a destination or a library's rules. Use ratings only with library-specific support actually present in the supplied evidence; do not invent rating requirements or exclusions.
- Do not infer a library's purpose, audience or restrictions from its name. Treat missing evidence as unknown, and observed profiles or past placements as observations rather than declared policy.
- If signals clearly point to one library with no real conflict, use CONFIDENT format, not CLARIFY
- In classify mode, NEVER use CONFIRM format
- Only use CLARIFY when there are genuinely conflicting signals pointing to different libraries

Respond with ONLY one of the formats above.`;
}
