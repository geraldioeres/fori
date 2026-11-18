/** The Fori leaf mark (same artwork as public/favicon.svg). */
export function Logo({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}favicon.svg`}
      width={size}
      height={size}
      alt=""
      aria-hidden
      draggable={false}
      className={className}
    />
  );
}
