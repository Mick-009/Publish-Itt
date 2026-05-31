export function AvatarBooks({ size = 48, className }) {
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
      {/* Book 1 — tallest, left */}
      <rect x="8" y="11" width="9" height="27" rx="1" />
      <line x1="11" y1="11" x2="11" y2="38" strokeOpacity="0.4" />
      {/* Book 2 — medium, centre */}
      <rect x="19" y="15" width="10" height="23" rx="1" />
      <line x1="22" y1="15" x2="22" y2="38" strokeOpacity="0.4" />
      {/* Book 3 — shorter, right */}
      <rect x="31" y="19" width="9" height="19" rx="1" />
      <line x1="34" y1="19" x2="34" y2="38" strokeOpacity="0.4" />
      {/* Shelf */}
      <line x1="6" y1="38" x2="42" y2="38" />
    </svg>
  );
}
