/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { EmbedBuilder } from 'discord.js';
import { formatDeliveryMarker, getDeliveryProof, readDeliveryMarker } from '../services/discordDeliveryMarker.mjs';
import { prepareDeliveryPayload, setDeliveryFooter } from '../services/discordDeliveryPayload.mjs';

const nonce = 'cf_abcdefghijklmnopqrstuv';
const marker = formatDeliveryMarker('91', nonce);
const botUserId = '111111111111111111';
const event = () => ({ id: '333333333333333333', channelId: '222222222222222222',
  author: { id: botUserId, bot: true }, type: 0, embeds: [{ footer: { text: `Ready\n${marker}` } }] });

test('persistent marker gives exact string IDs and version, without a transient nonce', () => {
  expect(getDeliveryProof(event(), botUserId)).toEqual({ nonce, classificationId: '91', correlationVersion: 1,
    botUserId, channelId: '222222222222222222', messageId: '333333333333333333' });
  expect(readDeliveryMarker(formatDeliveryMarker('9223372036854775807', nonce)).classificationId).toBe('9223372036854775807');
});

test.each([null, '', `${marker}\n`, `${marker} `, ` ${marker}`, `prefix${marker}`, `${marker}\n${marker}`,
  marker.replace('v1', 'v2'), marker.replace(':91:', ':091:'), marker.replace(':91:', ':0:'),
  marker.replace(nonce, 'short'), `x${' '.repeat(2048)}\n${marker}`])('rejects noncanonical footer %p', text => {
  expect(readDeliveryMarker(text)).toBeNull();
});

test.each([
  { author: { id: '444444444444444444', bot: true } }, { author: { id: botUserId, bot: false } },
  { author: { id: botUserId } }, { author: null }, { id: 'bad' }, { channelId: 'bad' },
  { partial: true }, { webhookId: '444444444444444444' }, { type: 19 }, { type: undefined },
  { reference: { type: 1 } }, { messageSnapshots: new Map([['id', {}]]) },
  { nonce: 'cf_ABCDEFGHIJKLMNOPQRSTUV' }, { nonce: 'bad' }, { embeds: [] },
  { embeds: [{ description: marker }] }, { embeds: [{}, { footer: { text: marker } }] },
  { embeds: [{ footer: { text: marker } }, { footer: { text: marker } }] },
  { embeds: [{ footer: { text: marker.replace('v1', 'v2') } }] },
  { embeds: Array.from({ length: 11 }, () => ({ footer: { text: marker } })) }, { embeds: {} },
])('rejects unrelated, incomplete or conflicting provider evidence %p', change => {
  expect(getDeliveryProof({ ...event(), ...change }, botUserId)).toBeNull();
});

test('legacy transient nonce still works; marker conflict cannot fall back to it', () => {
  expect(getDeliveryProof({ ...event(), nonce, embeds: [] }, botUserId)).toEqual({
    nonce, botUserId, channelId: '222222222222222222', messageId: '333333333333333333',
  });
  expect(getDeliveryProof({ ...event(), nonce }, botUserId)).toHaveProperty('correlationVersion', 1);
  expect(getDeliveryProof({ ...event(), nonce, embeds: [{ footer: { text: marker.replace('v1', 'v2') } }] }, botUserId)).toBeNull();
  expect(getDeliveryProof(event(), undefined)).toBeNull();
});

test('preparation serializes real SDK embeds without changing content, mentions, components or input', () => {
  const embed = new EmbedBuilder().setTitle('Movie').setFooter({ text: 'Original', iconURL: 'https://example.com/icon.png' });
  const payload = { content: '@here', embeds: [embed], allowedMentions: { parse: [] }, components: [] };
  const prepared = prepareDeliveryPayload(payload, '91')(nonce);
  expect(prepared).toMatchObject({ content: '@here', allowedMentions: { parse: [] }, components: [], nonce, enforceNonce: true });
  expect(prepared.embeds[0].footer).toEqual({ text: `Original\n${marker}`, icon_url: 'https://example.com/icon.png' });
  expect(embed.data.footer.text).toBe('Original');
  expect(prepareDeliveryPayload({ content: 'fixture' }, '91')(nonce).embeds[0].footer.text).toBe(marker);
});

test('footer prose yields space at both limits, without splitting unicode or truncating evidence', () => {
  const embed = { description: 'x'.repeat(4096), footer: { text: '🙂'.repeat(1024) } };
  const output = prepareDeliveryPayload({ embeds: [embed] }, '91')(nonce).embeds[0];
  expect(output.description).toBe(embed.description);
  expect(output.description.length + output.footer.text.length).toBeLessThanOrEqual(6000);
  expect(output.footer.text.length).toBeLessThanOrEqual(2048);
  expect(output.footer.text).not.toMatch(/[\uD800-\uDBFF]\n/);
  expect(readDeliveryMarker(output.footer.text)).not.toBeNull();
  expect(embed.footer.text).toHaveLength(2048);
});

test.each([null, { embeds: {} }, { embeds: Array(11).fill({}) }, { embeds: [{ title: 4 }] },
  { embeds: [{ description: 'x'.repeat(4097) }] }, { embeds: [{ fields: {} }] },
  { embeds: [{ fields: Array(26).fill({ name: 'n', value: 'v' }) }] },
  { embeds: [{ footer: { text: marker } }] },
  { embeds: [{ description: 'x'.repeat(4096) }, { description: 'x'.repeat(1904) }] },
])('rejects unrepresentable payload before admission %p', payload => {
  expect(() => prepareDeliveryPayload(payload, '91')).toThrow('delivery_payload_invalid');
});

test('edits retain the marker after adding fields; legacy edits never invent one', () => {
  const embed = new EmbedBuilder().setFooter({ text: marker }).addFields({ name: 'Result', value: 'Resolved' });
  expect(setDeliveryFooter(embed, 'Acknowledged')).toBe(embed);
  expect(embed.data.footer.text).toBe(`Acknowledged\n${marker}`);
  expect(setDeliveryFooter(new EmbedBuilder().setFooter({ text: 'Legacy' }), 'Resolved').data.footer.text).toBe('Resolved');
  expect(() => setDeliveryFooter(new EmbedBuilder().setFooter({ text: `${marker}\n` }), 'Resolved')).toThrow('delivery_payload_invalid');
  expect(() => setDeliveryFooter(embed, marker)).toThrow('delivery_payload_invalid');
});

test('format validation does not admit a malformed scope or nonce', () => {
  expect(() => formatDeliveryMarker('0', nonce)).toThrow('delivery_marker_invalid');
  expect(() => formatDeliveryMarker('91', 'bad')).toThrow('delivery_marker_invalid');
});
