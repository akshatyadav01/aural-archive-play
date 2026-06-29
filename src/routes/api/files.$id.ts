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
        let bytes: Uint8Array;
        const data = row.data;
        if (data instanceof Uint8Array) {
          bytes = data;
        } else if (typeof data === "string") {
          // neon HTTP may return bytea as "\\xDEADBEEF" hex string
          const hex = data.startsWith("\\x") ? data.slice(2) : data;
          bytes = new Uint8Array(hex.length / 2);
          for (let i = 0; i < bytes.length; i++) {
            bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
          }
        } else {
          bytes = new Uint8Array(data);
        }
        return new Response(bytes as unknown as BodyInit, {
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
