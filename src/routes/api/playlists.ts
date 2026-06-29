import { createFileRoute } from "@tanstack/react-router";
import { CORS, ensureDb, getPool, json } from "@/lib/db.server";

export const Route = createFileRoute("/api/playlists")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => {
        await ensureDb();
        const r = await getPool().query(
          `SELECT * FROM playlists ORDER BY created_at DESC`
        );
        return json(r.rows);
      },
      POST: async ({ request }) => {
        await ensureDb();
        const body = await request.json().catch(() => ({}));
        const name = body?.name;
        if (!name) return json({ error: "name required" }, 400);
        const r = await getPool().query(
          `INSERT INTO playlists (name) VALUES ($1) RETURNING *`,
          [name]
        );
        return json(r.rows[0]);
      },
    },
  },
});
