// Simple Express backend for the music app.
// Run with: npm install && npm start
import express from "express";
import cors from "cors";
import multer from "multer";
import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_pDNvqa82OFeu@ep-lucky-dream-at6dop6n-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const PORT = process.env.PORT || 4000;

// --- Database ---
const { Pool } = pg;
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function initDb() {
  // songs table (already defined per your schema, kept here for safety)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS songs (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      artist TEXT,
      duration REAL,
      audio_filename TEXT NOT NULL,
      poster_filename TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT now()
    );
  `);
  // playlists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS playlists (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT now()
    );
  `);
  // playlist_songs join table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS playlist_songs (
      id SERIAL PRIMARY KEY,
      playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
      song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
      position INTEGER NOT NULL DEFAULT 0
    );
  `);
  console.log("DB ready");
}

// --- Uploads ---
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}_${safe}`);
  },
});
const upload = multer({ storage });

// --- App ---
const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(uploadsDir));

// Health
app.get("/", (req, res) => res.json({ ok: true, name: "music-app-backend" }));

// --- Songs ---
// List with optional search ?q=
app.get("/api/songs", async (req, res) => {
  try {
    const q = (req.query.q || "").toString().trim();
    let result;
    if (q) {
      result = await pool.query(
        `SELECT * FROM songs
         WHERE title ILIKE $1 OR artist ILIKE $1
         ORDER BY created_at DESC`,
        [`%${q}%`]
      );
    } else {
      result = await pool.query(`SELECT * FROM songs ORDER BY created_at DESC`);
    }
    res.json(result.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Upload a song (audio required, poster optional)
app.post(
  "/api/songs",
  upload.fields([
    { name: "audio", maxCount: 1 },
    { name: "poster", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { title, artist, duration } = req.body;
      const audioFile = req.files?.audio?.[0];
      const posterFile = req.files?.poster?.[0];
      if (!title || !audioFile) {
        return res.status(400).json({ error: "title and audio file required" });
      }
      const result = await pool.query(
        `INSERT INTO songs (title, artist, duration, audio_filename, poster_filename)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [
          title,
          artist || null,
          duration ? parseFloat(duration) : null,
          audioFile.filename,
          posterFile ? posterFile.filename : null,
        ]
      );
      res.json(result.rows[0]);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  }
);

// Delete a song
app.delete("/api/songs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query(`SELECT * FROM songs WHERE id=$1`, [id]);
    const song = r.rows[0];
    if (song) {
      for (const f of [song.audio_filename, song.poster_filename]) {
        if (f) {
          const p = path.join(uploadsDir, f);
          if (fs.existsSync(p)) fs.unlinkSync(p);
        }
      }
    }
    await pool.query(`DELETE FROM songs WHERE id=$1`, [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Playlists ---
app.get("/api/playlists", async (req, res) => {
  try {
    const r = await pool.query(`SELECT * FROM playlists ORDER BY created_at DESC`);
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/playlists", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    const r = await pool.query(
      `INSERT INTO playlists (name) VALUES ($1) RETURNING *`,
      [name]
    );
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/playlists/:id", async (req, res) => {
  try {
    await pool.query(`DELETE FROM playlists WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get songs in a playlist
app.get("/api/playlists/:id/songs", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT s.*, ps.position, ps.id AS playlist_song_id
       FROM playlist_songs ps
       JOIN songs s ON s.id = ps.song_id
       WHERE ps.playlist_id = $1
       ORDER BY ps.position ASC, ps.id ASC`,
      [req.params.id]
    );
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Add song to playlist
app.post("/api/playlists/:id/songs", async (req, res) => {
  try {
    const { song_id } = req.body;
    if (!song_id) return res.status(400).json({ error: "song_id required" });
    const r = await pool.query(
      `INSERT INTO playlist_songs (playlist_id, song_id) VALUES ($1, $2) RETURNING *`,
      [req.params.id, song_id]
    );
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Remove song from playlist
app.delete("/api/playlists/:id/songs/:songId", async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM playlist_songs WHERE playlist_id=$1 AND song_id=$2`,
      [req.params.id, req.params.songId]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
  })
  .catch((e) => {
    console.error("DB init failed:", e);
    process.exit(1);
  });
