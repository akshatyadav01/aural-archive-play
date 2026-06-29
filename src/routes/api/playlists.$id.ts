import { createFileRoute } from "@tanstack/react-router";
import { CORS, ensureDb, getPool, json } from "@/lib/db.server";

export const Route = createFileRoute("/api/playlists/$id")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: CORS }),
      DELETE: async ({ params }) => {
        await ensureDb();
        await getPool().query(`DELETE FROM playlists WHERE id=$1`, [params.id]);
        return json({ ok: true });
      },
    },
  },
});
