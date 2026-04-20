import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Freelancer lane allows 50 MB PDFs × MAX_FILES_PER_UPLOAD. Leave
      // headroom over the 20 × 50 MB = 1000 MB theoretical worst case by
      // sizing for realistic batches.
      bodySizeLimit: "250mb",
    },
  },
};

export default nextConfig;
