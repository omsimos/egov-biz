import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const iconButtonVariants = cva(
  "inline-grid size-10 shrink-0 place-items-center rounded-full transition outline-none select-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[.94] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[22px]",
  {
    variants: {
      variant: {
        plain: "bg-transparent hover:bg-muted",
        soft: "bg-[var(--egov-blue-soft)] text-primary",
        primary: "bg-primary text-white shadow-[var(--shadow-primary)]",
      },
    },
    defaultVariants: {
      variant: "plain",
    },
  }
);

interface IconButtonProps
  extends ButtonPrimitive.Props,
    VariantProps<typeof iconButtonVariants> {}

function IconButton({
  className,
  variant = "plain",
  ...props
}: IconButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="icon-button"
      className={cn(iconButtonVariants({ variant, className }))}
      {...props}
    />
  );
}

export { IconButton, iconButtonVariants };
