import { createFileRoute } from "@tanstack/react-router";
import {
  CORS,
  ensureDb,
  getPool,
  json,
  SONG_COLS,
  songRowToJson,
} from "@/lib/db.server";

export const Route = createFileRoute("/api/playlists/$id/songs")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ params }) => {
        await ensureDb();
        const r = await getPool().query(
          `SELECT s.id, s.title, s.artist, s.duration,
                  s.audio_filename, s.poster_filename,
                  (s.audio_data IS NOT NULL) AS has_audio,
                  (s.poster_data IS NOT NULL) AS has_poster,
                  s.created_at,
                  ps.position, ps.id AS playlist_song_id
           FROM playlist_songs ps
           JOIN songs s ON s.id = ps.song_id
           WHERE ps.playlist_id = $1
           ORDER BY ps.position ASC, ps.id ASC`,
          [params.id]
        );
        return json(r.rows.map(songRowToJson));
      },
      POST: async ({ params, request }) => {
        await ensureDb();
        const body = await request.json().catch(() => ({}));
        const song_id = body?.song_id;
        if (!song_id) return json({ error: "song_id required" }, 400);
        const r = await getPool().query(
          `INSERT INTO playlist_songs (playlist_id, song_id) VALUES ($1,$2) RETURNING *`,
          [params.id, song_id]
        );
        return json(r.rows[0]);
      },
    },
  },
});
