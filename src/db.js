const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '')
    ? false
    : { rejectUnauthorized: false },
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      thread_id          TEXT PRIMARY KEY,
      buyer_id           TEXT NOT NULL,
      accepted_artist_id TEXT,
      status             TEXT NOT NULL DEFAULT 'Open',
      title              TEXT
    );
  `);

  // Normalise the old default status value to the new 'Open' wording.
  await pool.query("UPDATE posts SET status = 'Open' WHERE status = 'Unclaimed'");

  // The old single-row claims table (PK on thread_id, with title/status columns)
  // is incompatible with the multi-claim model. Drop it once if it's the old shape.
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'claims' AND column_name = 'status'
      ) THEN
        DROP TABLE claims;
      END IF;
    END $$;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS claims (
      thread_id TEXT NOT NULL,
      artist_id TEXT NOT NULL,
      PRIMARY KEY (thread_id, artist_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS completions (
      artist_id TEXT PRIMARY KEY,
      count     INTEGER NOT NULL DEFAULT 0
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS artists (
      artist_id TEXT PRIMARY KEY,
      portfolio TEXT
    );
  `);
}

// ── posts ──────────────────────────────────────────────────────────────────

async function ensurePost(threadId, buyerId, title) {
  await pool.query(
    `INSERT INTO posts (thread_id, buyer_id, title) VALUES ($1, $2, $3)
     ON CONFLICT (thread_id) DO NOTHING`,
    [threadId, buyerId, title]
  );
}

async function getPost(threadId) {
  const { rows } = await pool.query('SELECT * FROM posts WHERE thread_id = $1', [threadId]);
  return rows[0] || null;
}

async function getAllPostThreadIds() {
  const { rows } = await pool.query('SELECT thread_id FROM posts');
  return rows.map((r) => r.thread_id);
}

async function setAccepted(threadId, artistId) {
  await pool.query(
    "UPDATE posts SET accepted_artist_id = $2, status = 'In-Progress' WHERE thread_id = $1",
    [threadId, artistId]
  );
}

async function clearAccepted(threadId) {
  await pool.query(
    "UPDATE posts SET accepted_artist_id = NULL, status = 'Open' WHERE thread_id = $1",
    [threadId]
  );
}

async function setPaidStatus(threadId) {
  await pool.query("UPDATE posts SET status = 'Paid' WHERE thread_id = $1", [threadId]);
}

async function deletePost(threadId) {
  await pool.query('DELETE FROM claims WHERE thread_id = $1', [threadId]);
  await pool.query('DELETE FROM posts WHERE thread_id = $1', [threadId]);
}

// ── claims ─────────────────────────────────────────────────────────────────

async function addClaim(threadId, artistId) {
  await pool.query(
    `INSERT INTO claims (thread_id, artist_id) VALUES ($1, $2)
     ON CONFLICT (thread_id, artist_id) DO NOTHING`,
    [threadId, artistId]
  );
}

async function removeClaim(threadId, artistId) {
  await pool.query('DELETE FROM claims WHERE thread_id = $1 AND artist_id = $2', [threadId, artistId]);
}

async function removeAllClaims(threadId) {
  await pool.query('DELETE FROM claims WHERE thread_id = $1', [threadId]);
}

async function removeAllClaimsForArtist(artistId) {
  const res = await pool.query('DELETE FROM claims WHERE artist_id = $1', [artistId]);
  return res.rowCount;
}

async function hasClaim(threadId, artistId) {
  const { rows } = await pool.query(
    'SELECT 1 FROM claims WHERE thread_id = $1 AND artist_id = $2',
    [threadId, artistId]
  );
  return rows.length > 0;
}

async function getClaimsForArtist(artistId) {
  const { rows } = await pool.query(
    `SELECT p.thread_id, p.title, p.accepted_artist_id, p.status
     FROM claims c JOIN posts p ON c.thread_id = p.thread_id
     WHERE c.artist_id = $1
     ORDER BY p.title`,
    [artistId]
  );
  return rows;
}

async function countAcceptedForArtist(artistId) {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS n FROM posts WHERE accepted_artist_id = $1',
    [artistId]
  );
  return rows[0].n;
}

// ── completions ──────────────────────────────────────────────────────────────

async function getCount(artistId) {
  const { rows } = await pool.query('SELECT count FROM completions WHERE artist_id = $1', [artistId]);
  return rows[0]?.count ?? 0;
}

async function setCount(artistId, n) {
  if (n <= 0) {
    await pool.query('DELETE FROM completions WHERE artist_id = $1', [artistId]);
    return 0;
  }
  await pool.query(
    `INSERT INTO completions (artist_id, count) VALUES ($1, $2)
     ON CONFLICT (artist_id) DO UPDATE SET count = $2`,
    [artistId, n]
  );
  return n;
}

async function incrementCompletion(artistId) {
  const { rows } = await pool.query(
    `INSERT INTO completions (artist_id, count) VALUES ($1, 1)
     ON CONFLICT (artist_id) DO UPDATE SET count = completions.count + 1
     RETURNING count`,
    [artistId]
  );
  return rows[0].count;
}

async function topCompletions(limit = 10) {
  const { rows } = await pool.query(
    'SELECT artist_id, count FROM completions WHERE count > 0 ORDER BY count DESC, artist_id ASC LIMIT $1',
    [limit]
  );
  return rows;
}

// ── artists (portfolios) ─────────────────────────────────────────────────────

async function getPortfolio(artistId) {
  const { rows } = await pool.query('SELECT portfolio FROM artists WHERE artist_id = $1', [artistId]);
  return rows[0]?.portfolio ?? null;
}

async function setPortfolio(artistId, link) {
  await pool.query(
    `INSERT INTO artists (artist_id, portfolio) VALUES ($1, $2)
     ON CONFLICT (artist_id) DO UPDATE SET portfolio = $2`,
    [artistId, link]
  );
}

async function ensureArtist(artistId) {
  await pool.query(
    `INSERT INTO artists (artist_id, portfolio) VALUES ($1, NULL)
     ON CONFLICT (artist_id) DO NOTHING`,
    [artistId]
  );
}

module.exports = {
  pool,
  initDb,
  ensurePost,
  getPost,
  getAllPostThreadIds,
  setAccepted,
  clearAccepted,
  setPaidStatus,
  deletePost,
  addClaim,
  removeClaim,
  removeAllClaims,
  removeAllClaimsForArtist,
  hasClaim,
  getClaimsForArtist,
  countAcceptedForArtist,
  getCount,
  setCount,
  incrementCompletion,
  topCompletions,
  getPortfolio,
  setPortfolio,
  ensureArtist,
};
