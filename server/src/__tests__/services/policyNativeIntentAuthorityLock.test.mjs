import { jest } from '@jest/globals';
import { lockPolicyNativeIntentAuthority } from '../../services/policyNativeIntentAuthorityLock.mjs';

describe('policyNativeIntentAuthorityLock', () => {
  test('locks the exact policy-library authority row', async () => {
    const client = { query: jest.fn(async () => ({ rows: [{ id: 4, library_id: 2 }] })) };

    await expect(lockPolicyNativeIntentAuthority(client, { policyId: 4, libraryId: 2 }))
      .resolves.toEqual({ id: 4, library_id: 2 });
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('FOR UPDATE'), [4, 2]);
  });

  test('rejects invalid ownership inputs before querying', async () => {
    const client = { query: jest.fn() };

    await expect(lockPolicyNativeIntentAuthority(client, { policyId: 0, libraryId: 2 }))
      .rejects.toThrow('positive policyId and libraryId');
    expect(client.query).not.toHaveBeenCalled();
  });
});
