/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, jest } from '@jest/globals';
import { cleanupBudget, cleanupId, manifestIds, cleanupTarget } from '../scripts/inventoryCleanup/contract.mjs';
import { runInventoryCleanupPrototype } from '../scripts/runInventoryCleanupPrototype.mjs';

test.each([0, -1, 129, 1.5, '128', NaN])('rejects invalid cleanup budgets: %s', value => {
    expect(() => cleanupBudget(value)).toThrow();
});
test.each([null, [''], ['x\0y'], ['x'.repeat(101)], Array(129).fill('a'), [5]])('rejects invalid manifest batches: %j', value => {
    expect(() => manifestIds(value)).toThrow();
});
test('deduplicates manifest identities without coercion and supports a complete empty manifest', () => {
    expect(manifestIds(['a', 'a', 'b'])).toEqual(['a', 'b']); expect(manifestIds([])).toEqual([]);
    expect(manifestIds(['🎥'.repeat(100)])).toHaveLength(1);
});
test('rejects arbitrary kinds, identifiers and job tokens', () => {
    expect(() => cleanupTarget('restore', 1)).toThrow(); expect(() => cleanupTarget('server', '1')).toThrow();
    expect(() => cleanupId('1;DELETE')).toThrow();
});
test('the benchmark refuses connection/production arguments before starting Docker', async () => {
    const start = jest.fn();
    await expect(runInventoryCleanupPrototype({ argv: ['--database', 'production'], start })).rejects.toThrow('no arguments');
    expect(start).not.toHaveBeenCalled();
});
