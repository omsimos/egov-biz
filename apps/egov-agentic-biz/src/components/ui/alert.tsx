import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "grid grid-cols-[22px_1fr] gap-2.5 rounded-lg border p-[13px_15px] text-sm leading-[1.35] [&>svg]:size-[18px] [&>svg]:mt-px [&>svg]:text-current",
  {
    variants: {
      variant: {
        info: "border-[#cfe0ff] bg-secondary text-[var(--egov-blue-dark)]",
        success: "border-[#bfe4d6] bg-[var(--success-soft)] text-success",
        warning: "border-[#ead99c] bg-[#fff9e8] text-[#866000]",
        destructive: "border-[#f1cfca] bg-[#fff0ed] text-[#8d392c]",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  }
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn("col-start-2 mb-0.5 text-base font-extrabold", className)}
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("col-start-2 text-sm leading-[1.35]", className)}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription, alertVariants };
