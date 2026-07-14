function normalizePositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

async function lockPolicyNativeIntentAuthority(client, { policyId, libraryId } = {}) {
  const normalizedPolicyId = normalizePositiveInteger(policyId);
  const normalizedLibraryId = normalizePositiveInteger(libraryId);

  if (!normalizedPolicyId || !normalizedLibraryId) {
    throw new TypeError('Native intent authority lock requires positive policyId and libraryId values.');
  }

  const result = await client.query(
    `SELECT id, library_id
     FROM library_policies
     WHERE id = $1
       AND library_id = $2
     FOR UPDATE`,
    [normalizedPolicyId, normalizedLibraryId]
  );

  return result.rows?.[0] || null;
}

export {
  lockPolicyNativeIntentAuthority,
};
