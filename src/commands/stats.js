const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const CONFIG = require('../../config');
const { requireAdmin } = require('../guards');
const { hasRole } = require('../roles');
const { getCount, setCount } = require('../db');
const { updateLevelRole } = require('../levels');
const { plural, NO_PING } = require('../util');

async function runStat(interaction, op) {
  if (!(await requireAdmin(interaction))) return;

  const artistMember = interaction.options.getMember('artist');
  const artistUser = interaction.options.getUser('artist');
  if (!artistMember || !hasRole(artistMember, CONFIG.artistRole)) {
    return interaction.reply({
      content: `${artistUser ?? 'That user'} doesn't have the **${CONFIG.artistRole}** role, so their completions can't be edited.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const name = artistMember.displayName;
  const amount = op === 'clear' ? null : interaction.options.getInteger('amount');
  const current = await getCount(artistUser.id);

  let next;
  if (op === 'set') next = amount;
  else if (op === 'add') next = current + amount;
  else if (op === 'subtract') next = Math.max(0, current - amount);
  else next = 0;

  await setCount(artistUser.id, next);
  await updateLevelRole(interaction.guild, artistUser.id, next);

  let message;
  if (op === 'set') message = `Set **${name}** to **${plural(next)}**.`;
  else if (op === 'add') message = `Added **${amount}** — **${name}** now has **${plural(next)}**.`;
  else if (op === 'subtract') message = `Subtracted **${amount}** — **${name}** now has **${plural(next)}**.`;
  else message = `Cleared **${name}**'s completions — now **${plural(0)}**.`;

  return interaction.editReply({ content: message, ...NO_PING });
}

const artistOption = (opt) =>
  opt.setName('artist').setDescription('The artist to edit').setRequired(true);

module.exports = [
  {
    data: new SlashCommandBuilder()
      .setName('set')
      .setDescription("Set an artist's completion count to a value.")
      .addUserOption(artistOption)
      .addIntegerOption((opt) =>
        opt.setName('amount').setDescription('The value to set').setRequired(true).setMinValue(0)
      ),
    execute: (interaction) => runStat(interaction, 'set'),
  },
  {
    data: new SlashCommandBuilder()
      .setName('add')
      .setDescription("Add to an artist's completion count.")
      .addUserOption(artistOption)
      .addIntegerOption((opt) =>
        opt.setName('amount').setDescription('How many to add').setRequired(true).setMinValue(1)
      ),
    execute: (interaction) => runStat(interaction, 'add'),
  },
  {
    data: new SlashCommandBuilder()
      .setName('subtract')
      .setDescription("Subtract from an artist's completion count.")
      .addUserOption(artistOption)
      .addIntegerOption((opt) =>
        opt.setName('amount').setDescription('How many to subtract').setRequired(true).setMinValue(1)
      ),
    execute: (interaction) => runStat(interaction, 'subtract'),
  },
  {
    data: new SlashCommandBuilder()
      .setName('clear')
      .setDescription("Reset an artist's completion count to zero.")
      .addUserOption((opt) =>
        opt.setName('artist').setDescription('The artist to clear').setRequired(true)
      ),
    execute: (interaction) => runStat(interaction, 'clear'),
  },
];
