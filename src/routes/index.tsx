import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  api,
  fileUrl,
  type Playlist,
  type Song,
  API_URL,
} from "@/lib/music-api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Music App" },
      { name: "description", content: "Upload, search, queue, and play your songs." },
    ],
  }),
  component: MusicApp,
});

function MusicApp() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [query, setQuery] = useState("");
  const [queue, setQueue] = useState<Song[]>([]);
  const [current, setCurrent] = useState<Song | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(null);
  const [playlistSongs, setPlaylistSongs] = useState<Song[]>([]);
  const [newPlaylist, setNewPlaylist] = useState("");
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // search debouncing
  useEffect(() => {
    const t = setTimeout(() => {
      api.listSongs(query).then(setSongs).catch((e) => setError(e.message));
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    api.listPlaylists().then(setPlaylists).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (activePlaylist) {
      api.playlistSongs(activePlaylist.id).then(setPlaylistSongs);
    } else {
      setPlaylistSongs([]);
    }
  }, [activePlaylist]);

  function playSong(s: Song) {
    setCurrent(s);
    setTimeout(() => audioRef.current?.play().catch(() => {}), 50);
  }

  function playNext() {
    if (queue.length === 0) {
      setCurrent(null);
      return;
    }
    const [next, ...rest] = queue;
    setQueue(rest);
    playSong(next);
  }

  function addToQueue(s: Song) {
    setQueue((q) => [...q, s]);
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      await api.uploadSong(form);
      (e.target as HTMLFormElement).reset();
      const list = await api.listSongs(query);
      setSongs(list);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function createPlaylist() {
    if (!newPlaylist.trim()) return;
    const p = await api.createPlaylist(newPlaylist.trim());
    setPlaylists((ps) => [p, ...ps]);
    setNewPlaylist("");
  }

  async function addToPlaylist(playlistId: number, song: Song) {
    await api.addToPlaylist(playlistId, song.id);
    if (activePlaylist?.id === playlistId) {
      setPlaylistSongs((s) => [...s, song]);
    }
  }

  async function removeFromPlaylist(song: Song) {
    if (!activePlaylist) return;
    await api.removeFromPlaylist(activePlaylist.id, song.id);
    setPlaylistSongs((s) => s.filter((x) => x.id !== song.id));
  }

  const displayedSongs = activePlaylist ? playlistSongs : songs;

  return (
    <div className="min-h-screen bg-background text-foreground pb-32">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-2xl font-bold">🎵 Music App</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Backend: <code>{API_URL}</code>
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr_300px] gap-4 p-4 max-w-7xl mx-auto">
        {/* Sidebar: Playlists */}
        <aside className="space-y-4">
          <div className="rounded-lg border border-border p-3">
            <h2 className="font-semibold mb-2">Playlists</h2>
            <div className="flex gap-2 mb-3">
              <input
                value={newPlaylist}
                onChange={(e) => setNewPlaylist(e.target.value)}
                placeholder="New playlist"
                className="flex-1 px-2 py-1 rounded bg-muted text-sm"
              />
              <button
                onClick={createPlaylist}
                className="px-2 py-1 rounded bg-primary text-primary-foreground text-sm"
              >
                +
              </button>
            </div>
            <ul className="space-y-1">
              <li>
                <button
                  onClick={() => setActivePlaylist(null)}
                  className={`w-full text-left px-2 py-1 rounded text-sm ${
                    !activePlaylist ? "bg-accent" : "hover:bg-muted"
                  }`}
                >
                  All Songs
                </button>
              </li>
              {playlists.map((p) => (
                <li key={p.id} className="flex items-center gap-1">
                  <button
                    onClick={() => setActivePlaylist(p)}
                    className={`flex-1 text-left px-2 py-1 rounded text-sm ${
                      activePlaylist?.id === p.id ? "bg-accent" : "hover:bg-muted"
                    }`}
                  >
                    {p.name}
                  </button>
                  <button
                    onClick={async () => {
                      await api.deletePlaylist(p.id);
                      setPlaylists((ps) => ps.filter((x) => x.id !== p.id));
                      if (activePlaylist?.id === p.id) setActivePlaylist(null);
                    }}
                    className="text-xs text-muted-foreground hover:text-destructive px-1"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <form
            onSubmit={handleUpload}
            className="rounded-lg border border-border p-3 space-y-2"
          >
            <h2 className="font-semibold">Upload Song</h2>
            <input
              name="title"
              required
              placeholder="Title"
              className="w-full px-2 py-1 rounded bg-muted text-sm"
            />
            <input
              name="artist"
              placeholder="Artist"
              className="w-full px-2 py-1 rounded bg-muted text-sm"
            />
            <label className="text-xs text-muted-foreground">Audio file *</label>
            <input
              name="audio"
              type="file"
              accept="audio/*"
              required
              className="w-full text-xs"
            />
            <label className="text-xs text-muted-foreground">Poster (optional)</label>
            <input
              name="poster"
              type="file"
              accept="image/*"
              className="w-full text-xs"
            />
            <button
              type="submit"
              className="w-full px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm font-medium"
            >
              Upload
            </button>
          </form>
        </aside>

        {/* Main: Songs */}
        <main>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔍 Search songs by title or artist..."
            className="w-full px-3 py-2 rounded-lg bg-muted mb-4"
          />

          <h2 className="font-semibold mb-2">
            {activePlaylist ? activePlaylist.name : "All Songs"} ({displayedSongs.length})
          </h2>

          {error && (
            <div className="rounded bg-destructive/10 text-destructive p-2 text-sm mb-2">
              {error}
            </div>
          )}

          <ul className="space-y-2">
            {displayedSongs.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 p-2 rounded-lg border border-border hover:bg-muted/50"
              >
                {s.poster_filename ? (
                  <img
                    src={fileUrl(s.poster_filename)}
                    alt={s.title}
                    className="w-12 h-12 rounded object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                    🎵
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{s.title}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {s.artist || "Unknown artist"}
                  </div>
                </div>
                <button
                  onClick={() => playSong(s)}
                  className="px-2 py-1 rounded bg-primary text-primary-foreground text-xs"
                >
                  ▶ Play
                </button>
                <button
                  onClick={() => addToQueue(s)}
                  className="px-2 py-1 rounded bg-secondary text-secondary-foreground text-xs"
                >
                  + Queue
                </button>
                {activePlaylist ? (
                  <button
                    onClick={() => removeFromPlaylist(s)}
                    className="px-2 py-1 rounded text-xs text-destructive"
                  >
                    Remove
                  </button>
                ) : (
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      if (id) addToPlaylist(id, s);
                      e.target.value = "";
                    }}
                    className="text-xs bg-muted rounded px-1 py-1"
                  >
                    <option value="">+ Playlist</option>
                    {playlists.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
                {!activePlaylist && (
                  <button
                    onClick={async () => {
                      await api.deleteSong(s.id);
                      setSongs((ss) => ss.filter((x) => x.id !== s.id));
                    }}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
            {displayedSongs.length === 0 && (
              <li className="text-sm text-muted-foreground p-4 text-center">
                No songs yet. Upload one to get started!
              </li>
            )}
          </ul>
        </main>

        {/* Right: Queue */}
        <aside className="rounded-lg border border-border p-3 h-fit">
          <h2 className="font-semibold mb-2">Queue ({queue.length})</h2>
          {queue.length === 0 ? (
            <p className="text-xs text-muted-foreground">Queue is empty.</p>
          ) : (
            <ul className="space-y-1">
              {queue.map((s, i) => (
                <li
                  key={`${s.id}-${i}`}
                  className="flex items-center gap-2 text-sm p-1 rounded hover:bg-muted"
                >
                  <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                  <span className="flex-1 truncate">{s.title}</span>
                  <button
                    onClick={() =>
                      setQueue((q) => q.filter((_, idx) => idx !== i))
                    }
                    className="text-xs text-muted-foreground"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          {queue.length > 0 && (
            <button
              onClick={() => setQueue([])}
              className="mt-2 text-xs text-muted-foreground hover:text-destructive"
            >
              Clear queue
            </button>
          )}
        </aside>
      </div>

      {/* Player bar */}
      {current && (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-3 flex items-center gap-4">
          {current.poster_filename && (
            <img
              src={fileUrl(current.poster_filename)}
              alt=""
              className="w-12 h-12 rounded object-cover"
            />
          )}
          <div className="min-w-0 w-48">
            <div className="font-medium truncate">{current.title}</div>
            <div className="text-xs text-muted-foreground truncate">
              {current.artist || "Unknown artist"}
            </div>
          </div>
          <audio
            ref={audioRef}
            src={fileUrl(current.audio_filename)}
            controls
            autoPlay
            onEnded={playNext}
            className="flex-1"
          />
          <button
            onClick={playNext}
            className="px-3 py-1 rounded bg-secondary text-secondary-foreground text-sm"
          >
            Next ⏭
          </button>
        </div>
      )}
    </div>
  );
}
