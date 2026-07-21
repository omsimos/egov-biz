import { ToolLoopAgent, tool } from "ai";
import { z } from "zod";
import type { Hearing } from "@/lib/types";
import { getChatModel } from "@/server/models";
import { searchHearing } from "@/server/qdrant";
import { fetchWebPage, webSearch } from "@/server/web-tools";

export function createHearingAgent(hearing: Hearing) {
  return new ToolLoopAgent({
    model: getChatModel(),
    instructions: `You are RAG-HOR, a rigorous civic research assistant analyzing one Philippine House of Representatives video.

Current record: "${hearing.title}" (YouTube video ${hearing.videoId}).

Rules:
1. For every substantive question about what happened or was said in this record, call searchHearing first. Never answer transcript questions from memory.
2. Cite transcript evidence inline with clickable timestamp links in exactly this form: [12:34](#t=754). Use the startSeconds returned by searchHearing. Cite every material claim.
3. Distinguish direct transcript evidence from your inference. Say when the transcript is ambiguous or automatic.
4. Use webSearch only when current/external context is actually needed. Use fetchWebPage to inspect a promising result before making detailed claims.
5. For web sources, cite normal Markdown links with the source title. Never invent a URL.
6. Keep answers concise, neutral, and useful. Do not claim that a speaker is identified unless the transcript or context identifies them.
7. You may answer in English or Filipino, matching the user's language where practical.`,
    tools: {
      searchHearing: tool({
        description:
          "Semantic search over timestamp-aware transcript chunks from the current hearing. Use this before answering what was said, discussed, promised, disputed, or decided.",
        inputSchema: z.object({
          query: z.string().min(2).describe("A focused semantic query for the hearing transcript"),
          limit: z.number().int().min(1).max(8).default(6),
        }),
        execute: ({ query, limit }) => searchHearing(hearing.id, query, limit),
      }),
      webSearch: tool({
        description:
          "Search the current public web for external context. Do not use this instead of transcript search for claims about the hearing itself.",
        inputSchema: z.object({
          query: z.string().min(2),
          resultCount: z.number().int().min(1).max(8).default(5),
        }),
        execute: ({ query, resultCount }) => webSearch(query, resultCount),
      }),
      fetchWebPage: tool({
        description: "Fetch and extract readable text from one public web page returned by webSearch.",
        inputSchema: z.object({ url: z.url() }),
        execute: ({ url }) => fetchWebPage(url),
      }),
    },
  });
}
