"use client";

import { useEffect, useRef } from "react";

interface SoundCloudPlayerProps {
  url: string; // validated SoundCloud URL
  onStateChange: (state: "playing" | "paused" | "ended") => void;
  onReady: () => void;
  onError: (msg: string) => void;
}

declare global {
  interface Window {
    SC?: {
      Widget: ((element: HTMLIFrameElement) => SCWidget) & {
        Events: {
          PLAY: string;
          PAUSE: string;
          FINISH: string;
          ERROR: string;
          READY: string;
        };
      };
    };
  }
}

interface SCWidget {
  bind: (event: string, callback: () => void) => void;
  unbind: (event: string) => void;
  load: (url: string, options: Record<string, unknown>) => void;
}

let scApiLoaded = false;
let scApiLoading = false;
const scReadyCallbacks: (() => void)[] = [];

function loadSoundCloudAPI(): Promise<void> {
  return new Promise((resolve) => {
    if (scApiLoaded && window.SC) {
      resolve();
      return;
    }
    scReadyCallbacks.push(resolve);
    if (scApiLoading) return;
    scApiLoading = true;

    const script = document.createElement("script");
    script.src = "https://w.soundcloud.com/player/api.js";
    script.async = true;
    script.onload = () => {
      scApiLoaded = true;
      scReadyCallbacks.forEach((cb) => cb());
      scReadyCallbacks.length = 0;
    };
    script.onerror = () => {
      scReadyCallbacks.forEach((cb) => cb()); // resolve anyway, error handled elsewhere
      scReadyCallbacks.length = 0;
    };
    document.head.appendChild(script);
  });
}

function buildSCEmbedUrl(trackUrl: string): string {
  const encoded = encodeURIComponent(trackUrl);
  return `https://w.soundcloud.com/player/?url=${encoded}&color=%234f46e5&auto_play=true&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`;
}

export function SoundCloudPlayer({ url, onStateChange, onReady, onError }: SoundCloudPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const widgetRef = useRef<SCWidget | null>(null);

  const onStateChangeRef = useRef(onStateChange);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  onStateChangeRef.current = onStateChange;
  onReadyRef.current = onReady;
  onErrorRef.current = onError;

  useEffect(() => {
    let destroyed = false;

    async function init() {
      await loadSoundCloudAPI();
      if (destroyed || !iframeRef.current || !window.SC) {
        if (!window.SC) onErrorRef.current("Không thể tải SoundCloud. Vui lòng thử lại.");
        return;
      }

      const widget = window.SC.Widget(iframeRef.current);
      widgetRef.current = widget;

      widget.bind(window.SC.Widget.Events.READY, () => {
        if (!destroyed) onReadyRef.current();
      });
      widget.bind(window.SC.Widget.Events.PLAY, () => {
        if (!destroyed) onStateChangeRef.current("playing");
      });
      widget.bind(window.SC.Widget.Events.PAUSE, () => {
        if (!destroyed) onStateChangeRef.current("paused");
      });
      widget.bind(window.SC.Widget.Events.FINISH, () => {
        if (!destroyed) onStateChangeRef.current("ended");
      });
      widget.bind(window.SC.Widget.Events.ERROR, () => {
        if (!destroyed) onErrorRef.current("Không thể phát track này. Hãy kiểm tra link và thử lại.");
      });
    }

    init();

    return () => {
      destroyed = true;
      if (widgetRef.current && window.SC) {
        try {
          widgetRef.current.unbind(window.SC.Widget.Events.READY);
          widgetRef.current.unbind(window.SC.Widget.Events.PLAY);
          widgetRef.current.unbind(window.SC.Widget.Events.PAUSE);
          widgetRef.current.unbind(window.SC.Widget.Events.FINISH);
          widgetRef.current.unbind(window.SC.Widget.Events.ERROR);
        } catch { /* ignore */ }
        widgetRef.current = null;
      }
    };
  }, [url]);

  return (
    <div className="w-full rounded-xl overflow-hidden">
      <iframe
        ref={iframeRef}
        src={buildSCEmbedUrl(url)}
        width="100%"
        height="166"
        allow="autoplay"
        title="SoundCloud Player"
        className="block w-full"
        style={{ border: "none" }}
      />
    </div>
  );
}
