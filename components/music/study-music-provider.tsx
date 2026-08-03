"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import type {
  StudyTrack,
  PlaybackState,
  RepeatMode,
  StudyMusicContextValue,
} from "@/lib/music/types";
import { STORAGE_KEYS } from "@/lib/music/types";

const defaultContextValue: StudyMusicContextValue = {
  tracks: [],
  currentTrack: null,
  playbackState: "idle",
  currentTime: 0,
  duration: 0,
  volume: 0.25,
  isMuted: false,
  repeatMode: "off",
  isPanelOpen: false,
  errorMessage: "",
  isLoadingTracks: true,
  playTrack: () => {},
  togglePlayPause: () => {},
  nextTrack: () => {},
  prevTrack: () => {},
  stopMusic: () => {},
  seekTo: () => {},
  setVolume: () => {},
  toggleMute: () => {},
  cycleRepeatMode: () => {},
  setPanelOpen: () => {},
  reloadTracks: async () => {},
};

export const StudyMusicContext = createContext<StudyMusicContextValue>(defaultContextValue);

export function useStudyMusicContext(): StudyMusicContextValue {
  return useContext(StudyMusicContext);
}

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function StudyMusicProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [tracks, setTracks] = useState<StudyTrack[]>([]);
  const [currentTrack, setCurrentTrack] = useState<StudyTrack | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.25);
  const [isMuted, setIsMuted] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoadingTracks, setIsLoadingTracks] = useState(true);

  // Single persistent <audio> ref
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Keep ref to current values for callbacks
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  const currentTrackRef = useRef(currentTrack);
  currentTrackRef.current = currentTrack;

  const repeatModeRef = useRef(repeatMode);
  repeatModeRef.current = repeatMode;

  const lastSavedTimeRef = useRef<number>(0);

  // Fetch active tracks for students
  const fetchTracks = useCallback(async () => {
    setIsLoadingTracks(true);
    try {
      const res = await fetch("/api/music");
      const data = await res.json();
      if (res.ok && data.ok && Array.isArray(data.data?.tracks)) {
        setTracks(data.data.tracks);
        return data.data.tracks as StudyTrack[];
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingTracks(false);
    }
    return [];
  }, []);

  // Hydrate state from storage after mount
  useEffect(() => {
    setMounted(true);

    const savedVol = readStorage<number>(STORAGE_KEYS.VOLUME, 0.25);
    const savedMuted = readStorage<boolean>(STORAGE_KEYS.MUTED, false);
    const savedRepeat = readStorage<RepeatMode>(STORAGE_KEYS.REPEAT_MODE, "off");
    const savedTrackId = readStorage<string | null>(STORAGE_KEYS.TRACK_ID, null);

    setVolumeState(savedVol);
    setIsMuted(savedMuted);
    setRepeatMode(savedRepeat);

    fetchTracks().then((loadedTracks) => {
      if (savedTrackId && loadedTracks.length > 0) {
        const found = loadedTracks.find((t) => t.id === savedTrackId);
        if (found) {
          setCurrentTrack(found);
          // Restore saved time from sessionStorage
          try {
            const savedTime = sessionStorage.getItem(STORAGE_KEYS.CURRENT_TIME);
            if (savedTime) {
              const t = parseFloat(savedTime);
              if (!isNaN(t) && t > 0) setCurrentTime(t);
            }
          } catch {
            // ignore
          }
        }
      }
    });
  }, [fetchTracks]);

  // Sync volume & muted to audio element
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // Update Media Session API
  const updateMediaSession = useCallback((track: StudyTrack | null) => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;

    if (!track) {
      navigator.mediaSession.metadata = null;
      return;
    }

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist || "Nhạc học bài",
        album: track.category,
      });
    } catch {
      // ignore
    }
  }, []);

  // Action: Play specific track
  const playTrack = useCallback(
    async (track: StudyTrack) => {
      const audio = audioRef.current;
      if (!audio) return;

      setErrorMessage("");

      // If choosing the same track that's currently paused
      if (currentTrackRef.current?.id === track.id) {
        if (audio.paused) {
          try {
            setPlaybackState("loading");
            await audio.play();
            setPlaybackState("playing");
          } catch {
            setPlaybackState("paused");
            setErrorMessage("Trình duyệt chưa cho phép phát nhạc. Hãy bấm Phát lại.");
          }
        } else {
          audio.pause();
          setPlaybackState("paused");
        }
        return;
      }

      // Switching to a new track
      audio.pause();
      setCurrentTrack(track);
      writeStorage(STORAGE_KEYS.TRACK_ID, track.id);
      updateMediaSession(track);

      setPlaybackState("loading");
      audio.src = track.src;
      audio.load();

      try {
        await audio.play();
        setPlaybackState("playing");
      } catch {
        setPlaybackState("paused");
        setErrorMessage("Trình duyệt chưa cho phép phát nhạc. Hãy bấm Phát lại.");
      }
    },
    [updateMediaSession]
  );

  // Action: Toggle Play / Pause
  const togglePlayPause = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentTrackRef.current) {
      if (tracksRef.current.length > 0) {
        await playTrack(tracksRef.current[0]);
      }
      return;
    }

    if (audio.paused) {
      try {
        setPlaybackState("loading");
        await audio.play();
        setPlaybackState("playing");
      } catch {
        setPlaybackState("paused");
        setErrorMessage("Trình duyệt chưa cho phép phát nhạc. Hãy bấm Phát lại.");
      }
    } else {
      audio.pause();
      setPlaybackState("paused");
    }
  }, [playTrack]);

  // Action: Next track
  const nextTrack = useCallback(() => {
    const list = tracksRef.current;
    if (list.length === 0) return;

    const cur = currentTrackRef.current;
    if (!cur) {
      playTrack(list[0]);
      return;
    }

    const idx = list.findIndex((t) => t.id === cur.id);
    if (idx === -1 || idx === list.length - 1) {
      // End of playlist
      if (repeatModeRef.current === "all") {
        playTrack(list[0]);
      } else {
        // stop or pause at end
        setPlaybackState("idle");
      }
    } else {
      playTrack(list[idx + 1]);
    }
  }, [playTrack]);

  // Action: Prev track
  const prevTrack = useCallback(() => {
    const list = tracksRef.current;
    if (list.length === 0) return;

    const cur = currentTrackRef.current;
    if (!cur) {
      playTrack(list[0]);
      return;
    }

    // If audio played > 3s, restart current track
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    const idx = list.findIndex((t) => t.id === cur.id);
    if (idx <= 0) {
      playTrack(list[list.length - 1]);
    } else {
      playTrack(list[idx - 1]);
    }
  }, [playTrack]);

  // Action: Stop music
  const stopMusic = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = "";
    }
    setPlaybackState("idle");
    setCurrentTrack(null);
    setCurrentTime(0);
    setDuration(0);
    setErrorMessage("");
    writeStorage(STORAGE_KEYS.TRACK_ID, null);
    updateMediaSession(null);
  }, [updateMediaSession]);

  // Action: Seek to time in seconds
  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    setCurrentTime(seconds);
  }, []);

  // Action: Set volume
  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    setIsMuted(false);
    writeStorage(STORAGE_KEYS.VOLUME, clamped);
    writeStorage(STORAGE_KEYS.MUTED, false);
  }, []);

  // Action: Toggle Mute
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      writeStorage(STORAGE_KEYS.MUTED, next);
      return next;
    });
  }, []);

  // Action: Cycle Repeat Mode
  const cycleRepeatMode = useCallback(() => {
    setRepeatMode((prev) => {
      const next: RepeatMode =
        prev === "off" ? "all" : prev === "all" ? "one" : "off";
      writeStorage(STORAGE_KEYS.REPEAT_MODE, next);
      return next;
    });
  }, []);

  // Audio Events Handlers
  const handleEnded = useCallback(() => {
    const mode = repeatModeRef.current;
    if (mode === "one") {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    } else {
      nextTrack();
    }
  }, [nextTrack]);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const now = audio.currentTime;
    setCurrentTime(now);

    // Throttle sessionStorage write to max once every 5s
    const realNow = Date.now();
    if (realNow - lastSavedTimeRef.current > 5000) {
      lastSavedTimeRef.current = realNow;
      try {
        sessionStorage.setItem(STORAGE_KEYS.CURRENT_TIME, now.toString());
      } catch {
        // ignore
      }
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setDuration(audio.duration || 0);

    // If restoring saved currentTime
    if (currentTime > 0 && currentTime < audio.duration) {
      audio.currentTime = currentTime;
    }
  }, [currentTime]);

  const handleError = useCallback(() => {
    setPlaybackState("error");
    setErrorMessage("Không thể tải file âm thanh. Bài hát có thể đã bị đổi hoặc không khả dụng.");
  }, []);

  // Register Media Session Handlers (Progressive enhancement)
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;

    try {
      navigator.mediaSession.setActionHandler("play", () => togglePlayPause());
      navigator.mediaSession.setActionHandler("pause", () => togglePlayPause());
      navigator.mediaSession.setActionHandler("previoustrack", () => prevTrack());
      navigator.mediaSession.setActionHandler("nexttrack", () => nextTrack());
      navigator.mediaSession.setActionHandler("seekbackward", () => {
        if (audioRef.current) seekTo(Math.max(0, audioRef.current.currentTime - 10));
      });
      navigator.mediaSession.setActionHandler("seekforward", () => {
        if (audioRef.current) seekTo(Math.min(duration, audioRef.current.currentTime + 10));
      });
    } catch {
      // ignore
    }
  }, [togglePlayPause, prevTrack, nextTrack, seekTo, duration]);

  return (
    <StudyMusicContext.Provider
      value={{
        tracks,
        currentTrack: mounted ? currentTrack : null,
        playbackState: mounted ? playbackState : "idle",
        currentTime: mounted ? currentTime : 0,
        duration: mounted ? duration : 0,
        volume: mounted ? volume : 0.25,
        isMuted: mounted ? isMuted : false,
        repeatMode: mounted ? repeatMode : "off",
        isPanelOpen: mounted ? isPanelOpen : false,
        errorMessage: mounted ? errorMessage : "",
        isLoadingTracks,
        playTrack,
        togglePlayPause,
        nextTrack,
        prevTrack,
        stopMusic,
        seekTo,
        setVolume,
        toggleMute,
        cycleRepeatMode,
        setPanelOpen: setIsPanelOpen,
        reloadTracks: fetchTracks,
      }}
    >
      {children}

      {/* SINGLE PERSISTENT HTMLAUDIO ELEMENT */}
      <audio
        ref={audioRef}
        preload="metadata"
        onEnded={handleEnded}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={() => setPlaybackState("loading")}
        onCanPlay={() => {
          if (playbackState === "loading" && audioRef.current && !audioRef.current.paused) {
            setPlaybackState("playing");
          }
        }}
        onError={handleError}
      />
    </StudyMusicContext.Provider>
  );
}
