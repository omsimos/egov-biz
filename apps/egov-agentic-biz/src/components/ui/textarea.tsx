import * as React from "react";

import { cn } from "@/lib/utils";

interface TextareaProps extends React.ComponentProps<"textarea"> {
  error?: boolean;
}

function Textarea({ className, error, "aria-invalid": ariaInvalid, ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      aria-invalid={ariaInvalid ?? error}
      className={cn(
        "flex min-h-24 w-full rounded-md border border-input bg-white px-[13px] py-3 text-base leading-[1.55] text-foreground outline-none transition-[color,box-shadow] resize-y placeholder:text-[#9aa4b5] focus:border-primary focus:ring-3 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
