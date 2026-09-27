/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect, beforeEach } from '@jest/globals';
import { resolve, join } from 'node:path';
const originalFs = await import('node:fs/promises');
const mkdir = jest.fn(), realpath = jest.fn(), mkdtemp = jest.fn();
jest.unstable_mockModule('node:fs/promises', () => ({ ...originalFs, mkdir, realpath, mkdtemp }));
const { createPrivateStudyDirectory, PRIVATE_STUDY_ROOT } = await import('../../scripts/privateStudyFileBoundary.mjs');
beforeEach(() => {
  mkdir.mockReset().mockResolvedValue(undefined);
  realpath.mockReset().mockImplementation(async path => path);
  mkdtemp.mockReset().mockResolvedValue(join(PRIVATE_STUDY_ROOT, '.tmp', 'frozen-policy-owned'));
});

test('creates a unique directory only after checking the canonical private root', async () => {
  await expect(createPrivateStudyDirectory('frozen-policy-')).resolves.toBe(join(PRIVATE_STUDY_ROOT, '.tmp', 'frozen-policy-owned'));
  expect(mkdir).toHaveBeenCalledWith(join(PRIVATE_STUDY_ROOT, '.tmp'), { recursive: true });
  expect(realpath.mock.calls).toEqual([[PRIVATE_STUDY_ROOT], [join(PRIVATE_STUDY_ROOT, '.tmp')]]);
  expect(mkdtemp).toHaveBeenCalledWith(join(PRIVATE_STUDY_ROOT, '.tmp', 'frozen-policy-'));
  expect(mkdtemp.mock.invocationCallOrder[0]).toBeGreaterThan(realpath.mock.invocationCallOrder[1]);
});

test.each(['../outside', '.tmp/nested', '.tmp-sibling'])('refuses a redirected temporary root: %s', async redirected => {
  realpath.mockImplementation(async path => path === PRIVATE_STUDY_ROOT ? path : resolve(PRIVATE_STUDY_ROOT, redirected));
  await expect(createPrivateStudyDirectory('frozen-policy-')).rejects.toThrow('private_study_tmp_boundary_invalid');
  expect(mkdtemp).not.toHaveBeenCalled();
});

test('cannot create an evidence directory when root verification fails', async () => {
  realpath.mockRejectedValue(Object.assign(new Error('denied'), { code: 'EACCES' }));
  await expect(createPrivateStudyDirectory('frozen-policy-')).rejects.toMatchObject({ code: 'EACCES' });
  expect(mkdtemp).not.toHaveBeenCalled();
});
