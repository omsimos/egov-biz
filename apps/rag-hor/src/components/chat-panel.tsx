"use client";

import { useChat } from "@ai-sdk/react";
import {
  Check,
  ChevronDown,
  CircleStop,
  ExternalLink,
  Globe2,
  LoaderCircle,
  MessageSquarePlus,
  Play,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import { DefaultChatTransport, getToolName, isToolUIPart, type UIMessage } from "ai";
import { useMemo, useState } from "react";
import { Streamdown } from "streamdown";
import type { Conversation, ConversationSummary, HearingCitation } from "@/lib/types";
import { TextShimmer } from "@/components/text-shimmer";

interface ChatPanelProps {
  conversation: Conversation;
  conversations: ConversationSummary[];
  hearingId: string;
  onSeek: (seconds: number) => void;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
}

function ToolPart({ part, onSeek }: { part: UIMessage["parts"][number]; onSeek: (seconds: number) => void }) {
  if (!isToolUIPart(part)) return null;
  const name = getToolName(part);
  const complete = part.state === "output-available";
  const searchResults =
    complete && name === "searchHearing" && Array.isArray(part.output) ? (part.output as HearingCitation[]) : [];
  const label = name === "searchHearing" ? "Searched hearing" : name === "webSearch" ? "Searched the web" : "Read web source";

  return (
    <div className="my-2 border border-[var(--line)] bg-[var(--paper)]">
      <div className="flex items-center gap-2 px-3 py-2 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
        {complete ? <Check size={12} className="text-[var(--green)]" /> : <LoaderCircle size={12} className="animate-spin text-[var(--green)]" />}
        {label}
        {name === "webSearch" || name === "fetchWebPage" ? <Globe2 size={11} className="ml-auto" /> : <Search size={11} className="ml-auto" />}
      </div>
      {searchResults.length > 0 && (
        <div className="border-t border-[var(--line)] px-2 py-2">
          {searchResults.slice(0, 4).map((citation) => (
            <button
              key={citation.id}
              type="button"
              onClick={() => onSeek(citation.startSeconds)}
              className="flex w-full items-start gap-2 px-2 py-1.5 text-left text-[11px] leading-4 hover:bg-white"
            >
              <span className="shrink-0 font-mono font-semibold text-[var(--green)]">{citation.timestamp}</span>
              <span className="line-clamp-2 text-[var(--muted)]">{citation.text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MessagePart({
  part,
  onSeek,
  isAnimating = false,
}: {
  part: UIMessage["parts"][number];
  onSeek: (seconds: number) => void;
  isAnimating?: boolean;
}) {
  if (part.type === "text") {
    return (
      <div className="markdown-answer text-[13px] leading-[1.65]">
        <Streamdown
          animated={{ animation: "slideUp", duration: 180, easing: "ease-out" }}
          isAnimating={isAnimating}
          components={{
            a: ({ href, children }) => {
              const timestampMatch = href?.match(/^#t=(\d+(?:\.\d+)?)$/);
              if (timestampMatch) {
                const seconds = Number(timestampMatch[1]);
                return (
                  <button
                    type="button"
                    onClick={() => onSeek(seconds)}
                    className="citation-badge"
                    aria-label={`Jump to cited moment at ${children?.toString() ?? `${seconds} seconds`}`}
                    title="Open this citation in the hearing video"
                  >
                    <Play size={8} strokeWidth={2.5} fill="currentColor" aria-hidden="true" />
                    <span>{children}</span>
                  </button>
                );
              }
              return (
                <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5">
                  {children} <ExternalLink size={10} />
                </a>
              );
            },
          }}
        >
          {part.text}
        </Streamdown>
      </div>
    );
  }
  if (isToolUIPart(part)) return <ToolPart part={part} onSeek={onSeek} />;
  return null;
}

export function ChatPanel({
  conversation,
  conversations,
  hearingId,
  onSeek,
  onSelectConversation,
  onNewConversation,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { hearingId },
      }),
    [hearingId],
  );
  const { messages, sendMessage, status, stop, error } = useChat({
    id: conversation.id,
    messages: conversation.messages,
    transport,
    resume: true,
  });
  const busy = status === "submitted" || status === "streaming";
  const lastMessage = messages.at(-1);
  const lastAssistantHasText =
    lastMessage?.role === "assistant" &&
    lastMessage.parts.some((part) => part.type === "text" && part.text.trim().length > 0);
  const showWorkingShimmer = busy && (lastMessage?.role !== "assistant" || !lastAssistantHasText);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    void sendMessage({ text });
  };

  return (
    <section className="flex h-full max-h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[#f8f6ef]" aria-label="Hearing research agent">
      <div className="relative border-b border-[var(--line)] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="mr-auto">
            <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--green)]">
              <Sparkles size={11} /> Grounded agent
            </p>
            <h2 className="mt-1 font-serif text-2xl font-medium tracking-[-0.025em]">Ask this hearing</h2>
          </div>
          <button
            type="button"
            onClick={() => setHistoryOpen((open) => !open)}
            className="flex h-9 max-w-40 items-center gap-1.5 border border-[var(--line)] bg-white px-2.5 font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--muted)] hover:border-[var(--green)]"
          >
            <span className="truncate">{conversation.title}</span><ChevronDown size={12} />
          </button>
          <button
            type="button"
            onClick={onNewConversation}
            className="grid h-9 w-9 place-items-center bg-[var(--green)] text-white hover:bg-[var(--green-dark)]"
            aria-label="New conversation"
          >
            <MessageSquarePlus size={15} />
          </button>
        </div>
        {historyOpen && (
          <div className="absolute top-[calc(100%-5px)] right-14 z-30 w-72 border border-[var(--line)] bg-white p-1 shadow-[0_14px_30px_rgba(23,35,28,0.12)]">
            {conversations.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => { setHistoryOpen(false); onSelectConversation(item.id); }}
                className={`block w-full truncate px-3 py-2.5 text-left text-xs hover:bg-[var(--paper)] ${item.id === conversation.id ? "font-semibold text-[var(--green)]" : "text-[var(--muted)]"}`}
              >
                {item.title}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-5">
        {messages.length === 0 && (
          <div className="mx-auto max-w-md pt-8">
            <p className="font-serif text-3xl leading-tight tracking-[-0.03em]">Interrogate the record, not a summary.</p>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              The agent searches timestamped transcript chunks first. Citations seek the video and transcript together.
            </p>
            <div className="mt-6 space-y-2">
              {["What were the main issues discussed?", "Which claims were challenged?", "Create a timeline of key moments."].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void sendMessage({ text: prompt })}
                  className="block w-full border border-[var(--line)] bg-white px-3 py-2.5 text-left text-xs text-[var(--muted)] hover:border-[var(--green)] hover:text-[var(--green)]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-5">
          {messages.map((message) => {
            const isUser = message.role === "user";
            const isStreamingMessage = status === "streaming" && !isUser && message.id === lastMessage?.id;
            const isEmptyWorkingAssistant =
              !isUser &&
              message.id === lastMessage?.id &&
              message.parts.length === 0 &&
              showWorkingShimmer;
            if (isEmptyWorkingAssistant) return null;

            return (
            <article key={message.id} className={isUser ? "ml-10" : "mr-5"}>
              <p className="mb-1.5 font-mono text-[8px] font-semibold uppercase tracking-[0.17em] text-[var(--muted)]">
                {isUser ? "You" : "RAG—HOR"}
              </p>
               {isUser ? (
                 <div className="bg-[var(--green-dark)] px-3.5 py-3 text-white">
                   {message.parts.map((part, index) => <MessagePart key={`${message.id}-${index}`} part={part} onSeek={onSeek} />)}
                 </div>
               ) : (
                 message.parts.map((part, index) => (
                   <MessagePart
                     key={`${message.id}-${index}`}
                     part={part}
                     onSeek={onSeek}
                     isAnimating={isStreamingMessage}
                   />
                 ))
               )}
            </article>
            );
          })}
          {showWorkingShimmer && (
            <div className="mr-5" role="status" aria-live="polite">
              <p className="mb-1.5 font-mono text-[8px] font-semibold uppercase tracking-[0.17em] text-[var(--muted)]">RAG—HOR</p>
              <TextShimmer className="text-[13px] leading-[1.65]">Working on the record…</TextShimmer>
            </div>
          )}
          {error && <p className="border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error.message}</p>}
        </div>
      </div>

      <form onSubmit={submit} className="border-t border-[var(--line)] bg-[var(--panel)] p-3">
        <div className="border border-[var(--line)] bg-white focus-within:border-[var(--green)]">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit(event);
              }
            }}
            placeholder="Ask what was said, disputed, or decided…"
            rows={3}
            className="block w-full resize-none bg-transparent px-3.5 pt-3 text-sm leading-5 outline-none placeholder:text-[#929a94]"
          />
          <div className="flex items-center justify-between px-3 pb-2.5">
            <span className="font-mono text-[8px] uppercase tracking-[0.11em] text-[var(--muted)]">RAG · web research · resumable</span>
            {busy ? (
              <button type="button" onClick={stop} className="grid h-8 w-8 place-items-center bg-[var(--ink)] text-white" aria-label="Stop response">
                <CircleStop size={14} />
              </button>
            ) : (
              <button type="submit" disabled={!input.trim()} className="grid h-8 w-8 place-items-center bg-[var(--green)] text-white disabled:opacity-35" aria-label="Send message">
                <Send size={14} />
              </button>
            )}
          </div>
        </div>
      </form>
    </section>
  );
}
