import { ArrowUpRight, Database, Radio, Search, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { formatTimestamp } from "@/lib/time";
import { listHearings } from "@/server/hearings";

export const dynamic = "force-dynamic";

function Wordmark() {
  return (
    <Link href="/" className="group flex items-center gap-3" aria-label="RAG-HOR home">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--green)] text-xs font-bold tracking-tight text-white">
        RH
      </span>
      <span>
        <span className="block text-sm font-bold leading-none tracking-[-0.02em]">RAG—HOR</span>
        <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--muted)]">
          Philippine public record
        </span>
      </span>
    </Link>
  );
}

export default function Home() {
  const hearings = listHearings();

  return (
    <main className="min-h-screen">
      <header className="border-b border-[var(--line)] bg-[rgba(244,241,232,0.92)] px-5 py-4 backdrop-blur md:px-9">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between">
          <Wordmark />
          <div className="flex items-center gap-5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
            <span className="hidden items-center gap-2 sm:flex"><ShieldCheck size={13} /> Source-grounded</span>
            <span className="flex items-center gap-2 text-[var(--green)]"><span className="h-2 w-2 animate-pulse rounded-full bg-[var(--green)]" /> Archive online</span>
          </div>
        </div>
      </header>

      <section className="border-b border-[var(--line)] px-5 py-14 md:px-9 md:py-20">
        <div className="mx-auto grid max-w-[1500px] gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <p className="mb-5 flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--green)]">
              <Radio size={13} /> Civic intelligence / proof of concept
            </p>
            <h1 className="max-w-4xl font-serif text-[clamp(3.3rem,8vw,7.8rem)] leading-[0.84] font-medium tracking-[-0.055em]">
              Hear the
              <br />
              <em className="font-normal text-[var(--green)]">public record.</em>
            </h1>
          </div>
          <div className="max-w-xl border-l-2 border-[var(--amber)] pl-6 lg:mb-2">
            <p className="font-serif text-2xl leading-snug tracking-[-0.02em] md:text-3xl">
              Watch a hearing. Follow every word. Ask the record a question—and jump to the evidence.
            </p>
            <div className="mt-7 flex flex-wrap gap-x-7 gap-y-2 font-mono text-[10px] uppercase tracking-[0.13em] text-[var(--muted)]">
              <span>{hearings.length} records indexed</span>
              <span>Timestamp citations</span>
              <span>Persistent research threads</span>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-10 md:px-9 md:py-14">
        <div className="mx-auto max-w-[1500px]">
          <div className="mb-7 flex items-end justify-between border-b border-[var(--ink)] pb-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">House of Representatives</p>
              <h2 className="mt-2 font-serif text-3xl font-medium tracking-[-0.03em] md:text-4xl">Indexed hearings</h2>
            </div>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--muted)] md:block">
              Select a record to begin
            </span>
          </div>

          {hearings.length === 0 ? (
            <div className="grid min-h-[360px] place-items-center border border-dashed border-[var(--line)] bg-[var(--panel)] px-6 text-center">
              <div className="max-w-lg">
                <Database className="mx-auto mb-5 text-[var(--green)]" size={30} strokeWidth={1.5} />
                <h3 className="font-serif text-3xl">The archive is ready to be indexed.</h3>
                <p className="mt-3 leading-7 text-[var(--muted)]">
                  Start Qdrant and Redis, configure the model key, then preprocess five transcript-backed House records.
                </p>
                <code className="mt-6 inline-block bg-[var(--ink)] px-5 py-3 font-mono text-xs text-white">
                  bun run infra:up && bun run ingest:sample
                </code>
              </div>
            </div>
          ) : (
            <div className="grid border-l border-t border-[var(--line)] md:grid-cols-2 xl:grid-cols-3">
              {hearings.map((hearing, index) => (
                <Link
                  key={hearing.id}
                  href={`/hearings/${hearing.id}`}
                  className="group relative border-r border-b border-[var(--line)] bg-[rgba(255,253,246,0.55)] p-4 transition-colors hover:bg-[var(--panel)] md:p-5"
                >
                  <div className="relative aspect-video overflow-hidden bg-[var(--ink)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={hearing.thumbnailUrl}
                      alt=""
                      className="h-full w-full object-cover opacity-85 grayscale-[20%] transition duration-500 group-hover:scale-[1.025] group-hover:opacity-100 group-hover:grayscale-0"
                    />
                    <span className="absolute right-3 bottom-3 bg-[rgba(23,35,28,0.9)] px-2 py-1 font-mono text-[10px] text-white">
                      {formatTimestamp(hearing.durationSeconds)}
                    </span>
                    <span className="absolute top-3 left-3 grid h-8 w-8 place-items-center rounded-full bg-[var(--paper)] font-mono text-[10px] font-semibold text-[var(--ink)]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="flex min-h-40 flex-col pt-5">
                    <div className="mb-3 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--green)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--green)]" /> Transcript indexed
                    </div>
                    <h3 className="font-serif text-[1.65rem] leading-[1.08] font-medium tracking-[-0.025em]">
                      {hearing.title}
                    </h3>
                    <div className="mt-auto flex items-end justify-between pt-6 font-mono text-[9px] uppercase tracking-[0.11em] text-[var(--muted)]">
                      <span>{hearing.segmentCount.toLocaleString()} timed segments · {hearing.chunkCount} vectors</span>
                      <ArrowUpRight className="text-[var(--green)] transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" size={18} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <footer className="mt-8 border-t border-[var(--line)] px-5 py-7 md:px-9">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]">
          <span>Source: House of Representatives PH on YouTube</span>
          <span className="flex items-center gap-2"><Search size={12} /> Qdrant semantic retrieval · evidence stays clickable</span>
        </div>
      </footer>
    </main>
  );
}
