"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TranscriptSegment } from "@/lib/types";

interface TranscriptPanelProps {
  segments: TranscriptSegment[];
  currentTime: number;
  onSeek: (seconds: number) => void;
}

export function TranscriptPanel({ segments, currentTime, onSeek }: TranscriptPanelProps) {
  const [query, setQuery] = useState("");
  const activeRef = useRef<HTMLButtonElement>(null);
  const activeIndex = useMemo(() => {
    let low = 0;
    let high = segments.length - 1;
    let match = 0;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      if ((segments[middle]?.startSeconds ?? 0) <= currentTime) {
        match = middle;
        low = middle + 1;
      } else high = middle - 1;
    }
    return match;
  }, [currentTime, segments]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized ? segments.filter((segment) => segment.text.toLowerCase().includes(normalized)) : segments;
  }, [query, segments]);

  useEffect(() => {
    if (query) return;
    activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeIndex, query]);

  return (
    <section className="flex h-full max-h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--panel)]" aria-label="Timed transcript">
      <div className="min-w-0 shrink-0 border-b border-[var(--line)] px-4 py-4">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--muted)]">Live cursor</p>
            <h2 className="mt-1 font-serif text-2xl font-medium tracking-[-0.025em]">Transcript</h2>
          </div>
          <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">
            {segments.length.toLocaleString()} lines
          </span>
        </div>
        <label className="flex h-9 items-center gap-2 border border-[var(--line)] bg-white px-3 text-[var(--muted)] focus-within:border-[var(--green)]">
          <Search size={13} />
          <span className="sr-only">Search transcript</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find in transcript"
            className="min-w-0 flex-1 bg-transparent text-xs text-[var(--ink)] outline-none placeholder:text-[#949a95]"
          />
        </label>
      </div>

      <div className="scrollbar-thin min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
        {visible.map((segment) => {
          const active = !query && segment.position === activeIndex;
          return (
            <button
              key={segment.id}
              ref={active ? activeRef : undefined}
              type="button"
              onClick={() => onSeek(segment.startSeconds)}
              className={`group grid w-full min-w-0 grid-cols-[52px_minmax(0,1fr)] gap-3 border-b border-[var(--line)] px-4 py-3 text-left transition-colors ${
                active ? "bg-[#e8eedf]" : "hover:bg-[var(--paper)]"
              }`}
              aria-current={active ? "true" : undefined}
            >
              <span className={`pt-0.5 font-mono text-[10px] font-semibold ${active ? "text-[var(--green)]" : "text-[var(--muted)] group-hover:text-[var(--green)]"}`}>
                {segment.timestamp}
              </span>
              <span className={`min-w-0 break-words text-[13px] leading-[1.55] [overflow-wrap:anywhere] ${active ? "font-medium text-[var(--green-dark)]" : "text-[#3d4740]"}`}>
                {segment.text}
              </span>
            </button>
          );
        })}
        {visible.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-[var(--muted)]">No transcript lines match “{query}”.</p>
        )}
      </div>
    </section>
  );
}
