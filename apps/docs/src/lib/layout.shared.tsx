import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { appName, gitConfig, sdkDocsUrl } from "@/lib/shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: appName,
    },
    links: [
      {
        text: "egov.js SDK",
        url: sdkDocsUrl,
        external: true,
      },
    ],
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
