"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { CheckIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer flex size-5 shrink-0 items-center justify-center rounded-[6px] border-[1.5px] border-input bg-white outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-checked:border-primary data-checked:bg-primary",
        className,
      )}
      {...props}
    >
      {/* scale-50 with opacity, not scale-0 on its own. From 0 the tick was
          still fully opaque at scale 0.1, so the first thing the eye caught was
          a solid dot in the middle of the box that then grew into a check.
          Fading it over the same 150ms makes it read as one mark being set. */}
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex scale-100 items-center justify-center text-primary-foreground opacity-100 transition-[scale,opacity] duration-150 ease-[var(--ease-out)] motion-reduce:transition-none data-ending-style:scale-50 data-ending-style:opacity-0 data-starting-style:scale-50 data-starting-style:opacity-0"
      >
        <CheckIcon weight="bold" className="size-3" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
