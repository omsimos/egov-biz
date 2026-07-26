// Decorative flag-sunrise motif from the design handoff's Home screen.
// Literal hexes are intentional here: this is artwork, not a themeable
// surface. Where the brand has a token (--flag-red, --egov-gold) the token
// is used; the sky and sand tints are art-only values.
export function FlagSunrise({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        background: "#fff4bf",
        borderRadius: "55% 55% 18px 18px",
        height: 85,
        overflow: "hidden",
        position: "relative",
        width: 108,
      }}
    >
      <span
        style={{
          color: "var(--egov-gold)",
          fontSize: 30,
          left: 40,
          position: "absolute",
          top: 3,
        }}
      >
        ✦
      </span>
      <div
        style={{
          background: "linear-gradient(145deg,#0c48d3 0 45%,#efcc32 46% 58%,var(--flag-red) 59%)",
          borderRadius: "60% 60% 0 0",
          bottom: 8,
          height: 48,
          left: 12,
          position: "absolute",
          width: 84,
        }}
      />
      <div
        style={{
          background: "#60c2f2",
          borderRadius: "80% 40% 0 0",
          bottom: 0,
          height: 15,
          left: 0,
          position: "absolute",
          right: 0,
        }}
      />
    </div>
  );
}
