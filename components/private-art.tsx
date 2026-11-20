/** Decorative, local SVG artwork. No external image requests in Private Mode. */
export function SecretVoyageArt() {
  return (
    <svg viewBox="0 0 540 380" fill="none" aria-hidden="true">
      <path
        d="M62 75C130 2 362 12 452 85c73 59 56 192-12 240-87 61-298 32-371-35C7 234 8 131 62 75Z"
        fill="#244b44"
      />
      <path
        d="M52 236c67-31 106 39 177 4s123-30 235-2M38 267c76-30 113 37 191 2s134-25 254 4M73 300c59-22 111 27 171 3s133-25 201 4"
        stroke="#71988a"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M396 46a37 37 0 1 0 42 53 32 32 0 0 1-42-53Z" fill="#ede6b6" />
      <g stroke="#adc9a9" strokeWidth="2" strokeLinecap="round">
        <path d="M100 75v16m-8-8h16M328 57v12m-6-6h12M459 157v14m-7-7h14M71 177v10m-5-5h10" />
      </g>
      <path
        d="M95 206c-17-53 67-101 117-73 45 25 84 30 132-5"
        stroke="#a9c79b"
        strokeWidth="2"
        strokeDasharray="4 8"
        strokeLinecap="round"
      />
      <circle cx="94" cy="208" r="5" fill="#d6e7b3" />
      <g className="secret-art-boat">
        <path
          d="M159 251h255l-37 52H197Z"
          fill="#d1dfba"
          stroke="#102c28"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path d="m184 274 20 29h173l21-29" fill="#81a18e" />
        <path
          d="M326 67v184"
          stroke="#e9edda"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path d="m319 90-76 127h76Z" fill="#f4eedb" />
        <path d="m335 120 64 109h-64Z" fill="#dfab65" />
        <path d="M329 66h58l-13 18h-45Z" fill="#c9deb1" />
        <path
          d="M345 71c-5 6-4 11 4 11h10c5 0 6-6 2-7 4-6-4-9-7-4l-1 4Z"
          fill="#294d3c"
        />
        <path
          d="M141 218c-17-3-25-15-25-15-3 35 18 57 57 57 44 0 71-17 71-39 0-16-12-27-30-28 9-7 14-17 14-28 0-24-18-41-42-41-23 0-40 17-40 39 0 19 12 29 22 37-8 13-17 19-27 18Z"
          fill="#e7bc60"
          stroke="#15392f"
          strokeWidth="3"
        />
        <path d="m223 163 35 15-35 11" fill="#d77e50" />
        <path
          d="M156 144h72l-5 22c-2 8-22 10-28-1l-4-7-4 7c-7 11-25 7-28-1Z"
          fill="#14352d"
        />
        <path
          d="m168 149 10 2m26-2 10 2"
          stroke="#8fac99"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path d="M151 130c5-36 57-47 78-15l-9 18Z" fill="#efe9d3" />
        <path d="m151 129 70 3 6 9-78-1Z" fill="#102d27" />
        <path
          d="M188 108v14m-7-7c0 10 14 10 14 0"
          stroke="#3a6351"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M148 231c9 12 29 14 44 5"
          stroke="#fae2a4"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <rect
          x="275"
          y="264"
          width="46"
          height="31"
          rx="5"
          fill="#f5edcf"
          stroke="#355c4d"
          strokeWidth="2"
        />
        <path d="m277 267 21 14 21-14" stroke="#355c4d" strokeWidth="2" />
        <circle cx="298" cy="280" r="6" fill="#c07b55" />
      </g>
      <path
        d="M148 314c36-14 58 15 91 1s66-13 98 0 49 5 64-1"
        stroke="#b1c7b2"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <g transform="rotate(-10 96 300)">
        <rect x="44" y="278" width="136" height="40" rx="20" fill="#dce7bb" />
        <path
          d="M61 296v-4a5 5 0 0 1 10 0v4m-12 0h14v12H59Z"
          stroke="#264b3e"
          strokeWidth="2"
        />
        <text
          x="81"
          y="303"
          fill="#264b3e"
          fontFamily="sans-serif"
          fontSize="12"
          fontWeight="700"
        >
          BEAK SEALED
        </text>
      </g>
    </svg>
  );
}

export function PrivacyMark({ kind }: { kind: "query" | "brief" | "wake" }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      {kind === "query" ? (
        <>
          <path
            d="M10 16h36v27H26L16 51v-8h-6Z"
            fill="#e9e7cd"
            stroke="#2d5545"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M18 25h19m-19 8h12M43 11l10-6m-2 15h9"
            stroke="#2d5545"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="m39 42 8 6 13-19"
            stroke="#af7947"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : kind === "brief" ? (
        <>
          <rect
            x="11"
            y="27"
            width="42"
            height="29"
            rx="7"
            fill="#eedca7"
            stroke="#2d5545"
            strokeWidth="2"
          />
          <path
            d="M21 27V17a11 11 0 0 1 22 0v10"
            stroke="#2d5545"
            strokeWidth="4"
          />
          <circle cx="32" cy="39" r="4" fill="#2d5545" />
          <path d="M32 40v8" stroke="#2d5545" strokeWidth="3" />
          <path
            d="M7 10v9M3 14h8M54 17v8m-4-4h8"
            stroke="#af7947"
            strokeWidth="2"
          />
        </>
      ) : (
        <>
          <path
            d="M9 38h46l-9 13H19Z"
            fill="#d6dfba"
            stroke="#2d5545"
            strokeWidth="2"
          />
          <path
            d="M32 7v31M27 13 12 32h15Z"
            stroke="#2d5545"
            strokeWidth="2"
            fill="#eee8d1"
          />
          <path d="m37 18 13 14H37Z" fill="#c88a55" />
          <path
            d="M4 57c8-5 12 5 21 0s13 5 21 0 11 2 15 0"
            stroke="#2d5545"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="51" cy="12" r="4" stroke="#9baf91" strokeWidth="2" />
        </>
      )}
    </svg>
  );
}
