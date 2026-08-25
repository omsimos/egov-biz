import { cn } from "@/lib/utils";

// A state indicator, not an action spinner. The registration plan uses this to
// mark which step you are on — a condition that holds for as long as the step
// does. A spinner promises something will finish in a moment, which is the
// wrong promise for a task that might take days.
//
// Both layers paint with currentColor, so the dot takes the colour of whatever
// chip contains it. Size comes from the caller (e.g. `size-4`).
export function PulseDot({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("pulse-dot", className)}>
      <i className="pulse-dot-ring" />
      <i className="pulse-dot-core" />
    </span>
  );
}
