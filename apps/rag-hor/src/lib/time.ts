export function formatTimestamp(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function youtubeWatchUrl(videoId: string, startSeconds?: number): string {
  const url = new URL("https://www.youtube.com/watch");
  url.searchParams.set("v", videoId);
  if (startSeconds && startSeconds > 0) url.searchParams.set("t", `${Math.floor(startSeconds)}s`);
  return url.toString();
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
