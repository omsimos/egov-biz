"use client";

import { MotionConfig } from "motion/react";

// reducedMotion="user" makes every motion component in the tree drop transform
// and layout animations when the OS asks for reduced motion, while leaving
// opacity alone — the same line globals.css draws for CSS transitions, so the
// two halves of the app agree instead of each deciding for themselves.
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
