import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Search, Upload, ListMusic, Library, Music2, Play, Pause,
  Plus, X, SkipBack, SkipForward, Trash2, ChevronLeft, Disc3, FolderPlus,
  Repeat, Repeat1, Lock, LogOut, Menu,
} from "lucide-react";
import { api, fileUrl, type Playlist, type Song } from "@/lib/music-api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sonix — Your Music, Reimagined" },
      { name: "description", content: "Upload, search, queue, and play your songs." },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
  }),
  component: Gate,
});

const PASSWORD = "tendercoco";
const STORAGE_KEY = "sonix-unlocked";

function Gate() {
  const [unlocked, setUnlocked] = useState(false);
  const [input, setInput] = useState("");
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem(STORAGE_KEY) === "1") {
      setUnlocked(true);
    }
  }, []);

  if (unlocked) return <MusicApp onLock={() => { sessionStorage.removeItem(STORAGE_KEY); setUnlocked(false); }} />;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (input === PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, "1");
      setUnlocked(true);
    } else {
      setErr(true);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm bg-card/60 backdrop-blur border border-border rounded-2xl p-6 sm:p-8 space-y-5"
        style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl grid place-items-center shrink-0"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
            <Lock className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight">Sonix</div>
            <div className="text-xs text-muted-foreground">Enter password to continue</div>
          </div>
        </div>
        <input
          type="password" autoFocus value={input}
          onChange={(e) => { setInput(e.target.value); setErr(false); }}
          placeholder="Password"
          className="w-full px-4 py-3 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-primary/60 text-sm"
        />
        {err && <div className="text-xs text-destructive">Wrong password. Try again.</div>}
        <button type="submit"
          className="w-full px-4 py-3 rounded-xl text-primary-foreground font-semibold transition-transform hover:scale-[1.01] active:scale-[0.99]"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
          Unlock
        </button>
      </form>
    </div>
  );
}

type Tab = "search" | "upload" | "queue" | "playlists";

function MusicApp({ onLock }: { onLock: () => void }) {
  const [tab, setTab] = useState<Tab>("search");
  const [songs, setSongs] = useState<Song[]>([]);
  const [query, setQuery] = useState("");
  const [queue, setQueue] = useState<Song[]>([]);
  const [history, setHistory] = useState<Song[]>([]);
  const [current, setCurrent] = useState<Song | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [navOpen, setNavOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);


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
    setHistory((h) => (current && current.id !== s.id ? [...h, current] : h));
    setCurrent(s);
    setTimeout(() => audioRef.current?.play().catch(() => {}), 50);
  }
  function togglePlay() {
    const a = audioRef.current; if (!a) return;
    if (a.paused) a.play(); else a.pause();
  }
  function playNext() {
    if (loop && current) {
      const a = audioRef.current; if (!a) return;
      a.currentTime = 0; a.play().catch(() => {}); return;
    }
    if (queue.length === 0) { setCurrent(null); return; }
    const [next, ...rest] = queue;
    setQueue(rest); playSong(next);
  }
  function playPrevious() {
    const a = audioRef.current;
    if (a && progress > 3) {
      a.currentTime = 0;
      a.play().catch(() => {});
      return;
    }
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setCurrent(prev);
    setTimeout(() => audioRef.current?.play().catch(() => {}), 50);
  }
  function addToQueue(s: Song) {
    setQueue((q) => [...q, s]);
    setToast(`Added "${s.title}" to queue`);
    window.setTimeout(() => setToast(null), 2200);
  }
  function selectTab(t: Tab) { setTab(t); setNavOpen(false); }


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

  const navItems = (
    <>
      <MenuItem icon={<Search className="w-5 h-5" />} label="Search" active={tab === "search"} onClick={() => selectTab("search")} />
      <MenuItem icon={<Upload className="w-5 h-5" />} label="Upload" active={tab === "upload"} onClick={() => selectTab("upload")} />
      <MenuItem icon={<ListMusic className="w-5 h-5" />} label="Queue" badge={queue.length} active={tab === "queue"} onClick={() => selectTab("queue")} />
      <MenuItem icon={<Library className="w-5 h-5" />} label="Playlists" active={tab === "playlists"} onClick={() => { selectTab("playlists"); setActivePlaylist(null); }} />
    </>
  );

  const pct = duration > 0 ? (progress / duration) * 100 : 0;
  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const a = audioRef.current; if (!a || !duration) return;
    a.currentTime = (Number(e.target.value) / 100) * duration;
  }
  function fmt(t: number) {
    if (!isFinite(t)) return "0:00";
    const m = Math.floor(t / 60); const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <div className="min-h-screen text-foreground flex flex-col md:flex-row">
      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-sidebar/80 backdrop-blur-xl border-b border-border">
        <button onClick={() => setNavOpen((v) => !v)} className="p-2 -ml-2 rounded-lg hover:bg-card/60">
          <Menu className="w-5 h-5" />
        </button>
        <div className="w-8 h-8 rounded-lg grid place-items-center shrink-0"
          style={{ background: "var(--gradient-primary)" }}>
          <Disc3 className="w-4 h-4 text-primary-foreground" />
        </div>
        <div className="font-bold tracking-tight">Sonix</div>
        <button onClick={onLock} className="ml-auto p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card/60" title="Lock">
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* Mobile nav drawer (from hamburger) */}
      {navOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-xl" onClick={() => setNavOpen(false)}>
          <div className="p-4 space-y-1" onClick={(e) => e.stopPropagation()}>
            {navItems}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed z-50 left-1/2 -translate-x-1/2 top-16 md:top-6 px-4 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-lg animate-in fade-in slide-in-from-top-2"
          style={{ boxShadow: "var(--shadow-glow)" }}>
          {toast}
        </div>
      )}

      {/* Sidebar (desktop) */}
      <nav className="hidden md:flex w-20 lg:w-64 shrink-0 border-r border-border bg-sidebar/60 backdrop-blur-xl flex-col sticky top-0 h-screen">
        <div className="p-5 flex items-center gap-3">

          <div className="w-10 h-10 rounded-xl grid place-items-center shrink-0"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
            <Disc3 className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="hidden lg:block">
            <div className="text-base font-bold tracking-tight">Sonix</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Your sound</div>
          </div>
        </div>

        <div className="px-3 mt-2 flex-1 space-y-1">{navItems}</div>

        <div className="hidden lg:block p-4 m-3 rounded-xl border border-border bg-card/40">
          <div className="text-xs font-semibold mb-1">Library</div>
          <div className="text-xs text-muted-foreground mb-3">{songs.length} songs · {playlists.length} playlists</div>
          <button onClick={onLock} className="w-full text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
            <LogOut className="w-3 h-3" /> Lock app
          </button>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 min-w-0 overflow-y-auto pb-56 md:pb-32">
        <header className="hidden md:block sticky top-0 z-10 backdrop-blur-xl bg-background/70 border-b border-border/60 px-6 lg:px-10 py-5">
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">{tabMeta[tab].title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{tabMeta[tab].subtitle}</p>
        </header>

        <div className="px-4 sm:px-6 lg:px-10 py-5 md:py-6 max-w-5xl">
          <div className="md:hidden mb-4">
            <h1 className="text-2xl font-bold tracking-tight">{tabMeta[tab].title}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{tabMeta[tab].subtitle}</p>
          </div>

          {error && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/30 text-destructive p-3 text-sm mb-4 flex items-start gap-2">
              <X className="w-4 h-4 mt-0.5 shrink-0" /> <span className="min-w-0 break-words">{error}</span>
              <button onClick={() => setError(null)} className="ml-auto text-xs opacity-70 hover:opacity-100 shrink-0">dismiss</button>
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
                playlists={playlists} onAddToPlaylist={addToPlaylist} />
            </section>
          )}

          {tab === "upload" && (
            <section>
              {uploadMsg && (
                <div className="rounded-xl bg-primary/10 border border-primary/30 text-primary p-3 text-sm mb-4 flex items-center gap-2">
                  <Music2 className="w-4 h-4" /> {uploadMsg}
                </div>
              )}
              <form onSubmit={handleUpload} className="space-y-5 bg-card/60 backdrop-blur border border-border rounded-2xl p-5 sm:p-6 lg:p-8" style={{ boxShadow: "var(--shadow-card)" }}>
                <div className="flex items-center gap-4 pb-4 border-b border-border">
                  <div className="w-12 h-12 rounded-xl grid place-items-center shrink-0" style={{ background: "var(--gradient-accent)" }}>
                    <Upload className="w-5 h-5 text-accent-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold">New track</div>
                    <div className="text-xs text-muted-foreground">Audio is stored securely in your library</div>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Title"><TextInput name="title" required placeholder="Midnight Drive" /></Field>
                  <Field label="Artist"><TextInput name="artist" placeholder="Unknown" /></Field>
                </div>
                <Field label="Audio file"><FileInput name="audio" accept="audio/*" required /></Field>
                <Field label="Cover image (optional)"><FileInput name="poster" accept="image/*" /></Field>
                <button type="submit" disabled={uploading}
                  className="w-full px-4 py-3 rounded-xl text-primary-foreground font-semibold disabled:opacity-60 transition-transform hover:scale-[1.01] active:scale-[0.99]"
                  style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
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
                      <li key={`${s.id}-${i}`} className="flex items-center gap-3 px-2 sm:px-3 py-2.5 rounded-xl hover:bg-card/60 transition-colors">
                        <span className="text-xs text-muted-foreground w-5 sm:w-6 text-center font-mono shrink-0">{i + 1}</span>
                        <Cover song={s} size={40} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate text-sm">{s.title}</div>
                          <div className="text-xs text-muted-foreground truncate">{s.artist || "Unknown artist"}</div>
                        </div>
                        <button onClick={() => playSong(s)} className="px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium shrink-0">Play</button>
                        <button onClick={() => setQueue((q) => q.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive p-1.5 shrink-0">
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
                  <div className="flex flex-col sm:flex-row gap-2 mb-6">
                    <input
                      value={newPlaylist} onChange={(e) => setNewPlaylist(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && createPlaylist()}
                      placeholder="Name your next playlist…"
                      className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-card/60 border border-border focus:outline-none focus:ring-2 focus:ring-primary/60 text-sm"
                    />
                    <button onClick={createPlaylist} className="px-5 py-3 rounded-xl text-primary-foreground font-semibold inline-flex items-center justify-center gap-2"
                      style={{ background: "var(--gradient-primary)" }}>
                      <FolderPlus className="w-4 h-4" /> Create
                    </button>
                  </div>

                  {playlists.length === 0 ? (
                    <EmptyState icon={<Library className="w-8 h-8" />} title="No playlists yet" hint="Create one above to start organizing your music." />
                  ) : (
                    <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                      {playlists.map((p, i) => {
                        const gradients = [
                          "linear-gradient(135deg, oklch(0.72 0.21 150), oklch(0.55 0.22 200))",
                          "linear-gradient(135deg, oklch(0.65 0.22 305), oklch(0.5 0.24 260))",
                          "linear-gradient(135deg, oklch(0.75 0.2 70), oklch(0.6 0.24 22))",
                          "linear-gradient(135deg, oklch(0.7 0.2 220), oklch(0.55 0.22 305))",
                          "linear-gradient(135deg, oklch(0.68 0.22 340), oklch(0.55 0.2 30))",
                          "linear-gradient(135deg, oklch(0.7 0.18 170), oklch(0.5 0.2 250))",
                        ];
                        const bg = gradients[i % gradients.length];
                        return (
                          <li key={p.id} className="group relative">
                            <button onClick={() => setActivePlaylist(p)}
                              className="w-full text-left rounded-2xl p-3 sm:p-4 bg-card/60 border border-border hover:bg-card transition-all hover:-translate-y-0.5"
                              style={{ boxShadow: "var(--shadow-card)" }}>
                              <div className="aspect-square rounded-xl grid place-items-center mb-3 relative overflow-hidden"
                                style={{ background: bg }}>
                                <Library className="w-10 h-10 sm:w-12 sm:h-12 text-primary-foreground/90 drop-shadow-lg" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                                <div className="absolute bottom-1.5 right-1.5 w-8 h-8 rounded-full grid place-items-center bg-primary text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity translate-y-1 group-hover:translate-y-0"
                                  style={{ boxShadow: "var(--shadow-glow)" }}>
                                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                                </div>
                              </div>
                              <div className="font-semibold truncate text-sm sm:text-base">{p.name}</div>
                              <div className="text-[11px] text-muted-foreground uppercase tracking-wider mt-0.5">Playlist</div>
                            </button>
                            <button
                              onClick={async () => { if (confirm(`Delete playlist "${p.name}"?`)) { await api.deletePlaylist(p.id); setPlaylists((ps) => ps.filter((x) => x.id !== p.id)); } }}
                              className="absolute top-3 right-3 p-1.5 rounded-full bg-background/80 backdrop-blur text-muted-foreground opacity-100 md:opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground transition-all">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                </>
              ) : (
                <div>
                  <button onClick={() => setActivePlaylist(null)} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-5">
                    <ChevronLeft className="w-4 h-4" /> All playlists
                  </button>
                  <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-5 mb-6">
                    <div className="w-28 h-28 sm:w-32 sm:h-32 lg:w-40 lg:h-40 rounded-2xl grid place-items-center shrink-0"
                      style={{ background: "var(--gradient-accent)", boxShadow: "var(--shadow-card)" }}>
                      <Library className="w-12 h-12 sm:w-14 sm:h-14 text-accent-foreground/90" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-widest text-muted-foreground">Playlist</div>
                      <h2 className="text-2xl sm:text-3xl lg:text-5xl font-bold tracking-tight truncate">{activePlaylist.name}</h2>
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

      {/* Mobile bottom tab bar (always visible) */}
      <nav className="md:hidden fixed left-0 right-0 bottom-0 z-30 bg-sidebar/95 backdrop-blur-xl border-t border-border grid grid-cols-4 h-16">
        {[
          { t: "search" as Tab, icon: <Search className="w-5 h-5" />, label: "Search" },
          { t: "upload" as Tab, icon: <Upload className="w-5 h-5" />, label: "Upload" },
          { t: "queue" as Tab, icon: <ListMusic className="w-5 h-5" />, label: "Queue", badge: queue.length },
          { t: "playlists" as Tab, icon: <Library className="w-5 h-5" />, label: "Playlists" },
        ].map((it) => {
          const active = tab === it.t;
          return (
            <button key={it.t} onClick={() => { selectTab(it.t); if (it.t === "playlists") setActivePlaylist(null); }}
              className={`relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}>
              {it.icon}
              <span>{it.label}</span>
              {it.badge ? (
                <span className="absolute top-1.5 right-1/2 translate-x-4 text-[9px] font-bold bg-primary text-primary-foreground rounded-full min-w-4 h-4 px-1 grid place-items-center">{it.badge}</span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Player bar */}
      {current && (
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-20 border-t border-border bg-card/90 backdrop-blur-2xl px-3 sm:px-4 py-3"
          style={{ boxShadow: "0 -8px 32px -8px rgba(0,0,0,0.4)" }}>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-3 flex-1 sm:flex-initial sm:w-56 lg:w-72 min-w-0">
              <Cover song={current} size={44} />
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">{current.title}</div>
                <div className="text-xs text-muted-foreground truncate">{current.artist || "Unknown artist"}</div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button onClick={() => setLoop((v) => !v)} title={loop ? "Loop on" : "Loop off"}
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full grid place-items-center transition-colors ${
                  loop ? "bg-primary/20 text-primary" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}>
                {loop ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
              </button>
              <button onClick={playPrevious} title="Previous" disabled={history.length === 0 && progress <= 3}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full grid place-items-center bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-40 disabled:hover:bg-secondary">
                <SkipBack className="w-4 h-4" />
              </button>
              <button onClick={togglePlay}
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-full grid place-items-center text-primary-foreground transition-transform hover:scale-105"
                style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
                {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <button onClick={playNext} className="w-9 h-9 sm:w-10 sm:h-10 rounded-full grid place-items-center bg-secondary text-secondary-foreground hover:bg-secondary/80">
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-2 flex-1 min-w-0">
              <span className="text-[10px] text-muted-foreground font-mono w-9 text-right">{fmt(progress)}</span>
              <input
                type="range" min={0} max={100} step={0.1} value={pct} onChange={seek}
                className="flex-1 accent-primary h-1"
              />
              <span className="text-[10px] text-muted-foreground font-mono w-9">{fmt(duration)}</span>
            </div>
          </div>

          {/* Mobile scrubber below */}
          <div className="flex sm:hidden items-center gap-2 mt-2">
            <span className="text-[10px] text-muted-foreground font-mono w-9 text-right">{fmt(progress)}</span>
            <input
              type="range" min={0} max={100} step={0.1} value={pct} onChange={seek}
              className="flex-1 accent-primary h-1"
            />
            <span className="text-[10px] text-muted-foreground font-mono w-9">{fmt(duration)}</span>
          </div>

          <audio
            ref={audioRef}
            src={fileUrl(current.audio_filename)}
            autoPlay
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={playNext}
            onTimeUpdate={(e) => setProgress((e.target as HTMLAudioElement).currentTime)}
            onLoadedMetadata={(e) => setDuration((e.target as HTMLAudioElement).duration)}
            className="hidden"
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
      <span className="md:hidden lg:inline flex-1 text-left">{label}</span>
      {badge ? (
        <span className="md:hidden lg:inline text-[10px] font-bold bg-primary text-primary-foreground rounded-full px-2 py-0.5">{badge}</span>
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
      className="w-full px-3.5 py-2.5 rounded-lg bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-primary/60 text-sm transition-all" />
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
    <div className="text-center py-12 sm:py-16 px-6 rounded-2xl border border-dashed border-border bg-card/30">
      <div className="w-16 h-16 mx-auto rounded-2xl grid place-items-center mb-4 text-muted-foreground bg-card/60">{icon}</div>
      <div className="font-semibold">{title}</div>
      <div className="text-sm text-muted-foreground mt-1">{hint}</div>
    </div>
  );
}

function SongList({
  songs, current, onPlay, onQueue, playlists, onAddToPlaylist, onRemove,
}: {
  songs: Song[]; current: Song | null;
  onPlay: (s: Song) => void; onQueue: (s: Song) => void;
  playlists: Playlist[]; onAddToPlaylist: (playlistId: number, s: Song) => void;
  onRemove?: (s: Song) => void;
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
            className={`group flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 sm:py-2.5 rounded-xl transition-colors ${
              isCurrent ? "bg-primary/10" : "hover:bg-card/60"
            }`}>
            <button onClick={() => onPlay(s)} className="w-6 grid place-items-center text-foreground shrink-0" title="Play">
              <span className="text-xs text-muted-foreground font-mono group-hover:hidden">{i + 1}</span>
              <Play className="w-3.5 h-3.5 fill-current hidden group-hover:block" />
            </button>
            <Cover song={s} size={44} />
            <div className="flex-1 min-w-0" onClick={() => onPlay(s)}>
              <div className={`font-medium truncate text-sm ${isCurrent ? "text-primary" : ""}`}>{s.title}</div>
              <div className="text-xs text-muted-foreground truncate">{s.artist || "Unknown artist"}</div>
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <button onClick={() => onQueue(s)} title="Add to queue"
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full grid place-items-center bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all shrink-0">
                <Plus className="w-4 h-4" />
              </button>

              {onAddToPlaylist && playlists.length > 0 && !onRemove && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button title="Add to playlist"
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-full grid place-items-center bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all shrink-0">
                      <FolderPlus className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Add to playlist</div>
                    {playlists.map((p) => (
                      <DropdownMenuItem key={p.id} onClick={() => onAddToPlaylist(p.id, s)} className="cursor-pointer">
                        <ListMusic className="w-4 h-4 text-muted-foreground" />
                        <span className="truncate">{p.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {onRemove && (
                <button onClick={() => onRemove(s)} className="w-8 h-8 sm:w-9 sm:h-9 rounded-full grid place-items-center bg-secondary/60 hover:bg-destructive text-muted-foreground hover:text-destructive-foreground transition-all shrink-0">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

