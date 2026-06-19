require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  ChannelType,
  SlashCommandBuilder,
  MessageFlags,
  Events,
} = require('discord.js');
const { Pool } = require('pg');

const CONFIG = {
  categoryName: 'marketplace',
  adminRole: 'admin',
  artistRole: 'artist',
  tags: {
    unclaimed:  'Unclaimed',
    inProgress: 'In-Progress',
    paid:       'Paid',
    done:       'Completed',
    closed:     'Closed',
  },
};

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '')
    ? false
    : { rejectUnauthorized: false },
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS claims (
      thread_id TEXT PRIMARY KEY,
      artist_id TEXT NOT NULL,
      title     TEXT NOT NULL,
      status    TEXT NOT NULL DEFAULT 'In-Progress'
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS completions (
      artist_id TEXT PRIMARY KEY,
      count     INTEGER NOT NULL DEFAULT 0
    );
  `);
}

function isMarketplacePost(channel) {
  if (!channel || !channel.isThread()) return false;
  const forum = channel.parent;
  if (!forum || forum.type !== ChannelType.GuildForum) return false;
  const category = forum.parent;
  return (
    !!category &&
    category.name.toLowerCase() === CONFIG.categoryName.toLowerCase()
  );
}

function findTagId(forum, tagName) {
  const tag = forum.availableTags.find(
    (t) => t.name.toLowerCase() === tagName.toLowerCase()
  );
  return tag ? tag.id : null;
}

async function applyTag(thread, stateKey) {
  const tagName = CONFIG.tags[stateKey];
  const tagId = findTagId(thread.parent, tagName);
  if (tagId === null) {
    return { missingTag: true, tagName };
  }
  await thread.setAppliedTags([tagId]);
  return { missingTag: false, tagName };
}

function hasRole(member, roleName) {
  if (!member || !member.roles) return false;
  return member.roles.cache.some(
    (r) => r.name.toLowerCase() === roleName.toLowerCase()
  );
}

function isAdmin(member) {
  return hasRole(member, CONFIG.adminRole);
}

function isOwnerOrAdmin(interaction, thread) {
  return interaction.user.id === thread.ownerId || isAdmin(interaction.member);
}

function tagNote({ missingTag, tagName }) {
  return missingTag ? ` (No **${tagName}** tag found in this forum — create it.)` : '';
}

function plural(n) {
  return `${n} completion${n === 1 ? '' : 's'}`;
}

function artistDisplayName(interaction) {
  const member = interaction.options.getMember('artist');
  const user = interaction.options.getUser('artist');
  return member?.displayName ?? user?.username ?? 'That user';
}

async function getClaim(threadId) {
  const { rows } = await pool.query(
    'SELECT thread_id, artist_id, title, status FROM claims WHERE thread_id = $1',
    [threadId]
  );
  return rows[0] || null;
}

async function getCount(artistId) {
  const { rows } = await pool.query(
    'SELECT count FROM completions WHERE artist_id = $1',
    [artistId]
  );
  return rows[0]?.count ?? 0;
}

async function setCount(artistId, n) {
  if (n <= 0) {
    await pool.query('DELETE FROM completions WHERE artist_id = $1', [artistId]);
    return 0;
  }
  await pool.query(
    `INSERT INTO completions (artist_id, count)
     VALUES ($1, $2)
     ON CONFLICT (artist_id) DO UPDATE SET count = $2`,
    [artistId, n]
  );
  return n;
}

const NO_PING = { allowedMentions: { parse: [] } };

const commands = [
  new SlashCommandBuilder()
    .setName('claim')
    .setDescription('Mark this post as claimed / in-progress by an artist.')
    .addUserOption((opt) =>
      opt.setName('artist').setDescription('The artist who claimed this task').setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('unclaim')
    .setDescription('Unclaim this post and reopen it for any artist.'),
  new SlashCommandBuilder()
    .setName('paid')
    .setDescription('Mark this post as paid (asset not yet received).'),
  new SlashCommandBuilder()
    .setName('done')
    .setDescription('Mark this post completed, credit the artist, then close it.'),
  new SlashCommandBuilder()
    .setName('close')
    .setDescription('Close this post, then lock and archive it.'),
  new SlashCommandBuilder()
    .setName('current')
    .setDescription("List an artist's current (active) tasks.")
    .addUserOption((opt) =>
      opt.setName('artist').setDescription('The artist to look up').setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the artists with the most completions.'),
  new SlashCommandBuilder()
    .setName('view')
    .setDescription("View an artist's completion count.")
    .addUserOption((opt) =>
      opt.setName('artist').setDescription('The artist to look up').setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('set')
    .setDescription("Set an artist's completion count to a value.")
    .addUserOption((opt) =>
      opt.setName('artist').setDescription('The artist to edit').setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt.setName('amount').setDescription('The value to set').setRequired(true).setMinValue(0)
    ),
  new SlashCommandBuilder()
    .setName('add')
    .setDescription("Add to an artist's completion count.")
    .addUserOption((opt) =>
      opt.setName('artist').setDescription('The artist to edit').setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt.setName('amount').setDescription('How many to add').setRequired(true).setMinValue(1)
    ),
  new SlashCommandBuilder()
    .setName('subtract')
    .setDescription("Subtract from an artist's completion count.")
    .addUserOption((opt) =>
      opt.setName('artist').setDescription('The artist to edit').setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt.setName('amount').setDescription('How many to subtract').setRequired(true).setMinValue(1)
    ),
  new SlashCommandBuilder()
    .setName('clear')
    .setDescription("Reset an artist's completion count to zero.")
    .addUserOption((opt) =>
      opt.setName('artist').setDescription('The artist to clear').setRequired(true)
    ),
].map((c) => c.toJSON());

client.once(Events.ClientReady, async (c) => {
  console.log(`Logged in as ${c.user.tag}`);
  try {
    await initDb();
    console.log('Database ready.');
  } catch (err) {
    console.error('Failed to initialise database:', err);
  }
  try {
    const guild = await c.guilds.fetch(process.env.GUILD_ID);
    await guild.commands.set(commands);
    console.log('Slash commands registered.');
  } catch (err) {
    console.error('Failed to register commands:', err);
  }
});

client.on(Events.ThreadCreate, async (thread, newlyCreated) => {
  if (!newlyCreated) return;
  if (!isMarketplacePost(thread)) return;

  await new Promise((resolve) => setTimeout(resolve, 1500));

  try {
    const result = await applyTag(thread, 'unclaimed');
    if (result.missingTag) {
      await thread.send(`⚠️ Couldn't tag this post.${tagNote(result)}`);
    }
  } catch (err) {
    console.error('Failed to auto-tag new post:', err);
  }
});

async function handleClaim(interaction, thread) {
  const artist = interaction.options.getMember('artist');
  const artistUser = interaction.options.getUser('artist');

  if (!artist || !hasRole(artist, CONFIG.artistRole)) {
    return interaction.reply({
      content: `${artistUser ?? 'That user'} doesn't have the **${CONFIG.artistRole}** role, so they can't claim posts.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.deferReply();

  const existing = await getClaim(thread.id);
  if (existing) {
    return interaction.editReply(`⚠️ This post is already claimed by <@${existing.artist_id}>.`);
  }

  const result = await applyTag(thread, 'inProgress');
  await pool.query(
    `INSERT INTO claims (thread_id, artist_id, title, status)
     VALUES ($1, $2, $3, 'In-Progress')`,
    [thread.id, artistUser.id, thread.name]
  );
  await interaction.editReply(`Claimed by <@${artistUser.id}>.${tagNote(result)}`);
}

async function handleUnclaim(interaction, thread) {
  await interaction.deferReply();

  const existing = await getClaim(thread.id);
  if (!existing) {
    return interaction.editReply("This post isn't currently claimed, so there's nothing to unclaim.");
  }

  const result = await applyTag(thread, 'unclaimed');
  await pool.query('DELETE FROM claims WHERE thread_id = $1', [thread.id]);
  await interaction.editReply(`Unclaimed — this post is open again for any artist.${tagNote(result)}`);
}

async function handlePaid(interaction, thread) {
  await interaction.deferReply();

  const existing = await getClaim(thread.id);
  if (!existing) {
    return interaction.editReply("This post isn't claimed yet — run **/claim** before marking it paid.");
  }

  const result = await applyTag(thread, 'paid');
  await pool.query("UPDATE claims SET status = 'Paid' WHERE thread_id = $1", [thread.id]);
  await interaction.editReply(
    `<@${interaction.user.id}> has paid. <@${existing.artist_id}>, please send the asset over via DM to finish this process.${tagNote(result)}`
  );
}

async function handleDone(interaction, thread) {
  await interaction.deferReply();

  const existing = await getClaim(thread.id);
  if (!existing) {
    return interaction.editReply("This post isn't claimed yet — run **/claim** before marking it done.");
  }

  const result = await applyTag(thread, 'done');
  await pool.query(
    `INSERT INTO completions (artist_id, count)
     VALUES ($1, 1)
     ON CONFLICT (artist_id) DO UPDATE SET count = completions.count + 1`,
    [existing.artist_id]
  );
  await pool.query('DELETE FROM claims WHERE thread_id = $1', [thread.id]);
  await interaction.editReply(
    `Transaction complete — marked **${CONFIG.tags.done}** and the post is now closed. Thanks <@${existing.artist_id}>!${tagNote(result)}`
  );
  await thread.setLocked(true);
  await thread.setArchived(true);
}

async function handleClose(interaction, thread) {
  await interaction.deferReply();

  const result = await applyTag(thread, 'closed');
  await pool.query('DELETE FROM claims WHERE thread_id = $1', [thread.id]);
  await interaction.editReply(`This post has been **${CONFIG.tags.closed}**.${tagNote(result)}`);
  await thread.setLocked(true);
  await thread.setArchived(true);
}

async function handleCurrent(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({
      content: `Only members with the **${CONFIG.adminRole}** role can use this command.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const artist = interaction.options.getUser('artist');
  const { rows } = await pool.query(
    'SELECT title, status FROM claims WHERE artist_id = $1 ORDER BY title',
    [artist.id]
  );

  if (rows.length === 0) {
    return interaction.editReply({ content: `<@${artist.id}> has no active tasks.`, ...NO_PING });
  }

  const list = rows.map((r, i) => `${i + 1}. ${r.title} — *${r.status}*`).join('\n');
  return interaction.editReply({
    content: `**Active tasks for <@${artist.id}> (${rows.length}):**\n${list}`,
    ...NO_PING,
  });
}

async function handleLeaderboard(interaction) {
  await interaction.deferReply();

  const { rows } = await pool.query(
    'SELECT artist_id, count FROM completions WHERE count > 0 ORDER BY count DESC, artist_id ASC LIMIT 10'
  );

  if (rows.length === 0) {
    return interaction.editReply({ content: 'No completions yet — the leaderboard is empty.', ...NO_PING });
  }

  const medals = ['🥇', '🥈', '🥉'];
  const list = rows
    .map((r, i) => `${medals[i] ?? `**${i + 1}.**`} <@${r.artist_id}> — ${r.count}`)
    .join('\n');
  return interaction.editReply({ content: `**🏆 Completions leaderboard**\n${list}`, ...NO_PING });
}

async function handleView(interaction) {
  await interaction.deferReply();

  const artistUser = interaction.options.getUser('artist');
  const name = artistDisplayName(interaction);
  const count = await getCount(artistUser.id);
  return interaction.editReply({ content: `**${name}** has **${plural(count)}**.`, ...NO_PING });
}

async function handleStat(interaction, op) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({
      content: `Only members with the **${CONFIG.adminRole}** role can use this command.`,
      flags: MessageFlags.Ephemeral,
    });
  }

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

  let message;
  if (op === 'set') message = `Set **${name}** to **${plural(next)}**.`;
  else if (op === 'add') message = `Added **${amount}** — **${name}** now has **${plural(next)}**.`;
  else if (op === 'subtract') message = `Subtracted **${amount}** — **${name}** now has **${plural(next)}**.`;
  else message = `Cleared **${name}**'s completions — now **${plural(0)}**.`;

  return interaction.editReply({ content: message, ...NO_PING });
}

const POST_COMMANDS = new Set(['claim', 'unclaim', 'paid', 'done', 'close']);
const STAT_COMMANDS = new Set(['set', 'add', 'subtract', 'clear']);

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const name = interaction.commandName;

  try {
    if (name === 'current') return await handleCurrent(interaction);
    if (name === 'leaderboard') return await handleLeaderboard(interaction);
    if (name === 'view') return await handleView(interaction);
    if (STAT_COMMANDS.has(name)) return await handleStat(interaction, name);

    if (POST_COMMANDS.has(name)) {
      if (!isMarketplacePost(interaction.channel)) {
        return interaction.reply({
          content: 'Run this inside a marketplace forum post.',
          flags: MessageFlags.Ephemeral,
        });
      }
      const thread = interaction.channel;
      if (!isOwnerOrAdmin(interaction, thread)) {
        return interaction.reply({
          content: 'Only the person who created this post or an admin can use this command.',
          flags: MessageFlags.Ephemeral,
        });
      }

      if (name === 'claim')   return await handleClaim(interaction, thread);
      if (name === 'unclaim') return await handleUnclaim(interaction, thread);
      if (name === 'paid')    return await handlePaid(interaction, thread);
      if (name === 'done')    return await handleDone(interaction, thread);
      if (name === 'close')   return await handleClose(interaction, thread);
    }
  } catch (err) {
    console.error(err);
    const msg =
      'Something went wrong — make sure I have the **Manage Posts / Manage Threads** ' +
      'permission and that the database is reachable.';
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(msg).catch(() => {});
    } else {
      await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
