/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { Client, ChatInputCommandInteraction, ChannelType, ApplicationCommandOptionType,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessagePayload, AttachmentBuilder } from 'discord.js';
const client = new Client({ intents: [] });
try {
  const guild = client.guilds._add({ id: '100000000000000001', name: 'Synthetic guild', unavailable: false });
  const channelData = { id: '100000000000000002', guild_id: guild.id, type: ChannelType.GuildText,
    name: 'synthetic', position: 0, permission_overwrites: [] };
  const cached = client.channels._add(channelData, guild);
  const interaction = (permissions, appPermissions) => new ChatInputCommandInteraction(client, {
    id: '100000000000000003', type: 2, application_id: '100000000000000004', token: 'synthetic-not-a-credential',
    guild_id: guild.id, channel: channelData, user: { id: '100000000000000005', username: 'synthetic', discriminator: '0', avatar: null },
    app_permissions: '0', entitlements: [], authorizing_integration_owners: {}, locale: 'en-US', version: 1,
    data: { id: '100000000000000006', name: 'choose', type: 1,
      options: [{ name: 'destination', type: ApplicationCommandOptionType.Channel, value: channelData.id }],
      resolved: { channels: { [channelData.id]: { ...channelData,
        ...(permissions === undefined ? {} : { permissions }), ...(appPermissions === undefined ? {} : { app_permissions: appPermissions }) } } } },
  });
  const first = interaction('1024', '2048'), second = interaction('4096', '8192'), third = interaction();
  for (const [event, expected, appExpected] of [[first, 1024n, 2048n], [second, 4096n, 8192n], [third, null, null]]) {
    const resolved = event.options.getChannel('destination');
    assert.notEqual(resolved, cached);
    assert.equal(resolved.permissions?.bitfield ?? null, expected);
    assert.equal(resolved.appPermissions?.bitfield ?? null, appExpected);
    assert.equal(event.options.resolved.channels.get(channelData.id).permissions?.bitfield ?? null, expected);
    if (expected !== null) assert.equal(Object.isFrozen(resolved.permissions), true);
  }
  assert.equal(client.channels.cache.get(channelData.id), cached);
  assert.equal(cached.permissions, null); assert.equal(cached.appPermissions, null);
  assert.equal(first.options.getChannel('destination').permissions.bitfield, 1024n);
  const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('choose_synthetic').setLabel('Choose destination').setStyle(ButtonStyle.Primary));
  const embed = new EmbedBuilder().setTitle('Synthetic review').setDescription('Choose a destination.');
  const payload = MessagePayload.create(cached, { content: 'Review', embeds: [embed], components: [row],
    files: [new AttachmentBuilder(Buffer.from('synthetic-file'), { name: 'synthetic.txt' })], allowedMentions: { parse: [] } });
  await payload.resolveBody(); await payload.resolveFiles();
  assert.equal(payload.body.content, 'Review'); assert.equal(payload.body.components[0].components[0].custom_id, 'choose_synthetic');
  assert.equal(payload.body.embeds[0].title, 'Synthetic review'); assert.deepEqual(payload.body.allowed_mentions.parse, []);
  assert.equal(payload.files[0].name, 'synthetic.txt'); assert.equal(payload.files[0].data.toString(), 'synthetic-file');
  process.stdout.write(JSON.stringify({ mode: 'interactions', passed: true }) + '\n');
} finally { await client.destroy(); }
