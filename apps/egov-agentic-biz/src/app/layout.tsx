import type { Metadata, Viewport } from "next";
import { Nunito_Sans } from "next/font/google";
import { InteractionSounds } from "@/components/interaction-sounds";
import { MotionProvider } from "@/components/motion-provider";
import "./globals.css";

// No `weight` list on purpose. Nunito Sans is a variable font, and naming
// discrete weights makes next/font emit one @font-face per weight over the same
// file — which snaps anything in between to the nearest named step (500 would
// render as 400). Omitting it exposes the whole wght axis from one download, so
// the UI can sit at 500 without a second file.
const nunito = Nunito_Sans({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-ui",
});

export const metadata: Metadata = {
  title: "eGOVbusiness — eGovPH",
  description: "One app for Philippine government services.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const clientId = process.env.EGOVSSO_PARTNER_CODE?.trim() ?? "";

  return (
    <html className={nunito.variable} lang="en">
      <head>
        <meta content="STAGING" name="egov-environment" />
        <meta content={clientId} name="egov-client-id" />
        <meta content="handleEgovSsoSuccess" name="egov-sso-onsuccess" />
      </head>
      <body>
        <InteractionSounds />
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
