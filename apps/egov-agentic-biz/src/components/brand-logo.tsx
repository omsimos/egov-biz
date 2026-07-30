import Image from "next/image";
import { cn } from "@/lib/utils";
import logo from "../../public/images/egovbusiness-logo.png";

// This lockup marks the Business product; EGovLogo — the eGovPH platform
// wordmark — stays on Login and the launcher. next/image is mandatory, not
// stylistic: the source is 2172x724 / 308 KB behind a 28px mark.
const ASPECT = 3; // 2172 / 724

// Where the wordmark sits inside the file, measured off it: ink x 36-2134,
// y 192-496. Only 42% of the file's height is ink, so sizing the file drew a
// wordmark under half that (height 30 gave 13px). The file is scaled until its
// ink matches `height`, then clipped to it.
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
  // Width off the rounded height, not off `height` again: rounding each axis
  // separately left the pair a pixel out of 2172:724, which next/image reports
  // as "width or height modified, but not the other".
  const fileHeight = Math.round(height / INK.height);
  const fileWidth = Math.round(fileHeight * ASPECT);
  return (
    <span
      className={cn("relative block shrink-0 overflow-hidden", className)}
      style={{ height, width: Math.round(fileWidth * INK.width) }}
    >
      {/* Both axes need a definite length: align-items:stretch pulls a cross-size
          of `auto` to the container's width (once rendered this at 13.7:1), and
          next/image sizes its srcset from what it gets. */}
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
