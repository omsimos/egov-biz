"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/icon-button";

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

// absolute, not fixed — and no Portal above it. Portalled to <body> and pinned
// to the viewport, every sheet in the app escaped the phone frame: on a desktop
// viewport it spanned the whole window and centred itself on the page rather
// than on the device it belongs to. In place, the nearest positioned ancestor is
// the phone (`.screen`, or `.phone-shell` for anything rendered above the
// screens), whose `overflow: hidden` clips the sheet to the frame.
function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "absolute inset-0 z-50 bg-[rgba(12,22,45,.42)] backdrop-blur-[2px] duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 motion-reduce:animate-none!",
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = false,
  ...props
}: DialogPrimitive.Popup.Props & {
  /**
   * Off by default. Every sheet already closes on the scrim and on Escape, and
   * the grab handle says which edge it came from — an X in the corner as well
   * gave one dismissal three affordances. Opt in where a sheet has no other way
   * out (a preview with nothing to cancel).
   */
  showCloseButton?: boolean;
}) {
  return (
    <>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          // The same shape as the eGovPay sheet: 26px top radius, a grab handle,
          // and the shadow cast upward onto the content behind it.
          "absolute inset-x-0 bottom-0 z-50 flex w-full flex-col rounded-t-[26px] bg-white px-5 pt-2.5 pb-[26px] shadow-[0_-20px_50px_-20px_rgba(12,22,45,.4)] outline-none duration-200 ease-[cubic-bezier(.2,.8,.2,1)] data-open:animate-in data-open:slide-in-from-bottom data-closed:animate-out data-closed:slide-out-to-bottom motion-reduce:animate-none!",
          className,
        )}
        {...props}
      >
        <span
          aria-hidden="true"
          className="h-1 w-[38px] flex-none self-center rounded-full bg-gray-300"
        />
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <IconButton variant="plain" className="absolute top-[14px] right-[14px] size-8" />
            }
          >
            <XIcon className="size-[18px]" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1.5 pr-8", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg font-black -tracking-[.4px] text-foreground", className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm leading-[1.35] text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
