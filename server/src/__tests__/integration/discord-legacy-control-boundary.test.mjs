/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterAll, beforeAll, beforeEach, expect, jest, test } from '@jest/globals';
import { EmbedBuilder } from 'discord.js';
import { createReadinessDatabase } from '../helpers/readinessDatabase.mjs';

let database;
let beforeWrite;
let source;
let destination;
const query = (...args) => database.query(...args);
const withTransaction = (...args) => {
  beforeWrite?.();
  return database.withTransaction(...args);
};
const routeToArr = jest.fn().mockResolvedValue({ attempted: true, routed: true });
jest.unstable_mockModule('../../config/database.mjs', () => ({ query, withTransaction, default: { query, withTransaction } }));
jest.unstable_mockModule('../../services/classificationRoutingService.mjs', () => ({ routeToArr }));
const { handleInteraction } = await import('../../services/discordInteractionHandler.mjs');

const messageId = '111111111111111111';
const changedMessageId = '222222222222222222';
beforeAll(async () => {
  database = createReadinessDatabase({ max: 5 });
  const { rows } = await query(`INSERT INTO libraries(name,external_id,media_type,is_active)
    VALUES ('Legacy saved library','legacy-saved','movie',true),('Legacy destination','legacy-target','movie',true)
    RETURNING id,name`);
  [source, destination] = rows;
});
beforeEach(() => { routeToArr.mockClear(); beforeWrite = undefined; });
afterAll(async () => { await database.pool.end(); });

function interaction(kind, id, savedMessage = messageId) {
  return {
    isButton: () => kind === 'button', isStringSelectMenu: () => kind === 'selector',
    customId: kind === 'button' ? `ai_clarify_${id}_0` : 'library_select',
    values: [`${id}_${destination.id}`],
    message: { id: savedMessage, components: [{ components: [{ customId: `ai_clarify_${id}_0`, label: 'Use saved library' }] }],
      embeds: [new EmbedBuilder().setTitle('Owned legacy control')] },
    user: { id: '333333333333333333', username: 'owned-operator' },
    deferUpdate: jest.fn(), editReply: jest.fn(), followUp: jest.fn(), reply: jest.fn(),
  };
}

async function insertHistory(id, savedMessage = messageId) {
  const title = `Owned legacy ${id}`;
  const metadata = { title, media_type: 'movie', tmdb_id: 894801 };
  await query(`INSERT INTO classification_history(id,title,tmdb_id,media_type,status,library_id,library_name,discord_message_id,metadata)
    VALUES($1,$2,894801,'movie','awaiting_decision',$3,$4,$5,$6::jsonb)`, [id, title, source.id, source.name, savedMessage, JSON.stringify(metadata)]);
}

const history = async id => (await query('SELECT * FROM classification_history WHERE id=$1', [id])).rows[0];
const corrections = async id => (await query(`SELECT classification_id,corrected_library_id
  FROM classification_corrections WHERE classification_id=$1`, [id])).rows;

test.each([['button', Number.MAX_SAFE_INTEGER], ['selector', Number.MAX_SAFE_INTEGER - 1]])(
  'a bound %s preserves the exact row and routes only once', async (kind, id) => {
    await insertHistory(id);
    const accepted = interaction(kind, id);
    await handleInteraction(accepted);
    expect(accepted.editReply).toHaveBeenCalledTimes(1);
    const saved = await history(id);
    const chosen = kind === 'button' ? source : destination;
    expect(saved).toMatchObject({ id, status: 'routed', library_id: chosen.id, discord_message_id: messageId });
    expect(await corrections(id)).toEqual(kind === 'button' ? [] : [{ classification_id: id, corrected_library_id: chosen.id }]);
    const replay = interaction(kind, id);
    await handleInteraction(replay);
    expect(replay.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Already processed') }));
    expect(await history(id)).toEqual(saved);
    expect(routeToArr).toHaveBeenCalledTimes(1);
  },
);

test.each([['button', 7101, null], ['selector', 7102, null],
  ['button', 7103, changedMessageId], ['selector', 7104, changedMessageId]])(
  'a %s on History ID %i refuses missing or foreign message evidence', async (kind, id, savedMessage) => {
    await insertHistory(id, savedMessage);
    const before = await history(id);
    const rejected = interaction(kind, id);
    await handleInteraction(rejected);
    expect(rejected.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Open Classifarr') }));
    expect(await history(id)).toEqual(before);
    expect(await corrections(id)).toEqual([]);
    expect(routeToArr).not.toHaveBeenCalled();
  },
);

test.each([
  ['button', 7111, 'discord_message_id=$2', changedMessageId, 'Open Classifarr'],
  ['selector', 7112, 'discord_message_id=$2', changedMessageId, 'Open Classifarr'],
  ['button', 7113, 'policy_question=$2::jsonb', '{"question":"New review"}', 'stale'],
  ['button', 7114, 'library_id=$2', () => destination.id, 'stale'],
])('a %s waiting to write row %i rechecks the locked state', async (kind, id, assignment, value, expected) => {
  await insertHistory(id);
  const blocked = await database.pool.connect();
  let handling;
  try {
    await blocked.query('BEGIN');
    await blocked.query(`UPDATE classification_history SET ${assignment} WHERE id=$1`, [id, typeof value === 'function' ? value() : value]);
    const enteringWrite = new Promise(resolve => { beforeWrite = resolve; });
    const rejected = interaction(kind, id);
    handling = handleInteraction(rejected);
    // A result before the writer enters the transaction also fails the assertion.
    await Promise.race([enteringWrite, handling.then(() => { throw new Error('expected locked write'); })]);
    await blocked.query('COMMIT');
    const changed = await history(id);
    await handling;
    expect(rejected.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining(expected) }));
    expect(changed.status).toBe('awaiting_decision');
    expect(await history(id)).toEqual(changed);
    expect(await corrections(id)).toEqual([]);
    expect(routeToArr).not.toHaveBeenCalled();
  } finally {
    beforeWrite = undefined;
    await blocked.query('ROLLBACK');
    blocked.release();
    await handling;
  }
});
