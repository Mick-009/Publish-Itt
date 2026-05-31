export function AvatarLantern({ size = 48, className }) {
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
      {/* Hanging ring */}
      <path d="M 21 5 C 21 2 27 2 27 5 C 27 7 25.5 8 24 8 C 22.5 8 21 7 21 5 Z" />
      {/* Chain/stem */}
      <line x1="24" y1="8" x2="24" y2="12" />
      {/* Top cap */}
      <path d="M 15 12 L 33 12 L 35 16 L 13 16 Z" />
      {/* Body — tapers slightly toward bottom */}
      <path d="M 13 16 L 11 35 L 37 35 L 35 16" />
      {/* Centre divider */}
      <line x1="24" y1="16" x2="24" y2="35" strokeOpacity="0.35" />
      {/* Horizontal band */}
      <line x1="11" y1="25" x2="37" y2="25" strokeOpacity="0.4" />
      {/* Bottom cap */}
      <path d="M 11 35 L 13 40 L 35 40 L 37 35" />
      {/* Finial drop */}
      <line x1="24" y1="40" x2="24" y2="44" />
      <circle cx="24" cy="45" r="1.2" fill="currentColor" />
      {/* Flame */}
      <path d="M 24 20 C 24 20 27 24 27 27 C 27 29.5 25.5 31 24 31 C 22.5 31 21 29.5 21 27 C 21 24 24 20 24 20 Z" strokeOpacity="0.65" />
    </svg>
  );
}
