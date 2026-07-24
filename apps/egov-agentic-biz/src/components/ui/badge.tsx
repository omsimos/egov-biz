import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-1 text-2xs font-extrabold leading-none",
  {
    variants: {
      variant: {
        primary: "bg-secondary text-primary",
        success: "bg-[var(--success-soft)] text-success",
        warning: "bg-[var(--warning-soft)] text-[#866000]",
        destructive: "bg-destructive text-destructive-foreground",
        neutral: "bg-muted text-muted-foreground",
        solid: "bg-primary text-primary-foreground",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  }
);

function Badge({
  className,
  variant = "primary",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  });
}

export { Badge, badgeVariants };
