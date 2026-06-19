const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { requireMarketplacePost, requirePostOwner } = require('../guards');
const { hasRole, claimRoleFor } = require('../roles');
const { applyTag, tagNote } = require('../forum');
const { ensurePost, getPost, hasClaim, setAccepted, removeAllClaims, countAcceptedForArtist, getCount } = require('../db');
const { maxAcceptedFor } = require('../levels');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('accept')
    .setDescription('Assign this task to one of the artists who applied.')
    .addUserOption((opt) =>
      opt.setName('artist').setDescription('The artist to accept').setRequired(true)
    ),
  execute: async (interaction) => {
    const thread = await requireMarketplacePost(interaction);
    if (!thread) return;
    if (!(await requirePostOwner(interaction, thread))) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const artistMember = interaction.options.getMember('artist');
    const artistUser = interaction.options.getUser('artist');

    await ensurePost(thread.id, thread.ownerId, thread.name);
    const post = await getPost(thread.id);

    if (post && post.accepted_artist_id) {
      return interaction.editReply(
        `<@${post.accepted_artist_id}> is already accepted for this task. Run **/unaccept** first to switch.`
      );
    }
    if (!(await hasClaim(thread.id, artistUser.id))) {
      return interaction.editReply(
        `${artistUser} hasn't applied to this task — they need to run **/apply** before you can accept them.`
      );
    }

    const requiredRole = claimRoleFor(thread.parent);
    if (!artistMember || !hasRole(artistMember, requiredRole)) {
      return interaction.editReply(
        `${artistUser} doesn't have the **${requiredRole}** role, so they can't be accepted for this forum.`
      );
    }

    const accepted = await countAcceptedForArtist(artistUser.id);
    const cap = maxAcceptedFor(await getCount(artistUser.id));
    if (accepted >= cap) {
      return interaction.editReply(
        `${artistUser} is already at their accepted-task limit (**${cap}**). They must finish one before taking this on.`
      );
    }

    await setAccepted(thread.id, artistUser.id);
    await removeAllClaims(thread.id);
    const result = await applyTag(thread, 'inProgress');
    await thread.send({
      content: `✅ <@${artistUser.id}> has been accepted — this task is now **${result.tagName}**. Other applications have been cleared; if it's unaccepted, artists can apply again.${tagNote(result)}`,
      allowedMentions: { users: [artistUser.id] },
    });
    return interaction.editReply('Artist accepted.');
  },
};
