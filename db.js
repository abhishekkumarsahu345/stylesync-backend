import pg from "pg";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// ─── MIGRATIONS (run once on startup) ────────────────────────────
export async function initDb() {
  await pool.query(`
     CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    CREATE TABLE IF NOT EXISTS scraped_sites (
      id UUID PRIMARY KEY,
      url TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS design_tokens (
      site_id UUID REFERENCES scraped_sites(id) ON DELETE CASCADE,
      extracted JSONB,
      locked JSONB DEFAULT '{}',
      computed JSONB,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (site_id)
    );

    CREATE TABLE IF NOT EXISTS version_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id UUID REFERENCES scraped_sites(id) ON DELETE CASCADE,
      before JSONB,
      after JSONB,
      changed_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

// ─── HELPERS ─────────────────────────────────────────────────────

function mergeTokens(extracted, locked) {
  // Deep merge: locked values override extracted
  const merge = (base, override) => {
    if (!override) return base;
    const result = { ...base };
    for (const key of Object.keys(override)) {
      if (
        typeof override[key] === "object" &&
        !Array.isArray(override[key]) &&
        override[key] !== null
      ) {
        result[key] = merge(base[key] || {}, override[key]);
      } else {
        result[key] = override[key];
      }
    }
    return result;
  };
  return merge(extracted, locked);
}

// ─── CRUD ─────────────────────────────────────────────────────────

export async function saveScrape(url, tokens) {
  const siteId = uuidv4();

  await pool.query(
    `INSERT INTO scraped_sites (id, url) VALUES ($1, $2)`,
    [siteId, url]
  );

  await pool.query(
    `INSERT INTO design_tokens (site_id, extracted, locked, computed)
     VALUES ($1, $2, $3, $2)`,
    [siteId, JSON.stringify(tokens), JSON.stringify({})]
  );

  return siteId;
}

export async function getTokens(siteId) {
  const res = await pool.query(
    `SELECT extracted, locked, computed FROM design_tokens WHERE site_id = $1`,
    [siteId]
  );
  if (!res.rows.length) return null;
  return res.rows[0];
}

export async function updateLockedTokens(siteId, lockedTokens) {
  const existing = await getTokens(siteId);
  if (!existing) throw new Error("Site not found");

  const before = existing.computed;
  const computed = mergeTokens(existing.extracted, lockedTokens);

  await pool.query(
    `UPDATE design_tokens
     SET locked = $1, computed = $2, updated_at = NOW()
     WHERE site_id = $3`,
    [JSON.stringify(lockedTokens), JSON.stringify(computed), siteId]
  );

  // Save version history
  await pool.query(
    `INSERT INTO version_history (site_id, before, after)
     VALUES ($1, $2, $3)`,
    [siteId, JSON.stringify(before), JSON.stringify(computed)]
  );

  return computed;
}

export async function getVersionHistory(siteId) {
  const res = await pool.query(
    `SELECT id, before, after, changed_at
     FROM version_history
     WHERE site_id = $1
     ORDER BY changed_at DESC
     LIMIT 10`,
    [siteId]
  );

  return res.rows;
}