"use client";

import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";

import { cn } from "@/lib/utils";

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn("grid w-full gap-3", className)}
      {...props}
    />
  );
}

interface RadioGroupItemProps extends RadioPrimitive.Root.Props {
  /**
   * Draw an open ring with a filled core instead of a solid disc. The intake
   * step's option rows are 56px tall on a tinted fill, and at that size a solid
   * blue disc reads as a checkbox — the ring is what says one of these.
   */
  ring?: boolean;
}

function RadioGroupItem({ className, ring, ...props }: RadioGroupItemProps) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={cn(
        "peer flex shrink-0 items-center justify-center rounded-full bg-white outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-checked:border-primary",
        ring
          ? "size-[21px] border-2 border-gray-300"
          : "size-5 border-[1.5px] border-input data-checked:bg-primary",
        className,
      )}
      {...props}
    >
      <RadioPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="flex scale-100 items-center justify-center opacity-100 transition-[scale,opacity] duration-150 ease-[var(--ease-out)] motion-reduce:transition-none data-ending-style:scale-50 data-ending-style:opacity-0 data-starting-style:scale-50 data-starting-style:opacity-0"
      >
        <span
          className={cn(
            "rounded-full",
            ring ? "size-[11px] bg-primary" : "size-2 bg-primary-foreground",
          )}
        />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Root>
  );
}

export { RadioGroup, RadioGroupItem };
