import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let sqlClient: NeonQueryFunction<false, false> | null = null;
let initPromise: Promise<void> | null = null;

export function getSql() {
  if (!sqlClient) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL not set");
    sqlClient = neon(url);
  }
  return sqlClient;
}

// Thin wrapper so existing code can keep using `.query(text, params)`.
export function getPool() {
  const sql = getSql();
  return {
    query: async (text: string, params: any[] = []) => {
      const rows = await sql.query(text, params);
      return { rows: rows as any[] };
    },
  };
}

async function init() {
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS songs (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      artist TEXT,
      duration REAL,
      audio_filename TEXT,
      poster_filename TEXT,
      audio_data BYTEA,
      audio_mime TEXT,
      poster_data BYTEA,
      poster_mime TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT now()
    );
  `);
  await p.query(`ALTER TABLE songs ADD COLUMN IF NOT EXISTS audio_data BYTEA;`);
  await p.query(`ALTER TABLE songs ADD COLUMN IF NOT EXISTS audio_mime TEXT;`);
  await p.query(`ALTER TABLE songs ADD COLUMN IF NOT EXISTS poster_data BYTEA;`);
  await p.query(`ALTER TABLE songs ADD COLUMN IF NOT EXISTS poster_mime TEXT;`);
  try {
    await p.query(`ALTER TABLE songs ALTER COLUMN audio_filename DROP NOT NULL;`);
  } catch {}
  // Ensure SERIAL sequence is ahead of any existing max(id) — prevents
  // "duplicate key value violates unique constraint" after manual inserts.
  await p.query(
    `SELECT setval(pg_get_serial_sequence('songs','id'),
       GREATEST(COALESCE((SELECT MAX(id) FROM songs), 0), 1), true);`
  );

  await p.query(`
    CREATE TABLE IF NOT EXISTS playlists (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT now()
    );
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS playlist_songs (
      id SERIAL PRIMARY KEY,
      playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
      song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
      position INTEGER NOT NULL DEFAULT 0
    );
  `);
  await p.query(
    `SELECT setval(pg_get_serial_sequence('playlists','id'),
       GREATEST(COALESCE((SELECT MAX(id) FROM playlists), 0), 1), true);`
  );
  await p.query(
    `SELECT setval(pg_get_serial_sequence('playlist_songs','id'),
       GREATEST(COALESCE((SELECT MAX(id) FROM playlist_songs), 0), 1), true);`
  );
}

export function ensureDb() {
  if (!initPromise) initPromise = init().catch((e) => { initPromise = null; throw e; });
  return initPromise;
}

const SONG_COLS = `id, title, artist, duration, audio_filename, poster_filename,
  (audio_data IS NOT NULL) AS has_audio,
  (poster_data IS NOT NULL) AS has_poster,
  created_at`;

export function songRowToJson(r: any) {
  return {
    id: r.id,
    title: r.title,
    artist: r.artist,
    duration: r.duration,
    audio_filename: r.has_audio ? `audio-${r.id}` : r.audio_filename,
    poster_filename: r.has_poster ? `poster-${r.id}` : r.poster_filename,
    created_at: r.created_at,
  };
}

export { SONG_COLS };

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}
