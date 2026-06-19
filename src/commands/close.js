const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const CONFIG = require('../../config');
const { requireMarketplacePost, requirePostOwner } = require('../guards');
const { applyTag, tagNote } = require('../forum');
const { deletePost } = require('../db');
const { NO_PING } = require('../util');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('close')
    .setDescription('Close this post, then lock and archive it (no completion credited).'),
  execute: async (interaction) => {
    const thread = await requireMarketplacePost(interaction);
    if (!thread) return;
    if (!(await requirePostOwner(interaction, thread))) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const result = await applyTag(thread, 'closed');
    await deletePost(thread.id);
    await thread.send({ content: `This post has been **${CONFIG.tags.closed}**.${tagNote(result)}`, ...NO_PING });
    await interaction.editReply('Post closed.');
    await thread.setLocked(true);
    await thread.setArchived(true);
  },
};
