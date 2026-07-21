"use client";

import { useEffect, useRef } from "react";

interface PlayerApi {
  getCurrentTime(): number;
  playVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  destroy(): void;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement,
        options: {
          videoId: string;
          playerVars: Record<string, number>;
          events: { onReady: (event: { target: PlayerApi }) => void };
        },
      ) => PlayerApi;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YouTubePlayerProps {
  videoId: string;
  seekSeconds: number | null;
  seekNonce: number;
  onTimeUpdate: (seconds: number) => void;
}

export function YouTubePlayer({ videoId, seekSeconds, seekNonce, onTimeUpdate }: YouTubePlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerApi | null>(null);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    const createPlayer = () => {
      if (cancelled || !hostRef.current || !window.YT || playerRef.current) return;
      playerRef.current = new window.YT.Player(hostRef.current, {
        videoId,
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, enablejsapi: 1 },
        events: {
          onReady: ({ target }) => {
            interval = setInterval(() => onTimeUpdate(target.getCurrentTime()), 350);
          },
        },
      });
    };

    if (window.YT?.Player) createPlayer();
    else {
      const existing = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        createPlayer();
      };
      if (!existing) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [videoId, onTimeUpdate]);

  useEffect(() => {
    if (seekSeconds === null || !playerRef.current) return;
    playerRef.current.seekTo(seekSeconds, true);
    playerRef.current.playVideo();
  }, [seekNonce, seekSeconds]);

  return <div ref={hostRef} className="h-full w-full" aria-label="YouTube hearing player" />;
}
