import Image from "next/image";
import logo from "../../public/images/logo-egov.png";

// The eGovPH platform wordmark, from the supplied asset. This was previously a
// hand-built recreation — text plus three SVG arcs for the flag-coloured "O" —
// which read well but was not the real mark. Login is the one screen where a
// citizen checks they are on a genuine government sign-in, so it uses the file
// rather than an approximation of it.
//
// 854 / 244. Width is a definite length for the same reason BrandLogo's is: a
// flex container stretches a cross-size of `auto`, and next/image sizes its
// srcset from the dimensions it is handed.
const ASPECT = 3.5;

export function EGovLogo({
  className,
  size = 26,
  priority = false,
}: {
  className?: string;
  size?: number;
  priority?: boolean;
}) {
  const width = Math.round(size * ASPECT);
  return (
    <Image
      alt="eGovPH"
      className={className}
      height={size}
      priority={priority}
      src={logo}
      style={{ height: size, width }}
      width={width}
    />
  );
}
