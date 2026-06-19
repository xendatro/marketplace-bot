# Marketplace Forum Bot

A Discord bot for a Roblox marketplace server. Buyers create listings through a
guided `/post` form (the bot makes the forum post for them), artists **apply**
for the tasks they want, and the buyer **accepts** one. The bot tracks
applications, completions, levels, and portfolios in a Postgres database.

## The lifecycle

| Step | Command | Who | Result |
|------|---------|-----|--------|
| Create a listing | `/post` | **Buyer** | Guided form → the bot posts the thread, tagged **Open**, and records the buyer as the owner. |
| Show interest | `/apply [completion_date]` | **Artist** (with the forum's discipline role) | Joins the applicant pool and posts a card (pinging them) with **completions, an optional offered completion date, and portfolio**. Unlimited applicants — but only while the post is **Open** (applications close once someone's accepted). |
| Withdraw interest | `/withdraw` | **Artist** | Removes their own pending application (only possible while Open). |
| Assign the task | `/accept @artist` | **Buyer / Admin** | Picks one applicant → **In-Progress**, and **clears all other applications**. Re-checks discipline, that they applied, and their accepted-task cap. |
| Un-assign | `/unaccept` | **Buyer / Admin** | Removes the acceptance → back to **Open**. The pool was cleared on accept, so artists must **re-apply**. |
| Step down | `/resign` | **Artist** (the accepted one) | The accepted artist leaves the task → back to **Open**. Allowed anytime, even after payment. |
| Mark paid | `/paid` | **Buyer / Admin** | → **Paid**, pings the accepted artist to deliver via DM. |
| Complete | `/done` | **Buyer / Admin** | → **Completed**, **+1** to the accepted artist, then locks + archives. |
| Close | `/close` | **Buyer / Admin** | → **Closed**, locks + archives (no credit). |

Other commands:

| Command | Who | Result |
|---------|-----|--------|
| `/withdraw-all` | anyone | Withdraws all your pending applications server-wide (keeps accepted tasks). Run anywhere. |
| `/current @artist` | **Admin** | Lists that artist's applications + accepted tasks (private). |
| `/view @artist` | everyone | Display Name, Username, Level, Completions, Portfolio (no ping). |
| `/leaderboard` | everyone | Top 10 by completions (plain names, no pings). |
| `/portfolio [link]` | **Artist** | Sets/clears your own portfolio link. |
| `/createartist @user [modeler]` | **Admin** | Gives the **Artist** role, **Level 1**, and any disciplines you toggle. |
| `/set` `/add` `/subtract` `/clear` `@artist` | **Admin** | Edit an artist's completion count (artist-role targets only). |

**Apply vs accept:** an application is just interest — only an **accepted** artist
is real, In-Progress work, and only `/done` on an accepted artist credits a
completion. Applications are **unlimited** and not a queue; buyers choose from
applicants by their **portfolios**. Accepting one artist **auto-clears the rest of
the pool** to keep the post clean, so reopening it (`/unaccept` or `/resign`)
means artists re-apply.

**Nobody gets stuck — by design.** Every party can always exit: applicants
`/withdraw` (or `/withdraw-all`), the accepted artist `/resign`s, and the buyer
`/unaccept`s or `/close`s — all at any time, even after payment. The server is
invite-only and members are vetted, so the bot prioritizes freedom and leaves
real disputes to the moderators.

If a post is deleted, its tracking rows are cleaned up immediately (via the
`ThreadDelete` event). If it was deleted while the bot was offline — when that
event is missed — the bot reconciles on its next startup by dropping any tracked
post whose thread no longer exists, so an artist can never stay "accepted" on a
post that's gone.

### Caps (per level)
Applications are **unlimited**. The only cap is on **accepted (in-progress)**
tasks — an artist's level number, counted across all forums.

| Role | Completions | Max accepted |
|------|-------------|--------------|
| `Level 1` | 0–4 | 1 |
| `Level 2` | 5–14 | 2 |
| `Level 3` | 15–29 | 2 |
| `Level 4` | 30–49 | 3 |
| `Level 5` | 50+ | 3 |

`/accept` is blocked once the artist is at their accepted cap. Level roles are
assigned automatically and re-evaluated whenever a completion count changes.

### Who can apply in a forum
Applying is gated by **discipline**. `CONFIG.forumRoles` maps a forum to the role
required to apply there:

```js
forumRoles: { models: 'Modeler' },
```

So only a `Modeler` can apply in the `models` forum. The `Artist` role is the
umbrella for tracking (portfolios, completion edits) — it no longer gates
applying.

## The `/post` form

`/post` (buyers only) opens a short flow:
1. **Category** select (currently `Models`).
2. **Tags** (optional) and **Deadline** dropdowns for that category, then **Continue**.
3. A popup with **Title**, **Price — USD**, **Price — Robux**, **Description**,
   and **Reference image(s)** (paste, drag, or browse — real images, not links;
   1–10 required).

The deadline runs from `No deadline` through `1 day` … `1 month` (the list lives
in `CONFIG.deadlines`). A typed deadline isn't possible because Discord caps a
modal at 5 fields and the popup is already full — hence the dropdown.

At least one price is required. The bot then creates the forum post:
- Title formatted `[$USD] [R$Robux] Title` (only the prices you filled; the price
  prefix is never truncated).
- The selected tags applied (plus the `Open` state tag).
- The image(s) attached.
- Body:
  ```
  Buyer: @buyer
  Deadline: …
  Description: …
  ```
- The buyer is recorded as the owner, so `/accept`, `/paid`, etc. recognize them
  even though the bot created the thread.

> Requires **discord.js ≥ 14.26** (modal file-upload + in-modal select support).
> This repo pins a compatible version; run `npm install` to match it.

## One-time setup

### 1. Create the tags in the `models` forum
In the forum's settings, create the five **state** tags:
`Open`, `In-Progress`, `Paid`, `Completed`, `Closed`
plus the **category** tags offered by `/post`:
`Low-Poly`, `Mid-Poly`, `High-Poly`, `Stylized`, `Sculpt`, `Textured`, `No Texture`
(names matched case-insensitively; Discord allows up to 20 tags per forum.)

### 2. Create the roles
- `Admin` — oversight + completion edits + accept/unaccept override
- `Buyer` — can run `/post`
- `Artist` — umbrella role: set a portfolio, be completion-tracked
- `Modeler` — discipline required to claim in the `models` forum
- `Level 1`–`Level 5` — assigned automatically

### 3. Make the bot the only way to post
In the `models` forum's permissions, **deny “Create Posts”** for `@everyone`
(and buyers), but keep **“Send Messages in Threads”** on so people can talk in
their listings. Allow the bot to create posts. Now `/post` is the only entry.

### 4. Give the bot permission
- **Manage Posts / Manage Threads** and **Create Posts** in the forum
- **Manage Roles** (to assign Artist / discipline / Level roles)
- **Attach Files**, **View Channels**, **Send Messages**

**Important:** in **Server Settings → Roles**, drag the bot's role **above**
`Artist`, `Modeler`, and `Level 1`–`Level 5`. Discord won't let the bot assign a
role higher than its own — the usual reason levels don't apply.

### 5. Fill in your secrets
- `DISCORD_TOKEN` — your bot token
- `GUILD_ID` — your server's ID
- `DATABASE_URL` — your Postgres connection string

## Run it locally

```
npm install
npm start
```

You should see `Logged in as ...`, then `Database ready.`, then
`Slash commands registered.` For local dev, point `DATABASE_URL` at a local
Postgres or your Render database's **external** connection string.

## Hosting on Render

A Discord bot has no inbound web traffic, so it runs as a **Background Worker**,
not a Web Service.

1. **Create a Postgres database** (Dashboard → New → Postgres). The free tier is
   deleted after ~30 days; use a paid plan to keep data.
2. **Create a Background Worker** from this repo — build `npm install`, start
   `npm start`.
3. **Set env vars** on the worker: `DISCORD_TOKEN`, `GUILD_ID`, `DATABASE_URL`
   (use the **Internal** connection string).
4. Deploy. Tables are created automatically on first start.

> **Why Postgres and not a file?** Render's filesystem is *ephemeral* — a plain
> file (or SQLite without a persistent disk) is wiped on every deploy/restart. A
> managed Postgres database survives redeploys.

## Project structure

```
index.js                     entry point — creates the client, wires events, logs in
config.js                    all tunables (roles, tags, levels, categories, disciplines)
src/
  db.js                      Postgres pool + every query (posts, claims, completions, artists)
  roles.js                   role checks (hasRole, isAdmin, findRole, claimRoleFor)
  levels.js                  level bands, caps, automatic level-role assignment
  forum.js                   marketplace detection, tag swapping, forum lookup
  guards.js                  reusable permission gates (buyer / admin / artist / post-owner)
  util.js                    small shared helpers (NO_PING, plural, …)
  commands/
    index.js                 loads every command into a Collection
    post.js                  the /post form (slash + select/button/modal handlers)
    apply.js withdraw.js withdrawall.js accept.js unaccept.js resign.js
    paid.js done.js close.js
    current.js leaderboard.js view.js portfolio.js createartist.js
    stats.js                 /set /add /subtract /clear (share one handler)
  events/
    ready.js                 init DB, register commands, reconcile orphaned posts
    threadCreate.js          auto-tag new posts as Open
    threadDelete.js          clean up DB rows when a post is deleted
    interactionCreate.js     routes commands, and /post components + modals
```

Each command module exports `{ data, execute }` (the slash definition and its
handler); `post.js` also exports `handleComponent` / `handleModal`. To add a
command, drop a file in `src/commands/` and list it in `src/commands/index.js`.

## Changing things later

Everything adjustable lives in `config.js`: roles, the marketplace category name,
discipline→forum gating, listing categories + their tags, the deadline options,
level bands/caps, and the state tag names. To add a discipline (e.g. `Animator`): add it to
`disciplines`, add a `forumRoles` entry, add a `categories` entry with its tags,
and create the matching roles/tags in Discord. Restart the bot to apply.
