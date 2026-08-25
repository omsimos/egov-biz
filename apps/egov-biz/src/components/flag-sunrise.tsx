// Decorative flag-sunrise motif from the design handoff's Home screen.
// Literal hexes are intentional here: this is artwork, not a themeable
// surface. Where the brand has a token (--flag-red, --egov-gold) the token
// is used; the sky and sand tints are art-only values.
//
// Internals are proportional so the motif can be scaled from one number. The
// handoff drew it at 108 wide; Home now asks for 76, because at 108 it was the
// loudest object in the top third of a screen where it carries no information.
export function FlagSunrise({ className, width = 76 }: { className?: string; width?: number }) {
  const height = Math.round(width * (85 / 108));
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        background: "#fff4bf",
        borderRadius: "55% 55% 18px 18px",
        flex: "none",
        height,
        overflow: "hidden",
        position: "relative",
        width,
      }}
    >
      <span
        style={{
          color: "var(--egov-gold)",
          fontSize: Math.round(height * 0.35),
          left: "37%",
          lineHeight: 1,
          position: "absolute",
          top: "3%",
        }}
      >
        ✦
      </span>
      <div
        style={{
          background: "linear-gradient(145deg,#0c48d3 0 45%,#efcc32 46% 58%,var(--flag-red) 59%)",
          borderRadius: "60% 60% 0 0",
          bottom: "9%",
          height: "56%",
          left: "11%",
          position: "absolute",
          width: "78%",
        }}
      />
      <div
        style={{
          background: "#60c2f2",
          borderRadius: "80% 40% 0 0",
          bottom: 0,
          height: "18%",
          left: 0,
          position: "absolute",
          right: 0,
        }}
      />
    </div>
  );
}
