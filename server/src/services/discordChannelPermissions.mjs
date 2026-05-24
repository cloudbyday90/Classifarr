import { PermissionFlagsBits } from 'discord.js';

export const REQUIRED_PERMISSIONS = [
  'SendMessages',
  'EmbedLinks',
  'AttachFiles',
  'ReadMessageHistory',
  'UseExternalEmojis',
  'AddReactions',
];

export const PERMISSION_MAP = {
  SendMessages: PermissionFlagsBits.SendMessages,
  EmbedLinks: PermissionFlagsBits.EmbedLinks,
  AttachFiles: PermissionFlagsBits.AttachFiles,
  ReadMessageHistory: PermissionFlagsBits.ReadMessageHistory,
  UseExternalEmojis: PermissionFlagsBits.UseExternalEmojis,
  AddReactions: PermissionFlagsBits.AddReactions,
};

export function checkChannelPermissions(channel, botUserId) {
  const botMember = channel.guild.members.cache.get(botUserId);
  if (!botMember) {
    return {
      granted: [],
      missing: REQUIRED_PERMISSIONS,
      all: false,
    };
  }

  const channelPermissions = channel.permissionsFor(botMember);
  if (!channelPermissions) {
    return {
      granted: [],
      missing: REQUIRED_PERMISSIONS,
      all: false,
    };
  }

  const granted = [];
  const missing = [];

  REQUIRED_PERMISSIONS.forEach((perm) => {
    const permBit = PERMISSION_MAP[perm];
    if (permBit && channelPermissions.has(permBit)) {
      granted.push(perm);
    } else {
      missing.push(perm);
    }
  });

  return {
    granted,
    missing,
    all: missing.length === 0,
  };
}

export function findMissingCriticalPermissions(permissions) {
  return permissions.missing.filter((p) =>
    ['SendMessages', 'EmbedLinks'].includes(p),
  );
}
