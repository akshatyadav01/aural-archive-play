import { createFileRoute } from "@tanstack/react-router";
import {
  CORS,
  ensureDb,
  getPool,
  json,
  SONG_COLS,
  songRowToJson,
} from "@/lib/db.server";

export const Route = createFileRoute("/api/songs")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: CORS }),

      GET: async ({ request }) => {
        await ensureDb();
        const url = new URL(request.url);
        const q = (url.searchParams.get("q") || "").trim();
        const p = getPool();
        const r = q
          ? await p.query(
              `SELECT ${SONG_COLS} FROM songs
               WHERE title ILIKE $1 OR artist ILIKE $1
               ORDER BY created_at DESC`,
              [`%${q}%`]
            )
          : await p.query(`SELECT ${SONG_COLS} FROM songs ORDER BY created_at DESC`);
        return json(r.rows.map(songRowToJson));
      },

      POST: async ({ request }) => {
        await ensureDb();
        try {
          const form = await request.formData();
          const title = form.get("title")?.toString();
          const artist = form.get("artist")?.toString() || null;
          const duration = form.get("duration")?.toString();
          const audio = form.get("audio");
          const poster = form.get("poster");

          if (!title || !(audio instanceof File) || audio.size === 0) {
            return json({ error: "title and audio file required" }, 400);
          }

          const audioBuf = Buffer.from(await audio.arrayBuffer());
          const audioMime = audio.type || "audio/mpeg";
          const audioName = audio.name || "audio";

          let posterBuf: Buffer | null = null;
          let posterMime: string | null = null;
          let posterName: string | null = null;
          if (poster instanceof File && poster.size > 0) {
            posterBuf = Buffer.from(await poster.arrayBuffer());
            posterMime = poster.type || "image/jpeg";
            posterName = poster.name || "poster";
          }

          const p = getPool();
          const r = await p.query(
            `INSERT INTO songs
              (title, artist, duration, audio_filename, poster_filename,
               audio_data, audio_mime, poster_data, poster_mime)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             RETURNING ${SONG_COLS}`,
            [
              title,
              artist,
              duration ? parseFloat(duration) : null,
              audioName,
              posterName,
              audioBuf,
              audioMime,
              posterBuf,
              posterMime,
            ]
          );
          return json(songRowToJson(r.rows[0]));
        } catch (e: any) {
          console.error(e);
          return json({ error: e.message }, 500);
        }
      },
    },
  },
});
