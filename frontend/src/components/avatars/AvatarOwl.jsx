export function AvatarOwl({ size = 48, className }) {
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
      {/* Head — rounded shape */}
      <path d="M 24 8 C 38 8 42 19 42 26 C 42 35 35 42 24 42 C 13 42 6 35 6 26 C 6 19 10 8 24 8 Z" />
      {/* Ear tufts */}
      <path d="M 13 11 L 9 5 L 17 9" />
      <path d="M 35 11 L 39 5 L 31 9" />
      {/* Left eye ring + pupil dot */}
      <circle cx="17" cy="24" r="6" />
      <circle cx="17" cy="24" r="2" fill="currentColor" />
      {/* Right eye ring + pupil dot */}
      <circle cx="31" cy="24" r="6" />
      <circle cx="31" cy="24" r="2" fill="currentColor" />
      {/* Beak */}
      <path d="M 22 31 L 24 35 L 26 31" />
    </svg>
  );
}
