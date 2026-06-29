// Frontend talks to TanStack server routes on the same origin.
export const API_URL = "";

export type Song = {
  id: number;
  title: string;
  artist: string | null;
  duration: number | null;
  audio_filename: string | null;
  poster_filename: string | null;
  created_at: string;
};

export type Playlist = {
  id: number;
  name: string;
  created_at: string;
};

// Builds a URL that streams audio/poster bytes from the DB.
// `name` is "audio-<id>" or "poster-<id>" as returned by the API.
export const fileUrl = (name: string | null) => {
  if (!name) return "";
  const m = /^(audio|poster)-(\d+)$/.exec(name);
  if (!m) return "";
  return `/api/files/${m[2]}?kind=${m[1]}`;
};

async function j<T>(r: Response): Promise<T> {
  if (!r.ok) throw new Error((await r.text()) || r.statusText);
  return r.json();
}

export const api = {
  listSongs: (q = "") =>
    fetch(`/api/songs?q=${encodeURIComponent(q)}`).then(j<Song[]>),
  uploadSong: (form: FormData) =>
    fetch(`/api/songs`, { method: "POST", body: form }).then(j<Song>),
  deleteSong: (id: number) =>
    fetch(`/api/songs/${id}`, { method: "DELETE" }).then(j),

  listPlaylists: () => fetch(`/api/playlists`).then(j<Playlist[]>),
  createPlaylist: (name: string) =>
    fetch(`/api/playlists`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).then(j<Playlist>),
  deletePlaylist: (id: number) =>
    fetch(`/api/playlists/${id}`, { method: "DELETE" }).then(j),
  playlistSongs: (id: number) =>
    fetch(`/api/playlists/${id}/songs`).then(j<Song[]>),
  addToPlaylist: (id: number, song_id: number) =>
    fetch(`/api/playlists/${id}/songs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ song_id }),
    }).then(j),
  removeFromPlaylist: (id: number, songId: number) =>
    fetch(`/api/playlists/${id}/songs/${songId}`, {
      method: "DELETE",
    }).then(j),
};
