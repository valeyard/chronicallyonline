import type { NextConfig } from "next";

const REPO_NAME = "chronicallyonline";
// const isGithubPages = process.env.GITHUB_PAGES === "true";
const isGithubPages = "false";
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  basePath: isGithubPages ? `/${REPO_NAME}` : undefined,
  assetPrefix: isGithubPages ? `/${REPO_NAME}/` : undefined,
};

export default nextConfig;
