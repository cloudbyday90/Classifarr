/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createOmdbRecentLookup } from '../services/omdbRecentLookup.mjs';

const context = { source: 'omdb', id: 1, generation: '879a6b9f-f343-402d-834b-040739c6411b' };
const endpoint = 'https://www.omdbapi.com';
let recent, wall, mono;
beforeEach(() => {
    wall = Date.parse('2026-10-13T12:00:00Z'); mono = 100;
    recent = createOmdbRecentLookup({ clock: () => wall, monotonic: () => mono });
});
const seed = () => { const finish = recent.begin(context, endpoint); mono += 12; finish('success'); };

test('empty and restarted processes retain no evidence', () => {
    expect(recent.read(context)).toBeNull(); seed();
    expect(createOmdbRecentLookup().read(context)).toBeNull();
});
test('immutable metadata only; reads keep original timestamp and latency', () => {
    seed(); const result = recent.read(context);
    expect(result).toEqual({ id: 1, generation: context.generation, kind: 'success',
        lastCheck: '2026-10-13T12:00:00.000Z', responseTime: 12 });
    expect(Object.isFrozen(result)).toBe(true);
    wall += 10_000; mono += 10_000;
    expect(recent.read(context)).toBe(result);
});
test.each([0, 59_999, 60_000, 60_001, -1, NaN, Infinity])('monotonic age %s', age => {
    seed(); mono += age;
    expect(Boolean(recent.read(context))).toBe(Number.isFinite(age) && age >= 0 && age < 60_000);
});
test.each([0, 59_999, 60_000, -1, NaN, Infinity])('wall age %s', age => {
    seed(); wall += age;
    expect(Boolean(recent.read(context))).toBe(Number.isFinite(age) && age >= 0 && age < 60_000);
});
test.each([{}, null, { ...context, id: 2 }, { ...context, source: 'web_search' },
    { ...context, generation: 'invalid' }])('wrong read context %j is rejected', value => {
    seed(); expect(recent.read(value)).toBeNull();
});
test.each([{}, null, { ...context, id: -1 }, { ...context, source: 'web_search' },
    { ...context, generation: 'invalid' }])('wrong producer context %j cannot seed', value => {
    recent.begin(value, endpoint)('success'); expect(recent.read(context)).toBeNull();
});
test.each([undefined, 'http://www.omdbapi.com', 'https://www.omdbapi.com/evil',
    'https://www.omdbapi.com.evil', 'https://user@www.omdbapi.com', 'https://www.omdbapi.com?apikey=secret'])('endpoint %s cannot seed', value => {
    recent.begin(context, value)('success'); expect(recent.read(context)).toBeNull();
});
test.each(['success', 'not_found', 'unknown', 'authentication', 'invalid_response', undefined])('outcome %s', kind => {
    recent.begin(context, `${endpoint}/`)(kind);
    expect(Boolean(recent.read(context))).toBe(['success', 'not_found'].includes(kind));
});
test.each([['first', 'second'], ['second', 'first']])('overlap completing %s then %s cannot seed', (a, b) => {
    seed(); const tasks = { first: recent.begin(context, endpoint), second: recent.begin(context, endpoint) };
    expect(recent.read(context)).toBeNull(); tasks[a]('success'); tasks[b]('success');
    expect(recent.read(context)).toBeNull(); seed(); expect(recent.read(context)).not.toBeNull();
});
test('late success cannot undo a newer failure or queue pause', () => {
    const old = recent.begin(context, endpoint);
    recent.begin(context, endpoint)(); old('success');
    expect(recent.read(context)).toBeNull();
    const inflight = recent.begin(context, endpoint); recent.invalidate(); inflight('success');
    expect(recent.read(context)).toBeNull(); seed(); recent.invalidate(); expect(recent.read(context)).toBeNull();
});
test('new failed request invalidates previous success and completion is idempotent', () => {
    seed(); const failure = recent.begin(context, endpoint);
    expect(recent.read(context)).toBeNull(); failure(); failure('success');
    expect(recent.read(context)).toBeNull(); seed(); expect(recent.read(context)).not.toBeNull();
});
test.each([NaN, Infinity, -1])('invalid duration %s cannot seed', delta => {
    const finish = recent.begin(context, endpoint); mono += delta; finish('success');
    expect(recent.read(context)).toBeNull();
});
test.each([NaN, Infinity, 9e15])('invalid wall time %s cannot seed', value => {
    wall = value; seed(); expect(recent.read(context)).toBeNull();
});
test('UUID letter casing does not create another credential', () => {
    seed(); expect(recent.read({ ...context, generation: context.generation.toUpperCase() })).not.toBeNull();
});
