export function AvatarTypewriter({ size = 48, className }) {
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
      {/* Paper emerging from platen */}
      <rect x="18" y="5" width="12" height="11" rx="1" />
      <line x1="20" y1="8" x2="28" y2="8" strokeOpacity="0.5" />
      <line x1="20" y1="11" x2="28" y2="11" strokeOpacity="0.5" />
      {/* Platen roller */}
      <rect x="10" y="14" width="28" height="6" rx="3" />
      <circle cx="8" cy="17" r="2.5" />
      <circle cx="40" cy="17" r="2.5" />
      {/* Body */}
      <rect x="7" y="19" width="34" height="20" rx="2" />
      {/* Keys — top row */}
      <rect x="12" y="23" width="5" height="4" rx="1" />
      <rect x="21" y="23" width="6" height="4" rx="1" />
      <rect x="31" y="23" width="5" height="4" rx="1" />
      {/* Space bar */}
      <rect x="14" y="30" width="20" height="4" rx="1" />
    </svg>
  );
}
