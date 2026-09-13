/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { installRepresentativeShadow, rememberRepresentativeQuery, observeRepresentativeDecision,
  readRepresentativeShadow } from '../../services/inventoryRepresentativeShadowRuntime.mjs';

test('registry replacement is owner-bound and unavailable diagnostics never affect callers', () => {
  expect(readRepresentativeShadow()).toBeNull();
  rememberRepresentativeQuery({}, {}); observeRepresentativeDecision({});
  const first = installRepresentativeShadow({ read: () => ({ pending: 1 }) });
  const remember = jest.fn(), observe = jest.fn();
  const second = installRepresentativeShadow({ remember, observe, read: () => ({ pending: 2 }) });
  first();
  expect(readRepresentativeShadow()).toEqual({ pending: 2 });
  const metadata = {}, query = {}, decision = {};
  rememberRepresentativeQuery(metadata, query); observeRepresentativeDecision(decision);
  expect(remember).toHaveBeenCalledWith(metadata, query);
  expect(observe).toHaveBeenCalledWith(decision);
  second(); expect(readRepresentativeShadow()).toBeNull();
  const fail = () => { throw new Error('private'); };
  const disconnect = installRepresentativeShadow({ remember: fail, observe: fail, read: fail });
  expect(() => rememberRepresentativeQuery(metadata, query)).not.toThrow();
  expect(() => observeRepresentativeDecision(decision)).not.toThrow();
  expect(readRepresentativeShadow()).toBeNull(); disconnect();
});
