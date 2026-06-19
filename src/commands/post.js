const {
  SlashCommandBuilder,
  MessageFlags,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  LabelBuilder,
  TextInputBuilder,
  TextInputStyle,
  FileUploadBuilder,
} = require('discord.js');
const CONFIG = require('../../config');
const { requireBuyer } = require('../guards');
const { findForum, findTagId } = require('../forum');
const { ensurePost } = require('../db');

const categoryNames = Object.keys(CONFIG.categories);
const DEADLINES = CONFIG.deadlines && CONFIG.deadlines.length ? CONFIG.deadlines : ['No deadline'];

function categoryRow() {
  const select = new StringSelectMenuBuilder()
    .setCustomId('post:cat')
    .setPlaceholder('Choose a category')
    .addOptions(categoryNames.map((n) => ({ label: n, value: n })));
  return new ActionRowBuilder().addComponents(select);
}

function tagsRow(cat, tags) {
  const all = CONFIG.categories[cat].tags;
  if (all.length === 0) return null;
  const max = Math.min(4, all.length);
  const select = new StringSelectMenuBuilder()
    .setCustomId(`post:tags:${cat}:${tags.dl}`)
    .setPlaceholder(`Optional: pick up to ${max} tag(s)`)
    .setMinValues(0)
    .setMaxValues(max)
    .addOptions(all.map((t, i) => ({ label: t, value: String(i), default: tags.list.includes(i) })));
  return new ActionRowBuilder().addComponents(select);
}

function deadlineRow(cat, tags) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(`post:dl:${cat}:${tags.list.join(',')}`)
    .setPlaceholder('Deadline')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(DEADLINES.map((d, i) => ({ label: d, value: String(i), default: i === tags.dl })));
  return new ActionRowBuilder().addComponents(select);
}

function continueRow(cat, tags) {
  const btn = new ButtonBuilder()
    .setCustomId(`post:go:${cat}:${tags.list.join(',')}:${tags.dl}`)
    .setLabel('Continue')
    .setStyle(ButtonStyle.Primary);
  return new ActionRowBuilder().addComponents(btn);
}

function stepComponents(cat, list, dl) {
  const state = { list, dl };
  const rows = [];
  const tr = tagsRow(cat, state);
  if (tr) rows.push(tr);
  rows.push(deadlineRow(cat, state));
  rows.push(continueRow(cat, state));
  return rows;
}

function stepContent(cat, list, dl) {
  return `Category: **${cat}**. Tags: **${list.length}**, Deadline: **${DEADLINES[dl] ?? DEADLINES[0]}**. Hit **Continue** when ready.`;
}

function buildModal(cat, tagsCsv, dl) {
  return new ModalBuilder()
    .setCustomId(`post:modal:${cat}:${tagsCsv}:${dl}`)
    .setTitle(`New ${cat} listing`.slice(0, 45))
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Title')
        .setTextInputComponent(
          new TextInputBuilder().setCustomId('title').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80)
        ),
      new LabelBuilder()
        .setLabel('Price — USD')
        .setDescription('Leave blank if not accepting USD')
        .setTextInputComponent(
          new TextInputBuilder().setCustomId('price_usd').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(20)
        ),
      new LabelBuilder()
        .setLabel('Price — Robux')
        .setDescription('Leave blank if not accepting Robux')
        .setTextInputComponent(
          new TextInputBuilder().setCustomId('price_robux').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(20)
        ),
      new LabelBuilder()
        .setLabel('Description')
        .setDescription('What do you want made?')
        .setTextInputComponent(
          new TextInputBuilder().setCustomId('description').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000)
        ),
      new LabelBuilder()
        .setLabel('Reference image(s)')
        .setDescription('Attach 1–10 images (paste, drag, or browse)')
        .setFileUploadComponent(
          new FileUploadBuilder().setCustomId('reference').setMinValues(1).setMaxValues(10).setRequired(true)
        )
    );
}

const after = (id, prefix) => id.slice(prefix.length);
const parseTags = (csv) => (csv ? csv.split(',').map(Number).filter((n) => !Number.isNaN(n)) : []);

async function handleComponent(interaction) {
  const id = interaction.customId;

  if (id === 'post:cat') {
    const cat = interaction.values[0];
    return interaction.update({ content: stepContent(cat, [], 0), components: stepComponents(cat, [], 0) });
  }

  if (id.startsWith('post:tags:')) {
    const [cat, dlStr] = after(id, 'post:tags:').split(':');
    const dl = Number(dlStr) || 0;
    const list = interaction.values.map(Number).sort((a, b) => a - b);
    return interaction.update({ content: stepContent(cat, list, dl), components: stepComponents(cat, list, dl) });
  }

  if (id.startsWith('post:dl:')) {
    const [cat, tagsCsv = ''] = after(id, 'post:dl:').split(':');
    const list = parseTags(tagsCsv);
    const dl = Number(interaction.values[0]) || 0;
    return interaction.update({ content: stepContent(cat, list, dl), components: stepComponents(cat, list, dl) });
  }

  if (id.startsWith('post:go:')) {
    const [cat, tagsCsv = '', dlStr = '0'] = after(id, 'post:go:').split(':');
    return interaction.showModal(buildModal(cat, tagsCsv, dlStr));
  }
}

async function handleModal(interaction) {
  const [cat, tagsCsv = '', dlStr = '0'] = after(interaction.customId, 'post:modal:').split(':');
  const indices = parseTags(tagsCsv);
  const dl = Number(dlStr) || 0;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const cfg = CONFIG.categories[cat];
  if (!cfg) return interaction.editReply('That category no longer exists. Please run **/post** again.');

  const title = interaction.fields.getTextInputValue('title').trim();
  const usd = interaction.fields.getTextInputValue('price_usd').trim();
  const robux = interaction.fields.getTextInputValue('price_robux').trim();
  const description = interaction.fields.getTextInputValue('description').trim();

  if (!usd && !robux) {
    return interaction.editReply('You must enter at least one price (USD or Robux). Please run **/post** again.');
  }
  const numericish = (s) => Number(s.replace(/[, ]/g, ''));
  if (usd && Number.isNaN(numericish(usd))) {
    return interaction.editReply('The USD price must be a number. Please run **/post** again.');
  }
  if (robux && Number.isNaN(numericish(robux))) {
    return interaction.editReply('The Robux price must be a number. Please run **/post** again.');
  }

  let images = [];
  try {
    const uploaded = interaction.fields.getUploadedFiles('reference');
    images = uploaded ? [...uploaded.values()] : [];
  } catch {
    images = [];
  }
  if (images.length === 0) {
    return interaction.editReply('At least one reference image is required. Please run **/post** again.');
  }
  if (images.some((f) => f.contentType && !f.contentType.startsWith('image/'))) {
    return interaction.editReply('All references must be image files. Please run **/post** again.');
  }

  const forum = findForum(interaction.guild, cfg.forum);
  if (!forum) {
    return interaction.editReply(
      `Couldn't find the **${cfg.forum}** forum under the **${CONFIG.categoryName}** category.`
    );
  }

  const priceParts = [];
  if (usd) priceParts.push(`[$${usd}]`);
  if (robux) priceParts.push(`[R$${robux}]`);
  const name = `${priceParts.join(' ')} ${title}`.trim().slice(0, 100);

  const selectedTags = indices.map((i) => cfg.tags[i]).filter(Boolean);
  const unclaimedId = findTagId(forum, CONFIG.tags.unclaimed);
  const polyIds = selectedTags.map((t) => findTagId(forum, t)).filter(Boolean);
  const appliedTags = [unclaimedId, ...polyIds].filter(Boolean).slice(0, 5);

  const deadline = DEADLINES[dl] ?? DEADLINES[0];
  const body = `Buyer: <@${interaction.user.id}>\nDeadline: ${deadline}\nDescription: ${description}`;

  let thread;
  try {
    thread = await forum.threads.create({
      name,
      message: {
        content: body,
        files: images.map((f, i) => ({ attachment: f.url, name: f.name || `reference-${i + 1}.png` })),
        allowedMentions: { parse: [] },
      },
      appliedTags,
      reason: `Listing created via /post by ${interaction.user.tag}`,
    });
  } catch (err) {
    console.error('Failed to create listing:', err);
    return interaction.editReply(
      'Failed to create the post — make sure I can create posts and attach files in that forum.'
    );
  }

  await ensurePost(thread.id, interaction.user.id, name);
  return interaction.editReply(`✅ Your listing is up: ${thread}`);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('post')
    .setDescription('Create a marketplace listing (buyers only).'),
  execute: async (interaction) => {
    if (!(await requireBuyer(interaction))) return;
    if (categoryNames.length === 0) {
      return interaction.reply({ content: 'No categories are configured.', flags: MessageFlags.Ephemeral });
    }
    return interaction.reply({
      content: "Let's create your listing. Start by choosing a category:",
      components: [categoryRow()],
      flags: MessageFlags.Ephemeral,
    });
  },
  handleComponent,
  handleModal,
};
