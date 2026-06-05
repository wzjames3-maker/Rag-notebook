import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@prisma/adapter-pg", "pg"],
};

export default nextConfig;
