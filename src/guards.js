const { MessageFlags } = require('discord.js');
const CONFIG = require('../config');
const { isAdmin, hasRole } = require('./roles');
const { isMarketplacePost } = require('./forum');
const { getPost } = require('./db');

async function requireAdmin(interaction) {
  if (!isAdmin(interaction.member)) {
    await interaction.reply({
      content: `Only members with the **${CONFIG.adminRole}** role can use this command.`,
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }
  return true;
}

async function requireArtist(interaction) {
  if (!hasRole(interaction.member, CONFIG.artistRole)) {
    await interaction.reply({
      content: `Only members with the **${CONFIG.artistRole}** role can use this command.`,
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }
  return true;
}

async function requireBuyer(interaction) {
  if (!hasRole(interaction.member, CONFIG.buyerRole) && !isAdmin(interaction.member)) {
    await interaction.reply({
      content: `Only members with the **${CONFIG.buyerRole}** role can use this command.`,
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }
  return true;
}

async function requireMarketplacePost(interaction) {
  if (!isMarketplacePost(interaction.channel)) {
    await interaction.reply({
      content: 'Run this inside a marketplace forum post.',
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }
  return interaction.channel;
}

// The post "owner" is the buyer recorded when the bot created it (or the thread
// creator for posts not made through /post). Admins can always act.
async function requirePostOwner(interaction, thread) {
  const post = await getPost(thread.id);
  const ownerId = post?.buyer_id ?? thread.ownerId;
  if (interaction.user.id !== ownerId && !isAdmin(interaction.member)) {
    await interaction.reply({
      content: 'Only the buyer who owns this post or an admin can use this command.',
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }
  return true;
}

module.exports = {
  requireAdmin,
  requireArtist,
  requireBuyer,
  requireMarketplacePost,
  requirePostOwner,
};
