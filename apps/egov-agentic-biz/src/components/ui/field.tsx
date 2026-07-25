import * as React from "react";

import { cn } from "@/lib/utils";

function FieldLabel({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="field-label"
      className={cn("mb-1.5 block text-xs font-bold text-muted-foreground", className)}
      {...props}
    />
  );
}

interface FieldHintProps extends React.ComponentProps<"p"> {
  error?: boolean;
}

function FieldHint({ className, error, ...props }: FieldHintProps) {
  return (
    <p
      data-slot="field-hint"
      data-error={error || undefined}
      className={cn("mt-1.5 text-xs text-muted-foreground", error && "text-destructive", className)}
      {...props}
    />
  );
}

export { FieldLabel, FieldHint };
