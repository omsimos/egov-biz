import type { Transition } from "motion/react";

// The JS half of the motion vocabulary. The curves below are the same ones
// globals.css exposes as --ease-out / --ease-drawer; they are repeated as
// number tuples because motion takes arrays and cannot resolve a var(). Two
// copies of a value is worse than one, so if you change a curve, change both.
//
// CSS owns everything that can be done with a transition — press feedback,
// hover, colour, the accordion. motion owns exactly one thing CSS still cannot
// do: animating an element on its way *out*, when React is about to unmount it.
// If a suggestion here can be written as a `transition:` line, it should be.
const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];
const EASE_DRAWER: [number, number, number, number] = [0.32, 0.72, 0, 1];

// Exit is faster than enter throughout. Entering, the user is waiting to read
// something and the motion explains where it came from; leaving, they have
// already decided and every extra frame is the interface holding them up.
export const POPOVER_IN: Transition = { duration: 0.16, ease: EASE_OUT };
export const POPOVER_OUT: Transition = { duration: 0.11, ease: EASE_OUT };

export const SHEET_IN: Transition = { duration: 0.26, ease: EASE_DRAWER };
export const SHEET_OUT: Transition = { duration: 0.18, ease: EASE_OUT };

export const SCRIM_IN: Transition = { duration: 0.22, ease: EASE_OUT };
export const SCRIM_OUT: Transition = { duration: 0.16, ease: EASE_OUT };

// One value for both directions: a screen change is a swap, not an arrival, so
// the outgoing and incoming halves have to be the same length or they overlap
// unevenly. 220ms is the ceiling — past that, navigating the prototype starts
// to feel like waiting for it.
export const SCREEN: Transition = { duration: 0.22, ease: EASE_OUT };

// The landing's one hero move: pressing Get started slides the marketing copy
// out of frame while the phone glides to the middle of the viewport and the login
// screen slides in over the Home preview. Slower than SCREEN because this is the
// page recomposing itself rather than a navigation inside it — SCREEN's 220ms
// ceiling is about not being kept waiting between screens, which is a different
// job from this one. A slide is all it is: no fade and no scale, so no part of it
// reads as a zoom.
export const LANDING: Transition = { duration: 0.65, ease: EASE_OUT };

// Screens slide along the axis of travel: going deeper, the new screen enters
// from the right and the old one leaves to the left; coming back, both reverse.
// 24px, not a full width — this is a cue about direction, not a carousel, and a
// full-width slide inside 220ms reads as a smear.
const SCREEN_SHIFT = 24;

// Variants as *functions* of `back`, driven by AnimatePresence's `custom`, and
// not as plain objects computed from a prop. A screen on its way out renders
// with the props it had while it was still the current screen, so the direction
// baked into its `exit` would always be one navigation stale — every "back"
// would animate as a "forward". `custom` is read at exit time instead, which is
// the only place the direction is known correctly.
export const SCREEN_VARIANTS = {
  // `transform` as a string rather than motion's x shorthand: the shorthands are
  // driven by requestAnimationFrame on the main thread, which drops frames
  // exactly when a screen change is competing with the fetch that caused it.
  // The string form is handed to the compositor.
  initial: (back: boolean) => ({
    opacity: 0,
    transform: `translateX(${back ? -SCREEN_SHIFT : SCREEN_SHIFT}px)`,
  }),
  animate: { opacity: 1, transform: "translateX(0px)" },
  exit: (back: boolean) => ({
    opacity: 0,
    transform: `translateX(${back ? SCREEN_SHIFT : -SCREEN_SHIFT}px)`,
  }),
};

// How deep each screen sits, so the direction of any move can be derived rather
// than threaded through every setScreen call. chat and business-detail are both
// children of business — moving sideways between them is rare enough that
// treating it as "no direction" is fine.
export const SCREEN_DEPTH = {
  restoring: 0,
  home: 1,
  business: 2,
  "business-detail": 3,
  chat: 3,
} as const;
