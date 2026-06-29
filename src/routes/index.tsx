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

type Tab = "search" | "upload" | "queue" | "playlists";

function MusicApp() {
  const [tab, setTab] = useState<Tab>("search");

  const [songs, setSongs] = useState<Song[]>([]);
  const [query, setQuery] = useState("");
  const [queue, setQueue] = useState<Song[]>([]);
  const [current, setCurrent] = useState<Song | null>(null);

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(null);
  const [playlistSongs, setPlaylistSongs] = useState<Song[]>([]);
  const [newPlaylist, setNewPlaylist] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

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
    setError(null);
    setUploadMsg(null);
    setUploading(true);
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    try {
      const s = await api.uploadSong(form);
      formEl.reset();
      setUploadMsg(`✓ Uploaded "${s.title}"`);
      const list = await api.listSongs(query);
      setSongs(list);
    } catch (err: any) {
      setError(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  }

  async function createPlaylist() {
    if (!newPlaylist.trim()) return;
    try {
      const p = await api.createPlaylist(newPlaylist.trim());
      setPlaylists((ps) => [p, ...ps]);
      setNewPlaylist("");
    } catch (e: any) {
      setError(e.message);
    }
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

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Menu bar */}
      <nav className="w-20 md:w-56 border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="text-2xl">🎵</div>
          <div className="hidden md:block text-sm font-bold mt-1">Music App</div>
        </div>
        <div className="flex-1 p-2 space-y-1">
          <MenuItem icon="🔍" label="Search" active={tab === "search"} onClick={() => setTab("search")} />
          <MenuItem icon="⬆️" label="Upload" active={tab === "upload"} onClick={() => setTab("upload")} />
          <MenuItem icon="📜" label="Queue" badge={queue.length} active={tab === "queue"} onClick={() => setTab("queue")} />
          <MenuItem icon="📂" label="Playlists" active={tab === "playlists"} onClick={() => setTab("playlists")} />
        </div>
        <div className="hidden md:block p-3 text-[10px] text-muted-foreground border-t border-border">
          Backend: built-in
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-28">
        <div className="max-w-3xl mx-auto p-4 md:p-6">
          {error && (
            <div className="rounded-lg bg-destructive/10 text-destructive p-3 text-sm mb-4">
              {error}
            </div>
          )}

          {tab === "search" && (
            <section>
              <h1 className="text-2xl font-bold mb-4">Search</h1>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title or artist..."
                className="w-full px-4 py-3 rounded-lg bg-muted text-base mb-4 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <SongList
                songs={songs}
                onPlay={playSong}
                onQueue={addToQueue}
                playlists={playlists}
                onAddToPlaylist={addToPlaylist}
                onDelete={async (s) => {
                  await api.deleteSong(s.id);
                  setSongs((ss) => ss.filter((x) => x.id !== s.id));
                }}
              />
            </section>
          )}

          {tab === "upload" && (
            <section>
              <h1 className="text-2xl font-bold mb-4">Upload a Song</h1>
              {uploadMsg && (
                <div className="rounded-lg bg-primary/10 text-primary p-3 text-sm mb-4">
                  {uploadMsg}
                </div>
              )}
              <form onSubmit={handleUpload} className="space-y-4 bg-card border border-border rounded-xl p-5">
                <Field label="Title *">
                  <input
                    name="title"
                    required
                    placeholder="Song title"
                    className="w-full px-3 py-2 rounded-lg bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </Field>
                <Field label="Artist">
                  <input
                    name="artist"
                    placeholder="Artist name"
                    className="w-full px-3 py-2 rounded-lg bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </Field>
                <Field label="Audio file *">
                  <input name="audio" type="file" accept="audio/*" required className="w-full text-sm" />
                </Field>
                <Field label="Poster image (optional)">
                  <input name="poster" type="file" accept="image/*" className="w-full text-sm" />
                </Field>
                <button
                  type="submit"
                  disabled={uploading}
                  className="w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-60"
                >
                  {uploading ? "Uploading..." : "Upload Song"}
                </button>
                <p className="text-xs text-muted-foreground">
                  Songs are stored in your Neon database.
                </p>
              </form>
            </section>
          )}

          {tab === "queue" && (
            <section>
              <h1 className="text-2xl font-bold mb-4">Queue ({queue.length})</h1>
              {queue.length === 0 ? (
                <p className="text-muted-foreground">
                  Queue is empty. Add songs from Search or a Playlist.
                </p>
              ) : (
                <>
                  <button
                    onClick={() => setQueue([])}
                    className="mb-3 text-xs text-muted-foreground hover:text-destructive"
                  >
                    Clear queue
                  </button>
                  <ul className="space-y-2">
                    {queue.map((s, i) => (
                      <li
                        key={`${s.id}-${i}`}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
                      >
                        <span className="text-sm text-muted-foreground w-6">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{s.title}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {s.artist || "Unknown artist"}
                          </div>
                        </div>
                        <button
                          onClick={() => playSong(s)}
                          className="px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs"
                        >
                          Play now
                        </button>
                        <button
                          onClick={() => setQueue((q) => q.filter((_, idx) => idx !== i))}
                          className="text-sm text-muted-foreground hover:text-destructive px-1"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}

          {tab === "playlists" && (
            <section>
              <h1 className="text-2xl font-bold mb-4">Playlists</h1>

              <div className="flex gap-2 mb-4">
                <input
                  value={newPlaylist}
                  onChange={(e) => setNewPlaylist(e.target.value)}
                  placeholder="New playlist name"
                  className="flex-1 px-3 py-2 rounded-lg bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  onClick={createPlaylist}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium"
                >
                  Create
                </button>
              </div>

              {!activePlaylist ? (
                playlists.length === 0 ? (
                  <p className="text-muted-foreground">No playlists yet.</p>
                ) : (
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {playlists.map((p) => (
                      <li
                        key={p.id}
                        className="p-4 rounded-xl border border-border bg-card flex items-center justify-between"
                      >
                        <button
                          onClick={() => setActivePlaylist(p)}
                          className="flex-1 text-left font-medium"
                        >
                          📂 {p.name}
                        </button>
                        <button
                          onClick={async () => {
                            await api.deletePlaylist(p.id);
                            setPlaylists((ps) => ps.filter((x) => x.id !== p.id));
                          }}
                          className="text-xs text-muted-foreground hover:text-destructive"
                        >
                          Delete
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                <div>
                  <button
                    onClick={() => setActivePlaylist(null)}
                    className="text-sm text-muted-foreground mb-3 hover:text-foreground"
                  >
                    ← All playlists
                  </button>
                  <h2 className="text-xl font-semibold mb-3">
                    {activePlaylist.name} ({playlistSongs.length})
                  </h2>
                  <SongList
                    songs={playlistSongs}
                    onPlay={playSong}
                    onQueue={addToQueue}
                    playlists={playlists}
                    onAddToPlaylist={addToPlaylist}
                    onRemove={removeFromPlaylist}
                  />
                </div>
              )}
            </section>
          )}
        </div>
      </main>

      {/* Player bar */}
      {current && (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-3 flex items-center gap-3">
          {current.poster_filename ? (
            <img src={fileUrl(current.poster_filename)} alt="" className="w-12 h-12 rounded object-cover" />
          ) : (
            <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">🎵</div>
          )}
          <div className="min-w-0 w-32 md:w-48">
            <div className="font-medium truncate text-sm">{current.title}</div>
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
            className="flex-1 min-w-0"
          />
          <button
            onClick={playNext}
            className="px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-sm whitespace-nowrap"
          >
            Next ⏭
          </button>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  active,
  badge,
  onClick,
}: {
  icon: string;
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
        active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
      }`}
    >
      <span className="text-lg">{icon}</span>
      <span className="hidden md:inline flex-1 text-left">{label}</span>
      {badge ? (
        <span className="hidden md:inline text-xs bg-background/30 rounded-full px-2">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground block mb-1">{label}</span>
      {children}
    </label>
  );
}

function SongList({
  songs,
  onPlay,
  onQueue,
  playlists,
  onAddToPlaylist,
  onDelete,
  onRemove,
}: {
  songs: Song[];
  onPlay: (s: Song) => void;
  onQueue: (s: Song) => void;
  playlists: Playlist[];
  onAddToPlaylist: (playlistId: number, s: Song) => void;
  onDelete?: (s: Song) => void;
  onRemove?: (s: Song) => void;
}) {
  if (songs.length === 0) {
    return <p className="text-muted-foreground text-sm">No songs found.</p>;
  }
  return (
    <ul className="space-y-2">
      {songs.map((s) => (
        <li
          key={s.id}
          className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/40 transition-colors"
        >
          {s.poster_filename ? (
            <img src={fileUrl(s.poster_filename)} alt={s.title} className="w-12 h-12 rounded object-cover" />
          ) : (
            <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">🎵</div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{s.title}</div>
            <div className="text-xs text-muted-foreground truncate">
              {s.artist || "Unknown artist"}
            </div>
          </div>
          <button
            onClick={() => onPlay(s)}
            className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs"
            title="Play"
          >
            ▶
          </button>
          <button
            onClick={() => onQueue(s)}
            className="px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-xs"
            title="Add to queue"
          >
            +Q
          </button>
          {onAddToPlaylist && playlists.length > 0 && !onRemove && (
            <select
              defaultValue=""
              onChange={(e) => {
                const id = Number(e.target.value);
                if (id) onAddToPlaylist(id, s);
                e.target.value = "";
              }}
              className="text-xs bg-muted rounded-md px-1 py-1"
              title="Add to playlist"
            >
              <option value="">+ List</option>
              {playlists.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          {onRemove && (
            <button
              onClick={() => onRemove(s)}
              className="text-xs text-muted-foreground hover:text-destructive px-1"
            >
              Remove
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(s)}
              className="text-xs text-muted-foreground hover:text-destructive px-1"
              title="Delete song"
            >
              ✕
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
