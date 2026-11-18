export function Duck({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10 23c-4-1-6-5-6-5s-2 18 14 22c13 3 24-3 24-12 0-5-4-8-9-8 2-2 3-4 3-7 0-6-4-10-10-10S15 7 15 13c0 5 3 8 6 10-4 2-8 2-11 0Z"
        fill="currentColor"
      />
      <path d="m35 11 10 5-10 3" fill="#F4AF54" />
      <circle cx="29" cy="12" r="2" fill="#132E2B" />
      <path
        d="M14 29c3 4 8 5 13 2"
        stroke="#fff"
        strokeOpacity=".65"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function VoyageArt() {
  return (
    <svg
      className="voyage-art"
      viewBox="0 0 420 300"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="sea"
          x1="0"
          y1="0"
          x2="420"
          y2="300"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#bfd7d0" />
          <stop offset="1" stopColor="#92bcb1" />
        </linearGradient>
      </defs>
      <path d="M30 15h360v270H30z" fill="url(#sea)" />
      <path
        d="M0 222C85 190 116 260 195 221S320 188 425 228M0 242c85-32 116 38 195-1s125-33 230 7M0 62C85 30 116 100 195 61S320 28 425 68M0 82C85 50 116 120 195 81S320 48 425 88"
        stroke="#eaf3ee"
        strokeOpacity=".55"
      />
      <path
        d="M0 125c90-38 88 68 180 34s113-63 240-40"
        stroke="#3b796b"
        strokeOpacity=".2"
        strokeDasharray="4 7"
      />
      <circle cx="344" cy="82" r="25" stroke="#f1f7eb" strokeWidth="1.5" />
      <path d="m344 63 5 19-5 19-5-19z" fill="#f1f7eb" />
      <path d="m325 82 19-5 19 5-19 5z" fill="#f1f7eb" />
      <g transform="translate(155 82) rotate(-12 55 75)">
        <path d="m58 120-10 93 13-3 7-92" fill="#fff" opacity=".23" />
        <path d="M10 117h99l-14 19H31z" fill="#294e45" />
        <path d="M56 10v107" stroke="#294e45" strokeWidth="3" />
        <path d="M52 17 9 108h43z" fill="#fffcf3" />
        <path d="m62 35 38 73H62z" fill="#ecb366" />
        <path d="M56 10V0" stroke="#294e45" strokeWidth="3" />
        <path d="M56 0h24l-7 8H56z" fill="#e8f2e3" />
      </g>
      <path
        d="M71 61c38 8 3 34 22 53 13 13 29 8 38 5"
        stroke="#fff"
        strokeWidth="2"
        strokeDasharray="5 5"
      />
      <circle cx="72" cy="61" r="5" fill="#e8f2e3" />
      <path d="M36 15H0v270h36M384 15h36v270h-36" fill="#eaf0e5" />
    </svg>
  );
}
