"use client";

import { ArrowLeft, Captions, CheckCircle2, Database, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import type { Conversation, ConversationSummary, HearingDetail } from "@/lib/types";
import { formatTimestamp } from "@/lib/time";
import { ChatPanel } from "@/components/chat-panel";
import { TranscriptPanel } from "@/components/transcript-panel";
import { YouTubePlayer } from "@/components/youtube-player";

interface HearingWorkspaceProps {
  hearing: HearingDetail;
  initialConversation: Conversation;
  initialConversations: ConversationSummary[];
}

export function HearingWorkspace({ hearing, initialConversation, initialConversations }: HearingWorkspaceProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [seekSeconds, setSeekSeconds] = useState<number | null>(null);
  const [seekNonce, setSeekNonce] = useState(0);
  const [conversation, setConversation] = useState(initialConversation);
  const [conversations, setConversations] = useState(initialConversations);

  const seek = useCallback((seconds: number) => {
    setSeekSeconds(seconds);
    setSeekNonce((nonce) => nonce + 1);
    setCurrentTime(seconds);
  }, []);

  const loadConversation = async (id: string) => {
    if (id === conversation.id) return;
    const response = await fetch(`/api/conversations/${id}`);
    if (!response.ok) return;
    const data = (await response.json()) as { conversation: Conversation };
    setConversation(data.conversation);
  };

  const newConversation = async () => {
    const response = await fetch("/api/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hearingId: hearing.id }),
    });
    if (!response.ok) return;
    const data = (await response.json()) as { conversation: Conversation };
    setConversations((items) => [data.conversation, ...items]);
    setConversation(data.conversation);
  };

  return (
    <main className="flex h-dvh min-h-0 w-full min-w-0 flex-col overflow-hidden bg-[var(--paper)]">
      <header className="flex h-14 shrink-0 items-center border-b border-[var(--line)] bg-[var(--paper)] px-3 md:px-5">
        <Link href="/" className="mr-3 grid h-8 w-8 place-items-center border border-[var(--line)] hover:border-[var(--green)] hover:text-[var(--green)]" aria-label="Back to hearings">
          <ArrowLeft size={14} />
        </Link>
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--green)] text-[10px] font-bold text-white">RH</span>
        <div className="ml-2 min-w-0">
          <p className="truncate text-xs font-bold tracking-[-0.01em]">RAG—HOR</p>
          <p className="hidden font-mono text-[8px] uppercase tracking-[0.15em] text-[var(--muted)] sm:block">Evidence workspace</p>
        </div>
        <div className="ml-auto flex items-center gap-4 font-mono text-[8px] uppercase tracking-[0.12em] text-[var(--muted)]">
          <span className="hidden items-center gap-1.5 md:flex"><Database size={11} /> {hearing.chunkCount} vectors</span>
          <span className="flex items-center gap-1.5 text-[var(--green)]"><CheckCircle2 size={11} /> Indexed</span>
        </div>
      </header>

      <div className="shrink-0 border-b border-[var(--line)] bg-[var(--panel)] px-4 py-3 md:px-5">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[8px] uppercase tracking-[0.17em] text-[var(--green)]">House of Representatives · public video record</p>
            <h1 className="mt-1 truncate font-serif text-xl font-medium tracking-[-0.025em] md:text-2xl">{hearing.title}</h1>
          </div>
          <a href={hearing.watchUrl} target="_blank" rel="noreferrer" className="hidden items-center gap-1.5 pt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--muted)] hover:text-[var(--green)] sm:flex">
            YouTube <ExternalLink size={11} />
          </a>
        </div>
      </div>

      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 overflow-x-hidden overflow-y-auto lg:grid-cols-[minmax(400px,43fr)_minmax(260px,25fr)_minmax(330px,32fr)] lg:overflow-hidden">
        <section className="flex min-h-[480px] min-w-0 flex-col overflow-hidden border-r border-[var(--line)] bg-[#101913] lg:min-h-0">
          <div className="relative aspect-video w-full shrink-0 bg-black xl:aspect-auto xl:h-[min(58vh,650px)]">
            <YouTubePlayer videoId={hearing.videoId} seekSeconds={seekSeconds} seekNonce={seekNonce} onTimeUpdate={setCurrentTime} />
          </div>
          <div className="flex min-h-0 flex-1 flex-col justify-between bg-[#17231c] px-5 py-5 text-white md:px-7">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#a8b7ad]">Now following</p>
              <p className="mt-2 font-serif text-2xl leading-tight tracking-[-0.025em] md:text-3xl">
                {hearing.segments.findLast((segment) => segment.startSeconds <= currentTime)?.text ?? "Press play to follow the transcript."}
              </p>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-white/15 pt-4 font-mono text-[9px] uppercase tracking-[0.12em] text-[#a8b7ad]">
              <span className="flex items-center gap-2"><Captions size={13} /> {hearing.languageCode} · {hearing.autogenerated ? "Auto transcript" : hearing.trackName}</span>
              <span>{formatTimestamp(currentTime)} / {formatTimestamp(hearing.durationSeconds)}</span>
            </div>
          </div>
        </section>

        <div className="h-full max-h-full min-h-[600px] min-w-0 overflow-hidden border-r border-[var(--line)] lg:min-h-0">
          <TranscriptPanel segments={hearing.segments} currentTime={currentTime} onSeek={seek} />
        </div>
        <div className="h-full max-h-full min-h-[650px] min-w-0 overflow-hidden lg:min-h-0">
          <ChatPanel
            key={conversation.id}
            conversation={conversation}
            conversations={conversations}
            hearingId={hearing.id}
            onSeek={seek}
            onSelectConversation={loadConversation}
            onNewConversation={newConversation}
          />
        </div>
      </div>
    </main>
  );
}
