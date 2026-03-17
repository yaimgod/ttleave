import withPWA from "next-pwa";

const pwaConfig = withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Limit webpack parallelism on low-RAM VPS builds.
  // Default is CPU count (often 4+), each worker uses ~300-400 MB.
  // Setting to 1 serialises compilation: ~700 MB peak instead of ~2 GB.
  webpack: (config, { isServer }) => {
    if (process.env.WEBPACK_SINGLE_THREADED === "1") {
      config.parallelism = 1;
    }
    return config;
  },
  images: {
    remotePatterns: [
      // Self-hosted Supabase Storage served through Kong (https)
      {
        protocol: "https",
        hostname: "**",
        pathname: "/storage/v1/object/**",
      },
      // Self-hosted Supabase Storage served through Kong (http — local dev)
      {
        protocol: "http",
        hostname: "**",
        pathname: "/storage/v1/object/**",
      },
      // Supabase Cloud — kept for local dev / migration period
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      // Google OAuth avatars
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
      // GitHub OAuth avatars
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
};

export default pwaConfig(nextConfig);
