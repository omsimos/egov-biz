import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const FOCUS_RING =
  "outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2";
