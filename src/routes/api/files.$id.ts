import { createFileRoute } from "@tanstack/react-router";
import { CORS, ensureDb, getPool } from "@/lib/db.server";

// /api/files/{id}?kind=audio|poster
export const Route = createFileRoute("/api/files/$id")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ params, request }) => {
        await ensureDb();
        const url = new URL(request.url);
        const kind = url.searchParams.get("kind") === "poster" ? "poster" : "audio";
        const col = kind === "poster" ? "poster_data" : "audio_data";
        const mimeCol = kind === "poster" ? "poster_mime" : "audio_mime";

        const r = await getPool().query(
          `SELECT ${col} AS data, ${mimeCol} AS mime FROM songs WHERE id=$1`,
          [params.id]
        );
        const row = r.rows[0];
        if (!row || !row.data) {
          return new Response("Not found", { status: 404, headers: CORS });
        }
        const buf: Buffer = row.data;
        const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
        return new Response(bytes, {
          status: 200,
          headers: {
            "Content-Type": row.mime || "application/octet-stream",
            "Content-Length": String(bytes.byteLength),
            "Cache-Control": "public, max-age=31536000, immutable",
            "Accept-Ranges": "bytes",
            ...CORS,
          },
        });
      },
    },
  },
});
