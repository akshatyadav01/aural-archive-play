import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Search, Upload, ListMusic, Library, Music2, Play, Pause,
  Plus, X, SkipForward, Trash2, ChevronLeft, Disc3, FolderPlus,
} from "lucide-react";
import { api, fileUrl, type Playlist, type Song } from "@/lib/music-api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sonix — Your Music, Reimagined" },
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
  const [playing, setPlaying] = useState(false);

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
    if (activePlaylist) api.playlistSongs(activePlaylist.id).then(setPlaylistSongs);
    else setPlaylistSongs([]);
  }, [activePlaylist]);

  function playSong(s: Song) {
    setCurrent(s);
    setTimeout(() => audioRef.current?.play().catch(() => {}), 50);
  }
  function togglePlay() {
    const a = audioRef.current; if (!a) return;
    if (a.paused) a.play(); else a.pause();
  }
  function playNext() {
    if (queue.length === 0) { setCurrent(null); return; }
    const [next, ...rest] = queue;
    setQueue(rest); playSong(next);
  }
  function addToQueue(s: Song) { setQueue((q) => [...q, s]); }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null); setUploadMsg(null); setUploading(true);
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    try {
      const s = await api.uploadSong(form);
      formEl.reset();
      setUploadMsg(`"${s.title}" added to your library`);
      const list = await api.listSongs(query); setSongs(list);
    } catch (err: any) { setError(`Upload failed: ${err.message}`); }
    finally { setUploading(false); }
  }
  async function createPlaylist() {
    if (!newPlaylist.trim()) return;
    try {
      const p = await api.createPlaylist(newPlaylist.trim());
      setPlaylists((ps) => [p, ...ps]); setNewPlaylist("");
    } catch (e: any) { setError(e.message); }
  }
  async function addToPlaylist(playlistId: number, song: Song) {
    await api.addToPlaylist(playlistId, song.id);
    if (activePlaylist?.id === playlistId) setPlaylistSongs((s) => [...s, song]);
  }
  async function removeFromPlaylist(song: Song) {
    if (!activePlaylist) return;
    await api.removeFromPlaylist(activePlaylist.id, song.id);
    setPlaylistSongs((s) => s.filter((x) => x.id !== song.id));
  }

  const tabMeta: Record<Tab, { title: string; subtitle: string }> = {
    search: { title: "Discover", subtitle: "Find songs in your library" },
    upload: { title: "Upload", subtitle: "Add new music to your collection" },
    queue: { title: "Up Next", subtitle: `${queue.length} song${queue.length === 1 ? "" : "s"} in queue` },
    playlists: { title: "Playlists", subtitle: "Curated collections, your way" },
  };

  return (
    <div className="min-h-screen text-foreground flex">
      {/* Sidebar */}
      <nav className="w-20 lg:w-64 shrink-0 border-r border-border bg-sidebar/60 backdrop-blur-xl flex flex-col sticky top-0 h-screen">
        <div className="p-5 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl grid place-items-center shrink-0"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
          >
            <Disc3 className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="hidden lg:block">
            <div className="text-base font-bold tracking-tight">Sonix</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Your sound</div>
          </div>
        </div>

        <div className="px-3 mt-2 flex-1 space-y-1">
          <MenuItem icon={<Search className="w-5 h-5" />} label="Search" active={tab === "search"} onClick={() => setTab("search")} />
          <MenuItem icon={<Upload className="w-5 h-5" />} label="Upload" active={tab === "upload"} onClick={() => setTab("upload")} />
          <MenuItem icon={<ListMusic className="w-5 h-5" />} label="Queue" badge={queue.length} active={tab === "queue"} onClick={() => setTab("queue")} />
          <MenuItem icon={<Library className="w-5 h-5" />} label="Playlists" active={tab === "playlists"} onClick={() => { setTab("playlists"); setActivePlaylist(null); }} />
        </div>

        <div className="hidden lg:block p-4 m-3 rounded-xl border border-border bg-card/40">
          <div className="text-xs font-semibold mb-1">Library</div>
          <div className="text-xs text-muted-foreground">{songs.length} songs · {playlists.length} playlists</div>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 min-w-0 overflow-y-auto pb-32">
        <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/70 border-b border-border/60 px-6 lg:px-10 py-5">
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">{tabMeta[tab].title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{tabMeta[tab].subtitle}</p>
        </header>

        <div className="px-6 lg:px-10 py-6 max-w-5xl">
          {error && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/30 text-destructive p-3 text-sm mb-4 flex items-start gap-2">
              <X className="w-4 h-4 mt-0.5 shrink-0" /> <span>{error}</span>
              <button onClick={() => setError(null)} className="ml-auto text-xs opacity-70 hover:opacity-100">dismiss</button>
            </div>
          )}

          {tab === "search" && (
            <section>
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="What do you want to listen to?"
                  className="w-full pl-11 pr-4 py-3.5 rounded-full bg-card/60 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-transparent transition-all"
                />
              </div>
              <SongList songs={songs} current={current} onPlay={playSong} onQueue={addToQueue}
                playlists={playlists} onAddToPlaylist={addToPlaylist}
                onDelete={async (s) => { await api.deleteSong(s.id); setSongs((ss) => ss.filter((x) => x.id !== s.id)); }}
              />
            </section>
          )}

          {tab === "upload" && (
            <section>
              {uploadMsg && (
                <div className="rounded-xl bg-primary/10 border border-primary/30 text-primary p-3 text-sm mb-4 flex items-center gap-2">
                  <Music2 className="w-4 h-4" /> {uploadMsg}
                </div>
              )}
              <form onSubmit={handleUpload} className="space-y-5 bg-card/60 backdrop-blur border border-border rounded-2xl p-6 lg:p-8" style={{ boxShadow: "var(--shadow-card)" }}>
                <div className="flex items-center gap-4 pb-4 border-b border-border">
                  <div className="w-12 h-12 rounded-xl grid place-items-center" style={{ background: "var(--gradient-accent)" }}>
                    <Upload className="w-5 h-5 text-accent-foreground" />
                  </div>
                  <div>
                    <div className="font-semibold">New track</div>
                    <div className="text-xs text-muted-foreground">Audio is stored securely in your library</div>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Title"><TextInput name="title" required placeholder="Midnight Drive" /></Field>
                  <Field label="Artist"><TextInput name="artist" placeholder="Unknown" /></Field>
                </div>
                <Field label="Audio file">
                  <FileInput name="audio" accept="audio/*" required />
                </Field>
                <Field label="Cover image (optional)">
                  <FileInput name="poster" accept="image/*" />
                </Field>
                <button
                  type="submit" disabled={uploading}
                  className="w-full px-4 py-3 rounded-xl text-primary-foreground font-semibold disabled:opacity-60 transition-transform hover:scale-[1.01] active:scale-[0.99]"
                  style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
                >
                  {uploading ? "Uploading…" : "Add to library"}
                </button>
              </form>
            </section>
          )}

          {tab === "queue" && (
            <section>
              {queue.length === 0 ? (
                <EmptyState icon={<ListMusic className="w-8 h-8" />} title="Your queue is empty" hint="Add songs from Search or any playlist." />
              ) : (
                <>
                  <button onClick={() => setQueue([])} className="mb-4 text-xs text-muted-foreground hover:text-destructive inline-flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> Clear queue
                  </button>
                  <ul className="space-y-1">
                    {queue.map((s, i) => (
                      <li key={`${s.id}-${i}`} className="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-card/60 transition-colors">
                        <span className="text-xs text-muted-foreground w-6 text-center font-mono">{i + 1}</span>
                        <Cover song={s} size={40} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate text-sm">{s.title}</div>
                          <div className="text-xs text-muted-foreground truncate">{s.artist || "Unknown artist"}</div>
                        </div>
                        <button onClick={() => playSong(s)} className="opacity-0 group-hover:opacity-100 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium transition-opacity">Play</button>
                        <button onClick={() => setQueue((q) => q.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive p-1.5">
                          <X className="w-4 h-4" />
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
              {!activePlaylist ? (
                <>
                  <div className="flex gap-2 mb-6">
                    <input
                      value={newPlaylist} onChange={(e) => setNewPlaylist(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && createPlaylist()}
                      placeholder="Name your next playlist…"
                      className="flex-1 px-4 py-3 rounded-xl bg-card/60 border border-border focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-transparent text-sm"
                    />
                    <button onClick={createPlaylist} className="px-5 rounded-xl text-primary-foreground font-semibold inline-flex items-center gap-2"
                      style={{ background: "var(--gradient-primary)" }}>
                      <FolderPlus className="w-4 h-4" /> Create
                    </button>
                  </div>

                  {playlists.length === 0 ? (
                    <EmptyState icon={<Library className="w-8 h-8" />} title="No playlists yet" hint="Create one above to start organizing your music." />
                  ) : (
                    <ul className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {playlists.map((p, i) => (
                        <li key={p.id} className="group relative">
                          <button onClick={() => setActivePlaylist(p)} className="w-full text-left">
                            <div
                              className="aspect-square rounded-2xl grid place-items-center mb-3 transition-transform group-hover:scale-[1.02]"
                              style={{
                                background: i % 2 === 0 ? "var(--gradient-primary)" : "var(--gradient-accent)",
                                boxShadow: "var(--shadow-card)",
                              }}
                            >
                              <Library className="w-10 h-10 text-primary-foreground/90" />
                            </div>
                            <div className="font-semibold truncate">{p.name}</div>
                            <div className="text-xs text-muted-foreground">Playlist</div>
                          </button>
                          <button
                            onClick={async () => { await api.deletePlaylist(p.id); setPlaylists((ps) => ps.filter((x) => x.id !== p.id)); }}
                            className="absolute top-2 right-2 p-2 rounded-full bg-background/70 backdrop-blur opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <div>
                  <button onClick={() => setActivePlaylist(null)} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-5">
                    <ChevronLeft className="w-4 h-4" /> All playlists
                  </button>
                  <div className="flex items-end gap-5 mb-6">
                    <div className="w-32 h-32 lg:w-40 lg:h-40 rounded-2xl grid place-items-center shrink-0"
                      style={{ background: "var(--gradient-accent)", boxShadow: "var(--shadow-card)" }}>
                      <Library className="w-14 h-14 text-accent-foreground/90" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-widest text-muted-foreground">Playlist</div>
                      <h2 className="text-3xl lg:text-5xl font-bold tracking-tight truncate">{activePlaylist.name}</h2>
                      <div className="text-sm text-muted-foreground mt-2">{playlistSongs.length} songs</div>
                    </div>
                  </div>
                  <SongList songs={playlistSongs} current={current} onPlay={playSong} onQueue={addToQueue}
                    playlists={playlists} onAddToPlaylist={addToPlaylist} onRemove={removeFromPlaylist} />
                </div>
              )}
            </section>
          )}
        </div>
      </main>

      {/* Player bar */}
      {current && (
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-card/80 backdrop-blur-2xl px-4 py-3 flex items-center gap-4"
          style={{ boxShadow: "0 -8px 32px -8px rgba(0,0,0,0.4)" }}>
          <div className="flex items-center gap-3 w-56 lg:w-72 min-w-0">
            <Cover song={current} size={52} />
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">{current.title}</div>
              <div className="text-xs text-muted-foreground truncate">{current.artist || "Unknown artist"}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={togglePlay} className="w-11 h-11 rounded-full grid place-items-center text-primary-foreground transition-transform hover:scale-105"
              style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
              {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
            <button onClick={playNext} className="w-10 h-10 rounded-full grid place-items-center bg-secondary text-secondary-foreground hover:bg-secondary/80">
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          <audio
            ref={audioRef}
            src={fileUrl(current.audio_filename)}
            autoPlay
            controls
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={playNext}
            className="flex-1 min-w-0 h-10"
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, active, badge, onClick }: {
  icon: React.ReactNode; label: string; active: boolean; badge?: number; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
        active ? "bg-primary/15 text-primary font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-card/60"
      }`}>
      <span className="shrink-0">{icon}</span>
      <span className="hidden lg:inline flex-1 text-left">{label}</span>
      {badge ? (
        <span className="hidden lg:inline text-[10px] font-bold bg-primary text-primary-foreground rounded-full px-2 py-0.5">{badge}</span>
      ) : null}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props}
      className="w-full px-3.5 py-2.5 rounded-lg bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-transparent text-sm transition-all" />
  );
}

function FileInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input type="file" {...props}
      className="block w-full text-sm text-muted-foreground file:mr-3 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-secondary file:text-secondary-foreground hover:file:bg-secondary/80 file:cursor-pointer cursor-pointer" />
  );
}

function Cover({ song, size = 48 }: { song: Song; size?: number }) {
  const s = `${size}px`;
  if (song.poster_filename) {
    return <img src={fileUrl(song.poster_filename)} alt="" className="rounded-lg object-cover shrink-0" style={{ width: s, height: s }} />;
  }
  return (
    <div className="rounded-lg grid place-items-center shrink-0" style={{ width: s, height: s, background: "var(--gradient-accent)" }}>
      <Music2 className="w-1/2 h-1/2 text-accent-foreground/80" />
    </div>
  );
}

function EmptyState({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <div className="text-center py-16 px-6 rounded-2xl border border-dashed border-border bg-card/30">
      <div className="w-16 h-16 mx-auto rounded-2xl grid place-items-center mb-4 text-muted-foreground bg-card/60">{icon}</div>
      <div className="font-semibold">{title}</div>
      <div className="text-sm text-muted-foreground mt-1">{hint}</div>
    </div>
  );
}

function SongList({
  songs, current, onPlay, onQueue, playlists, onAddToPlaylist, onDelete, onRemove,
}: {
  songs: Song[]; current: Song | null;
  onPlay: (s: Song) => void; onQueue: (s: Song) => void;
  playlists: Playlist[]; onAddToPlaylist: (playlistId: number, s: Song) => void;
  onDelete?: (s: Song) => void; onRemove?: (s: Song) => void;
}) {
  if (songs.length === 0) {
    return <EmptyState icon={<Music2 className="w-8 h-8" />} title="No songs yet" hint="Upload your first track to get started." />;
  }
  return (
    <ul className="space-y-1">
      {songs.map((s, i) => {
        const isCurrent = current?.id === s.id;
        return (
          <li key={s.id}
            className={`group flex items-center gap-4 px-3 py-2.5 rounded-xl transition-colors ${
              isCurrent ? "bg-primary/10" : "hover:bg-card/60"
            }`}>
            <div className="w-6 text-center text-xs text-muted-foreground font-mono group-hover:hidden">{i + 1}</div>
            <button onClick={() => onPlay(s)} className="w-6 hidden group-hover:grid place-items-center text-foreground">
              <Play className="w-3.5 h-3.5 fill-current" />
            </button>
            <Cover song={s} size={44} />
            <div className="flex-1 min-w-0">
              <div className={`font-medium truncate text-sm ${isCurrent ? "text-primary" : ""}`}>{s.title}</div>
              <div className="text-xs text-muted-foreground truncate">{s.artist || "Unknown artist"}</div>
            </div>
            <button onClick={() => onQueue(s)} title="Add to queue"
              className="opacity-0 group-hover:opacity-100 p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-all">
              <Plus className="w-4 h-4" />
            </button>
            {onAddToPlaylist && playlists.length > 0 && !onRemove && (
              <select defaultValue=""
                onChange={(e) => { const id = Number(e.target.value); if (id) onAddToPlaylist(id, s); e.target.value = ""; }}
                className="opacity-0 group-hover:opacity-100 text-xs bg-secondary text-secondary-foreground rounded-md px-2 py-1.5 border-0 transition-all cursor-pointer">
                <option value="">＋ Playlist</option>
                {playlists.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            {onRemove && (
              <button onClick={() => onRemove(s)} className="text-xs text-muted-foreground hover:text-destructive p-1.5 opacity-0 group-hover:opacity-100">
                <X className="w-4 h-4" />
              </button>
            )}
            {onDelete && (
              <button onClick={() => onDelete(s)} title="Delete song"
                className="opacity-0 group-hover:opacity-100 p-2 rounded-full hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
