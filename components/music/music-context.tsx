"use client";

import { createContext, useContext } from "react";
import type { MusicContextValue } from "@/lib/music/types";

const noop = () => {};

const defaultValue: MusicContextValue = {
  currentUrl: null,
  currentSource: null,
  playerState: "idle",
  isPanelOpen: false,
  recentLinks: [],
  errorMessage: "",
  playUrl: noop,
  stopMusic: noop,
  setPanelOpen: noop,
  setPlayerState: noop,
  setErrorMessage: noop,
  removeRecent: noop,
  clearHistory: noop,
};

export const MusicContext = createContext<MusicContextValue>(defaultValue);

export function useMusicContext(): MusicContextValue {
  return useContext(MusicContext);
}
