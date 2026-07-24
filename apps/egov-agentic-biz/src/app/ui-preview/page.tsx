"use client";

import { useState } from "react";
import { PaperPlaneRight } from "@phosphor-icons/react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldHint, FieldLabel } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const BUTTON_VARIANTS = [
  "primary",
  "secondary",
  "outline",
  "ghost",
  "destructive",
] as const;

const BUTTON_SIZES = ["sm", "md", "lg"] as const;

const ICON_BUTTON_VARIANTS = ["plain", "soft", "primary"] as const;

const BADGE_VARIANTS = [
  "primary",
  "success",
  "warning",
  "destructive",
  "neutral",
  "solid",
] as const;

const AVATAR_SIZES = ["sm", "md", "lg"] as const;

const BUSINESS_TYPE_OPTIONS = [
  { value: "sole-proprietorship", label: "Sole Proprietorship" },
  { value: "partnership", label: "Partnership" },
  { value: "corporation", label: "Corporation" },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: "gcash", label: "GCash" },
  { value: "bank-transfer", label: "Bank transfer" },
  { value: "over-the-counter", label: "Over the counter" },
];

export default function UIPreviewPage() {
  const [agreed, setAgreed] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("gcash");
  const [notifications, setNotifications] = useState(false);

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
          <div className="p-6 border border-border rounded-lg bg-muted/50 grid gap-6 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="preview-input">Business name</FieldLabel>
              <Input id="preview-input" placeholder="Juan Dela Cruz Trading" />
              <FieldHint>Enter your registered business name.</FieldHint>
            </div>

            <div>
              <FieldLabel htmlFor="preview-input-error">
                Email address
              </FieldLabel>
              <Input
                id="preview-input-error"
                defaultValue="not-an-email"
                aria-invalid
              />
              <FieldHint error>Enter a valid email address.</FieldHint>
            </div>

            <div>
              <FieldLabel htmlFor="preview-input-disabled">
                Reference number
              </FieldLabel>
              <Input
                id="preview-input-disabled"
                defaultValue="REF-2026-00019"
                disabled
              />
              <FieldHint>Auto-generated, cannot be edited.</FieldHint>
            </div>

            <div>
              <FieldLabel htmlFor="preview-select">Business type</FieldLabel>
              <Select
                items={BUSINESS_TYPE_OPTIONS}
                defaultValue="sole-proprietorship"
              >
                <SelectTrigger id="preview-select">
                  <SelectValue placeholder="Select a business type" />
                </SelectTrigger>
                <SelectContent>
                  {BUSINESS_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldHint>
                Choose the legal structure of your business.
              </FieldHint>
            </div>

            <div className="sm:col-span-2">
              <FieldLabel htmlFor="preview-textarea">
                Business address
              </FieldLabel>
              <Textarea
                id="preview-textarea"
                placeholder="Unit / Floor, Building, Street, Barangay, City"
              />
              <FieldHint>Provide the complete registered address.</FieldHint>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Choice controls</h2>
          <div className="p-6 border border-border rounded-lg bg-muted/50 grid gap-8 sm:grid-cols-2">
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Checkbox
              </h3>
              <label className="flex items-center gap-2 text-[15px] text-foreground">
                <Checkbox
                  checked={agreed}
                  onCheckedChange={(checked) => setAgreed(checked)}
                />
                Unchecked / checked (click to toggle)
              </label>
              <label className="flex items-center gap-2 text-[15px] text-foreground">
                <Checkbox defaultChecked />
                Checked by default
              </label>
              <label className="flex items-center gap-2 text-[15px] text-muted-foreground">
                <Checkbox defaultChecked disabled />
                Disabled
              </label>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Radio group
              </h3>
              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 text-[15px] text-foreground"
                  >
                    <RadioGroupItem value={option.value} />
                    {option.label}
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Switch
              </h3>
              <label className="flex items-center gap-2 text-[15px] text-foreground">
                <Switch
                  checked={notifications}
                  onCheckedChange={(checked) => setNotifications(checked)}
                />
                On / off (click to toggle)
              </label>
              <label className="flex items-center gap-2 text-[15px] text-muted-foreground">
                <Switch defaultChecked disabled />
                Disabled
              </label>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Card / Badge / Avatar / Separator</h2>
          <div className="p-6 border border-border rounded-lg bg-muted/50 flex flex-col gap-8">
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Card
              </h3>
              <Card className="max-w-sm">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>Business registration</CardTitle>
                    <Badge variant="success">Approved</Badge>
                  </div>
                  <CardDescription>
                    Juan Dela Cruz Trading - Sole Proprietorship
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground">
                    Your DTI registration has been approved. Download your
                    certificate or start your next application.
                  </p>
                </CardContent>
                <CardFooter>
                  <Button size="sm">View certificate</Button>
                  <Button variant="ghost" size="sm">
                    Dismiss
                  </Button>
                </CardFooter>
              </Card>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Badge
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                {BADGE_VARIANTS.map((variant) => (
                  <Badge key={variant} variant={variant}>
                    {variant}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Avatar
              </h3>
              <div className="flex flex-wrap items-center gap-3">
                {AVATAR_SIZES.map((size) => (
                  <Avatar key={size} size={size}>
                    <AvatarFallback>JD</AvatarFallback>
                  </Avatar>
                ))}
                <Avatar size="lg">
                  <AvatarImage src="/images/mara-reyes.png" alt="Mara Reyes" />
                  <AvatarFallback>MR</AvatarFallback>
                </Avatar>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Separator
              </h3>
              <div className="flex flex-col gap-3">
                <Separator />
                <div className="flex h-8 items-center gap-3">
                  <span className="text-sm text-foreground">Left</span>
                  <Separator orientation="vertical" />
                  <span className="text-sm text-foreground">Right</span>
                </div>
              </div>
            </div>
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
