import type { NextConfig } from "next";

process.on("uncaughtException", err => {
  console.error("[Next] uncaughtException:", err);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("[Next] unhandledRejection:", reason, promise);
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: process.env.NEXT_PUBLIC_IGNORE_BUILD_ERROR === "true",
  },
  eslint: {
    ignoreDuringBuilds: process.env.NEXT_PUBLIC_IGNORE_BUILD_ERROR === "true",
  },
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      fs: false,
      net: false,
      tls: false,
      worker_threads: false,
    };
    config.externals.push("pino-pretty", "lokijs", "encoding");

    // Exclude Node.js-specific modules from client bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        worker_threads: false,
      };

      // Ignore node-localstorage in client bundle (it's Node.js only)
      // GoogleAuthenticator doesn't use storage, so this is safe
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const webpack = require("webpack");
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^node-localstorage$/,
        }),
      );
    }

    // Use TypeScript loader for API routes to support decorator metadata
    if (isServer) {
      const originalEntry = config.entry;
      config.entry = async () => {
        const entries = await originalEntry();
        return entries;
      };
    }

    return config;
  },
};

const isIpfs = process.env.NEXT_PUBLIC_IPFS_BUILD === "true";

if (isIpfs) {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;
  nextConfig.images = {
    unoptimized: true,
  };
}

module.exports = nextConfig;
