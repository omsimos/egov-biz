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
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex scale-100 items-center justify-center text-primary-foreground transition-transform duration-150 data-ending-style:scale-0 data-starting-style:scale-0"
      >
        <CheckIcon weight="bold" className="size-3" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
