/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { withResourceStudyImage } from '../../../../scripts/lib/resourceStudyImage.mjs';

const imageId = `sha256:${'a'.repeat(64)}`;
function dockerFixture({ collision = false, buildFailure = false, cleanupFailure = false, changed = false } = {}) {
  let present = collision, inspections = 0;
  return jest.fn((_command, args, options) => {
    expect(options).toMatchObject({ shell: false, windowsHide: true });
    let stdout = '';
    if (args[0] === 'build') { if (buildFailure) return { status: 1, stdout: '' }; present = true; }
    if (args[1] === 'ls') stdout = present ? 'image' : '';
    if (args[1] === 'inspect') stdout = changed && ++inspections > 1 ? `sha256:${'b'.repeat(64)}` : imageId;
    if (args[1] === 'rm') { if (cleanupFailure) return { status: 1, stdout: '' }; present = false; }
    return { status: 0, stdout };
  });
}
const options = run => ({ run, random: size => Buffer.alloc(size, 4) });

test('builds once, passes immutable image identity and removes only its owned tag after work', async () => {
  const run = dockerFixture();
  expect(await withResourceStudyImage(async id => {
    expect(id).toBe(imageId);
    expect(run.mock.calls.some(([, args]) => args.includes('rm'))).toBe(false);
    return 'complete';
  }, options(run))).toBe('complete');
  expect(run.mock.calls.filter(([, args]) => args[0] === 'build')).toHaveLength(1);
  const removal = run.mock.calls.find(([, args]) => args[1] === 'rm')[1];
  expect(removal).toEqual(['image', 'rm', `classifarr-resource-image-${'04'.repeat(16)}`]);
  expect(run.mock.calls.some(([, args]) => args.includes('--force') || args.includes('prune'))).toBe(false);
});

test.each(['collision', 'buildFailure', 'cleanupFailure', 'changed'])('image lifetime fails closed: %s', async failure => {
  const run = dockerFixture({ [failure]: true }), work = jest.fn(async () => 'complete');
  await expect(withResourceStudyImage(work, options(run))).rejects.toThrow('resource_study_image_');
  if (['collision', 'buildFailure'].includes(failure)) expect(work).not.toHaveBeenCalled();
  if (['collision', 'changed'].includes(failure)) expect(run.mock.calls.some(([, args]) => args[1] === 'rm')).toBe(false);
});

test('failed scenario still releases the shared image', async () => {
  const run = dockerFixture();
  await expect(withResourceStudyImage(async () => { throw new Error('scenario_failed'); }, options(run))).rejects.toThrow('scenario_failed');
  expect(run.mock.calls.some(([, args]) => args[1] === 'rm')).toBe(true);
});

test('invalid owned identity cannot invoke Docker', async () => {
  const run = jest.fn();
  await expect(withResourceStudyImage(() => {}, { run, random: () => Buffer.from('invalid') })).rejects.toThrow('identity_invalid');
  expect(run).not.toHaveBeenCalled();
});
