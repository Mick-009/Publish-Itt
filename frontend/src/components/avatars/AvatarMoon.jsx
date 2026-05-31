export function AvatarMoon({ size = 48, className }) {
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
      {/* Crescent — outer arc sweeps right, inner arc concave back */}
      <path d="M 24 8 C 42 8 44 40 24 40 C 32 34 32 14 24 8 Z" />
      {/* 4-point star */}
      <path d="M 37 13 L 38.5 9 L 40 13 L 44 14.5 L 40 16 L 38.5 20 L 37 16 L 33 14.5 Z" />
      {/* Tiny dot star */}
      <circle cx="40" cy="27" r="1.5" fill="currentColor" />
    </svg>
  );
}
