export function AvatarQuill({ size = 48, className }) {
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
      {/* Asymmetric vane — wide on right, narrow on left, pointed tip */}
      <path d="M 37 7 C 46 15 42 31 28 40 L 15 40 C 23 32 30 17 37 7 Z" />
      {/* Shaft — runs full length, tip extends past calamus to suggest nib */}
      <line x1="37" y1="7" x2="11" y2="44" />
      {/* Nib fork */}
      <path d="M 11 44 L 7 47 M 11 44 L 15 47" />
      {/* Barbs branching from shaft toward wide side */}
      <line x1="30" y1="17" x2="37" y2="21" strokeOpacity="0.55" />
      <line x1="24" y1="26" x2="31" y2="30" strokeOpacity="0.45" />
      <line x1="18" y1="34" x2="25" y2="38" strokeOpacity="0.35" />
    </svg>
  );
}
