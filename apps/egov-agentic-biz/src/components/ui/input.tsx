import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

interface InputProps extends InputPrimitive.Props {
  error?: boolean;
}

function Input({
  className,
  type,
  error,
  "aria-invalid": ariaInvalid,
  ...props
}: InputProps) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      aria-invalid={ariaInvalid ?? error}
      className={cn(
        "flex h-11 w-full min-w-0 rounded-md border border-input bg-white px-[13px] text-[15px] text-foreground outline-none transition-[color,box-shadow] placeholder:text-[#9aa4b5] focus:border-primary focus:ring-3 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  );
}

export { Input };
