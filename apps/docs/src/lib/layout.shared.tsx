import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { appName, gitConfig, sdkDocsUrl, sdkRepoUrl } from "@/lib/shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: appName,
    },
    links: [
      {
        text: "egov.js docs",
        url: sdkDocsUrl,
        external: true,
      },
      {
        text: "egov.js source",
        url: sdkRepoUrl,
        external: true,
      },
    ],
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
