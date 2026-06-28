export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) || "http://localhost:4000";

export type Song = {
  id: number;
  title: string;
  artist: string | null;
  duration: number | null;
  audio_filename: string;
  poster_filename: string | null;
  created_at: string;
};

export type Playlist = {
  id: number;
  name: string;
  created_at: string;
};

export const fileUrl = (name: string | null) =>
  name ? `${API_URL}/uploads/${name}` : "";

async function j<T>(r: Response): Promise<T> {
  if (!r.ok) throw new Error((await r.text()) || r.statusText);
  return r.json();
}

export const api = {
  listSongs: (q = "") =>
    fetch(`${API_URL}/api/songs?q=${encodeURIComponent(q)}`).then(j<Song[]>),
  uploadSong: (form: FormData) =>
    fetch(`${API_URL}/api/songs`, { method: "POST", body: form }).then(j<Song>),
  deleteSong: (id: number) =>
    fetch(`${API_URL}/api/songs/${id}`, { method: "DELETE" }).then(j),

  listPlaylists: () => fetch(`${API_URL}/api/playlists`).then(j<Playlist[]>),
  createPlaylist: (name: string) =>
    fetch(`${API_URL}/api/playlists`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).then(j<Playlist>),
  deletePlaylist: (id: number) =>
    fetch(`${API_URL}/api/playlists/${id}`, { method: "DELETE" }).then(j),
  playlistSongs: (id: number) =>
    fetch(`${API_URL}/api/playlists/${id}/songs`).then(j<Song[]>),
  addToPlaylist: (id: number, song_id: number) =>
    fetch(`${API_URL}/api/playlists/${id}/songs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ song_id }),
    }).then(j),
  removeFromPlaylist: (id: number, songId: number) =>
    fetch(`${API_URL}/api/playlists/${id}/songs/${songId}`, {
      method: "DELETE",
    }).then(j),
};
