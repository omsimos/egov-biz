import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Provider } from "@/components/provider";
import { baseOptions } from "@/lib/layout.shared";
import { appDescription, appName } from "@/lib/shared";
import { source } from "@/lib/source";
import "./global.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: `${appName} — System Documentation`,
    template: `%s — ${appName}`,
  },
  description: appDescription,
};

// Every route is a documentation page, so the docs shell lives in the root
// layout instead of a nested route group.
export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <Provider>
          <DocsLayout tree={source.getPageTree()} {...baseOptions()}>
            {children}
          </DocsLayout>
        </Provider>
      </body>
    </html>
  );
}
