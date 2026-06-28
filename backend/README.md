# Music App Backend (Node.js + Express)

Standalone backend. Runs separately from the React frontend.

## Setup

```bash
cd backend
npm install
npm start
```

Server runs on `http://localhost:4000`. Uploaded files are stored in `backend/uploads/` and served at `/uploads/<filename>`.

## Environment

`DATABASE_URL` is hard-coded to the Neon Postgres connection string for convenience. Override with an env var if needed:

```bash
DATABASE_URL="postgres://..." PORT=4000 npm start
```

Tables `songs`, `playlists`, `playlist_songs` are created automatically on startup.

## Endpoints

- `GET /api/songs?q=` — list / search songs
- `POST /api/songs` — multipart upload: fields `title`, `artist`, `duration`, files `audio`, `poster`
- `DELETE /api/songs/:id`
- `GET /api/playlists`
- `POST /api/playlists` — `{ name }`
- `DELETE /api/playlists/:id`
- `GET /api/playlists/:id/songs`
- `POST /api/playlists/:id/songs` — `{ song_id }`
- `DELETE /api/playlists/:id/songs/:songId`
