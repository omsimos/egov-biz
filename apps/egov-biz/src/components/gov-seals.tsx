// Flat vector recreations of the official marks shown on the eGovPH login
// screen. They are drawn by hand so the prototype ships no raster assets;
// at the sizes used (40-150px) they read the same as the originals.

const STAR =
  "M0 -10L2.29 -3.16L9.51 -3.09L3.71 1.21L5.88 8.09L0 3.9L-5.88 8.09L-3.71 1.21L-9.51 -3.09L-2.29 -3.16Z";

export function BagongPilipinasMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 200 200">
      <defs>
        <linearGradient id="bp-blue" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#3423e8" />
          <stop offset="1" stopColor="#1a0fa8" />
        </linearGradient>
        <linearGradient id="bp-red" x1="1" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#e8320e" />
          <stop offset="1" stopColor="#b00d10" />
        </linearGradient>
        <linearGradient id="bp-sun" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffd51c" />
          <stop offset="1" stopColor="#f2b300" />
        </linearGradient>
      </defs>
      <g fill="#f7c600">
        <path d={STAR} transform="translate(100 13) scale(1.05)" />
        <path d={STAR} transform="translate(50 34) scale(0.9)" />
        <path d={STAR} transform="translate(150 34) scale(0.9)" />
      </g>
      <g transform="translate(100 88)">
        <g fill="url(#bp-sun)">
          {Array.from({ length: 8 }, (_, ray) => (
            <path d="M-6.5 -22L0 -54L6.5 -22Z" key={ray} transform={`rotate(${ray * 45})`} />
          ))}
        </g>
        <circle fill="url(#bp-sun)" r="22" />
      </g>
      <path
        d="M30 62C58 100 100 122 170 114C168 124 162 132 152 138C92 148 48 118 30 62Z"
        fill="url(#bp-blue)"
        stroke="#fff"
        strokeWidth="3"
      />
      <path
        d="M170 62C142 100 100 122 30 114C32 124 38 132 48 138C108 148 152 118 170 62Z"
        fill="url(#bp-red)"
        stroke="#fff"
        strokeWidth="3"
      />
      <path
        d="M36 124C58 150 86 162 134 158C122 172 96 180 74 174C56 168 42 150 36 124Z"
        fill="url(#bp-red)"
        stroke="#fff"
        strokeWidth="3"
      />
      <path
        d="M164 124C142 150 114 162 66 158C78 172 104 180 126 174C144 168 158 150 164 124Z"
        fill="url(#bp-blue)"
        stroke="#fff"
        strokeWidth="3"
      />
    </svg>
  );
}

export function DictSeal({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 48 48">
      <circle cx="24" cy="24" fill="#fff" r="23" />
      <circle
        cx="24"
        cy="24"
        fill="none"
        r="21.5"
        stroke="#24408e"
        strokeDasharray="2.4 2.2"
        strokeWidth="2"
      />
      <circle cx="24" cy="24" fill="none" r="17.5" stroke="#24408e" strokeWidth="1.2" />
      <path d="M24 12l5.5 10L24 32l-5.5-10z" fill="#f0b70d" />
      <path d="M13.5 27.5c6 6.5 15 6.5 21 0" fill="none" stroke="#24408e" strokeWidth="2.4" />
      <circle cx="24" cy="22" fill="#24408e" r="2.2" />
    </svg>
  );
}

export function NpcSeal({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 44 56">
      <path
        d="M12.4 27.5A15 15 0 1 1 31.6 27.5L35.5 48.5Q36.2 52 32.2 52H11.8Q7.8 52 8.5 48.5Z"
        fill="#fff"
        stroke="#2b3990"
        strokeLinejoin="round"
        strokeWidth="3"
      />
      <circle cx="22" cy="7.6" fill="#f0b70d" r="1.7" />
      <path d="M20.5 9.8h3" stroke="#c8102e" strokeLinecap="round" strokeWidth="1.4" />
      <text fill="#2b3990" fontSize="6" fontWeight="800" textAnchor="middle" x="22" y="17.5">
        DPO/DPS
      </text>
      <rect fill="#35b6e3" height="5" rx="1" width="21" x="11.5" y="20" />
      <text fill="#fff" fontSize="3.4" fontWeight="700" textAnchor="middle" x="22" y="23.7">
        REGISTERED
      </text>
      <rect fill="#20242c" height="11" rx="1" width="11" x="16.5" y="28.5" />
      <g fill="#fff">
        <rect height="2.4" width="2.4" x="18" y="30" />
        <rect height="2.4" width="2.4" x="23.6" y="30" />
        <rect height="2.4" width="2.4" x="18" y="35.6" />
        <rect height="1.4" width="1.4" x="24.1" y="36.1" />
        <rect height="1.2" width="3.6" x="20" y="32.8" />
      </g>
      <path d="M14 44.5h16" stroke="#9aa2b1" strokeWidth="0.8" />
      <path
        d="M15 47c3-3 6 1.5 8-1s4 1 6-.6"
        fill="none"
        stroke="#3a3f4a"
        strokeLinecap="round"
        strokeWidth="1"
      />
    </svg>
  );
}

export function CityscapeArt({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      preserveAspectRatio="xMidYMax slice"
      viewBox="0 0 390 150"
    >
      <defs>
        <pattern height="9" id="city-win" patternUnits="userSpaceOnUse" width="7">
          <rect fill="#fff" height="4.6" opacity="0.55" width="3" x="1.4" y="1.6" />
        </pattern>
      </defs>
      <g fill="#cbd8f2">
        <rect height="52" width="26" x="0" y="98" />
        <rect height="72" width="20" x="22" y="78" />
        <rect height="46" width="24" x="46" y="104" />
        <rect height="64" width="18" x="68" y="86" />
        <rect height="84" width="26" x="90" y="66" />
        <rect height="56" width="20" x="120" y="94" />
        <rect height="68" width="26" x="144" y="82" />
        <rect height="92" width="22" x="176" y="58" />
        <rect height="62" width="24" x="200" y="88" />
        <rect height="74" width="20" x="228" y="76" />
        <rect height="52" width="26" x="252" y="98" />
        <rect height="66" width="22" x="282" y="84" />
        <rect height="80" width="26" x="308" y="70" />
        <rect height="58" width="20" x="338" y="92" />
        <rect height="70" width="30" x="360" y="80" />
      </g>
      <g>
        <g transform="translate(14 92)">
          <rect fill="#89aee3" height="46" rx="1" width="30" />
          <rect fill="url(#city-win)" height="46" width="30" />
        </g>
        <g transform="translate(56 76)">
          <rect fill="#6f99d9" height="62" rx="1" width="34" />
          <rect fill="url(#city-win)" height="62" width="34" />
          <rect fill="#6f99d9" height="6" width="14" x="10" y="-6" />
        </g>
        <g transform="translate(104 100)">
          <rect fill="#a3c0ec" height="38" rx="1" width="28" />
          <rect fill="url(#city-win)" height="38" width="28" />
        </g>
        <g transform="translate(142 68)">
          <rect fill="#7fa5de" height="70" rx="1" width="36" />
          <rect fill="url(#city-win)" height="70" width="36" />
        </g>
        <g transform="translate(190 88)">
          <rect fill="#93b5e8" height="50" rx="1" width="30" />
          <rect fill="url(#city-win)" height="50" width="30" />
        </g>
        <g transform="translate(232 60)">
          <rect fill="#6f99d9" height="78" rx="1" width="34" />
          <rect fill="url(#city-win)" height="78" width="34" />
          <rect fill="#6f99d9" height="8" width="4" x="15" y="-8" />
        </g>
        <g transform="translate(278 96)">
          <rect fill="#a3c0ec" height="42" rx="1" width="28" />
          <rect fill="url(#city-win)" height="42" width="28" />
        </g>
        <g transform="translate(316 74)">
          <rect fill="#89aee3" height="64" rx="1" width="34" />
          <rect fill="url(#city-win)" height="64" width="34" />
        </g>
        <g transform="translate(356 90)">
          <rect fill="#7fa5de" height="48" rx="1" width="30" />
          <rect fill="url(#city-win)" height="48" width="30" />
        </g>
      </g>
      <g>
        <rect fill="#6e4b2a" height="6" width="2" x="43" y="128" />
        <circle cx="44" cy="126" fill="#4f9e58" r="5.5" />
        <rect fill="#6e4b2a" height="6" width="2" x="133" y="129" />
        <circle cx="134" cy="127" fill="#57a860" r="5" />
        <rect fill="#6e4b2a" height="6" width="2" x="271" y="128" />
        <circle cx="272" cy="126" fill="#4f9e58" r="5.5" />
        <rect fill="#6e4b2a" height="6" width="2" x="351" y="129" />
        <circle cx="352" cy="127" fill="#57a860" r="5" />
      </g>
      <rect fill="#43536a" height="15" width="390" y="135" />
      <path d="M0 143h390" stroke="#d7dde8" strokeDasharray="11 13" strokeWidth="1.5" />
      <g transform="translate(96 124)">
        <rect fill="#f4f6fa" height="9" rx="1.5" width="20" x="0" y="0" />
        <rect fill="#e3e8f0" height="6.5" rx="1" width="7" x="20" y="2.5" />
        <circle cx="5" cy="9.5" fill="#20242c" r="2.2" />
        <circle cx="23" cy="9.5" fill="#20242c" r="2.2" />
      </g>
      <g transform="translate(302 127)">
        <rect fill="#d23b2f" height="6" rx="2" width="15" y="0" />
        <path d="M3.5 0.5c1-2 7-2 8 0z" fill="#a82a20" />
        <circle cx="3.5" cy="6" fill="#20242c" r="1.8" />
        <circle cx="11.5" cy="6" fill="#20242c" r="1.8" />
      </g>
    </svg>
  );
}
