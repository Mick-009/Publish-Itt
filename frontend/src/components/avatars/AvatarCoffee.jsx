export function AvatarCoffee({ size = 48, className }) {
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
      {/* Steam wisps — three wavy rises */}
      <path d="M 17 14 C 16 11 19 9 18 6" />
      <path d="M 24 13 C 23 10 26 8 25 5" />
      <path d="M 31 14 C 30 11 33 9 32 6" />
      {/* Cup body — slightly tapered trapezoid */}
      <path d="M 13 17 L 15 37 L 33 37 L 35 17 Z" />
      <line x1="13" y1="17" x2="35" y2="17" />
      {/* Handle */}
      <path d="M 35 21 C 43 21 43 33 35 33" />
      {/* Saucer */}
      <path d="M 9 38 C 9 43 39 43 39 38" />
    </svg>
  );
}
