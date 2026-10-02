/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createPgvectorReplayContainer } from '../scripts/pgvectorReplayContainer.mjs';

function fixture(result) {
    const source = { exec: jest.fn().mockResolvedValue(result), stop: jest.fn() };
    const target = { withCopyContentToContainer: jest.fn().mockReturnThis() };
    const Container = jest.fn(function (image) {
        return image.includes('0.8.6') ? { start: async () => source } : target;
    });
    return { source, target, Container };
}

test('uses the old pinned SQL with the new binary and stops its source container', async () => {
    const setup = fixture({ exitCode: 0, output: 'CREATE TYPE vector;' });
    expect(await createPgvectorReplayContainer(setup)).toBe(setup.target);
    expect(setup.source.stop).toHaveBeenCalledTimes(1);
    expect(setup.target.withCopyContentToContainer).toHaveBeenCalledWith([{
        content: 'CREATE TYPE vector;', target: '/usr/share/postgresql/18/extension/vector--0.8.6.sql',
    }]);
    expect(setup.Container.mock.calls.map(([image]) => image)).toEqual([
        'pgvector/pgvector:0.8.6-pg18', 'pgvector/pgvector:0.8.7-pg18',
    ]);
});

test.each([{ exitCode: 1, output: 'error' }, { exitCode: 0, output: '' }])(
    'cleans up and rejects an unavailable historical script', async result => {
        const setup = fixture(result);
        await expect(createPgvectorReplayContainer(setup)).rejects.toThrow('installation script');
        expect(setup.source.stop).toHaveBeenCalledTimes(1);
        expect(setup.Container).toHaveBeenCalledTimes(1);
    },
);

test('cleans up a source read failure', async () => {
    const setup = fixture({});
    setup.source.exec.mockRejectedValue(new Error('read failed'));
    await expect(createPgvectorReplayContainer(setup)).rejects.toThrow('read failed');
    expect(setup.source.stop).toHaveBeenCalledTimes(1);
});
