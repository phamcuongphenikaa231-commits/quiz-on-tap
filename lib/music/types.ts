// Types for the MP3 study music feature

export type PlaybackState = "idle" | "loading" | "playing" | "paused" | "error";

export type RepeatMode = "off" | "one" | "all";

export interface StudyTrack {
  id: string;
  title: string;
  artist: string;
  category: string;
  src: string; // mapped from DB audio_url
  durationLabel: string;
  sortOrder: number;
  isActive?: boolean;
}

export interface StudyMusicContextValue {
  tracks: StudyTrack[];
  currentTrack: StudyTrack | null;
  playbackState: PlaybackState;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  repeatMode: RepeatMode;
  isPanelOpen: boolean;
  errorMessage: string;
  isLoadingTracks: boolean;
  // Actions
  playTrack: (track: StudyTrack) => void;
  togglePlayPause: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  stopMusic: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  cycleRepeatMode: () => void;
  setPanelOpen: (open: boolean) => void;
  reloadTracks: () => Promise<void | StudyTrack[]>;
}

export const MUSIC_CATEGORIES = [
  "Lo-fi",
  "Piano",
  "Âm thanh thiên nhiên",
  "Nhạc không lời",
  "Âm thanh nền",
  "Khác",
] as const;

export const STORAGE_KEYS = {
  TRACK_ID: "study_music_track_id",
  VOLUME: "study_music_volume",
  MUTED: "study_music_muted",
  REPEAT_MODE: "study_music_repeat_mode",
  PANEL_OPEN: "study_music_panel_open",
  CURRENT_TIME: "study_music_current_time",
} as const;
