import Image from "next/image";
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
 * Where the wordmark actually sits inside the file, as fractions of it — ink
 * x 36-2134, y 192-496 of 2172x724, measured off the file itself.
 *
 * Only 42% of the file's height is ink, so a `height` that sized the *file* drew
 * a wordmark well under half that (30 gave 13px), and asking for a bigger mark
 * bought mostly empty space. On a one-viewport landing that empty space is
 * header height taken from the hero. So `height` is the wordmark's own height:
 * the file is scaled until its ink matches, then clipped to it.
 */
const INK = { height: 305 / 724, left: 36 / 2172, top: 192 / 724, width: 2099 / 2172 };

export function BrandLogo({
  className,
  height = 23,
  priority = false,
}: {
  className?: string;
  /** The wordmark's own height, not the file's. */
  height?: number;
  priority?: boolean;
}) {
  // Width off the *rounded* height, not off `height` again: rounding each axis
  // against the ink fractions independently left the pair a pixel out of
  // 2172:724, and next/image reads any deviation from the intrinsic ratio as
  // "one dimension was modified by CSS" and warns. Everything below therefore
  // measures against these two numbers, not against `height`.
  const fileHeight = Math.round(height / INK.height);
  const fileWidth = Math.round(fileHeight * ASPECT);
  return (
    <span
      className={cn("relative block shrink-0 overflow-hidden", className)}
      style={{ height, width: Math.round(fileWidth * INK.width) }}
    >
      {/* The whole file, scaled until its wordmark is `height` tall and offset so
          the ink box is what the wrapper clips to. Both axes need a definite
          length: a flex column defaults to align-items:stretch, which pulls a
          cross-size of `auto` to the container's width — that once rendered this
          lockup at 13.7:1 — and next/image sizes its srcset from what it gets. */}
      <Image
        alt="eGOVbusiness"
        height={fileHeight}
        priority={priority}
        src={logo}
        style={{
          height: fileHeight,
          left: -Math.round(fileWidth * INK.left),
          position: "absolute",
          top: -Math.round(fileHeight * INK.top),
          width: fileWidth,
        }}
        width={fileWidth}
      />
    </span>
  );
}
