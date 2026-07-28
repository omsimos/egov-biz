import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// active:scale is on the base, not on `primary`. Press feedback answers the
// question "did it hear me", which every variant has to answer — a ghost button
// that stays perfectly still while the primary beside it dips reads as the
// broken one. --press-md is the standard-button tier; `block` overrides it
// because a full-width button at 0.97 travels five pixels per edge.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap font-extrabold text-sm transition duration-150 ease-[var(--ease-out)] outline-none select-none active:scale-[var(--press-md)] focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-primary hover:bg-[var(--primary-hover)]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-primary-tint-strong",
        outline:
          "bg-white text-primary border border-input-strong hover:bg-[var(--egov-blue-soft)]",
        ghost: "bg-transparent text-foreground hover:bg-muted",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive-hover",
      },
      size: {
        sm: "h-8 rounded-sm px-3 text-xs",
        md: "h-10 rounded-md px-4",
        lg: "h-[50px] rounded-lg px-[22px] text-base",
      },
      block: {
        true: "flex w-full active:scale-[var(--press-lg)]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

interface ButtonProps extends ButtonPrimitive.Props, VariantProps<typeof buttonVariants> {}

function Button({ className, variant = "primary", size = "md", block, ...props }: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, block, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
