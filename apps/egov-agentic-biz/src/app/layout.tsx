import type { Metadata, Viewport } from "next";
import { Nunito_Sans } from "next/font/google";
import { InteractionSounds } from "@/components/interaction-sounds";
import "./globals.css";

const nunito = Nunito_Sans({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-ui",
  weight: ["400", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "eGovPH",
  description: "One app for Philippine government services.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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
        {children}
      </body>
    </html>
  );
}
