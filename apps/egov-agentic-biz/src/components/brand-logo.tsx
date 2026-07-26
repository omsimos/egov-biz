import Image from "next/image";
import logo from "../../public/images/egovbusiness-logo.png";

// Two-mark system, deliberate: this eGOVbusiness lockup marks the Business
// product (Home, Business landing, Chat, desktop panel). EGovLogo — the eGovPH
// platform wordmark — stays on Login only, where you authenticate to the
// platform rather than to this product.
//
// next/image is mandatory here, not stylistic: the source is 2172x724 / 308 KB
// and must never be served at full resolution for a 23px-tall mark.
export function BrandLogo({
  className,
  height = 23,
  priority = false,
}: {
  className?: string;
  height?: number;
  priority?: boolean;
}) {
  return (
    <Image
      alt="eGOVbusiness"
      className={className}
      height={height}
      priority={priority}
      src={logo}
      style={{ height, width: "auto" }}
    />
  );
}
