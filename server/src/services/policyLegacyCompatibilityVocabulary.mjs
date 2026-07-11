import {
  AUTHORITY_SOURCE_IDS,
} from './policyAuthorityVocabulary.mjs';

const LEGACY_COMPATIBILITY_TERM_IDS = Object.freeze({
  STARTER_TEMPLATE: 'starter_template',
  LEGACY_PRESET_RECORD: 'legacy_preset_record',
  COMPATIBILITY_BRIDGE: 'compatibility_bridge',
  CUSTOM_SIGNAL_PAYLOAD: 'custom_signal_payload',
  INTENT_DRAFT: 'intent_draft',
  ROLLBACK_SNAPSHOT: 'rollback_snapshot',
  NATIVE_INTENT_STORAGE: 'native_intent_storage',
});

const LEGACY_COMPATIBILITY_AUDIENCE = Object.freeze({
  PRODUCT: 'product',
  SUPPORT: 'support',
  INTERNAL: 'internal',
  MIGRATION: 'migration',
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  Object.values(value).forEach(item => {
    deepFreeze(item);
  });

  return value;
}

const LEGACY_COMPATIBILITY_TERMS = deepFreeze([
  {
    id: LEGACY_COMPATIBILITY_TERM_IDS.STARTER_TEMPLATE,
    productLabel: 'Starter Template',
    internalTerms: ['preset', 'content preset', 'policy preset'],
    audience: LEGACY_COMPATIBILITY_AUDIENCE.PRODUCT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.LEGACY_TEMPLATE,
    meaning: 'A reusable shortcut that can seed editable policy intent.',
    allowedProductUse: [
      'Show that a template helped fill an intent draft.',
      'Let the operator apply or remove the template intentionally.',
      'Explain template provenance without making the template the policy authority.',
    ],
    prohibitedProductUse: [
      'Describe the template as the final policy model.',
      'Expose raw preset JSON or custom signal payloads in normal setup.',
      'Hide observed library evidence behind template details.',
    ],
    permanentModel: false,
  },
  {
    id: LEGACY_COMPATIBILITY_TERM_IDS.LEGACY_PRESET_RECORD,
    productLabel: 'Legacy policy record',
    internalTerms: ['content_presets', 'policy_presets', 'preset attachment'],
    audience: LEGACY_COMPATIBILITY_AUDIENCE.INTERNAL,
    authoritySourceId: AUTHORITY_SOURCE_IDS.LEGACY_TEMPLATE,
    meaning: 'Existing database-backed preset data that must remain readable until native conversion is complete.',
    allowedProductUse: [
      'Appear in support or migration details when behavior comes from existing storage.',
      'Preserve existing policies during compatibility reads and writes.',
    ],
    prohibitedProductUse: [
      'Become a normal operator-facing policy concept.',
      'Be presented as the future durable model.',
    ],
    permanentModel: false,
  },
  {
    id: LEGACY_COMPATIBILITY_TERM_IDS.COMPATIBILITY_BRIDGE,
    productLabel: 'Compatibility bridge',
    internalTerms: ['legacy-compatible save path', 'preset bridge', 'draft bridge'],
    audience: LEGACY_COMPATIBILITY_AUDIENCE.SUPPORT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.LEGACY_TEMPLATE,
    meaning: 'A bounded adapter that preserves existing behavior while drafts and native intent contracts are introduced.',
    allowedProductUse: [
      'Explain why an existing policy still saves through the legacy-compatible path.',
      'Protect round-trip behavior for unconverted policies.',
      'Carry deletion criteria for bridge-only code.',
    ],
    prohibitedProductUse: [
      'Create new policy semantics.',
      'Bypass server validation.',
      'Remain after native intent parity and deletion gates pass.',
    ],
    permanentModel: false,
  },
  {
    id: LEGACY_COMPATIBILITY_TERM_IDS.CUSTOM_SIGNAL_PAYLOAD,
    productLabel: 'Compatibility payload',
    internalTerms: ['customSignals', 'custom_signals'],
    audience: LEGACY_COMPATIBILITY_AUDIENCE.INTERNAL,
    authoritySourceId: AUTHORITY_SOURCE_IDS.LEGACY_TEMPLATE,
    meaning: 'The existing structured override payload used to preserve legacy preset-backed behavior.',
    allowedProductUse: [
      'Remain in API, storage, tests, and migration documentation.',
      'Round-trip unchanged fields for unconverted policies.',
    ],
    prohibitedProductUse: [
      'Appear as normal product copy.',
      'Be directly edited by product components.',
      'Authorize behavior outside the compatibility bridge.',
    ],
    permanentModel: false,
  },
  {
    id: LEGACY_COMPATIBILITY_TERM_IDS.INTENT_DRAFT,
    productLabel: 'Intent draft',
    internalTerms: ['native intent draft', 'draft sidecar'],
    audience: LEGACY_COMPATIBILITY_AUDIENCE.PRODUCT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    meaning: 'An editable projection of declared intent before durable native storage owns the policy.',
    allowedProductUse: [
      'Describe unsaved or compatibility-saved operator intent.',
      'Feed server validation before persistence.',
      'Serialize through the compatibility bridge when native storage is not active.',
    ],
    prohibitedProductUse: [
      'Claim that native intent storage is active when it is not.',
      'Skip compatibility preservation for existing policies.',
    ],
    permanentModel: false,
  },
  {
    id: LEGACY_COMPATIBILITY_TERM_IDS.ROLLBACK_SNAPSHOT,
    productLabel: 'Rollback snapshot',
    internalTerms: ['legacy backup', 'conversion snapshot', 'migration snapshot'],
    audience: LEGACY_COMPATIBILITY_AUDIENCE.MIGRATION,
    authoritySourceId: AUTHORITY_SOURCE_IDS.LEGACY_TEMPLATE,
    meaning: 'A bounded safety record captured before conversion so a policy can be reverted during the rollback window.',
    allowedProductUse: [
      'Support explicit conversion reversal during the retention window.',
      'Preserve prior preset attachments, weights, thresholds, and compatibility payloads for recovery.',
      'Appear in migration and support flows.',
    ],
    prohibitedProductUse: [
      'Become a parallel editable policy model.',
      'Be described as an archive of the old product experience.',
      'Remain unbounded after deletion gates pass.',
    ],
    permanentModel: false,
  },
  {
    id: LEGACY_COMPATIBILITY_TERM_IDS.NATIVE_INTENT_STORAGE,
    productLabel: 'Native intent storage',
    internalTerms: ['policy intent tables', 'converted policy'],
    audience: LEGACY_COMPATIBILITY_AUDIENCE.PRODUCT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    meaning: 'The future durable policy model after explicit conversion, validation, backup, and rollback proof.',
    allowedProductUse: [
      'Describe policies after explicit policy conversion.',
      'Serve as the runtime read path after conversion gates pass.',
    ],
    prohibitedProductUse: [
      'Be implied for unconverted legacy policies.',
      'Be created by ordinary read or unrelated save operations.',
      'Bypass conversion reports, validation, or rollback safety.',
    ],
    permanentModel: true,
  },
]);

const PRODUCT_ALLOWED_LEGACY_TERM_IDS = Object.freeze([
  LEGACY_COMPATIBILITY_TERM_IDS.STARTER_TEMPLATE,
  LEGACY_COMPATIBILITY_TERM_IDS.INTENT_DRAFT,
  LEGACY_COMPATIBILITY_TERM_IDS.NATIVE_INTENT_STORAGE,
]);

function listLegacyCompatibilityTerms() {
  return LEGACY_COMPATIBILITY_TERMS;
}

function getLegacyCompatibilityTerm(termId) {
  return LEGACY_COMPATIBILITY_TERMS.find(term => term.id === termId) || null;
}

function listProductAllowedLegacyTermIds() {
  return PRODUCT_ALLOWED_LEGACY_TERM_IDS;
}

function isProductAllowedLegacyTerm(termId) {
  return PRODUCT_ALLOWED_LEGACY_TERM_IDS.includes(termId);
}

function isPermanentLegacyCompatibilityModel(termId) {
  return Boolean(getLegacyCompatibilityTerm(termId)?.permanentModel);
}

function findLegacyTermsForInternalName(internalName) {
  const normalizedName = String(internalName || '').toLowerCase();

  if (!normalizedName) {
    return [];
  }

  return LEGACY_COMPATIBILITY_TERMS.filter(term => term.internalTerms
    .some(internalTerm => internalTerm.toLowerCase() === normalizedName));
}

function shouldExposeLegacyInternalNameToProduct(internalName) {
  return findLegacyTermsForInternalName(internalName)
    .some(term => isProductAllowedLegacyTerm(term.id));
}

export {
  LEGACY_COMPATIBILITY_AUDIENCE,
  LEGACY_COMPATIBILITY_TERM_IDS,
  findLegacyTermsForInternalName,
  getLegacyCompatibilityTerm,
  isPermanentLegacyCompatibilityModel,
  isProductAllowedLegacyTerm,
  listLegacyCompatibilityTerms,
  listProductAllowedLegacyTermIds,
  shouldExposeLegacyInternalNameToProduct,
};
