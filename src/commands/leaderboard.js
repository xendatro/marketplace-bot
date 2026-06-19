const { SlashCommandBuilder } = require('discord.js');
const { topCompletions } = require('../db');
const { NO_PING } = require('../util');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the artists with the most completions.'),
  execute: async (interaction) => {
    await interaction.deferReply();

    const rows = await topCompletions(10);
    if (rows.length === 0) {
      return interaction.editReply({ content: 'No completions yet — the leaderboard is empty.', ...NO_PING });
    }

    const medals = ['🥇', '🥈', '🥉'];
    const lines = [];
    for (let i = 0; i < rows.length; i++) {
      let name;
      try {
        const member = await interaction.guild.members.fetch(rows[i].artist_id);
        name = member.displayName;
      } catch {
        name = 'Unknown artist';
      }
      lines.push(`${medals[i] ?? `**${i + 1}.**`} ${name} — ${rows[i].count}`);
    }
    return interaction.editReply({ content: `**🏆 Completions leaderboard**\n${lines.join('\n')}`, ...NO_PING });
  },
};
