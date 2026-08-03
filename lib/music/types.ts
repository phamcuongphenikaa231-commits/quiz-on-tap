// Types for the study music feature

export type PlayerState = "idle" | "loading" | "playing" | "paused" | "error";

export type CornerPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export type ParsedMusicSource =
  | {
      provider: "youtube";
      kind: "video";
      videoId: string;
    }
  | {
      provider: "youtube";
      kind: "playlist";
      playlistId: string;
    }
  | {
      provider: "soundcloud";
      kind: "track";
      url: string; // validated, original URL for Widget API
    };

export interface RecentLink {
  url: string;
  provider: "youtube" | "soundcloud";
  label: string; // shortened display name
  addedAt: number; // timestamp
}

export interface MusicContextValue {
  currentUrl: string | null;
  currentSource: ParsedMusicSource | null;
  playerState: PlayerState;
  isPanelOpen: boolean;
  recentLinks: RecentLink[];
  errorMessage: string;
  // Actions
  playUrl: (url: string) => void;
  stopMusic: () => void;
  setPanelOpen: (open: boolean) => void;
  setPlayerState: (state: PlayerState) => void;
  setErrorMessage: (msg: string) => void;
  removeRecent: (url: string) => void;
  clearHistory: () => void;
}

export const STORAGE_KEYS = {
  RECENT_LINKS: "study_music_recent_links",
  CURRENT_URL: "study_music_current_url",
  PROVIDER: "study_music_provider",
  PANEL_OPEN: "study_music_panel_open",
  DESKTOP_CORNER: "study_music_player_desktop_corner",
  MOBILE_CORNER: "study_music_player_mobile_corner",
  DESKTOP_POS: "study_music_player_desktop_position",
  MOBILE_POS: "study_music_player_mobile_position",
} as const;

export const MAX_RECENT_LINKS = 5;
