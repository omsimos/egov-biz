// The official eGovPH wordmark, rebuilt as text plus an SVG ring so it stays
// crisp at every size. The "O" carries the Philippine flag colors: sun-yellow
// up top, blue on the right, red sweeping the bottom.
const RING_SEGMENTS = [
  { color: "#f5c400", d: "M16.2 40.9A35 35 0 0 1 62 17.1" },
  { color: "currentColor", d: "M62 17.1A35 35 0 0 1 72.5 76.8" },
  { color: "#c8102e", d: "M72.5 76.8A35 35 0 0 1 16.2 40.9" },
];

export function EGovLogo({ className, size = 26 }: { className?: string; size?: number }) {
  return (
    <span
      aria-label="eGovPH"
      className={`egov-logo${className ? ` ${className}` : ""}`}
      role="img"
      style={{ fontSize: size }}
    >
      <span>eG</span>
      <svg aria-hidden="true" className="egov-logo-ring" viewBox="0 0 100 100">
        {RING_SEGMENTS.map(({ color, d }) => (
          <path d={d} fill="none" key={color} stroke={color} strokeWidth="30" />
        ))}
      </svg>
      <span>V</span>
      <small>PH</small>
    </span>
  );
}
