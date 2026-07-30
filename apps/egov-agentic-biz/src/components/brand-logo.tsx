import Image from "next/image";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import logo from "../../public/images/egovbusiness-logo.png";

// Two-mark system, deliberate: this eGOVbusiness lockup marks the Business
// product (landing header). EGovLogo — the eGovPH platform wordmark — stays on
// Login and the launcher, where you are on the platform rather than in this
// product.
//
// next/image is mandatory here, not stylistic: the source is 2172x724 / 308 KB
// and must never be served at full resolution for a 28px-tall mark.
const ASPECT = 3; // 2172 / 724

/**
 * Where the wordmark actually sits inside the file, as fractions of it. The
 * supplied asset is mostly transparent padding — 42.5% of its height is ink —
 * so a `height` that sized the *file* drew a wordmark well under half that, and
 * asking for a bigger mark bought mostly empty space. On a one-viewport landing
 * that empty space is header height taken from the hero.
 *
 * Measured off a 543x181 render of the file (an exact 1:4 of the source): ink
 * spans x 9-533, y 48-124.
 */
const INK = { height: 77 / 181, left: 9 / 543, top: 48 / 181, width: 525 / 543 };

// Everything derives from the ink height, so the mark can be resized by that one
// number — see --brand-ink below. Ratios, not pixels: they hold at any size.
const FILE_H = 1 / INK.height;
const FILE_W = ASPECT * FILE_H;
const BOX_W = FILE_W * INK.width;
const OFFSET_TOP = -INK.top * FILE_H;
const OFFSET_LEFT = -INK.left * FILE_W;

export function BrandLogo({
  className,
  height = 23,
  priority = false,
}: {
  className?: string;
  /**
   * The wordmark's own height, not the file's. Also the size the srcset is
   * generated for, so it must be the LARGEST the mark is ever drawn at: a
   * caller may step --brand-ink down at narrow widths (the header does), but
   * stepping it up past this would resample a too-small candidate.
   */
  height?: number;
  priority?: boolean;
}) {
  return (
    <span
      className={cn("relative block shrink-0 overflow-hidden", className)}
      style={
        {
          "--brand-ink": `${height}px`,
          height: "var(--brand-ink)",
          width: `calc(var(--brand-ink) * ${BOX_W})`,
        } as CSSProperties
      }
    >
      {/* The whole file, scaled until its wordmark is --brand-ink tall, then
          positioned so the ink box is what the wrapper clips to. Both axes need
          a definite length: a flex column defaults to align-items:stretch,
          which pulls a cross-size of `auto` to the container's width — that
          once rendered this lockup at 13.7:1 — and next/image sizes its srcset
          from what it is handed. */}
      <Image
        alt="eGOVbusiness"
        height={Math.round(height * FILE_H)}
        priority={priority}
        src={logo}
        style={{
          height: `calc(var(--brand-ink) * ${FILE_H})`,
          left: `calc(var(--brand-ink) * ${OFFSET_LEFT})`,
          position: "absolute",
          top: `calc(var(--brand-ink) * ${OFFSET_TOP})`,
          width: `calc(var(--brand-ink) * ${FILE_W})`,
        }}
        width={Math.round(height * FILE_W)}
      />
    </span>
  );
}
