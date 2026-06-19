const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const CONFIG = require('../../config');
const { requireAdmin } = require('../guards');
const { findRole } = require('../roles');
const { updateLevelRole } = require('../levels');
const { getCount, ensureArtist } = require('../db');
const { NO_PING, disciplineOption } = require('../util');

const data = new SlashCommandBuilder()
  .setName('createartist')
  .setDescription('Register a new artist and assign their roles.')
  .addUserOption((opt) =>
    opt.setName('artist').setDescription('The member to set up as an artist').setRequired(true)
  );
for (const d of CONFIG.disciplines) {
  data.addBooleanOption((opt) =>
    opt.setName(disciplineOption(d)).setDescription(`Give the ${d} role`).setRequired(false)
  );
}

module.exports = {
  data,
  execute: async (interaction) => {
    if (!(await requireAdmin(interaction))) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const artistUser = interaction.options.getUser('artist');
    let member;
    try {
      member = await interaction.guild.members.fetch(artistUser.id);
    } catch {
      return interaction.editReply("Couldn't find that member in this server.");
    }

    const selected = CONFIG.disciplines.filter((d) =>
      interaction.options.getBoolean(disciplineOption(d))
    );

    const wanted = [CONFIG.artistRole, ...selected];
    const missing = [];
    for (const roleName of wanted) {
      const role = findRole(interaction.guild, roleName);
      if (!role) {
        missing.push(roleName);
        continue;
      }
      try {
        if (!member.roles.cache.has(role.id)) await member.roles.add(role);
      } catch {
        missing.push(roleName);
      }
    }

    await ensureArtist(artistUser.id);
    await updateLevelRole(interaction.guild, artistUser.id, await getCount(artistUser.id));

    const given = wanted.filter((r) => !missing.includes(r));
    let message = `Registered **${member.displayName}** as an artist.`;
    if (given.length) message += `\nRoles given: ${given.join(', ')}.`;
    if (missing.length) {
      message += `\n⚠️ Couldn't assign: ${missing.join(', ')}. Check the role exists, the spelling matches, and that my role is **above** it (Server Settings → Roles), with **Manage Roles** enabled.`;
    }
    message += `\nThey can run **/portfolio** to add a portfolio link.`;

    return interaction.editReply({ content: message, ...NO_PING });
  },
};
