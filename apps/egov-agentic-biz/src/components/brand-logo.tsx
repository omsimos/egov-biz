import Image from "next/image";
import logo from "../../public/images/egovbusiness-logo.png";

// Two-mark system, deliberate: this eGOVbusiness lockup marks the Business
// product (Home, Business landing, Chat, desktop panel). EGovLogo — the eGovPH
// platform wordmark — stays on Login only, where you authenticate to the
// platform rather than to this product.
//
// next/image is mandatory here, not stylistic: the source is 2172x724 / 308 KB
// and must never be served at full resolution for a 23px-tall mark.
// 2172 / 724. The width has to be a definite length, not `auto`: a flex column
// defaults to align-items:stretch, which only stretches a cross-size of `auto`.
// As `width: auto` this mark was pulled to its container's full width while
// `height` stayed put — the desktop panel rendered the lockup at 13.7:1 instead
// of 3:1, and next/image had sized its srcset for the 90px it expected.
const ASPECT = 3;

export function BrandLogo({
  className,
  height = 23,
  priority = false,
}: {
  className?: string;
  height?: number;
  priority?: boolean;
}) {
  const width = Math.round(height * ASPECT);
  return (
    <Image
      alt="eGOVbusiness"
      className={className}
      height={height}
      priority={priority}
      src={logo}
      style={{ height, width }}
      width={width}
    />
  );
}
