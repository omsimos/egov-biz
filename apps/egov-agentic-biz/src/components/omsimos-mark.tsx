// Inlined from omsimos-logo.svg rather than using the white PNG, so the mark can
// take currentColor — grey on the light header, white in the Dynamic Island.
//
// The viewBox is the artwork's ink box, not the source's: that draws the mark
// inside a 2000-square with ~400 units of margin. Three of its four paths; the
// fourth spans 0.07 units.
const ASPECT = 1168 / 780;

export function OmsimosMark({ className, size = 17 }: { className?: string; size?: number }) {
  const width = Math.round(size * ASPECT);
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      height={size}
      // Sized twice: width/height are presentation attributes, so a flex
      // parent's align-items:stretch still wins over them.
      style={{ height: size, width }}
      viewBox="416 610 1168 780"
      width={width}
    >
      <path d="M1345.15,1328.11c386.59-253.16,21.67-699.25-356.03-604.21,446.32-183.11,831,378.2,356.03,604.21Z" />
      <path d="M1582.97,1040.24c-30.52-374.48-513.72-464.01-710.18-253.31-179.16,192.13,123.85,317.57,127.2-.89v-.82h.01v.78c0,.2,0,.4.01.61,1.31,239.7,175.09,220.05,219.24,142.27,148.94,106.01,69.41,299.77-71.62,387.41-293.62,182.43-751.75,11.56-730.6-356.54,30.52,374.48,513.72,464.03,710.18,253.33,180.84-193.96-123.86-315.22-127.2.89,0,.27-.01.55-.01.82h-.01v-1.4c-1.33-239.7-175.09-220.05-219.24-142.28-148.94-105.99-69.41-299.76,71.62-387.4,293.62-182.43,751.75-11.55,730.6,356.53Z" />
      <path d="M1010.93,1276.09c-415.07,184.11-849.54-371.17-356.08-604.19-386.61,253.17-21.64,699.29,356.08,604.19Z" />
    </svg>
  );
}
