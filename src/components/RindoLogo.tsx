interface RindoLogoProps {
  className?: string;
  size?: number;
  animate?: boolean;
}

export function RindoLogo({ className, size = 100, animate = false }: RindoLogoProps) {
  if (!animate) {
    return (
      <svg viewBox="0 0 100 100" width={size} height={size} className={className} fill="currentColor">
        <rect x="12" y="40" width="68" height="14" rx="3" transform="rotate(-32, 50, 50)" />
        <rect x="24" y="40" width="58" height="14" rx="3" transform="rotate(38, 50, 50)" opacity="0.55" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      style={{ overflow: "visible" }}
    >
      <rect
        x="12" y="40" width="68" height="14" rx="3"
        className="rindo-saber-1"
      />
      <rect
        x="24" y="40" width="58" height="14" rx="3"
        className="rindo-saber-2"
      />
    </svg>
  );
}
