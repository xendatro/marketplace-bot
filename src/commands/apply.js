const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { requireMarketplacePost } = require('../guards');
const { hasRole, claimRoleFor } = require('../roles');
const { ensurePost, getPost, hasClaim, addClaim, getCount, getPortfolio } = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('apply')
    .setDescription('Apply to take on this task (the buyer accepts one applicant).')
    .addStringOption((opt) =>
      opt
        .setName('completion_date')
        .setDescription('Optional: when you could finish by')
        .setRequired(false)
        .setMaxLength(100)
    ),
  execute: async (interaction) => {
    const thread = await requireMarketplacePost(interaction);
    if (!thread) return;

    const requiredRole = claimRoleFor(thread.parent);
    if (!hasRole(interaction.member, requiredRole)) {
      return interaction.reply({
        content: `You need the **${requiredRole}** role to apply for posts in this forum.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const artistId = interaction.user.id;
    await ensurePost(thread.id, thread.ownerId, thread.name);
    const post = await getPost(thread.id);

    if (post && post.accepted_artist_id) {
      return interaction.editReply(
        'This task already has an accepted artist — applications reopen only if it gets unaccepted.'
      );
    }
    if (await hasClaim(thread.id, artistId)) {
      return interaction.editReply("You've already applied to this task. Use **/withdraw** to pull your application.");
    }

    const offeredDate = (interaction.options.getString('completion_date') || '').trim() || null;
    await addClaim(thread.id, artistId, offeredDate);

    const count = await getCount(artistId);
    const portfolio = await getPortfolio(artistId);
    const portfolioLine = portfolio
      ? portfolio
      : "Not linked — ask them directly if you'd like to see their work.";

    await thread.send({
      content: [
        `**Applicant:** <@${artistId}>`,
        `**Total Completions:** ${count}`,
        `**Offered Date of Completion:** ${offeredDate || 'N/A'}`,
        `**Portfolio:** ${portfolioLine}`,
      ].join('\n'),
      allowedMentions: { users: [artistId] },
    });
    return interaction.editReply('Your application is in — the buyer picks from everyone who applied.');
  },
};
