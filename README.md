# Marketplace Forum Bot

A single-file Discord bot that manages the lifecycle of marketplace posts in
your forum(s) using tags, and tracks artist claims and completions in a
Postgres database.

## What it does

| Step | Trigger | Who | Result |
|------|---------|-----|--------|
| New post created | automatic | — | Tag → **Unclaimed** |
| `/claim @artist` | author / admin | Tag → **In-Progress**, public "Claimed by @artist". The user must have the **discipline role required by that forum** (e.g. `Modeler` in the `models` forum). A post that's already claimed can't be claimed again. |
| `/unclaim` | author / admin | Tag → **Unclaimed**, clears the claimer. Helpful message if nothing was claimed. |
| `/paid` | author / admin | Tag → **Paid**, public "@buyer has paid. @artist, please send the asset over via DM to finish this process." |
| `/done` | author / admin | Tag → **Completed**, public confirmation, **+1 to that artist's completion count**, then locks + archives the post. |
| `/close` | author / admin | Tag → **Closed**, then locks + archives the post (no completion credited). |
| `/current @artist` | admin | Lists that artist's current (active) tasks by title. Private to the admin who runs it. |
| `/leaderboard` | everyone | Top 10 artists by completions (names only — no pings). |
| `/view @artist` | everyone | Shows the artist's Display Name, Username, Completions, Level, and Portfolio (no ping). |
| `/set @artist <n>` | admin | Sets that artist's completion count to `n`. |
| `/add @artist <n>` | admin | Adds `n` to that artist's completion count. |
| `/subtract @artist <n>` | admin | Subtracts `n` (won't go below 0). |
| `/clear @artist` | admin | Resets that artist's completion count to 0. |
| `/portfolio [link]` | artist | Sets your own portfolio link; leave blank to clear it. |
| `/createartist @user [modeler]` | admin | Registers a member as an artist: gives the **Artist** role, **Level 1**, and any disciplines you toggle (e.g. **Modeler**). |

Each lifecycle state is shown by swapping the post's tag (only one state tag at
a time). The bot watches every forum under the **marketplace** category, so
adding more forums later needs no code changes. The completion-editing commands
(`/set` `/add` `/subtract` `/clear`) only work on members who have the **Artist**
role.

### Who can claim in a forum
Claiming is gated by **discipline**, not the generic `Artist` role. `CONFIG.forumRoles`
maps a forum name to the role required to be claimed there:

```js
forumRoles: {
  models: 'Modeler',
},
```

So only a `Modeler` can be claimed for a post in the `models` forum. Add a forum
to the map to gate it (e.g. `animations: 'Animator'`). Any forum not in the map
falls back to requiring the `Artist` role. The `Artist` role itself no longer
gates marketplace work — it's used for `/portfolio` and as the umbrella for
completion tracking.

### Levels
Each artist's **Level** role is assigned automatically from their completion
count, and re-evaluated every time the count changes (`/done` and the admin
commands). The default bands (editable in `CONFIG.levels`):

| Role | Completions | Max active claims |
|------|-------------|-------------------|
| `Level 1` | 0–4 | 1 |
| `Level 2` | 5–14 | 2 |
| `Level 3` | 15–29 | 2 |
| `Level 4` | 30–49 | 3 |
| `Level 5` | 50+ | 3 |

Active claims are counted **across all forums**. If an artist is already at their
limit, `/claim` refuses and posts a **public** message listing the posts they
still have open (so everyone — including the artist — can see what's left to
finish). They must `/done`, `/close`, or `/unclaim` one before taking another.

### Access map
- `/claim`, `/unclaim`, `/paid`, `/done`, `/close` → **the post's author or an Admin**
- `/current`, `/set`, `/add`, `/subtract`, `/clear`, `/createartist` → **Admin** role
- `/portfolio` → **Artist** role (sets their own)
- `/leaderboard`, `/view` → everyone

## One-time setup

### 1. Create the five tags in each forum
Forum tags live per-forum, so do this in **every** marketplace forum. In each
forum's settings, create tags named exactly (matching is case-insensitive):

- `Unclaimed`
- `In-Progress`
- `Paid`
- `Completed`
- `Closed`

(You can give them their own emoji/colour in Discord — the bot only matches on
the name.)

### 2. Create the roles
Create these roles (names are matched case-insensitively):

- `Admin` — runs oversight + completion-editing commands
- `Artist` — required to be claimed for, to be credited, and to set a portfolio
- `Level 1`, `Level 2`, `Level 3`, `Level 4`, `Level 5` — assigned automatically
- `Modeler` (and any other disciplines you add to `CONFIG.disciplines`)

The lifecycle commands are run by the post's author or an Admin.

### 3. Give the bot permission
The bot's role needs:

- **Manage Posts** (a.k.a. Manage Threads) in the marketplace forums
- **Manage Roles** (so it can assign Level / Artist / discipline roles)
- **View Channels** and **Send Messages**

**Important:** in **Server Settings → Roles**, drag the bot's role **above**
`Artist`, `Modeler`, and `Level 1`–`Level 5`. Discord refuses to assign any role
that sits higher than the bot's own role, so if levels aren't being applied, this
is almost always why.

### 4. Fill in your secrets
Set these environment variables (locally via a `.env` file, or in your host's
dashboard):

- `DISCORD_TOKEN` — your bot token
- `GUILD_ID` — your server's ID
- `DATABASE_URL` — your Postgres connection string

## Run it locally

```
npm install
npm start
```

You should see `Logged in as ...`, then `Database ready.`, then
`Slash commands registered.` The commands appear in your server immediately.

For local development you need a Postgres database. Either run one locally and
point `DATABASE_URL` at it (e.g. `postgres://user:pass@localhost:5432/marketplace`),
or just use your hosted Render database's **external** connection string.

## Hosting on Render

A Discord bot has no inbound web traffic, so it runs as a **Background Worker**,
not a Web Service.

1. **Create a Postgres database** on Render (Dashboard → New → Postgres). The
   free tier is deleted after ~30 days; use a paid plan for anything you want to
   keep.
2. **Create a Background Worker** from this repo. Set the build command to
   `npm install` and the start command to `npm start`.
3. **Set environment variables** on the worker: `DISCORD_TOKEN`, `GUILD_ID`, and
   `DATABASE_URL`. For `DATABASE_URL`, copy the **Internal** connection string
   from your Render Postgres instance (internal is faster and free between Render
   services).
4. Deploy. The tables are created automatically on first start.

> **Why Postgres and not a file?** Render's normal filesystem is *ephemeral* — a
> plain file (or a SQLite file without a persistent disk) is wiped on every
> deploy and restart. A managed Postgres database is a separate service, so your
> claims and completion counts survive redeploys.

## Changing things later

Everything adjustable lives in the `CONFIG` block at the top of `index.js`: the
category name, the role names (`Admin` / `Artist`), the discipline list, the
level bands, and the five state tag names. To add a new discipline, add it to
`CONFIG.disciplines` (e.g. `'Animator'`) and create a matching role — it becomes
a toggle on `/createartist` automatically. Change a value there, save, and
restart the bot.
