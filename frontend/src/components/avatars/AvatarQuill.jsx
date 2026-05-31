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
      {/* Feather vane — pointed oval, tilted ~50° */}
      <path d="M 36 6 C 44 12 42 32 30 42 L 10 44 C 16 36 18 22 10 14 Z" />
      {/* Central spine */}
      <line x1="33" y1="9" x2="10" y2="44" />
      {/* Nib fork at tip */}
      <path d="M 10 44 L 6 47 M 10 44 L 14 47" />
      {/* Barb texture */}
      <line x1="27" y1="14" x2="17" y2="28" strokeOpacity="0.45" />
      <line x1="21" y1="23" x2="13" y2="36" strokeOpacity="0.35" />
    </svg>
  );
}
