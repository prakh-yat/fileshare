import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.leadconnectorhq.com" },
      { protocol: "https", hostname: "*.gohighlevel.com" },
      { protocol: "https", hostname: "*.msgsndr.com" },
      { protocol: "https", hostname: "msgsndr-private-storage.com" },
      { protocol: "https", hostname: "*.googleapis.com" },
      { protocol: "https", hostname: "storage.googleapis.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
