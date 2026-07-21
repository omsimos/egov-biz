import type { CSSProperties, ElementType, ReactNode } from "react";

interface TextShimmerProps {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  duration?: number;
  spread?: number;
}

export function TextShimmer({
  children,
  as: Component = "p",
  className = "",
  duration = 1.6,
  spread = 2,
}: TextShimmerProps) {
  const textLength = typeof children === "string" ? children.length : 20;
  const style = {
    "--shimmer-duration": `${duration}s`,
    "--shimmer-spread": `${textLength * spread}px`,
    backgroundImage:
      "linear-gradient(90deg, transparent calc(50% - var(--shimmer-spread)), var(--panel), transparent calc(50% + var(--shimmer-spread))), linear-gradient(var(--muted), var(--muted))",
    backgroundRepeat: "no-repeat, padding-box",
  } as CSSProperties;

  return (
    <Component
      className={`text-shimmer relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent motion-reduce:text-[var(--muted)] ${className}`}
      style={style}
    >
      {children}
    </Component>
  );
}
