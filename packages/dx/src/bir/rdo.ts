const DEMO_RDO_CODES = ["043", "047", "048", "049", "050", "074", "080", "081", "082"] as const;

export type BirDemoRdoCode = (typeof DEMO_RDO_CODES)[number];

export type BirDemoRdo = Readonly<{
  code: BirDemoRdoCode;
  label: `RDO ${BirDemoRdoCode}`;
  simulated: true;
}>;

export function assignDemoRdo(random: () => number = Math.random): BirDemoRdo {
  const sample = random();
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1)
    throw new RangeError("The demo RDO random source must return a number from 0 up to 1.");
  const code = DEMO_RDO_CODES[Math.floor(sample * DEMO_RDO_CODES.length)] ?? DEMO_RDO_CODES[0];
  return {
    code,
    label: `RDO ${code}`,
    simulated: true,
  };
}
