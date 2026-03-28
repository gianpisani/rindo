import { motion } from "framer-motion";

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
    <motion.svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      animate={{ scale: [1, 1.04, 1] }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
    >
      <motion.rect
        x="12" y="40" width="68" height="14" rx="3"
        transform="rotate(-32, 50, 50)"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
      <motion.rect
        x="24" y="40" width="58" height="14" rx="3"
        transform="rotate(38, 50, 50)"
        opacity="0.55"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.55 }}
        transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
      />
    </motion.svg>
  );
}
