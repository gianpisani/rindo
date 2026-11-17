import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Radio y sombra con nombres propios (tailwind.config.ts): twMerge debe saber
// que `rounded-card` pisa a `rounded-full` y `shadow-float` a `shadow-none`.
const twMerge = extendTailwindMerge({
  extend: { theme: { borderRadius: ["card"] }, classGroups: { shadow: [{ shadow: ["float"] }] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
