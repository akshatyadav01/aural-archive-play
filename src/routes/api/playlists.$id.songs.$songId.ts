import { createFileRoute } from "@tanstack/react-router";
import { CORS, ensureDb, getPool, json } from "@/lib/db.server";

export const Route = createFileRoute("/api/playlists/$id/songs/$songId")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: CORS }),
      DELETE: async ({ params }) => {
        await ensureDb();
        await getPool().query(
          `DELETE FROM playlist_songs WHERE playlist_id=$1 AND song_id=$2`,
          [params.id, params.songId]
        );
        return json({ ok: true });
      },
    },
  },
});
