import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "eGovPH Business",
  description: "A simple way to start and register your business.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f7f9ff",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const clientId = process.env.EGOVSSO_PARTNER_CODE?.trim() ?? "";

  return (
    <html lang="en">
      <head>
        <meta content="STAGING" name="egov-environment" />
        <meta content={clientId} name="egov-client-id" />
        <meta content="handleEgovSsoSuccess" name="egov-sso-onsuccess" />
      </head>
      <body>{children}</body>
    </html>
  );
}
