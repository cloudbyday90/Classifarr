/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */
import { supportsNativePurposeDeclaration, supportsNativePurposeCommands } from '../../services/nativePurposeDeclarationCapability.mjs';
import { buildInitialPolicyIntentContract } from '../../services/policyInitialIntentEstablishmentContract.mjs';

const rule = (signal_type, operator, semantics) => ({ signal_type, operator, semantics,
  values: { [operator]: ['custom-token'] }, source: 'native_intent', intent_role: 'purpose' });

describe('fresh purpose capability reuses canonical scoring semantics', () => {
  test.each(['genres', 'keywords', 'studios', 'media_type'].flatMap(signal =>
    ['require_any', 'require_all', 'include', 'prefer'].flatMap(operator =>
      ['identity', 'compatibility'].map(semantics => [signal, operator, semantics]))))(
    '%s / %s / %s is supported', (signal, operator, semantics) => {
      expect(supportsNativePurposeDeclaration([rule(signal, operator, semantics)])).toBe(true);
    });
  test.each([
    rule('genres', 'exclude', 'identity'),
    { ...rule('genres', 'include', 'identity'), values: { require_any: ['custom-token'] } },
    { ...rule('genres', 'include', 'identity'), values: { include: ['custom-token'], exclude: ['other'] } },
    rule('genres', 'max', 'identity'), rule('runtime', 'include', 'identity'),
    rule('genres', 'include', null),
    { ...rule('genres', 'include', 'identity'), source: 'media_server_library_profile' },
  ])('rejects unsupported materialized declarations without discarding safe siblings: %j', invalid => {
    expect(supportsNativePurposeDeclaration([rule('genres', 'include', 'identity'), invalid])).toBe(false);
  });
  test('uses update defaults but never checks copied purpose for unrelated edits', () => {
    expect(supportsNativePurposeCommands([{ commandId: 'update_purpose', values: [{
      signal_type: 'genres', operator: 'include', values: { include: ['custom-token'] },
    }] }])).toBe(true);
    expect(supportsNativePurposeCommands([{ command_id: 'update_review_triggers', values: [{}] }])).toBe(true);
    expect(supportsNativePurposeCommands([{ command_id: 'update_purpose', values: [{}] }])).toBe(false);
  });
  test.each([undefined, null, 'compatibility', 'identity'])('preserves explicit initial %s with identity only as the nullish default', semantics => {
    const contract = buildInitialPolicyIntentContract({ declaredIntent: {
      purpose: [{ signal_type: 'genres', operator: 'include', semantics, values: { include: ['custom-token'] } }],
    } });
    expect(contract.purpose[0].semantics).toBe(semantics ?? 'identity');
    expect(supportsNativePurposeDeclaration(contract.purpose)).toBe(true);
  });
});
