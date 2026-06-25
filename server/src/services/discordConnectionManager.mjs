/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
} from 'discord.js';
import { createLogger } from '../utils/logger.mjs';
import {
  checkChannelPermissions,
  findMissingCriticalPermissions,
} from './discordChannelPermissions.mjs';
import { NotFoundError, ServiceUnavailableError } from '../utils/appError.mjs';

const logger = createLogger('discordConnectionManager');

export { checkChannelPermissions } from './discordChannelPermissions.mjs';

async function createEphemeralClient(token, intents) {
  const client = new Client({ intents });
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Discord client login timeout'));
      }, 10000);

      client.once('ready', () => {
        clearTimeout(timeout);
        resolve();
      });
      client.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
      client.login(token).catch((err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
    return client;
  } catch (error) {
    await client.destroy().catch(() => {}); // swallow-error: best-effort cleanup of ephemeral client on login failure
    throw error;
  }
}

export async function testConnection(botToken, channelId, config, permissionChecker = checkChannelPermissions) {
  let testClient = null;
  try {
    const token = botToken || config.bot_token;
    if (!token) {
      return { success: false, error: 'No bot token provided' };
    }

    testClient = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
    });

    await testClient.login(token);

    const user = testClient.user;
    const guilds = testClient.guilds.cache.size;

    const response = {
      success: true,
      message: 'Bot connected successfully',
      botUser: {
        id: user.id,
        username: user.username,
        discriminator: user.discriminator,
      },
      guildsCount: guilds,
    };

    if (channelId) {
      try {
        const channel = await testClient.channels.fetch(channelId);
        if (!channel) {
          return { success: false, error: 'Channel not found' };
        }

        const guild = channel.guild;
        if (guild) {
          try {
            await guild.members.fetch(testClient.user.id);
          } catch (fetchError) {
            logger.warn(
              'Could not fetch bot member for permission check:',
              fetchError.message,
            );
          }
        }

        const permissions = permissionChecker(channel, testClient.user.id);
        response.permissions = permissions;

        const missingCritical = findMissingCriticalPermissions(permissions);

        if (missingCritical.length > 0) {
          return {
            success: false,
            error: `Missing critical permissions: ${missingCritical.join(', ')}`,
            permissions,
            botUser: response.botUser,
            guildsCount: response.guildsCount,
          };
        }

        const testEmbed = new EmbedBuilder()
          .setTitle('\u2705 Classifarr Test Notification')
          .setDescription(
            'Your Discord bot is configured correctly and can send notifications!',
          )
          .setColor(0x00ff00)
          .addFields(
            { name: 'Bot', value: user.username, inline: true },
            { name: 'Channel', value: `#${channel.name}`, inline: true },
            {
              name: 'Server',
              value: channel.guild?.name || 'Unknown',
              inline: true,
            },
          )
          .setTimestamp()
          .setFooter({ text: 'This is a test message from Classifarr' });

        const sentMessage = await channel.send({ embeds: [testEmbed] });

        response.notification = {
          sent: true,
          messageId: sentMessage.id,
          channelName: channel.name,
          serverName: channel.guild?.name || 'Unknown',
        };
        response.message =
          'Test notification sent successfully! Check your Discord channel.';

        if (permissions.missing.length > 0) {
          response.warning = `Some optional permissions are missing: ${permissions.missing.join(', ')}. This may limit functionality.`;
        }
      } catch (channelError) {
        return {
          success: false,
          error: `Failed to send test notification: ${channelError.message}`,
          botUser: response.botUser,
          permissions: response.permissions,
        };
      }
    }

    return response;
  } catch (error) {
    return {
      success: false,
      error: error.message.includes('token')
        ? 'Invalid bot token'
        : error.message,
    };
  } finally {
    if (testClient) {
      await testClient.destroy();
    }
  }
}

export async function getServers(botToken, config) {
  let testClient = null;
  try {
    const token = config?.bot_token || botToken;
    if (!token) {
      throw new ServiceUnavailableError('No bot token configured');
    }

    testClient = await createEphemeralClient(token, [GatewayIntentBits.Guilds]);

    const guilds = testClient.guilds.cache.map((guild) => ({
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL(),
      memberCount: guild.memberCount,
    }));

    return guilds;
  } catch (error) {
    throw new Error(`Failed to fetch servers: ${error.message}`);
  } finally {
    if (testClient) {
      await testClient.destroy().catch(() => {}); // swallow-error: best-effort cleanup of test client in finally block
    }
  }
}

export async function getChannels(serverId, botToken, config) {
  let testClient = null;
  try {
    const token = config?.bot_token || botToken;
    if (!token) {
      throw new ServiceUnavailableError('No bot token configured');
    }

    testClient = await createEphemeralClient(token, [GatewayIntentBits.Guilds]);

    const guild = testClient.guilds.cache.get(serverId);
    if (!guild) {
      throw new NotFoundError('Server not found or bot not added to this server');
    }

    await guild.channels.fetch();

    const channels = guild.channels.cache
      .filter((channel) => channel.isTextBased() && !channel.isThread())
      .map((channel) => ({
        id: channel.id,
        name: channel.name,
        type: channel.type,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return channels;
  } catch (error) {
    throw new Error(`Failed to fetch channels: ${error.message}`);
  } finally {
    if (testClient) {
      await testClient.destroy().catch(() => {}); // swallow-error: best-effort cleanup of test client in finally block
    }
  }
}

export async function getMentionTargets(serverId, botToken, config) {
  let testClient = null;
  try {
    const token = config?.bot_token || botToken;
    if (!token) {
      throw new ServiceUnavailableError('No bot token configured');
    }

    testClient = await createEphemeralClient(token, [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
    ]);

    const guild = testClient.guilds.cache.get(serverId);
    if (!guild) {
      throw new NotFoundError('Server not found or bot not added to this server');
    }

    await guild.roles.fetch();
    const roles = guild.roles.cache
      .filter((role) => role.id !== guild.id && !role.managed)
      .map((role) => ({
        id: role.id,
        name: role.name,
        mentionable: role.mentionable,
        position: role.position,
      }))
      .sort((a, b) => b.position - a.position || a.name.localeCompare(b.name));

    let members = [];
    let memberWarning = null;
    try {
      const fetchedMembers = await guild.members.fetch({ limit: 100 });
      members = fetchedMembers
        .filter((member) => !member.user?.bot)
        .map((member) => ({
          id: member.id,
          username: member.user?.username || 'Unknown user',
          displayName: member.displayName || member.user?.username || 'Unknown user',
        }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
    } catch (error) {
      memberWarning = 'Member lookup unavailable. Enable the Server Members Intent for the bot or select a role instead.';
      logger.warn('Discord member target lookup failed', {
        serverId,
        error: error.message,
      });
    }

    return {
      roles,
      members,
      warning: memberWarning,
    };
  } catch (error) {
    throw new Error(`Failed to fetch mention targets: ${error.message}`);
  } finally {
    if (testClient) {
      await testClient.destroy().catch(() => {});
    }
  }
}

export async function getChannelDetails(channelId, botToken, config) {
  let testClient = null;
  try {
    logger.info(
      `[Discord] Fetching channel details for channel ID: ${channelId}`,
    );

    const token = config?.bot_token || botToken;
    if (!token) {
      throw new ServiceUnavailableError('No bot token configured');
    }

    logger.info(
      `[Discord] Using ${config?.bot_token ? 'stored' : 'provided'} bot token`,
    );

    testClient = await createEphemeralClient(token, [GatewayIntentBits.Guilds]);

    const channel = await testClient.channels.fetch(channelId);
    if (!channel) {
      throw new NotFoundError('Channel not found');
    }

    let guildName = 'Unknown Server';
    if (channel.guild) {
      if (!channel.guild.name) {
        await channel.guild.fetch();
      }
      guildName = channel.guild.name || 'Unknown Server';
    }

    const result = {
      id: channel.id,
      name: channel.name,
      guildId: channel.guildId,
      guildName: guildName,
    };

    logger.info(
      `[Discord] Successfully fetched channel: ${channel.name} in guild: ${channel.guild?.name || 'Unknown'}`,
    );

    return result;
  } catch (error) {
    logger.error(
      `Failed to fetch channel details for ${channelId}:`,
      error.message,
    );
    throw error;
  } finally {
    if (testClient) {
      await testClient.destroy().catch(() => {}); // swallow-error: best-effort cleanup of test client in finally block
    }
  }
}
