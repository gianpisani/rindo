import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  extend: { theme: { borderRadius: ["card"] }, classGroups: { shadow: [{ shadow: ["float"] }] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
