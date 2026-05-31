export function AvatarAnchor({ size = 48, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Ring at top */}
      <circle cx="24" cy="11" r="5" />
      {/* Vertical shaft */}
      <line x1="24" y1="16" x2="24" y2="40" />
      {/* Crossbar */}
      <line x1="13" y1="22" x2="35" y2="22" />
      {/* Crossbar end caps */}
      <circle cx="13" cy="22" r="1.5" fill="currentColor" />
      <circle cx="35" cy="22" r="1.5" fill="currentColor" />
      {/* Flukes — curved arms at bottom */}
      <path d="M 24 40 C 18 40 12 36 12 31" />
      <path d="M 24 40 C 30 40 36 36 36 31" />
      {/* Rope loop over ring */}
      <path d="M 19 10 C 19 5 29 5 29 10" strokeOpacity="0.55" />
      {/* Rope trailing down left side */}
      <path d="M 29 10 C 32 15 30 21 13 22" strokeOpacity="0.45" />
    </svg>
  );
}
