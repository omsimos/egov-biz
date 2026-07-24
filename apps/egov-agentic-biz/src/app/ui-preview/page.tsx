"use client";

import { PaperPlaneRight } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";

const BUTTON_VARIANTS = [
  "primary",
  "secondary",
  "outline",
  "ghost",
  "destructive",
] as const;

const BUTTON_SIZES = ["sm", "md", "lg"] as const;

const ICON_BUTTON_VARIANTS = ["plain", "soft", "primary"] as const;

export default function UIPreviewPage() {
  return (
    <main className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">UI Primitives Preview</h1>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Buttons</h2>
          <div className="p-6 border border-border rounded-lg bg-muted/50 flex flex-col gap-8">
            {BUTTON_SIZES.map((size) => (
              <div key={size} className="flex flex-col gap-3">
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Size: {size}
                </h3>
                <div className="flex flex-wrap items-center gap-3">
                  {BUTTON_VARIANTS.map((variant) => (
                    <Button key={variant} variant={variant} size={size}>
                      {variant}
                    </Button>
                  ))}
                  <Button variant="primary" size={size} disabled>
                    disabled
                  </Button>
                </div>
              </div>
            ))}

            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Block
              </h3>
              <Button variant="primary" block>
                Full width primary
              </Button>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Icon buttons
              </h3>
              <div className="flex flex-wrap items-center gap-3">
                {ICON_BUTTON_VARIANTS.map((variant) => (
                  <IconButton key={variant} variant={variant} aria-label="Send">
                    <PaperPlaneRight weight="bold" />
                  </IconButton>
                ))}
                <IconButton variant="primary" disabled aria-label="Send disabled">
                  <PaperPlaneRight weight="bold" />
                </IconButton>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Form fields</h2>
          <div className="p-6 border border-border rounded-lg bg-muted/50">
            {/* Primitive examples will be added here */}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Choice controls</h2>
          <div className="p-6 border border-border rounded-lg bg-muted/50">
            {/* Primitive examples will be added here */}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Card / Badge / Avatar / Separator</h2>
          <div className="p-6 border border-border rounded-lg bg-muted/50">
            {/* Primitive examples will be added here */}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Alert / Dialog / Tabs</h2>
          <div className="p-6 border border-border rounded-lg bg-muted/50">
            {/* Primitive examples will be added here */}
          </div>
        </section>
      </div>
    </main>
  );
}
